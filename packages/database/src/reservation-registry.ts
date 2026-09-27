import type { Prisma } from "@prisma/client";
import { nextCounterValue } from "./counters";
import { resolveOrCreateCustomer, type CustomerInput } from "./customer-registry";

/**
 * Réservations communes aux secteurs hors commerce (visite d'un bien, place sur un
 * départ, rendez-vous, séjour, essai) — docs/04 §4.5.2. Règles tenues ici, jamais
 * seulement dans l'interface :
 *
 * - le montant est TOUJOURS recalculé depuis la fiche et le créneau enregistrés :
 *   aucun prix venu du navigateur n'est accepté ;
 * - une place sur un créneau est prise par un UPDATE conditionné atomique : deux
 *   clients simultanés ne peuvent jamais obtenir la dernière place (et une contrainte
 *   CHECK en base interdit de toute façon toute surréservation) ;
 * - le statut ne change que par `transitionReservationStatus`, ligne verrouillée
 *   (FOR UPDATE) pour qu'une double annulation ne libère jamais deux fois les places,
 *   chaque transition historisée dans une table immuable ;
 * - un client invité ne retrouve QUE sa réservation, par son jeton d'accès.
 *
 * Une réservation n'est jamais « payée » par ce registre : l'encaissement éventuel
 * passe par le moteur de paiements existant (jamais Chariow, réservé aux abonnements).
 */

export const RESERVATION_STATUSES = ["requested", "confirmed", "completed", "canceled", "no_show"] as const;
export type ReservationStatus = (typeof RESERVATION_STATUSES)[number];

export const RESERVATION_STATUS_TRANSITIONS: Record<ReservationStatus, ReservationStatus[]> = {
  requested: ["confirmed", "canceled"],
  confirmed: ["completed", "canceled", "no_show"],
  completed: [],
  canceled: [],
  no_show: [],
};

/** Statuts qui occupent une place sur le créneau. */
const HOLDS_CAPACITY: ReservationStatus[] = ["requested", "confirmed"];

export class ReservationUnavailableError extends Error {}
export class AvailabilityFullError extends Error {
  constructor(public readonly remaining: number) {
    super(remaining > 0 ? `Il ne reste que ${remaining} place(s) sur ce créneau.` : "Ce créneau est complet.");
  }
}
export class InvalidReservationTransitionError extends Error {
  constructor(public readonly from: string, public readonly to: string) {
    super(`Transition de réservation impossible : ${from} → ${to}.`);
  }
}
export class ReservationNotFoundError extends Error {
  constructor() {
    super("Réservation introuvable.");
  }
}

export function formatReservationReference(year: number, value: number) {
  return `RES-${year}-${String(value).padStart(6, "0")}`;
}

/** Montant d'une réservation selon l'unité de prix de la fiche. `null` = sur devis. */
export function computeReservationAmount(unitPrice: number | null, priceUnit: string, quantity: number) {
  if (unitPrice == null || priceUnit === "on_request") return { unitPrice: null, totalAmount: null };
  const multiplied = priceUnit === "per_person" || priceUnit === "per_night" || priceUnit === "per_session";
  return { unitPrice, totalAmount: multiplied ? unitPrice * quantity : unitPrice };
}

export interface CreateReservationInput {
  listingId: string;
  /** Créneau choisi (départ, rendez-vous, nuitée). Sans créneau : demande à une date
   *  souhaitée (`requestedStartAt`), à confirmer par l'entreprise. */
  availabilityId?: string | null;
  requestedStartAt?: Date | null;
  quantity?: number;
  /** Client existant (dashboard) ou coordonnées d'un invité (site public). */
  customerId?: string | null;
  customer?: CustomerInput | null;
  customerNote?: string | null;
  channel?: "web" | "dashboard" | "phone" | "whatsapp";
  /** "none" : réservation sans montant (ex. visite gratuite d'un bien). */
  pricing?: "listing" | "none";
  actor: { userId: string | null; type: "owner" | "employee" | "system" | "customer" };
}

