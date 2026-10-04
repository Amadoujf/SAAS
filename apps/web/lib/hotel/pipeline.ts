import "server-only";
import { z } from "zod";
import {
  withTenant,
  addRoom,
  bookStay,
  changeStay,
  checkIn,
  checkOut,
  createRoomType,
  deleteListing,
  isIsoDate,
  markNoShow,
  recordReservationPayment,
  removeRate,
  searchAvailability,
  setListingStatus,
  setMediaAssetPublic,
  setRate,
  setRoomHousekeeping,
  transitionReservationStatus,
  updateHotelSettings,
  updateRoom,
  updateRoomType,
  voidReservationPayment,
  HOUSEKEEPING_STATUSES,
  HotelError,
  InvalidListingInputError,
  InvalidListingTransitionError,
  InvalidReservationTransitionError,
  ListingConflictError,
  ListingHasActiveReservationsError,
  ListingNotFoundError,
  QuotaExceededError,
  ReservationNotFoundError,
  ReservationUnavailableError,
  ROOM_AMENITIES,
  STAYS_MODULE,
  TRAVEL_PAYMENT_METHODS,
  TravelError,
} from "@yamacommerce/database";
import type { Permission } from "@yamacommerce/auth";
import { getCurrentTenantMembership } from "@/lib/current-tenant";
import { requireTenantPermission } from "@/lib/tenant-permissions";
import { checkImage } from "@/lib/media/image-refs";
import { getTenantModuleKeys, isHotel } from "@/lib/modules/tenant-modules";

/**
 * Actions hôtel du tableau de bord. Chaque action revérifie côté serveur la permission
 * précise du membre, la RLS isole l'établissement, et les règles métier (chambre libre,
 * prix nuit par nuit, encaissements) vivent dans le registre (packages/database).
 */

export type ActionResult<T = unknown> = { ok: true; data: T } | { ok: false; status: number; error: string };

const optionalText = (max: number) => z.string().trim().max(max).nullable().optional().transform((v) => (v ? v : null));
const isoDate = z.string().refine(isIsoDate, "Date invalide.");

export const roomTypeSchema = z.object({
  title: z.string().trim().min(2, "Nom trop court.").max(120),
  summary: optionalText(220),
  description: optionalText(3_000),
  nightlyPrice: z.number().int().min(0).max(100_000_000).nullable(),
  maxAdults: z.number().int().min(1).max(30),
  maxChildren: z.number().int().min(0).max(20),
  bedSummary: z.string().trim().min(1, "Décrivez la literie.").max(80),
  sizeM2: z.number().int().min(1).max(5000).nullable(),
  amenities: z.array(z.enum(ROOM_AMENITIES)).max(ROOM_AMENITIES.length),
  minNights: z.number().int().min(1).max(60),
  checkInMinute: z.number().int().min(0).max(1439),
  checkOutMinute: z.number().int().min(0).max(1439),
  depositPercent: z.number().int().min(0).max(100),
  featured: z.boolean(),
  media: z.array(z.object({ url: z.string().trim().max(300), alt: z.string().trim().max(140).default(""), demo: z.boolean().optional() })).max(12),
});
export type RoomTypeFormInput = z.infer<typeof roomTypeSchema>;

const deskSchema = z.object({
  listingId: z.string().uuid(),
  roomId: z.string().uuid().nullable(),
  arrival: isoDate,
  departure: isoDate,
  adults: z.number().int().min(1).max(30),
  children: z.number().int().min(0).max(20),
  firstName: z.string().trim().min(1, "Indiquez le prénom.").max(80),
  lastName: optionalText(80),
  phone: z.string().trim().min(6, "Indiquez le téléphone.").max(20),
  note: optionalText(600),
  channel: z.enum(["phone", "dashboard", "whatsapp"]),
});

