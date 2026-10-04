import { Prisma } from "@prisma/client";
import { nextCounterValue } from "./counters";
import { resolveOrCreateCustomer, type CustomerInput } from "./customer-registry";
import { createListing, InvalidListingInputError, setListingStatus, updateListing, type ListingInput } from "./listing-registry";
import { createReservation } from "./reservation-registry";

/**
 * Immobilier (secteur `real_estate`) — biens, demandes de visite, baux et loyers.
 * S'appuie sur les primitives communes (fiche, réservation) : un bien EST une fiche
 * `type = "property"` + sa fiche technique `PropertyDetails` ; une visite EST une
 * réservation du module "visit_requests". Seuls les baux et les loyers, propres à ce
 * secteur, ont leurs modèles dédiés (docs/04 §4.5.3).
 *
 * Un loyer n'est JAMAIS marqué payé sans encaissement réellement enregistré par
 * l'agence (montant, date, moyen) — contrainte CHECK en base en plus de ce registre.
 */

export const PROPERTY_TYPES = ["apartment", "house", "villa", "land", "commercial", "office"] as const;
export type PropertyType = (typeof PROPERTY_TYPES)[number];
export const DEAL_TYPES = ["sale", "rent"] as const;
export type DealType = (typeof DEAL_TYPES)[number];
export const PROPERTY_AMENITIES = ["pool", "garden", "parking", "guard", "air_conditioning", "sea_view", "generator", "elevator", "terrace", "furnished_kitchen"] as const;
export const RENT_PAYMENT_METHODS = ["cash", "wave", "orange_money", "bank_transfer", "check"] as const;
export type RentPaymentMethod = (typeof RENT_PAYMENT_METHODS)[number];

export const REAL_ESTATE_MODULE = "listings";
export const VISIT_MODULE = "visit_requests";

export interface PropertyInput {
  title: string;
  slug?: string;
  summary?: string | null;
  description?: string | null;
  price?: number | null;
  location?: ListingInput["location"];
  media?: ListingInput["media"];
  featured?: boolean;
  propertyType: PropertyType;
  dealType: DealType;
  bedrooms?: number | null;
  bathrooms?: number | null;
  surfaceM2?: number | null;
  landSurfaceM2?: number | null;
  furnished?: boolean;
  amenities?: string[];
  agencyReference?: string | null;
}

function assertPropertyDetails(input: Partial<PropertyInput>) {
  if (input.propertyType !== undefined && !(PROPERTY_TYPES as readonly string[]).includes(input.propertyType)) {
    throw new InvalidListingInputError(`Type de bien inconnu : ${input.propertyType}.`);
  }
  if (input.dealType !== undefined && !(DEAL_TYPES as readonly string[]).includes(input.dealType)) {
    throw new InvalidListingInputError("Choisissez vente ou location.");
  }
  for (const [key, label] of [["bedrooms", "chambres"], ["bathrooms", "salles de bain"]] as const) {
    const v = input[key];
    if (v != null && (!Number.isInteger(v) || v < 0 || v > 50)) throw new InvalidListingInputError(`Nombre de ${label} invalide.`);
  }
  for (const key of ["surfaceM2", "landSurfaceM2"] as const) {
    const v = input[key];
    if (v != null && (!Number.isInteger(v) || v <= 0)) throw new InvalidListingInputError("La surface doit être un nombre entier de m².");
  }
  if (input.amenities?.some((a) => !(PROPERTY_AMENITIES as readonly string[]).includes(a))) {
    throw new InvalidListingInputError("Équipement inconnu.");
  }
}

const detailsData = (input: Partial<PropertyInput>) => ({
  ...(input.propertyType !== undefined ? { propertyType: input.propertyType } : {}),
  ...(input.dealType !== undefined ? { dealType: input.dealType } : {}),
  ...(input.bedrooms !== undefined ? { bedrooms: input.bedrooms } : {}),
  ...(input.bathrooms !== undefined ? { bathrooms: input.bathrooms } : {}),
  ...(input.surfaceM2 !== undefined ? { surfaceM2: input.surfaceM2 } : {}),
  ...(input.landSurfaceM2 !== undefined ? { landSurfaceM2: input.landSurfaceM2 } : {}),
  ...(input.furnished !== undefined ? { furnished: input.furnished } : {}),
  ...(input.amenities !== undefined ? { amenities: input.amenities } : {}),
  ...(input.agencyReference !== undefined ? { agencyReference: input.agencyReference } : {}),
});

