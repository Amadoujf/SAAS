import "server-only";
import { z } from "zod";
import {
  withTenant,
  bookingSlots,
  bookTable,
  cancelBookingAsGuest,
  cancelOrderAsGuest,
  getOrderByToken,
  getTableBookingByToken,
  getTableByQr,
  isIsoDate,
  placeOrder,
  InvalidReservationTransitionError,
  ReservationNotFoundError,
  RestaurantError,
} from "@yamacommerce/database";
import { RedisRateLimiter, redisConnection } from "@yamacommerce/queue";
import { dispatchRestaurantNotifications, planRestaurantNotifications } from "./notify";

const limiter = new RedisRateLimiter(redisConnection);
const TOKEN_RE = /^[0-9a-f-]{36}$/;

export class RestaurantPublicError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
  }
}

const wrap = async <T>(fn: () => Promise<T>): Promise<T> => {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof RestaurantPublicError) throw error;
    if (error instanceof RestaurantError) throw new RestaurantPublicError(error.message, 409);
    if (error instanceof ReservationNotFoundError) throw new RestaurantPublicError("Réservation introuvable.", 404);
    if (error instanceof InvalidReservationTransitionError) throw new RestaurantPublicError("Cette réservation ne peut plus être modifiée en ligne : appelez le restaurant.", 409);
    throw error;
  }
};

const phone = z.string().trim().max(20);
export const orderSchema = z.object({
  mode: z.enum(["dine_in", "takeaway", "delivery"]),
  tableQrToken: z.string().regex(TOKEN_RE).optional().nullable(),
  items: z
    .array(z.object({ dishId: z.string().uuid(), quantity: z.number().int().min(1).max(50), optionIds: z.array(z.string().uuid()).max(40).default([]), note: z.string().trim().max(200).optional().default("") }))
    .min(1, "Votre commande est vide.")
    .max(40),
  firstName: z.string().trim().min(1, "Indiquez votre prénom.").max(80),
  phone: phone.optional().default(""),
  /** Heure de retrait / livraison (ISO), ou vide = dès que possible. */
  requestedFor: z.string().datetime().optional().nullable(),
  deliveryAddress: z.string().trim().max(300).optional().default(""),
  note: z.string().trim().max(400).optional().default(""),
});

/**
 * Commande depuis le site ou le QR code d'une table : chaque ligne est RE-TARIFÉE par le
 * serveur depuis la carte (le navigateur n'envoie que des identifiants et des quantités).
 * Fréquence limitée par visiteur. Rien n'est débité en ligne.
 */
export async function submitRestaurantOrder(tenantId: string, clientKey: string, raw: unknown) {
  const parsed = orderSchema.safeParse(raw);
  if (!parsed.success) throw new RestaurantPublicError(parsed.error.issues[0]?.message ?? "Commande incomplète.");
  const i = parsed.data;
  const rate = await limiter.consume(`resto-order:${tenantId}:${clientKey}`, 8, 30 * 60_000);
  if (!rate.allowed) throw new RestaurantPublicError("Trop de commandes envoyées. Réessayez plus tard ou appelez le restaurant.", 429);
  return wrap(() =>
    withTenant(tenantId, async (tx) => {
      const o = await placeOrder(tx, tenantId, {
        mode: i.mode,
        tableQrToken: i.tableQrToken ?? null,
        items: i.items.map((l) => ({ dishId: l.dishId, quantity: l.quantity, optionIds: l.optionIds, note: l.note || null })),
        customer: { firstName: i.firstName, phone: i.phone || null },
        requestedFor: i.requestedFor ? new Date(i.requestedFor) : null,
        deliveryAddress: i.deliveryAddress || null,
        note: i.note || null,
        actor: { userId: null, type: "customer" },
      });
      const planned = await planRestaurantNotifications(tx, tenantId, { orderId: o.id }, "restaurant_order_received");
      return { number: o.number, accessToken: o.accessToken, planned };
    }),
  ).then(async (r) => {
    await dispatchRestaurantNotifications(tenantId, r.planned);
    return r;
  });
}

export function getOrderForGuest(tenantId: string, token: string) {
  if (!TOKEN_RE.test(token)) return Promise.resolve(null);
  return withTenant(tenantId, (tx) => getOrderByToken(tx, tenantId, token));
}

