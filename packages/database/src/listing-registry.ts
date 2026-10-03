import type { Prisma } from "@prisma/client";
import { assertQuotaAvailable } from "./subscription-usage";

/**
 * Fiches génériques des secteurs hors commerce (docs/04 §4.5.2) : bien immobilier,
 * offre de voyage, prestation, chambre, véhicule, formation. Point de passage UNIQUE
 * pour créer, modifier, publier ou retirer une fiche :
 *
 * - le quota « fiches » de la formule est vérifié côté serveur avant toute création ;
 * - chaque enregistrement écrit une révision complète, immuable en base
 *   (opposable si une annonce est modifiée après une réservation) ;
 * - le statut ne change que par les transitions ci-dessous, gardées contre les
 *   écritures concurrentes (même idiome que les commandes et les abonnements).
 *
 * Toujours appelé dans une transaction `withTenant` : la RLS garantit en plus qu'une
 * entreprise ne lit ni n'écrit jamais la fiche d'une autre.
 */

export const LISTING_TYPES = ["property", "travel_package", "service_offering", "room", "vehicle", "course"] as const;
export type ListingType = (typeof LISTING_TYPES)[number];

export const LISTING_STATUSES = ["draft", "published", "unavailable", "archived"] as const;
export type ListingStatus = (typeof LISTING_STATUSES)[number];

export const PRICE_UNITS = ["total", "per_person", "per_night", "per_month", "per_session", "on_request"] as const;
export type PriceUnit = (typeof PRICE_UNITS)[number];

export const LISTING_STATUS_TRANSITIONS: Record<ListingStatus, ListingStatus[]> = {
  draft: ["published", "archived"],
  published: ["unavailable", "draft", "archived"],
  unavailable: ["published", "archived"],
  archived: ["draft"],
};

export class InvalidListingTransitionError extends Error {
  constructor(public readonly from: string, public readonly to: string) {
    super(`Transition de fiche impossible : ${from} → ${to}.`);
  }
}

export class ListingConflictError extends Error {
  constructor(listingId: string) {
    super(`La fiche ${listingId} a été modifiée en parallèle — rechargez puis réessayez.`);
  }
}

export class ListingNotFoundError extends Error {
  constructor(listingId: string) {
    super(`Fiche introuvable : ${listingId}.`);
  }
}

export class ListingHasActiveReservationsError extends Error {
  constructor(public readonly count: number) {
    super(`Cette fiche a ${count} réservation(s) à venir : annulez-les ou honorez-les avant de la supprimer.`);
  }
}

export class InvalidListingInputError extends Error {}

export interface ListingInput {
  moduleKey: string;
  type: ListingType;
  title: string;
  slug?: string;
  summary?: string | null;
  description?: string | null;
  price?: number | null;
  priceUnit?: PriceUnit;
  location?: { region?: string; commune?: string; neighborhood?: string } | null;
  media?: { url: string; alt?: string; demo?: boolean }[];
  featured?: boolean;
}

export type ListingPatch = Partial<Omit<ListingInput, "moduleKey" | "type">>;

export function slugifyListingTitle(title: string): string {
  const base = title
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70);
  return base || "fiche";
}

function assertValidInput(input: ListingPatch & { type?: string; priceUnit?: string }) {
  if (input.title !== undefined && !input.title.trim()) throw new InvalidListingInputError("Titre requis.");
  if (input.type !== undefined && !(LISTING_TYPES as readonly string[]).includes(input.type)) {
    throw new InvalidListingInputError(`Type de fiche inconnu : ${input.type}.`);
  }
  if (input.priceUnit !== undefined && !(PRICE_UNITS as readonly string[]).includes(input.priceUnit)) {
    throw new InvalidListingInputError(`Unité de prix inconnue : ${input.priceUnit}.`);
  }
  if (input.price != null && (!Number.isInteger(input.price) || input.price < 0)) {
    throw new InvalidListingInputError("Le prix doit être un montant entier positif en FCFA.");
  }
  if (input.slug !== undefined && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.slug)) {
    throw new InvalidListingInputError("Adresse de la fiche invalide (lettres minuscules, chiffres et tirets).");
  }
}

/** Premier slug libre pour cette entreprise : « villa-almadies », puis « villa-almadies-2 »… */
async function availableSlug(tx: Prisma.TransactionClient, tenantId: string, wanted: string, exceptId?: string) {
  const taken = new Set(
    (
      await tx.listing.findMany({
        where: { tenantId, slug: { startsWith: wanted }, ...(exceptId ? { id: { not: exceptId } } : {}) },
        select: { slug: true },
      })
    ).map((l) => l.slug),
  );
  if (!taken.has(wanted)) return wanted;
  for (let i = 2; ; i++) if (!taken.has(`${wanted}-${i}`)) return `${wanted}-${i}`;
}