export async function createProperty(tx: Prisma.TransactionClient, tenantId: string, input: PropertyInput, actorUserId: string | null) {
  assertPropertyDetails(input);
  const listing = await createListing(
    tx,
    tenantId,
    {
      moduleKey: REAL_ESTATE_MODULE,
      type: "property",
      title: input.title,
      slug: input.slug,
      summary: input.summary,
      description: input.description,
      price: input.price,
      // Location : loyer mensuel ; vente : prix total. Sans prix : « prix sur demande ».
      priceUnit: input.price == null ? "on_request" : input.dealType === "rent" ? "per_month" : "total",
      location: input.location,
      media: input.media,
      featured: input.featured,
    },
    actorUserId,
  );
  await tx.propertyDetails.create({
    data: { listingId: listing.id, tenantId, propertyType: input.propertyType, dealType: input.dealType, ...detailsData(input) },
  });
  return getProperty(tx, tenantId, listing.id);
}

export async function updateProperty(
  tx: Prisma.TransactionClient,
  tenantId: string,
  listingId: string,
  patch: Partial<PropertyInput>,
  actorUserId: string | null,
) {
  assertPropertyDetails(patch);
  const current = await tx.propertyDetails.findFirst({ where: { listingId, tenantId } });
  if (!current) throw new InvalidListingInputError("Ce bien n'existe pas.");
  const details = detailsData(patch);
  if (Object.keys(details).length) await tx.propertyDetails.update({ where: { listingId }, data: details });
  const dealType = patch.dealType ?? (current.dealType as DealType);
  const currentListing = await tx.listing.findFirstOrThrow({ where: { id: listingId, tenantId }, select: { price: true } });
  // La révision de la fiche est écrite APRÈS la fiche technique : l'instantané reste
  // cohérent avec l'état enregistré.
  await updateListing(
    tx,
    tenantId,
    listingId,
    {
      ...(patch.title !== undefined ? { title: patch.title } : {}),
      ...(patch.slug !== undefined ? { slug: patch.slug } : {}),
      ...(patch.summary !== undefined ? { summary: patch.summary } : {}),
      ...(patch.description !== undefined ? { description: patch.description } : {}),
      ...(patch.location !== undefined ? { location: patch.location } : {}),
      ...(patch.media !== undefined ? { media: patch.media } : {}),
      ...(patch.featured !== undefined ? { featured: patch.featured } : {}),
      ...(patch.price !== undefined || patch.dealType !== undefined
        ? {
            ...(patch.price !== undefined ? { price: patch.price } : {}),
            priceUnit: ((patch.price !== undefined ? patch.price : currentListing.price) === null
              ? "on_request"
              : dealType === "rent"
                ? "per_month"
                : "total") as ListingInput["priceUnit"],
          }
        : {}),
    },
    actorUserId,
  );
  return getProperty(tx, tenantId, listingId);
}

export function getProperty(tx: Prisma.TransactionClient, tenantId: string, listingId: string) {
  return tx.listing.findFirstOrThrow({ where: { id: listingId, tenantId, deletedAt: null, type: "property" }, include: { property: true } });
}

export interface PropertySearch {
  dealType?: DealType;
  propertyType?: PropertyType;
  minBedrooms?: number;
  maxPrice?: number;
  commune?: string;
  search?: string;
  status?: "draft" | "published" | "unavailable" | "archived";
  publishedOnly?: boolean;
  featuredFirst?: boolean;
  take?: number;
}

