import { Prisma } from "@prisma/client";
import type { CustomerInput } from "./customer-registry";
import { createListing, InvalidListingInputError, updateListing, type ListingInput } from "./listing-registry";
import { createReservation, ReservationNotFoundError, transitionReservationStatus } from "./reservation-registry";
import { addDays, isIsoDate, localToUtc, utcToLocal } from "./service-slots";

/**
 * Hôtels et locations (secteur `hospitality`) — types de chambres, chambres physiques,
 * tarifs par période, séjours. S'appuie sur les primitives communes : un type de
 * chambre EST une fiche `type = "room"` + sa fiche technique ; un séjour EST une
 * réservation commune du module "stays" + la chambre attribuée.
 *
 * Règles tenues ici (et doublées en base) :
 * - jamais de surréservation : chaque séjour occupe une chambre précise ; le type est
 *   verrouillé pendant l'attribution et une contrainte d'exclusion interdit deux
 *   séjours actifs qui se chevauchent dans une même chambre ;
 * - le prix est calculé nuit par nuit par le serveur (tarif de la période, sinon prix
 *   de base) — jamais transmis par le navigateur ;
 * - une chambre hors service n'est jamais attribuée ;
 * - le client invité ne voit et n'annule que SON séjour (jeton), dans le délai fixé ;
 * - aucun paiement n'est simulé ; Chariow reste réservé aux abonnements.
 */

export const ROOM_MODULE = "listings";
export const STAYS_MODULE = "stays";
export const ROOM_AMENITIES = ["wifi", "air_conditioning", "tv", "minibar", "balcony", "sea_view", "garden_view", "bathtub", "workspace", "kitchenette", "breakfast", "parking", "pool"] as const;
export const HOUSEKEEPING_STATUSES = ["clean", "dirty", "inspected", "out_of_service"] as const;
export type HousekeepingStatus = (typeof HOUSEKEEPING_STATUSES)[number];

export class HotelError extends Error {}

type Tx = Prisma.TransactionClient;
type Actor = { userId: string | null; type: "owner" | "employee" | "system" | "customer" };
const DEFAULT_SETTINGS = { autoConfirm: true, cancelFreeHours: 48, maxAdvanceDays: 365, maxNights: 30 };
const ACTIVE = ["requested", "confirmed"];
const includes = <T extends readonly string[]>(list: T, v: unknown): v is T[number] => typeof v === "string" && (list as readonly string[]).includes(v);
const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const iso = (d: Date) => d.toISOString().slice(0, 10);
const nightsBetween = (a: string, b: string) => Math.round((day(b).getTime() - day(a).getTime()) / 86_400_000);

// ============================================================================
// TYPES DE CHAMBRES
// ============================================================================

export interface RoomTypeInput {
  title: string;
  slug?: string;
  summary?: string | null;
  description?: string | null;
  /** Prix de base par nuit (FCFA). Absent = sur demande. */
  nightlyPrice?: number | null;
  media?: ListingInput["media"];
  featured?: boolean;
  maxAdults: number;
  maxChildren?: number;
  bedSummary: string;
  sizeM2?: number | null;
  amenities?: string[];
  minNights?: number;
  checkInMinute?: number;
  checkOutMinute?: number;
  depositPercent?: number;
  position?: number;
}

function assertRoomType(i: Partial<RoomTypeInput>) {
  const int = (v: unknown, a: number, b: number) => Number.isInteger(v) && (v as number) >= a && (v as number) <= b;
  if (i.maxAdults !== undefined && !int(i.maxAdults, 1, 30)) throw new InvalidListingInputError("Nombre d'adultes invalide (1 à 30).");
  if (i.maxChildren !== undefined && !int(i.maxChildren, 0, 20)) throw new InvalidListingInputError("Nombre d'enfants invalide (0 à 20).");
  if (i.bedSummary !== undefined && (!i.bedSummary.trim() || i.bedSummary.trim().length > 80)) throw new InvalidListingInputError("Décrivez la literie (80 caractères au plus).");
  if (i.sizeM2 != null && !int(i.sizeM2, 1, 5000)) throw new InvalidListingInputError("Surface invalide.");
  if (i.minNights !== undefined && !int(i.minNights, 1, 60)) throw new InvalidListingInputError("Durée minimale invalide (1 à 60 nuits).");
  if (i.checkInMinute !== undefined && !int(i.checkInMinute, 0, 1439)) throw new InvalidListingInputError("Heure d'arrivée invalide.");
  if (i.checkOutMinute !== undefined && !int(i.checkOutMinute, 0, 1439)) throw new InvalidListingInputError("Heure de départ invalide.");
  if (i.depositPercent !== undefined && !int(i.depositPercent, 0, 100)) throw new InvalidListingInputError("L'acompte est un pourcentage entre 0 et 100.");
  if (i.amenities?.some((a) => !includes(ROOM_AMENITIES, a))) throw new InvalidListingInputError("Équipement inconnu.");
  if (i.nightlyPrice != null && !int(i.nightlyPrice, 0, 100_000_000)) throw new InvalidListingInputError("Prix par nuit invalide.");
}