export async function createReservation(tx: Prisma.TransactionClient, tenantId: string, input: CreateReservationInput) {
  const quantity = input.quantity ?? 1;
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 50) {
    throw new ReservationUnavailableError("Nombre de places invalide.");
  }

  const listing = await tx.listing.findFirst({ where: { id: input.listingId, tenantId, deletedAt: null } });
  if (!listing) throw new ReservationUnavailableError("Cette offre n'existe pas ou plus.");
  // Le site public ne réserve qu'une fiche publiée ; l'équipe peut saisir une
  // réservation sur une fiche momentanément indisponible (ex. client au téléphone).
  const fromPublic = input.actor.type === "customer" || input.channel === "web";
  if (fromPublic ? listing.status !== "published" : listing.status === "archived") {
    throw new ReservationUnavailableError("Cette offre n'est pas ouverte à la réservation.");
  }

  let startAt: Date;
  let endAt: Date | null = null;
  let unitPrice: number | null = listing.price;
  let availabilityId: string | null = null;

  if (input.availabilityId) {
    const slot = await tx.listingAvailability.findFirst({ where: { id: input.availabilityId, tenantId, listingId: listing.id } });
    if (!slot) throw new ReservationUnavailableError("Ce créneau n'existe pas pour cette offre.");
    if (slot.status !== "open") throw new ReservationUnavailableError("Ce créneau n'est plus ouvert à la réservation.");
    if (slot.startAt <= new Date()) throw new ReservationUnavailableError("Ce créneau est déjà passé.");
    // Prise de place atomique : la condition est réévaluée sur la ligne verrouillée par
    // PostgreSQL, jamais sur une lecture antérieure.
    const taken = await tx.$executeRaw`
      UPDATE "ListingAvailability"
         SET "reservedCount" = "reservedCount" + ${quantity}
       WHERE "id" = ${slot.id} AND "tenantId" = ${tenantId} AND "status" = 'open'
         AND "reservedCount" + ${quantity} <= "capacity"`;
    if (taken === 0) {
      const fresh = await tx.listingAvailability.findFirst({ where: { id: slot.id, tenantId } });
      throw new AvailabilityFullError(fresh ? Math.max(0, fresh.capacity - fresh.reservedCount) : 0);
    }
    availabilityId = slot.id;
    startAt = slot.startAt;
    endAt = slot.endAt;
    unitPrice = slot.priceOverride ?? listing.price;
  } else {
    if (!input.requestedStartAt) throw new ReservationUnavailableError("Choisissez une date.");
    if (input.requestedStartAt <= new Date()) throw new ReservationUnavailableError("La date choisie est déjà passée.");
    startAt = input.requestedStartAt;
  }

  let customerId = input.customerId ?? null;
  if (customerId) {
    const owned = await tx.customer.findFirst({ where: { id: customerId, tenantId }, select: { id: true } });
    if (!owned) throw new ReservationUnavailableError("Client introuvable.");
  } else {
    if (!input.customer?.firstName?.trim() || !input.customer.phone?.trim()) {
      throw new ReservationUnavailableError("Nom et téléphone requis pour réserver.");
    }
    customerId = (await resolveOrCreateCustomer(tx, tenantId, input.customer)).id;
  }

  const amounts = input.pricing === "none" ? { unitPrice: null, totalAmount: null } : computeReservationAmount(unitPrice, listing.priceUnit, quantity);
  const year = new Date().getFullYear();
  const reference = formatReservationReference(year, await nextCounterValue(tx, tenantId, `reservation-${year}`));

  const reservation = await tx.reservation.create({
    data: {
      tenantId,
      reference,
      listingId: listing.id,
      availabilityId,
      customerId,
      moduleKey: listing.moduleKey,
      startAt,
      endAt,
      quantity,
      unitPrice: amounts.unitPrice,
      totalAmount: amounts.totalAmount,
      currency: listing.currency,
      customerNote: input.customerNote?.trim() || null,
      channel: input.channel ?? "web",
    },
  });
  await tx.reservationStatusHistory.create({
    data: { tenantId, reservationId: reservation.id, fromStatus: null, toStatus: "requested", changedBy: input.actor.userId, changedByType: input.actor.type },
  });
  return reservation;
}

export interface TransitionReservationInput {
  reservationId: string;
  toStatus: ReservationStatus;
  actor: { userId: string | null; type: "owner" | "employee" | "system" | "customer" };
  note?: string | null;
}

