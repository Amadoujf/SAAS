import "server-only";
import { z } from "zod";
import {
  withTenant,
  bookTestDrive,
  cancelTestDriveAsGuest,
  getImportByToken,
  getTestDriveByToken,
  isIsoDate,
  submitLeadRequest,
  testDriveSlots,
  AutoError,
  InvalidReservationTransitionError,
  ReservationNotFoundError,
  ReservationUnavailableError,
} from "@yamacommerce/database";
import { RedisRateLimiter, redisConnection } from "@yamacommerce/queue";
import { dispatchAutoNotifications, planAutoNotifications } from "./notify";

const limiter = new RedisRateLimiter(redisConnection);
const TOKEN_RE = /^[0-9a-f-]{36}$/;

export class AutoPublicError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
  }
}

const wrap = async <T>(fn: () => Promise<T>): Promise<T> => {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof AutoPublicError) throw error;
    if (error instanceof AutoError || error instanceof ReservationUnavailableError) throw new AutoPublicError(error.message, 409);
    if (error instanceof ReservationNotFoundError) throw new AutoPublicError("Essai introuvable.", 404);
    if (error instanceof InvalidReservationTransitionError) throw new AutoPublicError("Cet essai ne peut plus être modifié en ligne : appelez le showroom.", 409);
    throw error;
  }
};

/** Véhicule publié de CETTE concession (identifiant venu du navigateur, revérifié). */
async function publishedVehicle(tenantId: string, listingId: string) {
  const v = await withTenant(tenantId, (tx) => tx.listing.findFirst({ where: { id: listingId, tenantId, type: "vehicle", status: "published", deletedAt: null }, select: { id: true } }));
  if (!v) throw new AutoPublicError("Ce véhicule n'est plus proposé.", 404);
  return v.id;
}

export async function publicTestDriveSlots(tenantId: string, q: { listingId: string; date: string }) {
  if (!isIsoDate(q.date)) throw new AutoPublicError("Date invalide.");
  if (!z.string().uuid().safeParse(q.listingId).success) throw new AutoPublicError("Véhicule invalide.");
  const listingId = await publishedVehicle(tenantId, q.listingId);
  const r = await wrap(() => withTenant(tenantId, (tx) => testDriveSlots(tx, tenantId, listingId, q.date)));
  return { date: r.date, bookable: r.bookable, slots: r.slots.map((s) => ({ minute: s.minute, available: s.available })) };
}

export const testDriveSchema = z.object({
  listingId: z.string().uuid(),
  date: z.string().refine(isIsoDate, "Choisissez une date."),
  minute: z.number().int().min(0).max(1439),
  firstName: z.string().trim().min(1, "Indiquez votre prénom.").max(80),
  lastName: z.string().trim().max(80).optional().default(""),
  phone: z.string().trim().min(6, "Indiquez votre téléphone.").max(20),
  email: z.string().trim().email("E-mail invalide.").max(160).optional().or(z.literal("")).default(""),
  licenseConfirmed: z.literal(true, { errorMap: () => ({ message: "Confirmez que vous avez un permis de conduire valide." }) }),
  note: z.string().trim().max(400).optional().default(""),
});