const detailsData = (i: Partial<RoomTypeInput>) => ({
  ...(i.maxAdults !== undefined ? { maxAdults: i.maxAdults } : {}),
  ...(i.maxChildren !== undefined ? { maxChildren: i.maxChildren } : {}),
  ...(i.bedSummary !== undefined ? { bedSummary: i.bedSummary.trim() } : {}),
  ...(i.sizeM2 !== undefined ? { sizeM2: i.sizeM2 } : {}),
  ...(i.amenities !== undefined ? { amenities: [...new Set(i.amenities)] } : {}),
  ...(i.minNights !== undefined ? { minNights: i.minNights } : {}),
  ...(i.checkInMinute !== undefined ? { checkInMinute: i.checkInMinute } : {}),
  ...(i.checkOutMinute !== undefined ? { checkOutMinute: i.checkOutMinute } : {}),
  ...(i.depositPercent !== undefined ? { depositPercent: i.depositPercent } : {}),
  ...(i.position !== undefined ? { position: i.position } : {}),
});

export async function createRoomType(tx: Tx, tenantId: string, input: RoomTypeInput, actorUserId: string | null) {
  assertRoomType(input);
  const listing = await createListing(
    tx,
    tenantId,
    {
      moduleKey: ROOM_MODULE,
      type: "room",
      title: input.title,
      slug: input.slug,
      summary: input.summary,
      description: input.description,
      price: input.nightlyPrice ?? null,
      priceUnit: input.nightlyPrice == null ? "on_request" : "per_night",
      media: input.media,
      featured: input.featured,
    },
    actorUserId,
  );
  await tx.roomTypeDetails.create({ data: { listingId: listing.id, tenantId, maxAdults: input.maxAdults, bedSummary: input.bedSummary.trim(), ...detailsData(input) } });
  return getRoomType(tx, tenantId, listing.id);
}

export async function updateRoomType(tx: Tx, tenantId: string, listingId: string, patch: Partial<RoomTypeInput>, actorUserId: string | null) {
  assertRoomType(patch);
  const current = await tx.roomTypeDetails.findFirst({ where: { listingId, tenantId } });
  if (!current) throw new InvalidListingInputError("Ce type de chambre n'existe pas.");
  const details = detailsData(patch);
  if (Object.keys(details).length) await tx.roomTypeDetails.update({ where: { listingId }, data: details });
  await updateListing(
    tx,
    tenantId,
    listingId,
    {
      ...(patch.title !== undefined ? { title: patch.title } : {}),
      ...(patch.slug !== undefined ? { slug: patch.slug } : {}),
      ...(patch.summary !== undefined ? { summary: patch.summary } : {}),
      ...(patch.description !== undefined ? { description: patch.description } : {}),
      ...(patch.media !== undefined ? { media: patch.media } : {}),
      ...(patch.featured !== undefined ? { featured: patch.featured } : {}),
      ...(patch.nightlyPrice !== undefined ? { price: patch.nightlyPrice, priceUnit: patch.nightlyPrice == null ? "on_request" : "per_night" } : {}),
    },
    actorUserId,
  );
  return getRoomType(tx, tenantId, listingId);
}

const roomTypeInclude = {
  roomType: { include: { rooms: { orderBy: { number: "asc" as const } }, rates: { orderBy: { startDate: "asc" as const } } } },
} satisfies Prisma.ListingInclude;

export function getRoomType(tx: Tx, tenantId: string, listingId: string) {
  return tx.listing.findFirstOrThrow({ where: { id: listingId, tenantId, deletedAt: null, type: "room" }, include: roomTypeInclude });
}

export function listRoomTypes(tx: Tx, tenantId: string, q: { publishedOnly?: boolean } = {}) {
  return tx.listing.findMany({
    where: { tenantId, deletedAt: null, type: "room", ...(q.publishedOnly ? { status: "published" } : {}) },
    include: roomTypeInclude,
    orderBy: [{ roomType: { position: "asc" } }, { price: "asc" }],
  });
}

export function getPublishedRoomTypeBySlug(tx: Tx, tenantId: string, slug: string) {
  return tx.listing.findFirst({ where: { tenantId, slug, status: "published", deletedAt: null, type: "room" }, include: roomTypeInclude });
}

// ============================================================================
// CHAMBRES ET MÉNAGE
// ============================================================================

export async function addRoom(tx: Tx, tenantId: string, input: { listingId: string; number: string; floor?: string | null; note?: string | null }) {
  const number = input.number.trim();
  if (!number || number.length > 20) throw new HotelError("Numéro de chambre invalide.");
  const type = await tx.roomTypeDetails.findFirst({ where: { listingId: input.listingId, tenantId }, select: { listingId: true } });
  if (!type) throw new HotelError("Type de chambre introuvable.");
  const clash = await tx.hotelRoom.findFirst({ where: { tenantId, number }, select: { id: true } });
  if (clash) throw new HotelError(`La chambre ${number} existe déjà.`);
  return tx.hotelRoom.create({ data: { tenantId, listingId: input.listingId, number, floor: input.floor?.trim() || null, note: input.note?.trim() || null } });
}