async function context(permission: Permission) {
  const membership = await getCurrentTenantMembership();
  if (!membership) return null;
  if (!isHotel(await getTenantModuleKeys(membership.tenantId))) return null;
  const actor = await requireTenantPermission(membership.tenantId, permission);
  if (!actor) return null;
  return { tenantId: membership.tenantId, userId: actor.userId, actorType: (membership.roleName === "OWNER" ? "owner" : "employee") as "owner" | "employee" };
}

const DENIED = { ok: false as const, status: 403, error: "Action non autorisée." };

function toError(error: unknown): { ok: false; status: number; error: string } {
  if (error instanceof QuotaExceededError) return { ok: false, status: 402, error: `Votre formule inclut ${error.limit} fiches. Passez à une formule supérieure pour ajouter d'autres types de chambres.` };
  if (
    error instanceof HotelError || error instanceof TravelError || error instanceof InvalidListingInputError || error instanceof InvalidListingTransitionError ||
    error instanceof ListingConflictError || error instanceof ListingHasActiveReservationsError || error instanceof ListingNotFoundError ||
    error instanceof InvalidReservationTransitionError || error instanceof ReservationNotFoundError || error instanceof ReservationUnavailableError
  ) {
    return { ok: false, status: 409, error: error.message };
  }
  if (error instanceof Error && error.message.startsWith("Image")) return { ok: false, status: 400, error: error.message };
  // eslint-disable-next-line no-console
  console.error("[hotel]", error);
  return { ok: false, status: 400, error: "Action impossible pour le moment." };
}

function firstIssue(error: z.ZodError) {
  const issue = error.issues[0];
  return issue ? `${issue.path.join(" › ") || "Formulaire"} : ${issue.message}` : "Données invalides.";
}

type Tx = Parameters<Parameters<typeof withTenant>[1]>[0];
const run = async <T>(permission: Permission, fn: (ctx: NonNullable<Awaited<ReturnType<typeof context>>>, tx: Tx) => Promise<T>): Promise<ActionResult<T>> => {
  const ctx = await context(permission);
  if (!ctx) return DENIED;
  try {
    return { ok: true, data: await withTenant(ctx.tenantId, (tx) => fn(ctx, tx)) };
  } catch (error) {
    return toError(error);
  }
};

async function assertStay(tx: Tx, tenantId: string, reservationId: string) {
  const r = await tx.reservation.findFirst({ where: { id: reservationId, tenantId, moduleKey: STAYS_MODULE }, select: { id: true } });
  if (!r) throw new ReservationNotFoundError();
}

// --- Types de chambres, chambres, tarifs, règles -------------------------------------

export async function saveRoomType(listingId: string | null, raw: unknown) {
  const parsed = roomTypeSchema.safeParse(raw);
  if (!parsed.success) return { ok: false as const, status: 400, error: firstIssue(parsed.error) };
  const input = parsed.data;
  return run(listingId ? "listings.edit" : "listings.create", async (ctx, tx) => {
    const ids = new Set<string>();
    for (const m of input.media) {
      const problem = checkImage(m.url, ids);
      if (problem) throw new Error(problem.startsWith("Image") ? problem : `Image : ${problem}`);
    }
    if (ids.size && (await tx.mediaAsset.count({ where: { tenantId: ctx.tenantId, id: { in: [...ids] }, status: "READY" } })) !== ids.size) throw new Error("Image introuvable dans votre médiathèque.");
    for (const id of ids) await setMediaAssetPublic(tx, ctx.tenantId, id, true);
    const saved = listingId ? await updateRoomType(tx, ctx.tenantId, listingId, input, ctx.userId) : await createRoomType(tx, ctx.tenantId, input, ctx.userId);
    return { id: saved.id };
  });
}

