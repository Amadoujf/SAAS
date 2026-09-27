import type { Prisma } from "@prisma/client";
import { nextCounterValue } from "./counters";
import type { CustomerInput } from "./customer-registry";
import { encryptSecret } from "./encryption";
import { addAvailability, createListing, InvalidListingInputError, updateListing, type ListingInput } from "./listing-registry";
import { createReservation, ReservationUnavailableError } from "./reservation-registry";

/**
 * Voyage (secteur `travel_agency`) — voyages, départs, voyageurs, pièces, encaissements.
 * S'appuie sur les primitives communes : un voyage EST une fiche `type = "travel_package"`
 * + sa fiche technique ; un départ EST un créneau (places) ; une réservation EST une
 * réservation commune du module "departures", avec ses voyageurs nominatifs.
 *
 * Règles tenues ici (et doublées par des contraintes en base) :
 * - le prix vient de la fiche ou du départ enregistrés, jamais du navigateur ;
 * - une réservation compte exactement autant de voyageurs que de places prises ;
 * - le numéro de passeport est chiffré au repos, seuls ses 4 derniers caractères restent lisibles ;
 * - un encaissement est un fait enregistré par l'agence (montant, moyen, date) : jamais
 *   simulé, jamais au-delà du reste à payer, jamais Chariow (réservé aux abonnements) ;
 * - « payé » se CALCULE à partir des encaissements non annulés, rien n'est présumé.
 */

export const TRIP_TYPES = ["circuit", "stay", "pilgrimage", "excursion", "cruise"] as const;
export type TripType = (typeof TRIP_TYPES)[number];
export const TRAVEL_INCLUSIONS = ["flights", "hotel", "transfers", "breakfast", "full_board", "guide", "visa_assistance", "insurance", "excursions"] as const;
export const TRAVEL_DOCUMENTS = ["passport", "id_card", "visa", "yellow_fever", "photo", "travel_insurance"] as const;
export type TravelDocumentKind = (typeof TRAVEL_DOCUMENTS)[number];
export const DOCUMENT_STATUSES = ["missing", "received", "submitted", "approved", "refused"] as const;
export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];
export const TRAVEL_PAYMENT_METHODS = ["cash", "wave", "orange_money", "bank_transfer", "card_terminal"] as const;
export type TravelPaymentMethod = (typeof TRAVEL_PAYMENT_METHODS)[number];

export const TRAVEL_MODULE = "listings";
export const DEPARTURES_MODULE = "departures";

export class TravelError extends Error {}

const includes = <T extends readonly string[]>(list: T, value: unknown): value is T[number] => typeof value === "string" && (list as readonly string[]).includes(value);

// ============================================================================
// VOYAGES
// ============================================================================

export interface ItineraryDayInput {
  dayNumber: number;
  title: string;
  description?: string | null;
}

export interface TravelPackageInput {
  title: string;
  slug?: string;
  summary?: string | null;
  description?: string | null;
  /** Prix par voyageur (FCFA). Absent = sur devis. */
  pricePerPerson?: number | null;
  media?: ListingInput["media"];
  featured?: boolean;
  tripType: TripType;
  destinationCountry: string;
  destinationCity?: string | null;
  durationDays: number;
  durationNights?: number;
  included?: string[];
  excludedNote?: string | null;
  depositPercent?: number;
  requiredDocuments?: string[];
  meetingPoint?: string | null;
  itinerary?: ItineraryDayInput[];
}