export async function updateRoom(tx: Tx, tenantId: string, roomId: string, patch: { number?: string; floor?: string | null; note?: string | null; isActive?: boolean; listingId?: string }) {
  const room = await tx.hotelRoom.findFirst({ where: { id: roomId, tenantId } });
  if (!room) throw new HotelError("Chambre introuvable.");
  if (patch.number !== undefined) {
    const n = patch.number.trim();
    if (!n || n.length > 20) throw new HotelError("Numéro de chambre invalide.");
    if (await tx.hotelRoom.findFirst({ where: { tenantId, number: n, id: { not: roomId } }, select: { id: true } })) throw new HotelError(`La chambre ${n} existe déjà.`);
  }
  if ((patch.isActive === false || (patch.listingId && patch.listingId !== room.listingId)) && (await futureStaysInRoom(tx, tenantId, roomId)) > 0) {
    throw new HotelError("Des séjours à venir sont prévus dans cette chambre : changez-les de chambre d'abord.");
  }
  return tx.hotelRoom.update({
    where: { id: roomId },
    data: {
      ...(patch.number !== undefined ? { number: patch.number.trim() } : {}),
      ...(patch.floor !== undefined ? { floor: patch.floor?.trim() || null } : {}),
      ...(patch.note !== undefined ? { note: patch.note?.trim() || null } : {}),
      ...(patch.isActive !== undefined ? { isActive: patch.isActive } : {}),
      ...(patch.listingId !== undefined ? { listingId: patch.listingId } : {}),
    },
  });
}

async function futureStaysInRoom(tx: Tx, tenantId: string, roomId: string) {
  return tx.hotelStay.count({ where: { tenantId, roomId, active: true, departure: { gt: new Date() }, reservation: { status: { in: ACTIVE } } } });
}

/** État de ménage. Mettre une chambre hors service est refusé si un client y séjourne. */
export async function setRoomHousekeeping(tx: Tx, tenantId: string, roomId: string, status: HousekeepingStatus, note?: string | null) {
  if (!includes(HOUSEKEEPING_STATUSES, status)) throw new HotelError("État de ménage inconnu.");
  const room = await tx.hotelRoom.findFirst({ where: { id: roomId, tenantId }, select: { id: true } });
  if (!room) throw new HotelError("Chambre introuvable.");
  if (status === "out_of_service") {
    const inHouse = await tx.hotelStay.count({ where: { tenantId, roomId, checkedInAt: { not: null }, checkedOutAt: null, reservation: { status: "confirmed" } } });
    if (inHouse) throw new HotelError("Un client occupe cette chambre : faites d'abord son départ ou changez-le de chambre.");
  }
  return tx.hotelRoom.update({ where: { id: roomId }, data: { housekeeping: status, ...(note !== undefined ? { note: note?.trim() || null } : {}) } });
}

export function listRooms(tx: Tx, tenantId: string) {
  return tx.hotelRoom.findMany({ where: { tenantId }, include: { roomType: { select: { listing: { select: { id: true, title: true } } } } }, orderBy: { number: "asc" } });
}

// ============================================================================
// TARIFS PAR PÉRIODE
// ============================================================================

export async function setRate(tx: Tx, tenantId: string, input: { listingId: string; startDate: string; endDate: string; nightlyPrice: number; label?: string | null }) {
  if (!isIsoDate(input.startDate) || !isIsoDate(input.endDate) || input.endDate <= input.startDate) throw new HotelError("Période invalide : la fin doit suivre le début.");
  if (!Number.isInteger(input.nightlyPrice) || input.nightlyPrice < 0) throw new HotelError("Prix par nuit invalide.");
  const type = await tx.roomTypeDetails.findFirst({ where: { listingId: input.listingId, tenantId }, select: { listingId: true } });
  if (!type) throw new HotelError("Type de chambre introuvable.");
  const overlap = await tx.roomRate.findFirst({ where: { tenantId, listingId: input.listingId, startDate: { lt: day(input.endDate) }, endDate: { gt: day(input.startDate) } }, select: { id: true } });
  if (overlap) throw new HotelError("Cette période chevauche un tarif existant : modifiez ou supprimez-le d'abord.");
  return tx.roomRate.create({ data: { tenantId, listingId: input.listingId, startDate: day(input.startDate), endDate: day(input.endDate), nightlyPrice: input.nightlyPrice, label: input.label?.trim() || null } });
}

export async function removeRate(tx: Tx, tenantId: string, rateId: string) {
  const { count } = await tx.roomRate.deleteMany({ where: { id: rateId, tenantId } });
  if (count === 0) throw new HotelError("Tarif introuvable.");
}

/** Prix nuit par nuit [arrival, departure). `null` si une nuit n'a pas de prix (sur demande). */
export async function nightlyPrices(tx: Tx, tenantId: string, listingId: string, basePrice: number | null, arrival: string, departure: string) {
  const rates = await tx.roomRate.findMany({ where: { tenantId, listingId, startDate: { lt: day(departure) }, endDate: { gt: day(arrival) } } });
  const out: { date: string; price: number }[] = [];
  for (let d = arrival; d < departure; d = addDays(d, 1)) {
    const r = rates.find((x) => iso(x.startDate) <= d && d < iso(x.endDate));
    const price = r ? r.nightlyPrice : basePrice;
    if (price == null) return null;
    out.push({ date: d, price });
  }
  return out;
}