export function listProperties(tx: Prisma.TransactionClient, tenantId: string, q: PropertySearch = {}) {
  return tx.listing.findMany({
    where: {
      tenantId,
      type: "property",
      deletedAt: null,
      ...(q.publishedOnly ? { status: "published" } : q.status ? { status: q.status } : {}),
      ...(q.maxPrice ? { price: { lte: q.maxPrice } } : {}),
      ...(q.search ? { OR: [{ title: { contains: q.search, mode: "insensitive" as const } }, { summary: { contains: q.search, mode: "insensitive" as const } }] } : {}),
      ...(q.commune ? { location: { path: ["commune"], string_contains: q.commune } } : {}),
      property: {
        is: {
          ...(q.dealType ? { dealType: q.dealType } : {}),
          ...(q.propertyType ? { propertyType: q.propertyType } : {}),
          ...(q.minBedrooms ? { bedrooms: { gte: q.minBedrooms } } : {}),
        },
      },
    },
    include: { property: true },
    orderBy: q.featuredFirst === false ? [{ updatedAt: "desc" }] : [{ featured: "desc" }, { updatedAt: "desc" }],
    take: Math.min(q.take ?? 60, 200),
  });
}

export function getPublishedPropertyBySlug(tx: Prisma.TransactionClient, tenantId: string, slug: string) {
  return tx.listing.findFirst({ where: { tenantId, slug, type: "property", status: "published", deletedAt: null }, include: { property: true } });
}

// ============================================================================
// VISITES
// ============================================================================

export interface VisitRequestInput {
  listingId: string;
  preferredAt: Date;
  customer: CustomerInput;
  message?: string | null;
  channel?: "web" | "dashboard" | "phone" | "whatsapp";
  actor: { userId: string | null; type: "owner" | "employee" | "system" | "customer" };
}

/** Demande de visite : réservation sans montant, à confirmer par l'agence. */
export async function requestPropertyVisit(tx: Prisma.TransactionClient, tenantId: string, input: VisitRequestInput) {
  const property = await tx.propertyDetails.findFirst({ where: { listingId: input.listingId, tenantId } });
  if (!property) throw new InvalidListingInputError("Ce bien n'existe pas.");
  return createReservation(tx, tenantId, {
    listingId: input.listingId,
    requestedStartAt: input.preferredAt,
    customer: input.customer,
    customerNote: input.message,
    channel: input.channel ?? "web",
    pricing: "none",
    moduleKey: VISIT_MODULE,
    actor: input.actor,
  });
}

// ============================================================================
// BAUX ET LOYERS
// ============================================================================

export class LeaseError extends Error {}

export interface CreateLeaseInput {
  listingId: string;
  occupantCustomerId?: string | null;
  occupant?: CustomerInput | null;
  landlordName?: string | null;
  landlordPhone?: string | null;
  startDate: Date;
  endDate?: Date | null;
  monthlyRent: number;
  charges?: number;
  depositAmount?: number;
  dueDay?: number;
  notes?: string | null;
}

const toPeriod = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
const utcDate = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, d));