async function writeRevision(tx: Prisma.TransactionClient, tenantId: string, listingId: string, changedBy: string | null) {
  const listing = await tx.listing.findFirstOrThrow({ where: { id: listingId, tenantId } });
  await tx.listingRevision.create({
    data: { tenantId, listingId, changedBy, snapshot: JSON.parse(JSON.stringify(listing)) as Prisma.InputJsonValue },
  });
  return listing;
}

export async function createListing(tx: Prisma.TransactionClient, tenantId: string, input: ListingInput, actorUserId: string | null) {
  assertValidInput(input);
  await assertQuotaAvailable(tx, tenantId, "records");
  const slug = await availableSlug(tx, tenantId, input.slug ?? slugifyListingTitle(input.title));
  const created = await tx.listing.create({
    data: {
      tenantId,
      moduleKey: input.moduleKey,
      type: input.type,
      title: input.title.trim(),
      slug,
      summary: input.summary ?? null,
      description: input.description ?? null,
      price: input.price ?? null,
      priceUnit: input.priceUnit ?? "total",
      location: input.location ?? undefined,
      media: input.media ?? [],
      featured: input.featured ?? false,
      createdBy: actorUserId,
    },
  });
  return writeRevision(tx, tenantId, created.id, actorUserId);
}

async function getLiveListing(tx: Prisma.TransactionClient, tenantId: string, listingId: string) {
  const listing = await tx.listing.findFirst({ where: { id: listingId, tenantId, deletedAt: null } });
  if (!listing) throw new ListingNotFoundError(listingId);
  return listing;
}

export async function updateListing(
  tx: Prisma.TransactionClient,
  tenantId: string,
  listingId: string,
  patch: ListingPatch,
  actorUserId: string | null,
) {
  assertValidInput(patch);
  const current = await getLiveListing(tx, tenantId, listingId);
  const slug = patch.slug && patch.slug !== current.slug ? await availableSlug(tx, tenantId, patch.slug, listingId) : undefined;
  const { count } = await tx.listing.updateMany({
    // Garde optimiste : rien n'a changé depuis la lecture (sinon une modification
    // concurrente serait écrasée sans révision intermédiaire).
    where: { id: listingId, tenantId, updatedAt: current.updatedAt, deletedAt: null },
    data: {
      ...(patch.title !== undefined ? { title: patch.title.trim() } : {}),
      ...(slug ? { slug } : {}),
      ...(patch.summary !== undefined ? { summary: patch.summary } : {}),
      ...(patch.description !== undefined ? { description: patch.description } : {}),
      ...(patch.price !== undefined ? { price: patch.price } : {}),
      ...(patch.priceUnit !== undefined ? { priceUnit: patch.priceUnit } : {}),
      ...(patch.location !== undefined ? { location: patch.location ?? undefined } : {}),
      ...(patch.media !== undefined ? { media: patch.media } : {}),
      ...(patch.featured !== undefined ? { featured: patch.featured } : {}),
    },
  });
  if (count === 0) throw new ListingConflictError(listingId);
  return writeRevision(tx, tenantId, listingId, actorUserId);
}

export async function setListingStatus(
  tx: Prisma.TransactionClient,
  tenantId: string,
  listingId: string,
  toStatus: ListingStatus,
  actorUserId: string | null,
) {
  const current = await getLiveListing(tx, tenantId, listingId);
  if (current.status === toStatus) return current;
  const allowed = LISTING_STATUS_TRANSITIONS[current.status as ListingStatus] ?? [];
  if (!allowed.includes(toStatus)) throw new InvalidListingTransitionError(current.status, toStatus);
  const { count } = await tx.listing.updateMany({
    where: { id: listingId, tenantId, status: current.status, deletedAt: null },
    data: { status: toStatus },
  });
  if (count === 0) throw new ListingConflictError(listingId);
  return writeRevision(tx, tenantId, listingId, actorUserId);
}

/** Retrait définitif de la fiche (conservée pour l'historique, plus comptée dans le
 *  quota). Refusé tant que des réservations à venir sont en cours. */
export async function deleteListing(tx: Prisma.TransactionClient, tenantId: string, listingId: string, actorUserId: string | null) {
  await getLiveListing(tx, tenantId, listingId);
  const active = await tx.reservation.count({
    where: { tenantId, listingId, status: { in: ["requested", "confirmed"] }, startAt: { gte: new Date() } },
  });
  if (active > 0) throw new ListingHasActiveReservationsError(active);
  await tx.listing.update({ where: { id: listingId }, data: { status: "archived", deletedAt: new Date(), featured: false } });
  return writeRevision(tx, tenantId, listingId, actorUserId);
}