// ============================================================================
// RÉGLAGES
// ============================================================================

export async function getHotelSettings(tx: Tx, tenantId: string) {
  return (await tx.hotelSettings.findUnique({ where: { tenantId } })) ?? { tenantId, ...DEFAULT_SETTINGS, updatedAt: null };
}

export async function updateHotelSettings(tx: Tx, tenantId: string, patch: Partial<typeof DEFAULT_SETTINGS>) {
  const int = (v: unknown, a: number, b: number) => Number.isInteger(v) && (v as number) >= a && (v as number) <= b;
  if (patch.cancelFreeHours !== undefined && !int(patch.cancelFreeHours, 0, 720)) throw new HotelError("Délai d'annulation invalide.");
  if (patch.maxAdvanceDays !== undefined && !int(patch.maxAdvanceDays, 1, 730)) throw new HotelError("Fenêtre de réservation invalide.");
  if (patch.maxNights !== undefined && !int(patch.maxNights, 1, 365)) throw new HotelError("Durée maximale invalide.");
  return tx.hotelSettings.upsert({ where: { tenantId }, create: { tenantId, ...DEFAULT_SETTINGS, ...patch }, update: patch });
}

async function tenantTimezone(tx: Tx, tenantId: string) {
  return (await tx.tenant.findUnique({ where: { id: tenantId }, select: { timezone: true } }))?.timezone || "Africa/Dakar";
}

// ============================================================================
// DISPONIBILITÉS
// ============================================================================

async function freeRooms(tx: Tx, tenantId: string, listingId: string, arrival: string, departure: string, excludeReservationId?: string) {
  const busy = await tx.hotelStay.findMany({
    where: { tenantId, active: true, arrival: { lt: day(departure) }, departure: { gt: day(arrival) }, ...(excludeReservationId ? { reservationId: { not: excludeReservationId } } : {}) },
    select: { roomId: true },
  });
  const taken = new Set(busy.map((b) => b.roomId));
  const rooms = await tx.hotelRoom.findMany({ where: { tenantId, listingId, isActive: true, housekeeping: { not: "out_of_service" } }, orderBy: { number: "asc" } });
  return rooms.filter((r) => !taken.has(r.id));
}

function checkDates(arrival: string, departure: string, today: string, rules: { maxAdvanceDays: number; maxNights: number } | null) {
  if (!isIsoDate(arrival) || !isIsoDate(departure)) throw new HotelError("Dates invalides.");
  if (departure <= arrival) throw new HotelError("La date de départ doit suivre la date d'arrivée.");
  if (arrival < today) throw new HotelError("La date d'arrivée est passée.");
  const nights = nightsBetween(arrival, departure);
  if (rules && nights > rules.maxNights) throw new HotelError(`Séjour limité à ${rules.maxNights} nuits en ligne : contactez l'établissement.`);
  if (rules && nightsBetween(today, arrival) > rules.maxAdvanceDays) throw new HotelError("Ces dates ne sont pas encore ouvertes à la réservation.");
  return nights;
}

export interface StaySearch {
  arrival: string;
  departure: string;
  adults: number;
  children?: number;
  public?: boolean;
  now?: Date;
}

/** Types de chambres et leur disponibilité RÉELLE pour ces dates, avec le prix total calculé. */
export async function searchAvailability(tx: Tx, tenantId: string, q: StaySearch) {
  const [tz, settings] = await Promise.all([tenantTimezone(tx, tenantId), getHotelSettings(tx, tenantId)]);
  const today = utcToLocal(q.now ?? new Date(), tz).date;
  const nights = checkDates(q.arrival, q.departure, today, q.public ? settings : null);
  const types = await listRoomTypes(tx, tenantId, { publishedOnly: q.public });
  const out = [];
  for (const t of types) {
    if (!t.roomType) continue;
    const free = await freeRooms(tx, tenantId, t.id, q.arrival, q.departure);
    const nightly = await nightlyPrices(tx, tenantId, t.id, t.price, q.arrival, q.departure);
    const fitsGuests = q.adults <= t.roomType.maxAdults && (q.children ?? 0) <= t.roomType.maxChildren;
    const fitsStay = nights >= t.roomType.minNights;
    out.push({
      listing: t,
      freeCount: free.length,
      nights,
      nightly,
      total: nightly ? nightly.reduce((s, n) => s + n.price, 0) : null,
      bookable: free.length > 0 && fitsGuests && fitsStay,
      reason: !fitsGuests ? "capacity" : !fitsStay ? `min_nights:${t.roomType.minNights}` : free.length === 0 ? "full" : null,
    });
  }
  return { nights, results: out };
}