export async function createLease(tx: Prisma.TransactionClient, tenantId: string, input: CreateLeaseInput, actorUserId: string | null) {
  const property = await tx.propertyDetails.findFirst({ where: { listingId: input.listingId, tenantId }, include: { listing: true } });
  if (!property || property.listing.deletedAt) throw new LeaseError("Ce bien n'existe pas.");
  if (property.dealType !== "rent") throw new LeaseError("Un bail ne concerne qu'un bien proposé à la location.");
  if (!Number.isInteger(input.monthlyRent) || input.monthlyRent <= 0) throw new LeaseError("Loyer mensuel invalide.");
  for (const v of [input.charges, input.depositAmount]) {
    if (v != null && (!Number.isInteger(v) || v < 0)) throw new LeaseError("Montant invalide.");
  }
  const dueDay = input.dueDay ?? 5;
  if (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 28) throw new LeaseError("Le jour d'échéance doit être entre 1 et 28.");
  if (input.endDate && input.endDate <= input.startDate) throw new LeaseError("La fin du bail doit être après son début.");
  const active = await tx.lease.findFirst({ where: { tenantId, listingId: input.listingId, status: "active" }, select: { reference: true } });
  if (active) throw new LeaseError(`Ce bien a déjà un bail actif (${active.reference}).`);

  let occupantCustomerId = input.occupantCustomerId ?? null;
  if (occupantCustomerId) {
    const owned = await tx.customer.findFirst({ where: { id: occupantCustomerId, tenantId }, select: { id: true } });
    if (!owned) throw new LeaseError("Locataire introuvable.");
  } else {
    if (!input.occupant?.firstName?.trim() || !input.occupant.phone?.trim()) throw new LeaseError("Nom et téléphone du locataire requis.");
    occupantCustomerId = (await resolveOrCreateCustomer(tx, tenantId, input.occupant)).id;
  }

  const year = input.startDate.getUTCFullYear();
  const reference = `BAIL-${year}-${String(await nextCounterValue(tx, tenantId, `lease-${year}`)).padStart(4, "0")}`;
  let lease;
  try {
    lease = await tx.lease.create({
      data: {
        tenantId,
        reference,
        listingId: input.listingId,
        occupantCustomerId,
        landlordName: input.landlordName?.trim() || null,
        landlordPhone: input.landlordPhone?.trim() || null,
        startDate: input.startDate,
        endDate: input.endDate ?? null,
        monthlyRent: input.monthlyRent,
        charges: input.charges ?? 0,
        depositAmount: input.depositAmount ?? 0,
        dueDay,
        notes: input.notes?.trim() || null,
        createdBy: actorUserId,
      },
    });
  } catch (error) {
    // Course perdue contre un autre bail créé au même instant : l'index unique partiel
    // (un seul bail actif par bien) a tranché.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new LeaseError("Ce bien a déjà un bail actif.");
    throw error;
  }
  // Un bien loué n'est plus proposé sur le site.
  if (property.listing.status === "published") await setListingStatus(tx, tenantId, input.listingId, "unavailable", actorUserId);
  await ensureRentSchedule(tx, tenantId, lease.id, new Date());
  return lease;
}

/**
 * Crée (idempotent) les échéances de loyer du début du bail jusqu'au mois suivant
 * `until` — jamais au-delà de la fin du bail. Appelé à la création du bail et à chaque
 * consultation de l'échéancier ; aucune échéance n'est dupliquée (unique leaseId+period).
 */
export async function ensureRentSchedule(tx: Prisma.TransactionClient, tenantId: string, leaseId: string, until: Date) {
  const lease = await tx.lease.findFirst({ where: { id: leaseId, tenantId } });
  if (!lease || lease.status !== "active") return 0;
  const last = utcDate(until.getUTCFullYear(), until.getUTCMonth() + 1, 1);
  const rows: Prisma.RentPaymentCreateManyInput[] = [];
  for (let d = utcDate(lease.startDate.getUTCFullYear(), lease.startDate.getUTCMonth(), 1); d <= last; d = utcDate(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)) {
    const dueDate = utcDate(d.getUTCFullYear(), d.getUTCMonth(), lease.dueDay);
    if (lease.endDate && dueDate > lease.endDate) break;
    rows.push({ tenantId, leaseId, period: toPeriod(d), dueDate, amountDue: lease.monthlyRent + lease.charges });
    if (rows.length > 240) break;
  }
  if (!rows.length) return 0;
  const { count } = await tx.rentPayment.createMany({ data: rows, skipDuplicates: true });
  return count;
}

export interface RecordRentPaymentInput {
  rentPaymentId: string;
  amountPaid: number;
  method: RentPaymentMethod;
  paymentReference?: string | null;
  paidAt?: Date;
}

/**
 * Enregistre un encaissement RÉEL. Le loyer passe à « payé » seulement si le montant
 * cumulé couvre l'échéance ; un paiement partiel reste « en attente » avec son
 * montant. Garde contre la double saisie : l'échéance est verrouillée.
 */