function assertTravel(input: Partial<TravelPackageInput>) {
  if (input.tripType !== undefined && !includes(TRIP_TYPES, input.tripType)) throw new InvalidListingInputError("Type de voyage inconnu.");
  if (input.destinationCountry !== undefined && !input.destinationCountry.trim()) throw new InvalidListingInputError("Indiquez le pays de destination.");
  if (input.durationDays !== undefined && (!Number.isInteger(input.durationDays) || input.durationDays < 1 || input.durationDays > 90)) {
    throw new InvalidListingInputError("La durée doit être comprise entre 1 et 90 jours.");
  }
  if (input.durationNights !== undefined && (!Number.isInteger(input.durationNights) || input.durationNights < 0 || input.durationNights > 90)) {
    throw new InvalidListingInputError("Nombre de nuits invalide.");
  }
  if (input.depositPercent !== undefined && (!Number.isInteger(input.depositPercent) || input.depositPercent < 0 || input.depositPercent > 100)) {
    throw new InvalidListingInputError("L'acompte est un pourcentage entre 0 et 100.");
  }
  if (input.included?.some((i) => !includes(TRAVEL_INCLUSIONS, i))) throw new InvalidListingInputError("Prestation incluse inconnue.");
  if (input.requiredDocuments?.some((d) => !includes(TRAVEL_DOCUMENTS, d))) throw new InvalidListingInputError("Pièce demandée inconnue.");
  if (input.itinerary) {
    const days = input.itinerary.map((d) => d.dayNumber);
    if (new Set(days).size !== days.length) throw new InvalidListingInputError("Deux étapes du programme ont le même jour.");
    if (input.itinerary.some((d) => !Number.isInteger(d.dayNumber) || d.dayNumber < 1 || d.dayNumber > 90 || !d.title.trim())) {
      throw new InvalidListingInputError("Chaque jour du programme a un numéro (1 à 90) et un titre.");
    }
  }
}

const detailsData = (input: Partial<TravelPackageInput>) => ({
  ...(input.tripType !== undefined ? { tripType: input.tripType } : {}),
  ...(input.destinationCountry !== undefined ? { destinationCountry: input.destinationCountry.trim() } : {}),
  ...(input.destinationCity !== undefined ? { destinationCity: input.destinationCity?.trim() || null } : {}),
  ...(input.durationDays !== undefined ? { durationDays: input.durationDays } : {}),
  ...(input.durationNights !== undefined ? { durationNights: input.durationNights } : {}),
  ...(input.included !== undefined ? { included: [...new Set(input.included)] } : {}),
  ...(input.excludedNote !== undefined ? { excludedNote: input.excludedNote?.trim() || null } : {}),
  ...(input.depositPercent !== undefined ? { depositPercent: input.depositPercent } : {}),
  ...(input.requiredDocuments !== undefined ? { requiredDocuments: [...new Set(input.requiredDocuments)] } : {}),
  ...(input.meetingPoint !== undefined ? { meetingPoint: input.meetingPoint?.trim() || null } : {}),
});

async function replaceItinerary(tx: Prisma.TransactionClient, tenantId: string, listingId: string, days: ItineraryDayInput[]) {
  await tx.travelItineraryDay.deleteMany({ where: { tenantId, listingId } });
  if (days.length) {
    await tx.travelItineraryDay.createMany({
      data: days.map((d) => ({ tenantId, listingId, dayNumber: d.dayNumber, title: d.title.trim(), description: d.description?.trim() || null })),
    });
  }
}

export async function createTravelPackage(tx: Prisma.TransactionClient, tenantId: string, input: TravelPackageInput, actorUserId: string | null) {
  assertTravel(input);
  const listing = await createListing(
    tx,
    tenantId,
    {
      moduleKey: TRAVEL_MODULE,
      type: "travel_package",
      title: input.title,
      slug: input.slug,
      summary: input.summary,
      description: input.description,
      price: input.pricePerPerson ?? null,
      priceUnit: input.pricePerPerson == null ? "on_request" : "per_person",
      location: { region: input.destinationCountry.trim(), commune: input.destinationCity?.trim() || undefined },
      media: input.media,
      featured: input.featured,
    },
    actorUserId,
  );
  await tx.travelPackageDetails.create({
    data: { listingId: listing.id, tenantId, tripType: input.tripType, destinationCountry: input.destinationCountry.trim(), durationDays: input.durationDays, ...detailsData(input) },
  });
  if (input.itinerary) await replaceItinerary(tx, tenantId, listing.id, input.itinerary);
  return getTravelPackage(tx, tenantId, listing.id);
}