export const changeRoomTypeStatus = (listingId: string, status: "draft" | "published" | "unavailable" | "archived") =>
  run("listings.publish", async (ctx, tx) => {
    const t = await tx.listing.findFirst({ where: { id: listingId, tenantId: ctx.tenantId, type: "room" }, include: { roomType: { select: { rooms: { where: { isActive: true }, select: { id: true } } } } } });
    if (!t) throw new ListingNotFoundError(listingId);
    if (status === "published" && !(Array.isArray(t.media) && t.media.length)) throw new InvalidListingInputError("Ajoutez au moins une photo avant de mettre ce type en ligne.");
    if (status === "published" && !t.roomType?.rooms.length) throw new InvalidListingInputError("Ajoutez au moins une chambre de ce type avant de le mettre en ligne.");
    await setListingStatus(tx, ctx.tenantId, listingId, status, ctx.userId);
    return null;
  });

export const removeRoomType = (listingId: string) => run("listings.delete", (ctx, tx) => deleteListing(tx, ctx.tenantId, listingId, ctx.userId).then(() => null));

export const createRoom = (listingId: string, number: string, floor: string | null) => run("listings.manage_availability", (ctx, tx) => addRoom(tx, ctx.tenantId, { listingId, number, floor }).then((r) => ({ id: r.id })));

export const editRoom = (roomId: string, patch: { number?: string; floor?: string | null; isActive?: boolean; listingId?: string }) =>
  run("listings.manage_availability", (ctx, tx) => updateRoom(tx, ctx.tenantId, roomId, patch).then(() => null));

/** Ménage : l'équipe de réception ou d'étage change l'état d'une chambre. */
export const changeHousekeeping = (roomId: string, status: string, note?: string | null) =>
  run("reservations.update_status", async (ctx, tx) => {
    if (!(HOUSEKEEPING_STATUSES as readonly string[]).includes(status)) throw new HotelError("État inconnu.");
    await setRoomHousekeeping(tx, ctx.tenantId, roomId, status as (typeof HOUSEKEEPING_STATUSES)[number], note);
    return null;
  });

export const addRate = (raw: unknown) => {
  const p = z.object({ listingId: z.string().uuid(), startDate: isoDate, endDate: isoDate, nightlyPrice: z.number().int().min(0).max(100_000_000), label: optionalText(60) }).safeParse(raw);
  if (!p.success) return Promise.resolve({ ok: false as const, status: 400, error: firstIssue(p.error) });
  return run("listings.edit", (ctx, tx) => setRate(tx, ctx.tenantId, p.data).then(() => null));
};

export const deleteRate = (rateId: string) => run("listings.edit", (ctx, tx) => removeRate(tx, ctx.tenantId, rateId).then(() => null));

export const saveHotelSettings = (raw: unknown) => {
  const p = z.object({ autoConfirm: z.boolean(), cancelFreeHours: z.number().int().min(0).max(720), maxAdvanceDays: z.number().int().min(1).max(730), maxNights: z.number().int().min(1).max(365) }).safeParse(raw);
  if (!p.success) return Promise.resolve({ ok: false as const, status: 400, error: firstIssue(p.error) });
  return run("listings.manage_availability", (ctx, tx) => updateHotelSettings(tx, ctx.tenantId, p.data).then(() => null));
};

// --- Séjours --------------------------------------------------------------------------

/** Chambres libres et prix par type pour des dates (réception, sans règles du site). */
export const deskAvailability = (q: { arrival: string; departure: string; adults: number; children: number }) =>
  run("reservations.view", async (ctx, tx) => {
    const r = await searchAvailability(tx, ctx.tenantId, { ...q, public: false });
    const rooms = await tx.hotelRoom.findMany({ where: { tenantId: ctx.tenantId, isActive: true, housekeeping: { not: "out_of_service" } }, orderBy: { number: "asc" } });
    const busy = new Set(
      (await tx.hotelStay.findMany({ where: { tenantId: ctx.tenantId, active: true, arrival: { lt: new Date(`${q.departure}T00:00:00Z`) }, departure: { gt: new Date(`${q.arrival}T00:00:00Z`) } }, select: { roomId: true } })).map((s) => s.roomId),
    );
    return r.results.map((x) => ({
      listingId: x.listing.id,
      title: x.listing.title,
      nights: x.nights,
      total: x.total,
      bookable: x.bookable,
      reason: x.reason,
      freeRooms: rooms.filter((room) => room.listingId === x.listing.id && !busy.has(room.id)).map((room) => ({ id: room.id, number: room.number, housekeeping: room.housekeeping })),
    }));
  });

