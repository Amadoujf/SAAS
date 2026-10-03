import "server-only";
import { z } from "zod";
import {
  withTenant,
  bookAppointment,
  cancelAppointmentAsGuest,
  computeAvailability,
  getAppointmentByToken,
  isIsoDate,
  openDays,
  rescheduleAppointment,
  utcToLocal,
  InvalidReservationTransitionError,
  ReservationNotFoundError,
  ReservationUnavailableError,
  ServiceError,
} from "@yamacommerce/database";
import { RedisRateLimiter, redisConnection } from "@yamacommerce/queue";

const limiter = new RedisRateLimiter(redisConnection);

export class SalonPublicError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
  }
}

const uuid = z.string().uuid();
const TOKEN_RE = /^[0-9a-f-]{36}$/;

async function publishedService(tenantId: string, slug: string) {
  const s = await withTenant(tenantId, (tx) =>
    tx.listing.findFirst({ where: { tenantId, slug, type: "service_offering", status: "published", deletedAt: null }, select: { id: true, service: { select: { onlineBooking: true } } } }),
  );
  if (!s?.service) throw new SalonPublicError("Cette prestation n'est plus proposée.", 404);
  if (!s.service.onlineBooking) throw new SalonPublicError("Cette prestation se réserve par téléphone.", 409);
  return s.id;
}

const wrap = async <T>(fn: () => Promise<T>): Promise<T> => {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof SalonPublicError) throw error;
    if (error instanceof ServiceError || error instanceof ReservationUnavailableError) throw new SalonPublicError(error.message, 409);
    if (error instanceof ReservationNotFoundError) throw new SalonPublicError("Rendez-vous introuvable.", 404);
    if (error instanceof InvalidReservationTransitionError) throw new SalonPublicError("Ce rendez-vous ne peut plus être modifié en ligne : appelez le salon.", 409);
    throw error;
  }
};

/** Horaires libres d'une prestation publiée un jour donné (heures locales du salon). */
export async function publicSlots(tenantId: string, q: { service: string; date: string; staff?: string | null }) {
  if (!isIsoDate(q.date)) throw new SalonPublicError("Date invalide.");
  if (q.staff && !uuid.safeParse(q.staff).success) throw new SalonPublicError("Personne inconnue.");
  const listingId = await publishedService(tenantId, q.service);
  return wrap(() =>
    withTenant(tenantId, async (tx) => {
      const r = await computeAvailability(tx, tenantId, { listingId, date: q.date, staffId: q.staff || null, public: true });
      return r.slots.map((s) => ({ startAt: s.startAt.toISOString(), minute: utcToLocal(s.startAt, r.timezone).minute, staffIds: s.staffIds }));
    }),
  );
}

/** Nombre d'horaires libres par jour sur les prochains jours (bande des dates). */
export async function publicDays(tenantId: string, q: { service: string; from: string; staff?: string | null; days?: number }) {
  if (!isIsoDate(q.from)) throw new SalonPublicError("Date invalide.");
  if (q.staff && !uuid.safeParse(q.staff).success) throw new SalonPublicError("Personne inconnue.");
  const listingId = await publishedService(tenantId, q.service);
  return wrap(() => withTenant(tenantId, (tx) => openDays(tx, tenantId, { listingId, staffId: q.staff || null, public: true, from: q.from, days: Math.min(q.days ?? 14, 21) })));
}

export const salonBookingSchema = z.object({
  service: z.string().min(1).max(120),
  staffId: z.string().uuid().nullable().optional(),
  startAt: z.string().datetime({ message: "Choisissez un horaire." }),
  firstName: z.string().trim().min(1, "Indiquez votre prénom.").max(80),
  lastName: z.string().trim().max(80).optional().default(""),
  phone: z.string().trim().min(6, "Indiquez votre téléphone.").max(20),
  email: z.string().trim().email("E-mail invalide.").max(200).optional().or(z.literal("")),
  note: z.string().trim().max(500).optional().default(""),
});

/**
 * Rendez-vous pris sur le site : prestation PUBLIÉE et réservable en ligne de ce salon,
 * horaire revérifié par le serveur (heures, absences, chevauchement, délais), prix de la
 * fiche (le navigateur n'envoie aucun prix). Fréquence limitée par visiteur.
 */
export async function submitSalonBooking(tenantId: string, clientKey: string, raw: unknown) {
  const parsed = salonBookingSchema.safeParse(raw);
  if (!parsed.success) throw new SalonPublicError(parsed.error.issues[0]?.message ?? "Formulaire incomplet.");
  const input = parsed.data;
  const rate = await limiter.consume(`salon-booking:${tenantId}:${clientKey}`, 6, 30 * 60_000);
  if (!rate.allowed) throw new SalonPublicError("Trop de demandes envoyées. Réessayez un peu plus tard ou appelez le salon.", 429);
  const listingId = await publishedService(tenantId, input.service);
  return wrap(() =>
    withTenant(tenantId, async (tx) => {
      const appt = await bookAppointment(tx, tenantId, {
        listingId,
        staffId: input.staffId ?? null,
        startAt: new Date(input.startAt),
        customer: { firstName: input.firstName, lastName: input.lastName || null, phone: input.phone, email: input.email || null },
        customerNote: input.note || null,
        channel: "web",
        actor: { userId: null, type: "customer" },
      });
      return { reference: appt!.reference, accessToken: appt!.accessToken };
    }),
  );
}

/** Le client retrouve SON rendez-vous par son jeton (jamais un autre, jamais d'un autre salon). */
export function getAppointmentForGuest(tenantId: string, token: string) {
  if (!TOKEN_RE.test(token)) return Promise.resolve(null);
  return withTenant(tenantId, (tx) => getAppointmentByToken(tx, tenantId, token));
}

export async function cancelSalonAppointmentAsGuest(tenantId: string, token: string) {
  if (!TOKEN_RE.test(token)) throw new SalonPublicError("Rendez-vous introuvable.", 404);
  await wrap(() => withTenant(tenantId, (tx) => cancelAppointmentAsGuest(tx, tenantId, token)));
}

export async function rescheduleSalonAppointmentAsGuest(tenantId: string, clientKey: string, raw: unknown) {
  const parsed = z.object({ token: z.string().regex(TOKEN_RE), startAt: z.string().datetime(), staffId: z.string().uuid().nullable().optional() }).safeParse(raw);
  if (!parsed.success) throw new SalonPublicError("Choisissez un nouvel horaire.");
  const rate = await limiter.consume(`salon-move:${tenantId}:${clientKey}`, 8, 30 * 60_000);
  if (!rate.allowed) throw new SalonPublicError("Trop de modifications. Appelez le salon.", 429);
  const { token, startAt, staffId } = parsed.data;
  await wrap(() =>
    withTenant(tenantId, async (tx) => {
      const appt = await getAppointmentByToken(tx, tenantId, token);
      if (!appt) throw new ReservationNotFoundError();
      await rescheduleAppointment(tx, tenantId, { reservationId: appt.id, startAt: new Date(startAt), staffId: staffId ?? null, actor: { userId: null, type: "customer" } });
    }),
  );
}