export interface ListListingsFilter {
  moduleKey?: string;
  status?: ListingStatus;
  search?: string;
  take?: number;
}

export function listListings(tx: Prisma.TransactionClient, tenantId: string, filter: ListListingsFilter = {}) {
  return tx.listing.findMany({
    where: {
      tenantId,
      deletedAt: null,
      ...(filter.moduleKey ? { moduleKey: filter.moduleKey } : {}),
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.search ? { title: { contains: filter.search, mode: "insensitive" as const } } : {}),
    },
    orderBy: [{ featured: "desc" }, { updatedAt: "desc" }],
    take: Math.min(filter.take ?? 100, 500),
  });
}

/** Fiche visible du public (site de l'entreprise) — jamais un brouillon ni une fiche retirée. */
export function getPublishedListingBySlug(tx: Prisma.TransactionClient, tenantId: string, slug: string) {
  return tx.listing.findFirst({ where: { tenantId, slug, status: "published", deletedAt: null } });
}

export function listListingRevisions(tx: Prisma.TransactionClient, tenantId: string, listingId: string) {
  return tx.listingRevision.findMany({ where: { tenantId, listingId }, orderBy: { changedAt: "desc" }, take: 50 });
}

// ============================================================================
// CRÉNEAUX (départs, rendez-vous, nuitées, visites)
// ============================================================================

export class InvalidAvailabilityError extends Error {}

export interface AvailabilityInput {
  startAt: Date;
  endAt?: Date | null;
  capacity?: number;
  priceOverride?: number | null;
  label?: string | null;
}

export async function addAvailability(tx: Prisma.TransactionClient, tenantId: string, listingId: string, input: AvailabilityInput) {
  await getLiveListing(tx, tenantId, listingId);
  const capacity = input.capacity ?? 1;
  if (!Number.isInteger(capacity) || capacity < 1) throw new InvalidAvailabilityError("La capacité doit être d'au moins 1.");
  if (input.endAt && input.endAt <= input.startAt) throw new InvalidAvailabilityError("La fin doit être après le début.");
  if (input.priceOverride != null && (!Number.isInteger(input.priceOverride) || input.priceOverride < 0)) {
    throw new InvalidAvailabilityError("Le prix du créneau doit être un montant entier positif.");
  }
  return tx.listingAvailability.create({
    data: {
      tenantId,
      listingId,
      startAt: input.startAt,
      endAt: input.endAt ?? null,
      capacity,
      priceOverride: input.priceOverride ?? null,
      label: input.label ?? null,
    },
  });
}

/** Modifie la capacité d'un créneau — jamais en dessous des places déjà réservées. */
export async function setAvailabilityCapacity(tx: Prisma.TransactionClient, tenantId: string, availabilityId: string, capacity: number) {
  if (!Number.isInteger(capacity) || capacity < 1) throw new InvalidAvailabilityError("La capacité doit être d'au moins 1.");
  const { count } = await tx.listingAvailability.updateMany({
    where: { id: availabilityId, tenantId, reservedCount: { lte: capacity } },
    data: { capacity },
  });
  if (count === 0) {
    const slot = await tx.listingAvailability.findFirst({ where: { id: availabilityId, tenantId } });
    if (!slot) throw new InvalidAvailabilityError("Créneau introuvable.");
    throw new InvalidAvailabilityError(`${slot.reservedCount} place(s) déjà réservée(s) : la capacité ne peut pas descendre en dessous.`);
  }
  return tx.listingAvailability.findFirstOrThrow({ where: { id: availabilityId, tenantId } });
}

export async function setAvailabilityStatus(tx: Prisma.TransactionClient, tenantId: string, availabilityId: string, status: "open" | "closed") {
  const { count } = await tx.listingAvailability.updateMany({ where: { id: availabilityId, tenantId }, data: { status } });
  if (count === 0) throw new InvalidAvailabilityError("Créneau introuvable.");
  return tx.listingAvailability.findFirstOrThrow({ where: { id: availabilityId, tenantId } });
}

export function listAvailabilities(
  tx: Prisma.TransactionClient,
  tenantId: string,
  listingId: string,
  range: { from?: Date; to?: Date; openOnly?: boolean } = {},
) {
  return tx.listingAvailability.findMany({
    where: {
      tenantId,
      listingId,
      ...(range.openOnly ? { status: "open" } : {}),
      startAt: { ...(range.from ? { gte: range.from } : {}), ...(range.to ? { lt: range.to } : {}) },
    },
    orderBy: { startAt: "asc" },
    take: 500,
  });
}