export async function cancelRestaurantOrderAsGuest(tenantId: string, token: string) {
  if (!TOKEN_RE.test(token)) throw new RestaurantPublicError("Commande introuvable.", 404);
  const planned = await wrap(() =>
    withTenant(tenantId, async (tx) => {
      const o = await cancelOrderAsGuest(tx, tenantId, token);
      return planRestaurantNotifications(tx, tenantId, { orderId: o.id }, "restaurant_order_canceled");
    }),
  );
  await dispatchRestaurantNotifications(tenantId, planned);
}

// ── Réservations de table ─────────────────────────────────────────────────

export async function publicBookingSlots(tenantId: string, q: { date: string; party: number }) {
  if (!isIsoDate(q.date)) throw new RestaurantPublicError("Date invalide.");
  if (!Number.isInteger(q.party) || q.party < 1 || q.party > 60) throw new RestaurantPublicError("Nombre de couverts invalide.");
  const r = await wrap(() => withTenant(tenantId, (tx) => bookingSlots(tx, tenantId, q.date, q.party)));
  return { date: r.date, maxPartySize: r.maxPartySize, acceptBookings: r.acceptBookings, slots: r.slots.map((s) => ({ minute: s.minute, available: s.available })) };
}

export const bookingSchema = z.object({
  date: z.string().refine(isIsoDate, "Choisissez une date."),
  minute: z.number().int().min(0).max(1439),
  partySize: z.number().int().min(1).max(60),
  firstName: z.string().trim().min(1, "Indiquez votre prénom.").max(80),
  lastName: z.string().trim().max(80).optional().default(""),
  phone: z.string().trim().min(6, "Indiquez votre téléphone.").max(20),
  occasion: z.string().trim().max(60).optional().default(""),
  note: z.string().trim().max(400).optional().default(""),
});

/** Réservation d'une table : couverts recomptés sous verrou (rythme et places de la salle). */
export async function submitTableBooking(tenantId: string, clientKey: string, raw: unknown) {
  const parsed = bookingSchema.safeParse(raw);
  if (!parsed.success) throw new RestaurantPublicError(parsed.error.issues[0]?.message ?? "Formulaire incomplet.");
  const i = parsed.data;
  const rate = await limiter.consume(`resto-booking:${tenantId}:${clientKey}`, 5, 30 * 60_000);
  if (!rate.allowed) throw new RestaurantPublicError("Trop de demandes envoyées. Réessayez plus tard ou appelez le restaurant.", 429);
  return wrap(() =>
    withTenant(tenantId, async (tx) => {
      const r = await bookTable(tx, tenantId, {
        date: i.date,
        minute: i.minute,
        partySize: i.partySize,
        customer: { firstName: i.firstName, lastName: i.lastName || null, phone: i.phone },
        occasion: i.occasion || null,
        customerNote: i.note || null,
        channel: "web",
        actor: { userId: null, type: "customer" },
      });
      const planned = await planRestaurantNotifications(tx, tenantId, { reservationId: r.id }, "table_booking_confirmed");
      return { reference: r.reference, accessToken: r.accessToken, planned };
    }),
  ).then(async (r) => {
    await dispatchRestaurantNotifications(tenantId, r.planned);
    return r;
  });
}

export function getBookingForGuest(tenantId: string, token: string) {
  if (!TOKEN_RE.test(token)) return Promise.resolve(null);
  return withTenant(tenantId, (tx) => getTableBookingByToken(tx, tenantId, token));
}

export async function cancelTableBookingAsGuest(tenantId: string, token: string) {
  if (!TOKEN_RE.test(token)) throw new RestaurantPublicError("Réservation introuvable.", 404);
  const planned = await wrap(() =>
    withTenant(tenantId, async (tx) => {
      const { reservation } = await cancelBookingAsGuest(tx, tenantId, token);
      return planRestaurantNotifications(tx, tenantId, { reservationId: reservation.id }, "table_booking_canceled");
    }),
  );
  await dispatchRestaurantNotifications(tenantId, planned);
}

/** Table d'un QR code (active), ou `null`. */
export async function tableForQr(tenantId: string, qrToken: string) {
  if (!TOKEN_RE.test(qrToken)) return null;
  const t = await withTenant(tenantId, (tx) => getTableByQr(tx, tenantId, qrToken));
  return t ? { label: t.label, qrToken: t.qrToken, zone: t.zone } : null;
}