/** Calendrier d'un type : chambres libres et prix de chaque nuit sur `days` jours. */
export async function roomTypeCalendar(tx: Tx, tenantId: string, listingId: string, from: string, days: number) {
  const type = await tx.listing.findFirst({ where: { id: listingId, tenantId, type: "room" }, select: { price: true } });
  if (!type) throw new HotelError("Type de chambre introuvable.");
  const to = addDays(from, Math.min(days, 92));
  const [rooms, stays, nightly] = await Promise.all([
    tx.hotelRoom.count({ where: { tenantId, listingId, isActive: true, housekeeping: { not: "out_of_service" } } }),
    tx.hotelStay.findMany({ where: { tenantId, listingId, active: true, arrival: { lt: day(to) }, departure: { gt: day(from) } }, select: { arrival: true, departure: true } }),
    nightlyPrices(tx, tenantId, listingId, type.price, from, to),
  ]);
  const out: { date: string; free: number; price: number | null }[] = [];
  for (let d = from, i = 0; d < to; d = addDays(d, 1), i++) {
    const used = stays.filter((s) => iso(s.arrival) <= d && d < iso(s.departure)).length;
    out.push({ date: d, free: Math.max(0, rooms - used), price: nightly ? nightly[i]!.price : null });
  }
  return out;
}

// ============================================================================
// SÉJOURS
// ============================================================================

const isOverlapViolation = (e: unknown) =>
  (e instanceof Prisma.PrismaClientKnownRequestError && (e.meta as { code?: string } | undefined)?.code === "23P01") ||
  (e instanceof Error && /HotelStay_no_overlap|23P01|conflicting key value violates exclusion constraint/.test(e.message));

export interface BookStayInput {
  listingId: string;
  arrival: string;
  departure: string;
  adults: number;
  children?: number;
  /** Chambre précise (équipe) ; sinon la première libre du type. */
  roomId?: string | null;
  customerId?: string | null;
  customer?: CustomerInput | null;
  customerNote?: string | null;
  channel?: "web" | "dashboard" | "phone" | "whatsapp";
  actor: Actor;
}

export async function bookStay(tx: Tx, tenantId: string, input: BookStayInput) {
  const fromPublic = input.actor.type === "customer" || (input.channel ?? "web") === "web";
  const [tz, settings] = await Promise.all([tenantTimezone(tx, tenantId), getHotelSettings(tx, tenantId)]);
  const today = utcToLocal(new Date(), tz).date;
  const nights = checkDates(input.arrival, input.departure, today, fromPublic ? settings : null);
  const children = input.children ?? 0;
  if (!Number.isInteger(input.adults) || input.adults < 1 || !Number.isInteger(children) || children < 0) throw new HotelError("Nombre de voyageurs invalide.");

  // Verrou sur le type : deux réservations simultanées sont sérialisées ; la seconde
  // relit les séjours APRÈS la première.
  const locked = await tx.$queryRaw<{ listingId: string }[]>`SELECT "listingId" FROM "RoomTypeDetails" WHERE "listingId" = ${input.listingId} AND "tenantId" = ${tenantId} FOR UPDATE`;
  if (!locked[0]) throw new HotelError("Type de chambre introuvable.");
  const listing = await tx.listing.findFirst({ where: { id: input.listingId, tenantId, deletedAt: null }, include: { roomType: true } });
  if (!listing?.roomType) throw new HotelError("Type de chambre introuvable.");
  if (fromPublic && listing.status !== "published") throw new HotelError("Ce type de chambre n'est pas ouvert à la réservation.");
  const rt = listing.roomType;
  if (input.adults > rt.maxAdults || children > rt.maxChildren) throw new HotelError(`Capacité : ${rt.maxAdults} adulte(s)${rt.maxChildren ? ` et ${rt.maxChildren} enfant(s)` : ""} au plus.`);
  if (nights < rt.minNights) throw new HotelError(`Séjour minimum : ${rt.minNights} nuits.`);

  const free = await freeRooms(tx, tenantId, listing.id, input.arrival, input.departure);
  const room = input.roomId ? free.find((r) => r.id === input.roomId) : free[0];
  if (!room) throw new HotelError(input.roomId ? "Cette chambre n'est pas libre à ces dates." : "Plus aucune chambre de ce type n'est libre à ces dates.");

  const nightly = await nightlyPrices(tx, tenantId, listing.id, listing.price, input.arrival, input.departure);
  if (!nightly && fromPublic) throw new HotelError("Prix sur demande : contactez l'établissement.");
  const total = nightly ? nightly.reduce((s, n) => s + n.price, 0) : null;

  // Heure d'arrivée conventionnelle ; arrivée le jour même après cette heure : maintenant.
  let startAt = localToUtc(input.arrival, rt.checkInMinute, tz);
  if (startAt <= new Date()) startAt = new Date(Date.now() + 60_000);
  const reservation = await createReservation(tx, tenantId, {
    listingId: listing.id,
    requestedStartAt: startAt,
    quantity: 1,
    customerId: input.customerId ?? null,
    customer: input.customer ?? null,
    customerNote: input.customerNote ?? null,
    channel: input.channel ?? "web",
    moduleKey: STAYS_MODULE,
    pricing: "none",
    actor: input.actor,
  });
  await tx.reservation.update({ where: { id: reservation.id }, data: { endAt: localToUtc(input.departure, rt.checkOutMinute, tz), quantity: nights, unitPrice: null, totalAmount: total } });
  try {
    await tx.hotelStay.create({
      data: { reservationId: reservation.id, tenantId, listingId: listing.id, roomId: room.id, arrival: day(input.arrival), departure: day(input.departure), nights, adults: input.adults, children, nightly: nightly ?? [] },
    });
  } catch (e) {
    if (isOverlapViolation(e)) throw new HotelError("Cette chambre vient d'être réservée : réessayez.");
    throw e;
  }
  if (!fromPublic || settings.autoConfirm) {
    await transitionReservationStatus(tx, tenantId, { reservationId: reservation.id, toStatus: "confirmed", actor: fromPublic ? { userId: null, type: "system" } : input.actor });
  }
  return getStay(tx, tenantId, reservation.id);
}