export async function createDeskStay(raw: unknown) {
  const p = deskSchema.safeParse(raw);
  if (!p.success) return { ok: false as const, status: 400, error: firstIssue(p.error) };
  const b = p.data;
  return run("reservations.update_status", async (ctx, tx) => {
    const s = await bookStay(tx, ctx.tenantId, {
      listingId: b.listingId,
      roomId: b.roomId,
      arrival: b.arrival,
      departure: b.departure,
      adults: b.adults,
      children: b.children,
      customer: { firstName: b.firstName, lastName: b.lastName, phone: b.phone },
      customerNote: b.note,
      channel: b.channel,
      actor: { userId: ctx.userId, type: ctx.actorType },
    });
    return { id: s!.id };
  });
}

export const stayAction = (reservationId: string, action: "confirm" | "check_in" | "check_out" | "no_show" | "cancel", note?: string) =>
  run(action === "cancel" ? "reservations.cancel" : "reservations.update_status", async (ctx, tx) => {
    await assertStay(tx, ctx.tenantId, reservationId);
    const actor = { userId: ctx.userId, type: ctx.actorType };
    if (action === "confirm") await transitionReservationStatus(tx, ctx.tenantId, { reservationId, toStatus: "confirmed", actor });
    else if (action === "check_in") await checkIn(tx, ctx.tenantId, reservationId, actor);
    else if (action === "check_out") await checkOut(tx, ctx.tenantId, reservationId, actor);
    else if (action === "no_show") await markNoShow(tx, ctx.tenantId, reservationId, actor);
    else {
      const stay = await tx.hotelStay.findFirstOrThrow({ where: { reservationId, tenantId: ctx.tenantId } });
      if (stay.checkedInAt && !stay.checkedOutAt) throw new HotelError("Le client est arrivé : enregistrez son départ plutôt qu'une annulation.");
      await transitionReservationStatus(tx, ctx.tenantId, { reservationId, toStatus: "canceled", actor, note });
    }
    return null;
  });

export const modifyStay = (reservationId: string, patch: { roomId?: string; arrival?: string; departure?: string }) =>
  run("reservations.update_status", async (ctx, tx) => {
    await assertStay(tx, ctx.tenantId, reservationId);
    await changeStay(tx, ctx.tenantId, { reservationId, ...patch, actor: { userId: ctx.userId, type: ctx.actorType } });
    return null;
  });

export const recordStayPayment = (raw: unknown) => {
  const p = z.object({ reservationId: z.string().uuid(), amount: z.number().int().min(1).max(1_000_000_000), method: z.enum(TRAVEL_PAYMENT_METHODS), kind: z.enum(["deposit", "balance", "other"]), reference: optionalText(80) }).safeParse(raw);
  if (!p.success) return Promise.resolve({ ok: false as const, status: 400, error: firstIssue(p.error) });
  return run("reservation_payments.record", async (ctx, tx) => {
    await assertStay(tx, ctx.tenantId, p.data.reservationId);
    const pay = await recordReservationPayment(tx, ctx.tenantId, { ...p.data, actorUserId: ctx.userId });
    return { receiptNumber: pay.receiptNumber };
  });
};

export const voidStayPayment = (paymentId: string, reason: string) =>
  run("reservation_payments.record", async (ctx, tx) => {
    const pay = await tx.reservationPayment.findFirst({ where: { id: paymentId, tenantId: ctx.tenantId, reservation: { moduleKey: STAYS_MODULE } }, select: { id: true } });
    if (!pay) throw new HotelError("Encaissement introuvable.");
    await voidReservationPayment(tx, ctx.tenantId, paymentId, reason);
    return null;
  });