export async function updateTravelPackage(tx: Prisma.TransactionClient, tenantId: string, listingId: string, patch: Partial<TravelPackageInput>, actorUserId: string | null) {
  assertTravel(patch);
  const current = await tx.travelPackageDetails.findFirst({ where: { listingId, tenantId } });
  if (!current) throw new InvalidListingInputError("Ce voyage n'existe pas.");
  const details = detailsData(patch);
  if (Object.keys(details).length) await tx.travelPackageDetails.update({ where: { listingId }, data: details });
  if (patch.itinerary) await replaceItinerary(tx, tenantId, listingId, patch.itinerary);
  // Révision de la fiche écrite APRÈS la fiche technique et le programme.
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
      ...(patch.pricePerPerson !== undefined ? { price: patch.pricePerPerson, priceUnit: patch.pricePerPerson == null ? "on_request" : "per_person" } : {}),
      ...(patch.destinationCountry !== undefined || patch.destinationCity !== undefined
        ? { location: { region: (patch.destinationCountry ?? current.destinationCountry).trim(), commune: (patch.destinationCity !== undefined ? patch.destinationCity : current.destinationCity)?.trim() || undefined } }
        : {}),
    },
    actorUserId,
  );
  return getTravelPackage(tx, tenantId, listingId);
}

export function getTravelPackage(tx: Prisma.TransactionClient, tenantId: string, listingId: string) {
  return tx.listing.findFirstOrThrow({
    where: { id: listingId, tenantId, deletedAt: null, type: "travel_package" },
    include: { travel: { include: { itinerary: { orderBy: { dayNumber: "asc" } } } } },
  });
}

export interface TravelSearch {
  tripType?: TripType;
  country?: string;
  /** Mois de départ, format AAAA-MM : voyages ayant un départ ouvert ce mois-là. */
  month?: string;
  maxPrice?: number;
  search?: string;
  status?: "draft" | "published" | "unavailable" | "archived";
  publishedOnly?: boolean;
  take?: number;
}

export function listTravelPackages(tx: Prisma.TransactionClient, tenantId: string, q: TravelSearch = {}) {
  const now = new Date();
  const monthRange = q.month && /^\d{4}-(0[1-9]|1[0-2])$/.test(q.month) ? monthBounds(q.month) : null;
  return tx.listing.findMany({
    where: {
      tenantId,
      type: "travel_package",
      deletedAt: null,
      ...(q.publishedOnly ? { status: "published" } : q.status ? { status: q.status } : {}),
      ...(q.maxPrice ? { price: { lte: q.maxPrice } } : {}),
      ...(q.search ? { OR: [{ title: { contains: q.search, mode: "insensitive" as const } }, { summary: { contains: q.search, mode: "insensitive" as const } }] } : {}),
      travel: { is: { ...(q.tripType ? { tripType: q.tripType } : {}), ...(q.country ? { destinationCountry: { equals: q.country, mode: "insensitive" as const } } : {}) } },
      ...(monthRange ? { availabilities: { some: { status: "open", startAt: { gte: monthRange.from > now ? monthRange.from : now, lt: monthRange.to } } } } : {}),
    },
    include: {
      travel: true,
      availabilities: { where: { status: "open", startAt: { gt: now } }, orderBy: { startAt: "asc" }, take: 6 },
    },
    orderBy: [{ featured: "desc" }, { updatedAt: "desc" }],
    take: Math.min(q.take ?? 60, 200),
  });
}

export function getPublishedTravelBySlug(tx: Prisma.TransactionClient, tenantId: string, slug: string) {
  return tx.listing.findFirst({
    where: { tenantId, slug, type: "travel_package", status: "published", deletedAt: null },
    include: {
      travel: { include: { itinerary: { orderBy: { dayNumber: "asc" } } } },
      availabilities: { where: { startAt: { gt: new Date() } }, orderBy: { startAt: "asc" }, take: 24 },
    },
  });
}

function monthBounds(month: string) {
  const [y, m] = month.split("-").map(Number) as [number, number];
  return { from: new Date(Date.UTC(y, m - 1, 1)), to: new Date(Date.UTC(y, m, 1)) };
}

// ============================================================================
// DÉPARTS
// ============================================================================

export interface DepartureInput {
  startDate: Date;
  capacity: number;
  pricePerPerson?: number | null;
  label?: string | null;
}