export async function transitionReservationStatus(tx: Prisma.TransactionClient, tenantId: string, input: TransitionReservationInput) {
  // Verrou de ligne AVANT la lecture du statut : deux annulations simultanées sont
  // sérialisées, la seconde relit « canceled » et ne libère rien une seconde fois.
  const locked = await tx.$queryRaw<{ status: string }[]>`
    SELECT "status" FROM "Reservation" WHERE "id" = ${input.reservationId} AND "tenantId" = ${tenantId} FOR UPDATE`;
  if (locked.length === 0) throw new ReservationNotFoundError();
  const from = locked[0]!.status as ReservationStatus;
  if (from === input.toStatus) {
    return { reservation: await tx.reservation.findFirstOrThrow({ where: { id: input.reservationId, tenantId } }), changed: false };
  }
  if (!RESERVATION_STATUS_TRANSITIONS[from]?.includes(input.toStatus)) {
    throw new InvalidReservationTransitionError(from, input.toStatus);
  }

  const now = new Date();
  const reservation = await tx.reservation.update({
    where: { id: input.reservationId },
    data: {
      status: input.toStatus,
      ...(input.toStatus === "confirmed" ? { confirmedAt: now } : {}),
      ...(input.toStatus === "canceled" ? { canceledAt: now } : {}),
    },
  });

  // Une annulation rend ses places au créneau (les autres statuts finaux concernent un
  // créneau passé : rien à libérer).
  if (input.toStatus === "canceled" && HOLDS_CAPACITY.includes(from) && reservation.availabilityId) {
    await tx.$executeRaw`
      UPDATE "ListingAvailability" SET "reservedCount" = "reservedCount" - ${reservation.quantity}
       WHERE "id" = ${reservation.availabilityId} AND "tenantId" = ${tenantId}`;
  }

  await tx.reservationStatusHistory.create({
    data: {
      tenantId,
      reservationId: reservation.id,
      fromStatus: from,
      toStatus: input.toStatus,
      changedBy: input.actor.userId,
      changedByType: input.actor.type,
      note: input.note?.trim() || null,
    },
  });
  return { reservation, changed: true };
}

/** Le client invité retrouve SA réservation par son jeton — jamais celle d'un autre. */
export function getReservationByAccessToken(tx: Prisma.TransactionClient, tenantId: string, accessToken: string) {
  return tx.reservation.findFirst({
    where: { tenantId, accessToken },
    include: { listing: { select: { title: true, slug: true, type: true } }, history: { orderBy: { createdAt: "asc" } } },
  });
}

/** Annulation par le client lui-même : uniquement sa réservation, uniquement avant la date. */
export async function cancelReservationByCustomer(tx: Prisma.TransactionClient, tenantId: string, accessToken: string) {
  const reservation = await tx.reservation.findFirst({ where: { tenantId, accessToken }, select: { id: true, startAt: true } });
  if (!reservation) throw new ReservationNotFoundError();
  if (reservation.startAt <= new Date()) throw new ReservationUnavailableError("La date est passée : contactez l'entreprise.");
  return transitionReservationStatus(tx, tenantId, {
    reservationId: reservation.id,
    toStatus: "canceled",
    actor: { userId: null, type: "customer" },
    note: "Annulée par le client",
  });
}

export interface ListReservationsFilter {
  moduleKey?: string;
  status?: ReservationStatus;
  listingId?: string;
  from?: Date;
  to?: Date;
  take?: number;
}

export function listReservations(tx: Prisma.TransactionClient, tenantId: string, filter: ListReservationsFilter = {}) {
  return tx.reservation.findMany({
    where: {
      tenantId,
      ...(filter.moduleKey ? { moduleKey: filter.moduleKey } : {}),
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.listingId ? { listingId: filter.listingId } : {}),
      ...(filter.from || filter.to ? { startAt: { ...(filter.from ? { gte: filter.from } : {}), ...(filter.to ? { lt: filter.to } : {}) } } : {}),
    },
    include: {
      listing: { select: { title: true, slug: true } },
      customer: { select: { firstName: true, lastName: true, phone: true } },
    },
    orderBy: { startAt: "asc" },
    take: Math.min(filter.take ?? 100, 500),
  });
}