/** Essai sur rendez-vous : créneau revérifié sous verrou, jamais deux essais qui se chevauchent. */
export async function submitTestDrive(tenantId: string, clientKey: string, raw: unknown) {
  const parsed = testDriveSchema.safeParse(raw);
  if (!parsed.success) throw new AutoPublicError(parsed.error.issues[0]?.message ?? "Formulaire incomplet.");
  const i = parsed.data;
  const rate = await limiter.consume(`auto-drive:${tenantId}:${clientKey}`, 5, 30 * 60_000);
  if (!rate.allowed) throw new AutoPublicError("Trop de demandes envoyées. Réessayez plus tard ou appelez le showroom.", 429);
  const listingId = await publishedVehicle(tenantId, i.listingId);
  const r = await wrap(() =>
    withTenant(tenantId, async (tx) => {
      const td = await bookTestDrive(tx, tenantId, {
        listingId,
        date: i.date,
        minute: i.minute,
        customer: { firstName: i.firstName, lastName: i.lastName || null, phone: i.phone, email: i.email || null },
        licenseConfirmed: i.licenseConfirmed,
        note: i.note || null,
        channel: "web",
        actor: { userId: null, type: "customer" },
      });
      const planned = await planAutoNotifications(tx, tenantId, { reservationId: td.id }, "test_drive_confirmed");
      return { reference: td.reference, accessToken: td.accessToken, planned };
    }),
  );
  await dispatchAutoNotifications(tenantId, r.planned);
  return r;
}

export async function cancelTestDriveForGuest(tenantId: string, token: string) {
  if (!TOKEN_RE.test(token)) throw new AutoPublicError("Essai introuvable.", 404);
  const planned = await wrap(() =>
    withTenant(tenantId, async (tx) => {
      const td = await cancelTestDriveAsGuest(tx, tenantId, token);
      return planAutoNotifications(tx, tenantId, { reservationId: td.id }, "test_drive_canceled");
    }),
  );
  await dispatchAutoNotifications(tenantId, planned);
}

export function getTestDriveForGuest(tenantId: string, token: string) {
  if (!TOKEN_RE.test(token)) return Promise.resolve(null);
  return withTenant(tenantId, (tx) => getTestDriveByToken(tx, tenantId, token));
}

export function getImportForGuest(tenantId: string, token: string) {
  if (!TOKEN_RE.test(token)) return Promise.resolve(null);
  return withTenant(tenantId, (tx) => getImportByToken(tx, tenantId, token));
}

export const leadSchema = z.object({
  listingId: z.string().uuid().optional().nullable(),
  interest: z.enum(["purchase", "trade_in", "financing", "import_request"]),
  firstName: z.string().trim().min(1, "Indiquez votre prénom.").max(80),
  lastName: z.string().trim().max(80).optional().default(""),
  phone: z.string().trim().min(6, "Indiquez votre téléphone.").max(20),
  email: z.string().trim().email("E-mail invalide.").max(160).optional().or(z.literal("")).default(""),
  budget: z.number().int().positive().max(5_000_000_000).optional().nullable(),
  tradeIn: z.string().trim().max(200).optional().default(""),
  message: z.string().trim().max(800).optional().default(""),
});

/** Demande (achat, reprise, financement, importation sur commande) : prospect créé ou enrichi. */
export async function submitVehicleLead(tenantId: string, clientKey: string, raw: unknown) {
  const parsed = leadSchema.safeParse(raw);
  if (!parsed.success) throw new AutoPublicError(parsed.error.issues[0]?.message ?? "Formulaire incomplet.");
  const i = parsed.data;
  const rate = await limiter.consume(`auto-lead:${tenantId}:${clientKey}`, 6, 30 * 60_000);
  if (!rate.allowed) throw new AutoPublicError("Trop de demandes envoyées. Réessayez plus tard ou appelez le showroom.", 429);
  const listingId = i.listingId ? await publishedVehicle(tenantId, i.listingId) : null;
  const planned = await wrap(() =>
    withTenant(tenantId, async (tx) => {
      const lead = await submitLeadRequest(tx, tenantId, {
        listingId,
        interest: i.interest,
        customer: { firstName: i.firstName, lastName: i.lastName || null, phone: i.phone, email: i.email || null },
        budget: i.budget ?? null,
        tradeIn: i.tradeIn || null,
        message: i.message || null,
        source: "web",
        actor: { userId: null, type: "customer" },
      });
      return planAutoNotifications(tx, tenantId, { leadId: lead.id }, "vehicle_lead_received");
    }),
  );
  await dispatchAutoNotifications(tenantId, planned);
}