/** Nouveau départ : le retour se déduit de la durée du voyage (jamais saisi deux fois). */
export async function addDeparture(tx: Prisma.TransactionClient, tenantId: string, listingId: string, input: DepartureInput) {
  const travel = await tx.travelPackageDetails.findFirst({ where: { listingId, tenantId } });
  if (!travel) throw new TravelError("Ce voyage n'existe pas.");
  if (input.startDate <= new Date()) throw new TravelError("La date de départ doit être à venir.");
  if (!Number.isInteger(input.capacity) || input.capacity < 1 || input.capacity > 500) throw new TravelError("Le nombre de places doit être compris entre 1 et 500.");
  const endAt = new Date(input.startDate.getTime() + (travel.durationDays - 1) * 86_400_000);
  return addAvailability(tx, tenantId, listingId, {
    startAt: input.startDate,
    endAt: endAt > input.startDate ? endAt : null,
    capacity: input.capacity,
    priceOverride: input.pricePerPerson ?? null,
    label: input.label?.trim() || null,
  });
}

/** Tous les départs à venir de l'agence, avec leur remplissage. */
export function listUpcomingDepartures(tx: Prisma.TransactionClient, tenantId: string, range: { from?: Date; to?: Date; listingId?: string } = {}) {
  return tx.listingAvailability.findMany({
    where: {
      tenantId,
      ...(range.listingId ? { listingId: range.listingId } : {}),
      listing: { type: "travel_package", deletedAt: null },
      startAt: { gte: range.from ?? new Date(), ...(range.to ? { lt: range.to } : {}) },
    },
    include: { listing: { select: { id: true, title: true, slug: true, price: true, status: true } } },
    orderBy: { startAt: "asc" },
    take: 300,
  });
}

// ============================================================================
// RÉSERVATIONS ET VOYAGEURS
// ============================================================================

export interface TravelerInput {
  firstName: string;
  lastName: string;
  birthDate?: Date | null;
  nationality?: string | null;
  passportNumber?: string | null;
  passportExpiry?: Date | null;
}

const PASSPORT = /^[A-Z0-9]{6,12}$/;

function travelerData(t: TravelerInput) {
  const firstName = t.firstName?.trim();
  const lastName = t.lastName?.trim();
  if (!firstName || !lastName) throw new TravelError("Indiquez le prénom et le nom de chaque voyageur, comme sur le passeport.");
  if (firstName.length > 80 || lastName.length > 80) throw new TravelError("Nom de voyageur trop long.");
  if (t.birthDate && (t.birthDate > new Date() || t.birthDate.getUTCFullYear() < 1900)) throw new TravelError("Date de naissance invalide.");
  const passport = t.passportNumber?.replace(/\s+/g, "").toUpperCase() || null;
  if (passport && !PASSPORT.test(passport)) throw new TravelError("Numéro de passeport invalide (6 à 12 lettres ou chiffres).");
  return {
    firstName,
    lastName,
    birthDate: t.birthDate ?? null,
    nationality: t.nationality?.trim() || null,
    ...(passport ? { passportCipher: encryptSecret(passport) as unknown as Prisma.InputJsonValue, passportLast4: passport.slice(-4) } : {}),
    passportExpiry: t.passportExpiry ?? null,
  };
}

export interface BookDepartureInput {
  listingId: string;
  availabilityId: string;
  travelers: TravelerInput[];
  /** Personne à contacter (souvent le premier voyageur) ; ou client existant (dashboard). */
  contact?: CustomerInput | null;
  customerId?: string | null;
  customerNote?: string | null;
  channel?: "web" | "dashboard" | "phone" | "whatsapp";
  actor: { userId: string | null; type: "owner" | "employee" | "system" | "customer" };
}

/**
 * Réserve des places sur un départ : prise de places atomique (registre commun), montant
 * recalculé depuis le départ enregistré, un voyageur nominatif par place, et la liste
 * des pièces à fournir créée pour chacun (statut « à fournir »).
 */
export async function bookDeparture(tx: Prisma.TransactionClient, tenantId: string, input: BookDepartureInput) {
  const travel = await tx.travelPackageDetails.findFirst({ where: { listingId: input.listingId, tenantId } });
  if (!travel) throw new ReservationUnavailableError("Ce voyage n'existe pas ou plus.");
  if (!input.travelers.length || input.travelers.length > 20) throw new TravelError("Indiquez de 1 à 20 voyageurs.");
  const travelers = input.travelers.map(travelerData);
  const reservation = await createReservation(tx, tenantId, {
    listingId: input.listingId,
    availabilityId: input.availabilityId,
    quantity: travelers.length,
    customerId: input.customerId ?? null,
    customer: input.contact ?? null,
    customerNote: input.customerNote,
    channel: input.channel ?? "web",
    moduleKey: DEPARTURES_MODULE,
    actor: input.actor,
  });
  for (const [i, t] of travelers.entries()) {
    const row = await tx.reservationTraveler.create({ data: { tenantId, reservationId: reservation.id, position: i + 1, isLead: i === 0, ...t } });
    if (travel.requiredDocuments.length) {
      await tx.travelerDocument.createMany({ data: travel.requiredDocuments.map((kind) => ({ tenantId, travelerId: row.id, kind })) });
    }
  }
  return reservation;
}

