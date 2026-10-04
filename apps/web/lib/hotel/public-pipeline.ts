import "server-only";
import { z } from "zod";
import {
  withTenant,
  bookStay,
  cancelStayAsGuest,
  getStayByToken,
  isIsoDate,
  roomTypeCalendar,
  HotelError,
  InvalidReservationTransitionError,
  ReservationNotFoundError,
  ReservationUnavailableError,
} from "@yamacommerce/database";
import { RedisRateLimiter, redisConnection } from "@yamacommerce/queue";

const limiter = new RedisRateLimiter(redisConnection);
const TOKEN_RE = /^[0-9a-f-]{36}$/;

export class HotelPublicError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
  }
}

const wrap = async <T>(fn: () => Promise<T>): Promise<T> => {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof HotelPublicError) throw error;
    if (error instanceof HotelError || error instanceof ReservationUnavailableError) throw new HotelPublicError(error.message, 409);
    if (error instanceof ReservationNotFoundError) throw new HotelPublicError("Séjour introuvable.", 404);
    if (error instanceof InvalidReservationTransitionError) throw new HotelPublicError("Ce séjour ne peut plus être modifié en ligne : contactez l'établissement.", 409);
    throw error;
  }
};

async function publishedType(tenantId: string, slug: string) {
  const t = await withTenant(tenantId, (tx) => tx.listing.findFirst({ where: { tenantId, slug, type: "room", status: "published", deletedAt: null }, select: { id: true } }));
  if (!t) throw new HotelPublicError("Ce type de chambre n'est plus proposé.", 404);
  return t.id;
}

/** Calendrier d'un type (chambres libres et prix par nuit) sur ~2 mois. */
export async function publicCalendar(tenantId: string, q: { type: string; from: string }) {
  if (!isIsoDate(q.from)) throw new HotelPublicError("Date invalide.");
  const id = await publishedType(tenantId, q.type);
  return wrap(() => withTenant(tenantId, (tx) => roomTypeCalendar(tx, tenantId, id, q.from, 62)));
}

const date = z.string().refine(isIsoDate, "Choisissez vos dates.");
export const hotelBookingSchema = z.object({
  type: z.string().min(1).max(120),
  arrival: date,
  departure: date,
  adults: z.number().int().min(1).max(30),
  children: z.number().int().min(0).max(20),
  firstName: z.string().trim().min(1, "Indiquez votre prénom.").max(80),
  lastName: z.string().trim().min(1, "Indiquez votre nom.").max(80),
  phone: z.string().trim().min(6, "Indiquez votre téléphone.").max(20),
  email: z.string().trim().email("E-mail invalide.").max(200).optional().or(z.literal("")),
  note: z.string().trim().max(600).optional().default(""),
});

/**
 * Réservation depuis le site : type PUBLIÉ de cet établissement, chambre libre attribuée
 * sous verrou, prix nuit par nuit recalculé par le serveur (le navigateur n'envoie aucun
 * prix). Fréquence limitée par visiteur. Rien n'est débité en ligne.
 */
export async function submitHotelBooking(tenantId: string, clientKey: string, raw: unknown) {
  const parsed = hotelBookingSchema.safeParse(raw);
  if (!parsed.success) throw new HotelPublicError(parsed.error.issues[0]?.message ?? "Formulaire incomplet.");
  const i = parsed.data;
  const rate = await limiter.consume(`hotel-booking:${tenantId}:${clientKey}`, 5, 30 * 60_000);
  if (!rate.allowed) throw new HotelPublicError("Trop de demandes envoyées. Réessayez plus tard ou appelez l'établissement.", 429);
  const listingId = await publishedType(tenantId, i.type);
  return wrap(() =>
    withTenant(tenantId, async (tx) => {
      const s = await bookStay(tx, tenantId, {
        listingId,
        arrival: i.arrival,
        departure: i.departure,
        adults: i.adults,
        children: i.children,
        customer: { firstName: i.firstName, lastName: i.lastName, phone: i.phone, email: i.email || null },
        customerNote: i.note || null,
        channel: "web",
        actor: { userId: null, type: "customer" },
      });
      return { reference: s!.reference, accessToken: s!.accessToken };
    }),
  );
}

export function getStayForGuest(tenantId: string, token: string) {
  if (!TOKEN_RE.test(token)) return Promise.resolve(null);
  return withTenant(tenantId, (tx) => getStayByToken(tx, tenantId, token));
}

export async function cancelHotelStayAsGuest(tenantId: string, token: string) {
  if (!TOKEN_RE.test(token)) throw new HotelPublicError("Séjour introuvable.", 404);
  await wrap(() => withTenant(tenantId, (tx) => cancelStayAsGuest(tx, tenantId, token)));
}