async function lockStay(tx: Tx, tenantId: string, reservationId: string) {
  const r = await tx.$queryRaw<{ status: string }[]>`SELECT "status" FROM "Reservation" WHERE "id" = ${reservationId} AND "tenantId" = ${tenantId} AND "moduleKey" = ${STAYS_MODULE} FOR UPDATE`;
  if (!r[0]) throw new ReservationNotFoundError();
  const stay = await tx.hotelStay.findFirst({ where: { reservationId, tenantId }, include: { roomType: { include: { listing: { select: { price: true } } } } } });
  if (!stay) throw new ReservationNotFoundError();
  return { status: r[0].status, stay };
}

/**
 * Change de chambre et/ou de dates (équipe). Les nouvelles nuits sont recalculées ; le
 * montant ne peut pas descendre sous ce qui est déjà encaissé.
 */
export async function changeStay(tx: Tx, tenantId: string, input: { reservationId: string; roomId?: string; arrival?: string; departure?: string; actor: Actor }) {
  const { status, stay } = await lockStay(tx, tenantId, input.reservationId);
  if (!ACTIVE.includes(status) || stay.checkedOutAt) throw new HotelError("Ce séjour ne peut plus être modifié.");
  const tz = await tenantTimezone(tx, tenantId);
  const today = utcToLocal(new Date(), tz).date;
  const arrival = input.arrival ?? iso(stay.arrival);
  const departure = input.departure ?? iso(stay.departure);
  if (stay.checkedInAt && arrival !== iso(stay.arrival)) throw new HotelError("Le client est arrivé : seule la date de départ peut changer.");
  if (!stay.checkedInAt) checkDates(arrival, departure, today, null);
  else if (!isIsoDate(departure) || departure <= arrival || departure < today) throw new HotelError("Date de départ invalide.");
  const roomId = input.roomId ?? stay.roomId;
  const room = await tx.hotelRoom.findFirst({ where: { id: roomId, tenantId, isActive: true, housekeeping: { not: "out_of_service" } } });
  if (!room) throw new HotelError("Chambre indisponible.");
  await tx.$queryRaw`SELECT "listingId" FROM "RoomTypeDetails" WHERE "listingId" = ${room.listingId} AND "tenantId" = ${tenantId} FOR UPDATE`;
  const free = await freeRooms(tx, tenantId, room.listingId, arrival, departure, input.reservationId);
  if (!free.some((r) => r.id === roomId)) throw new HotelError(`La chambre ${room.number} n'est pas libre à ces dates.`);
  const datesChanged = arrival !== iso(stay.arrival) || departure !== iso(stay.departure);
  const nightly = datesChanged ? await nightlyPrices(tx, tenantId, stay.listingId, stay.roomType.listing.price, arrival, departure) : null;
  const total = datesChanged ? (nightly ? nightly.reduce((s, n) => s + n.price, 0) : null) : undefined;
  if (total !== undefined) {
    const paid = (await tx.reservationPayment.findMany({ where: { tenantId, reservationId: input.reservationId, voidedAt: null }, select: { amount: true } })).reduce((s, p) => s + p.amount, 0);
    if (total != null && total < paid) throw new HotelError(`Le nouveau montant (${total} FCFA) serait inférieur à ce qui est déjà encaissé (${paid} FCFA).`);
  }
  try {
    await tx.hotelStay.update({
      where: { reservationId: input.reservationId },
      data: { roomId, arrival: day(arrival), departure: day(departure), nights: nightsBetween(arrival, departure), ...(nightly ? { nightly } : {}) },
    });
  } catch (e) {
    if (isOverlapViolation(e)) throw new HotelError("Cette chambre vient d'être réservée à ces dates.");
    throw e;
  }
  const rt = stay.roomType;
  await tx.reservation.update({
    where: { id: input.reservationId },
    data: {
      ...(datesChanged ? { endAt: localToUtc(departure, rt.checkOutMinute, tz), quantity: nightsBetween(arrival, departure), totalAmount: total } : {}),
      ...(arrival !== iso(stay.arrival) ? { startAt: (() => { const s = localToUtc(arrival, rt.checkInMinute, tz); return s <= new Date() ? new Date(Date.now() + 60_000) : s; })() } : {}),
    },
  });
  const notes = [roomId !== stay.roomId ? `chambre ${room.number}` : null, datesChanged ? `du ${arrival.split("-").reverse().join("/")} au ${departure.split("-").reverse().join("/")}` : null].filter(Boolean);
  if (notes.length) {
    await tx.reservationStatusHistory.create({ data: { tenantId, reservationId: input.reservationId, fromStatus: status, toStatus: status, changedBy: input.actor.userId, changedByType: input.actor.type, note: `Modifié : ${notes.join(", ")}` } });
  }
  return getStay(tx, tenantId, input.reservationId);
}