export async function updateTraveler(tx: Prisma.TransactionClient, tenantId: string, travelerId: string, patch: TravelerInput) {
  const traveler = await tx.reservationTraveler.findFirst({ where: { id: travelerId, tenantId } });
  if (!traveler) throw new TravelError("Voyageur introuvable.");
  return tx.reservationTraveler.update({ where: { id: travelerId }, data: travelerData(patch) });
}

export async function setTravelerDocumentStatus(
  tx: Prisma.TransactionClient,
  tenantId: string,
  input: { travelerId: string; kind: TravelDocumentKind; status: DocumentStatus; note?: string | null; actorUserId: string | null },
) {
  if (!includes(TRAVEL_DOCUMENTS, input.kind)) throw new TravelError("Pièce inconnue.");
  if (!includes(DOCUMENT_STATUSES, input.status)) throw new TravelError("Statut de pièce inconnu.");
  // Un visa se DÉPOSE (submitted) puis est accordé ou refusé ; les autres pièces se
  // reçoivent, puis sont validées (approved) ou refusées.
  if (input.kind !== "visa" && input.status === "submitted") throw new TravelError("Seul un visa peut être « déposé ».");
  if (input.kind === "visa" && input.status === "received") throw new TravelError("Un visa est « déposé », puis « accordé » ou « refusé ».");
  const traveler = await tx.reservationTraveler.findFirst({ where: { id: input.travelerId, tenantId }, select: { id: true } });
  if (!traveler) throw new TravelError("Voyageur introuvable.");
  return tx.travelerDocument.upsert({
    where: { travelerId_kind: { travelerId: input.travelerId, kind: input.kind } },
    create: { tenantId, travelerId: input.travelerId, kind: input.kind, status: input.status, note: input.note?.trim() || null, updatedBy: input.actorUserId },
    update: { status: input.status, note: input.note?.trim() || null, updatedBy: input.actorUserId },
  });
}

// ============================================================================
// ENCAISSEMENTS
// ============================================================================

export interface PaymentSummary {
  total: number | null;
  depositDue: number | null;
  paid: number;
  remaining: number | null;
  /** on_request : montant sur devis ; unpaid ; deposit_paid : acompte couvert ; paid : totalité reçue. */
  state: "on_request" | "unpaid" | "partial" | "deposit_paid" | "paid";
}

export function summarizePayments(totalAmount: number | null, depositPercent: number, payments: { amount: number; voidedAt: Date | null }[]): PaymentSummary {
  const paid = payments.filter((p) => !p.voidedAt).reduce((sum, p) => sum + p.amount, 0);
  if (totalAmount == null) return { total: null, depositDue: null, paid, remaining: null, state: "on_request" };
  const depositDue = Math.ceil((totalAmount * depositPercent) / 100);
  const remaining = Math.max(0, totalAmount - paid);
  const state = paid >= totalAmount ? "paid" : paid === 0 ? "unpaid" : paid >= depositDue && depositDue > 0 ? "deposit_paid" : "partial";
  return { total: totalAmount, depositDue, paid, remaining, state };
}

export function formatReceiptNumber(year: number, value: number) {
  return `REC-${year}-${String(value).padStart(6, "0")}`;
}

export interface RecordPaymentInput {
  reservationId: string;
  amount: number;
  method: TravelPaymentMethod;
  kind: "deposit" | "balance" | "other";
  reference?: string | null;
  paidAt?: Date;
  actorUserId: string | null;
}

/**
 * Enregistre un encaissement RÉEL. Réservation verrouillée pendant le calcul du reste à
 * payer : deux saisies simultanées ne peuvent pas dépasser le total. Refusé sur une
 * réservation annulée ou sur devis (montant à fixer d'abord).
 */