export async function recordRentPayment(tx: Prisma.TransactionClient, tenantId: string, input: RecordRentPaymentInput, actorUserId: string | null) {
  if (!Number.isInteger(input.amountPaid) || input.amountPaid <= 0) throw new LeaseError("Montant encaissé invalide.");
  if (!(RENT_PAYMENT_METHODS as readonly string[]).includes(input.method)) throw new LeaseError("Moyen de paiement inconnu.");
  const locked = await tx.$queryRaw<{ status: string; amountDue: number; amountPaid: number; period: string }[]>`
    SELECT "status", "amountDue", "amountPaid", "period" FROM "RentPayment"
     WHERE "id" = ${input.rentPaymentId} AND "tenantId" = ${tenantId} FOR UPDATE`;
  const row = locked[0];
  if (!row) throw new LeaseError("Échéance introuvable.");
  if (row.status !== "pending") throw new LeaseError(row.status === "paid" ? "Ce loyer est déjà enregistré comme payé." : "Cette échéance est annulée.");
  const total = row.amountPaid + input.amountPaid;
  if (total > row.amountDue) throw new LeaseError(`Le montant dépasse le reste dû (${row.amountDue - row.amountPaid} FCFA).`);
  const fullyPaid = total === row.amountDue;
  const paidAt = input.paidAt ?? new Date();
  const receiptNumber = fullyPaid
    ? `QUIT-${paidAt.getUTCFullYear()}-${String(await nextCounterValue(tx, tenantId, `rent-receipt-${paidAt.getUTCFullYear()}`)).padStart(6, "0")}`
    : null;
  return tx.rentPayment.update({
    where: { id: input.rentPaymentId },
    data: {
      amountPaid: total,
      method: input.method,
      paymentReference: input.paymentReference?.trim() || null,
      paidAt,
      recordedBy: actorUserId,
      ...(fullyPaid ? { status: "paid", receiptNumber } : {}),
    },
  });
}

/** Fin de bail : les échéances postérieures encore dues sont annulées (jamais les
 *  échéances passées impayées, qui restent une dette réelle). */
export async function endLease(
  tx: Prisma.TransactionClient,
  tenantId: string,
  leaseId: string,
  input: { endDate: Date; status: "ended" | "terminated" },
  actorUserId: string | null,
) {
  const { count } = await tx.lease.updateMany({
    where: { id: leaseId, tenantId, status: "active" },
    data: { status: input.status, endDate: input.endDate, endedAt: new Date() },
  });
  if (count === 0) throw new LeaseError("Ce bail n'est pas actif.");
  await tx.rentPayment.updateMany({ where: { tenantId, leaseId, status: "pending", amountPaid: 0, dueDate: { gt: input.endDate } }, data: { status: "canceled" } });
  const lease = await tx.lease.findFirstOrThrow({ where: { id: leaseId, tenantId } });
  void actorUserId;
  return lease;
}

export function listLeases(tx: Prisma.TransactionClient, tenantId: string, filter: { status?: "active" | "ended" | "terminated" } = {}) {
  return tx.lease.findMany({
    where: { tenantId, ...(filter.status ? { status: filter.status } : {}) },
    include: {
      listing: { select: { id: true, title: true, slug: true } },
      occupant: { select: { firstName: true, lastName: true, phone: true } },
      rentPayments: { orderBy: { dueDate: "desc" }, take: 24 },
    },
    orderBy: [{ status: "asc" }, { startDate: "desc" }],
  });
}

export async function rentOverview(tx: Prisma.TransactionClient, tenantId: string, now = new Date()) {
  const today = utcDate(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const period = toPeriod(now);
  const [activeLeases, late, thisMonth, collected] = await Promise.all([
    tx.lease.count({ where: { tenantId, status: "active" } }),
    tx.rentPayment.aggregate({ where: { tenantId, status: "pending", dueDate: { lt: today } }, _count: true, _sum: { amountDue: true, amountPaid: true } }),
    tx.rentPayment.aggregate({ where: { tenantId, period, status: { not: "canceled" } }, _sum: { amountDue: true } }),
    tx.rentPayment.aggregate({ where: { tenantId, period, status: { not: "canceled" } }, _sum: { amountPaid: true } }),
  ]);
  return {
    activeLeases,
    lateCount: late._count,
    lateAmount: (late._sum.amountDue ?? 0) - (late._sum.amountPaid ?? 0),
    dueThisMonth: thisMonth._sum.amountDue ?? 0,
    collectedThisMonth: collected._sum.amountPaid ?? 0,
  };
}

/** Une échéance est en retard si elle est encore due après sa date — calculé, jamais stocké. */
export function isRentLate(payment: { status: string; dueDate: Date }, now = new Date()) {
  const today = utcDate(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return payment.status === "pending" && payment.dueDate < today;
}