/** Arrivée du client : séjour confirmé, date d'arrivée atteinte, chambre en service. */
export async function checkIn(tx: Tx, tenantId: string, reservationId: string, actor: Actor) {
  const { status, stay } = await lockStay(tx, tenantId, reservationId);
  if (stay.checkedInAt) throw new HotelError("Le client est déjà arrivé.");
  if (!ACTIVE.includes(status)) throw new HotelError("Ce séjour n'est plus actif.");
  const tz = await tenantTimezone(tx, tenantId);
  if (iso(stay.arrival) > utcToLocal(new Date(), tz).date) throw new HotelError("L'arrivée est prévue à une date ultérieure.");
  const room = await tx.hotelRoom.findFirstOrThrow({ where: { id: stay.roomId, tenantId } });
  if (room.housekeeping === "out_of_service") throw new HotelError(`La chambre ${room.number} est hors service : attribuez une autre chambre.`);
  if (status === "requested") await transitionReservationStatus(tx, tenantId, { reservationId, toStatus: "confirmed", actor });
  await tx.hotelStay.update({ where: { reservationId }, data: { checkedInAt: new Date() } });
  await tx.reservationStatusHistory.create({ data: { tenantId, reservationId, fromStatus: "confirmed", toStatus: "confirmed", changedBy: actor.userId, changedByType: actor.type, note: `Arrivée, chambre ${room.number}` } });
  return getStay(tx, tenantId, reservationId);
}

/** Départ : séjour terminé, chambre à nettoyer. */
export async function checkOut(tx: Tx, tenantId: string, reservationId: string, actor: Actor) {
  const { stay } = await lockStay(tx, tenantId, reservationId);
  if (!stay.checkedInAt) throw new HotelError("Le client n'est pas encore arrivé.");
  if (stay.checkedOutAt) throw new HotelError("Le départ est déjà enregistré.");
  await tx.hotelStay.update({ where: { reservationId }, data: { checkedOutAt: new Date() } });
  await transitionReservationStatus(tx, tenantId, { reservationId, toStatus: "completed", actor, note: "Départ" });
  await tx.hotelRoom.update({ where: { id: stay.roomId }, data: { housekeeping: "dirty" } });
  return getStay(tx, tenantId, reservationId);
}

/** Non-présentation : après la date d'arrivée, sans arrivée enregistrée ; la chambre est libérée. */
export async function markNoShow(tx: Tx, tenantId: string, reservationId: string, actor: Actor) {
  const { status, stay } = await lockStay(tx, tenantId, reservationId);
  if (stay.checkedInAt) throw new HotelError("Le client est arrivé.");
  if (!ACTIVE.includes(status)) throw new HotelError("Ce séjour n'est plus actif.");
  const tz = await tenantTimezone(tx, tenantId);
  if (iso(stay.arrival) > utcToLocal(new Date(), tz).date) throw new HotelError("La date d'arrivée n'est pas encore passée.");
  if (status === "requested") await transitionReservationStatus(tx, tenantId, { reservationId, toStatus: "confirmed", actor });
  await transitionReservationStatus(tx, tenantId, { reservationId, toStatus: "no_show", actor });
  return getStay(tx, tenantId, reservationId);
}

/** Annulation en ligne par le client : SON séjour, avant le délai, sans paiement enregistré. */
export async function cancelStayAsGuest(tx: Tx, tenantId: string, accessToken: string) {
  const r = await tx.reservation.findFirst({ where: { tenantId, accessToken, moduleKey: STAYS_MODULE }, include: { payments: { where: { voidedAt: null }, select: { id: true } } } });
  if (!r) throw new ReservationNotFoundError();
  if (!ACTIVE.includes(r.status)) throw new HotelError("Ce séjour n'est plus actif.");
  const settings = await getHotelSettings(tx, tenantId);
  if (r.startAt.getTime() - Date.now() < settings.cancelFreeHours * 3600_000) throw new HotelError(`L'arrivée est dans moins de ${settings.cancelFreeHours} h : contactez l'établissement pour annuler.`);
  if (r.payments.length) throw new HotelError("Un paiement a déjà été enregistré : contactez l'établissement pour annuler et convenir du remboursement.");
  return transitionReservationStatus(tx, tenantId, { reservationId: r.id, toStatus: "canceled", actor: { userId: null, type: "customer" }, note: "Annulé en ligne par le client" });
}