export async function recordReservationPayment(tx: Prisma.TransactionClient, tenantId: string, input: RecordPaymentInput) {
  if (!Number.isInteger(input.amount) || input.amount <= 0) throw new TravelError("Le montant doit être un nombre entier positif.");
  if (!includes(TRAVEL_PAYMENT_METHODS, input.method)) throw new TravelError("Moyen de paiement inconnu.");
  if (!["deposit", "balance", "other"].includes(input.kind)) throw new TravelError("Type d'encaissement inconnu.");
  const paidAt = input.paidAt ?? new Date();
  if (paidAt.getTime() > Date.now() + 5 * 60_000) throw new TravelError("La date d'encaissement ne peut pas être dans le futur.");
  const locked = await tx.$queryRaw<{ status: string; totalAmount: number | null }[]>`
    SELECT "status", "totalAmount" FROM "Reservation" WHERE "id" = ${input.reservationId} AND "tenantId" = ${tenantId} FOR UPDATE`;
  const row = locked[0];
  if (!row) throw new TravelError("Réservation introuvable.");
  if (row.status === "canceled") throw new TravelError("Réservation annulée : aucun encaissement ne peut y être ajouté.");
  if (row.totalAmount == null) throw new TravelError("Montant sur devis : fixez d'abord le prix de la réservation.");
  const payments = await tx.reservationPayment.findMany({ where: { tenantId, reservationId: input.reservationId }, select: { amount: true, voidedAt: true } });
  const paid = payments.filter((p) => !p.voidedAt).reduce((s, p) => s + p.amount, 0);
  if (paid + input.amount > row.totalAmount) {
    throw new TravelError(`Montant supérieur au reste à payer (${row.totalAmount - paid} FCFA).`);
  }
  const year = paidAt.getFullYear();
  const receiptNumber = formatReceiptNumber(year, await nextCounterValue(tx, tenantId, `receipt-${year}`));
  return tx.reservationPayment.create({
    data: {
      tenantId,
      reservationId: input.reservationId,
      receiptNumber,
      kind: input.kind,
      amount: input.amount,
      method: input.method,
      reference: input.reference?.trim() || null,
      paidAt,
      recordedBy: input.actorUserId,
    },
  });
}

/** Annule un encaissement saisi par erreur : motif obligatoire, la ligne reste visible. */
export async function voidReservationPayment(tx: Prisma.TransactionClient, tenantId: string, paymentId: string, reason: string) {
  if (!reason?.trim()) throw new TravelError("Indiquez le motif de l'annulation.");
  const { count } = await tx.reservationPayment.updateMany({ where: { id: paymentId, tenantId, voidedAt: null }, data: { voidedAt: new Date(), voidReason: reason.trim() } });
  if (count === 0) throw new TravelError("Encaissement introuvable ou déjà annulé.");
  return tx.reservationPayment.findFirstOrThrow({ where: { id: paymentId, tenantId } });
}

// ============================================================================
// LECTURES MÉTIER
// ============================================================================

const bookingInclude = {
  listing: { select: { id: true, title: true, slug: true, media: true, travel: { select: { depositPercent: true, durationDays: true, destinationCountry: true, destinationCity: true, requiredDocuments: true } } } },
  availability: { select: { startAt: true, endAt: true, label: true } },
  customer: { select: { id: true, firstName: true, lastName: true, phone: true, email: true } },
  travelers: { orderBy: { position: "asc" as const }, include: { documents: { orderBy: { kind: "asc" as const } } } },
  payments: { orderBy: { paidAt: "asc" as const } },
  history: { orderBy: { createdAt: "asc" as const } },
} satisfies Prisma.ReservationInclude;

export function getTravelBooking(tx: Prisma.TransactionClient, tenantId: string, reservationId: string) {
  return tx.reservation.findFirst({ where: { id: reservationId, tenantId, moduleKey: DEPARTURES_MODULE }, include: bookingInclude });
}

/** Le voyageur retrouve SA réservation par son jeton — jamais celle d'un autre. */
export function getTravelBookingByToken(tx: Prisma.TransactionClient, tenantId: string, accessToken: string) {
  return tx.reservation.findFirst({ where: { tenantId, accessToken, moduleKey: DEPARTURES_MODULE }, include: bookingInclude });
}