// ============================================================================
// LECTURES MÉTIER
// ============================================================================

const stayInclude = {
  listing: { select: { id: true, title: true, slug: true, media: true, roomType: { select: { bedSummary: true, depositPercent: true, checkInMinute: true, checkOutMinute: true, maxAdults: true } } } },
  customer: { select: { id: true, firstName: true, lastName: true, phone: true, email: true } },
  stay: { include: { room: { select: { id: true, number: true, floor: true, housekeeping: true } } } },
  payments: { orderBy: { paidAt: "asc" as const } },
  history: { orderBy: { createdAt: "asc" as const } },
} satisfies Prisma.ReservationInclude;

export function getStay(tx: Tx, tenantId: string, reservationId: string) {
  return tx.reservation.findFirst({ where: { id: reservationId, tenantId, moduleKey: STAYS_MODULE }, include: stayInclude });
}

export function getStayByToken(tx: Tx, tenantId: string, accessToken: string) {
  return tx.reservation.findFirst({ where: { accessToken, tenantId, moduleKey: STAYS_MODULE }, include: stayInclude });
}

export function listStays(tx: Tx, tenantId: string, q: { arrivalFrom?: string; arrivalTo?: string; departureOn?: string; arrivalOn?: string; inHouse?: boolean; status?: string[]; search?: string; take?: number; order?: "asc" | "desc" } = {}) {
  const search = q.search?.trim();
  return tx.reservation.findMany({
    where: {
      tenantId,
      moduleKey: STAYS_MODULE,
      ...(q.status ? { status: { in: q.status } } : {}),
      stay: {
        ...(q.arrivalFrom || q.arrivalTo ? { arrival: { ...(q.arrivalFrom ? { gte: day(q.arrivalFrom) } : {}), ...(q.arrivalTo ? { lt: day(q.arrivalTo) } : {}) } } : {}),
        ...(q.arrivalOn ? { arrival: day(q.arrivalOn) } : {}),
        ...(q.departureOn ? { departure: day(q.departureOn) } : {}),
        ...(q.inHouse ? { checkedInAt: { not: null }, checkedOutAt: null } : {}),
      },
      ...(search
        ? { OR: [{ reference: { contains: search, mode: "insensitive" as const } }, { customer: { OR: [{ firstName: { contains: search, mode: "insensitive" as const } }, { lastName: { contains: search, mode: "insensitive" as const } }, { phone: { contains: search.replace(/\s/g, "") } }] } }] }
        : {}),
    },
    include: stayInclude,
    orderBy: { startAt: q.order ?? "asc" },
    take: Math.min(q.take ?? 200, 500),
  });
}

/** Planning : chambres (par type) et séjours actifs qui recouvrent [from, from + days). */
export async function hotelPlanning(tx: Tx, tenantId: string, from: string, days: number) {
  const to = addDays(from, days);
  const [rooms, stays] = await Promise.all([
    tx.hotelRoom.findMany({ where: { tenantId, isActive: true }, include: { roomType: { select: { position: true, listing: { select: { id: true, title: true } } } } }, orderBy: { number: "asc" } }),
    tx.hotelStay.findMany({
      where: { tenantId, active: true, arrival: { lt: day(to) }, departure: { gt: day(from) } },
      include: { reservation: { select: { id: true, status: true, reference: true, customer: { select: { firstName: true, lastName: true } } } } },
    }),
  ]);
  rooms.sort((a, b) => a.roomType.position - b.roomType.position || a.number.localeCompare(b.number, "fr", { numeric: true }));
  return { from, to, rooms, stays };
}

/** Chiffres du jour pour la vue d'ensemble de l'établissement. */
export async function hotelOverview(tx: Tx, tenantId: string, now = new Date()) {
  const tz = await tenantTimezone(tx, tenantId);
  const today = utcToLocal(now, tz).date;
  const [rooms, tonight, arrivals, departures, inHouse, pending, dirty] = await Promise.all([
    tx.hotelRoom.count({ where: { tenantId, isActive: true, housekeeping: { not: "out_of_service" } } }),
    tx.hotelStay.count({ where: { tenantId, active: true, arrival: { lte: day(today) }, departure: { gt: day(today) }, reservation: { status: { in: ACTIVE } } } }),
    tx.hotelStay.count({ where: { tenantId, active: true, arrival: day(today), checkedInAt: null, reservation: { status: { in: ACTIVE } } } }),
    tx.hotelStay.count({ where: { tenantId, active: true, departure: day(today), checkedInAt: { not: null }, checkedOutAt: null } }),
    tx.hotelStay.count({ where: { tenantId, checkedInAt: { not: null }, checkedOutAt: null, reservation: { status: "confirmed" } } }),
    tx.reservation.count({ where: { tenantId, moduleKey: STAYS_MODULE, status: "requested" } }),
    tx.hotelRoom.count({ where: { tenantId, isActive: true, housekeeping: "dirty" } }),
  ]);
  return { timezone: tz, today, rooms, tonight, occupancy: rooms ? Math.round((tonight / rooms) * 100) : 0, arrivals, departures, inHouse, pending, dirty };
}