export function listTravelBookings(tx: Prisma.TransactionClient, tenantId: string, filter: { status?: string; listingId?: string; availabilityId?: string; search?: string; take?: number } = {}) {
  return tx.reservation.findMany({
    where: {
      tenantId,
      moduleKey: DEPARTURES_MODULE,
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.listingId ? { listingId: filter.listingId } : {}),
      ...(filter.availabilityId ? { availabilityId: filter.availabilityId } : {}),
      ...(filter.search
        ? {
            OR: [
              { reference: { contains: filter.search, mode: "insensitive" as const } },
              { customer: { OR: [{ firstName: { contains: filter.search, mode: "insensitive" as const } }, { lastName: { contains: filter.search, mode: "insensitive" as const } }, { phone: { contains: filter.search } }] } },
            ],
          }
        : {}),
    },
    include: {
      listing: { select: { title: true, slug: true, travel: { select: { depositPercent: true } } } },
      customer: { select: { firstName: true, lastName: true, phone: true } },
      payments: { select: { amount: true, voidedAt: true } },
      travelers: { select: { documents: { select: { status: true } } } },
    },
    orderBy: { startAt: "asc" },
    take: Math.min(filter.take ?? 100, 500),
  });
}

/** Manifeste d'un départ : voyageurs confirmés ou en attente, avec l'état de leurs pièces. */
export async function departureManifest(tx: Prisma.TransactionClient, tenantId: string, availabilityId: string) {
  const departure = await tx.listingAvailability.findFirst({
    where: { id: availabilityId, tenantId, listing: { type: "travel_package" } },
    include: { listing: { select: { id: true, title: true, travel: { select: { requiredDocuments: true, depositPercent: true } } } } },
  });
  if (!departure) return null;
  const bookings = await tx.reservation.findMany({
    where: { tenantId, availabilityId, moduleKey: DEPARTURES_MODULE, status: { in: ["requested", "confirmed", "completed"] } },
    include: {
      customer: { select: { firstName: true, lastName: true, phone: true } },
      travelers: { orderBy: { position: "asc" }, include: { documents: true } },
      payments: { select: { amount: true, voidedAt: true } },
    },
    orderBy: { createdAt: "asc" },
  });
  return { departure, bookings };
}

/** Indicateurs de l'agence pour la vue d'ensemble. */
export async function travelOverview(tx: Prisma.TransactionClient, tenantId: string, now = new Date()) {
  const in60 = new Date(now.getTime() + 60 * 86_400_000);
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const [departures, pending, collected, openBookings, missingDocs] = await Promise.all([
    tx.listingAvailability.findMany({ where: { tenantId, listing: { type: "travel_package" }, startAt: { gte: now, lt: in60 } }, select: { capacity: true, reservedCount: true } }),
    tx.reservation.count({ where: { tenantId, moduleKey: DEPARTURES_MODULE, status: "requested" } }),
    tx.reservationPayment.aggregate({ where: { tenantId, voidedAt: null, paidAt: { gte: monthStart } }, _sum: { amount: true } }),
    tx.reservation.findMany({ where: { tenantId, moduleKey: DEPARTURES_MODULE, status: { in: ["requested", "confirmed"] } }, select: { totalAmount: true, payments: { select: { amount: true, voidedAt: true } } } }),
    tx.travelerDocument.count({ where: { tenantId, status: { in: ["missing", "refused"] }, traveler: { reservation: { status: { in: ["requested", "confirmed"] }, startAt: { gte: now } } } } }),
  ]);
  const balanceDue = openBookings.reduce((sum, b) => sum + (b.totalAmount == null ? 0 : Math.max(0, b.totalAmount - b.payments.filter((p) => !p.voidedAt).reduce((s, p) => s + p.amount, 0))), 0);
  return {
    upcomingDepartures: departures.length,
    seats: departures.reduce((s, d) => s + d.capacity, 0),
    seatsSold: departures.reduce((s, d) => s + d.reservedCount, 0),
    pendingRequests: pending,
    collectedThisMonth: collected._sum.amount ?? 0,
    balanceDue,
    missingDocuments: missingDocs,
  };
}
