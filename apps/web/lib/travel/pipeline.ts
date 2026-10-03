import "server-only";
import { z } from "zod";
import {
  withTenant,
  addDeparture,
  bookDeparture,
  createTravelPackage,
  deleteListing,
  recordReservationPayment,
  setAvailabilityCapacity,
  setAvailabilityStatus,
  setListingStatus,
  setMediaAssetPublic,
  setTravelerDocumentStatus,
  transitionReservationStatus,
  updateTraveler,
  updateTravelPackage,
  voidReservationPayment,
  AvailabilityFullError,
  DEPARTURES_MODULE,
  DOCUMENT_STATUSES,
  InvalidAvailabilityError,
  InvalidListingInputError,
  InvalidListingTransitionError,
  InvalidReservationTransitionError,
  ListingConflictError,
  ListingHasActiveReservationsError,
  ListingNotFoundError,
  QuotaExceededError,
  ReservationNotFoundError,
  ReservationUnavailableError,
  TRAVEL_DOCUMENTS,
  TRAVEL_INCLUSIONS,
  TRAVEL_PAYMENT_METHODS,
  TRIP_TYPES,
  TravelError,
} from "@yamacommerce/database";
import type { Permission } from "@yamacommerce/auth";
import { getCurrentTenantMembership } from "@/lib/current-tenant";
import { requireTenantPermission } from "@/lib/tenant-permissions";
import { checkImage } from "@/lib/media/image-refs";
import { getTenantModuleKeys, isTravel } from "@/lib/modules/tenant-modules";

/**
 * Actions voyage du tableau de bord. Chaque action revérifie côté serveur la permission
 * précise du membre (jamais seulement masquée dans l'interface), la RLS isole
 * l'entreprise, et les règles métier vivent dans le registre (packages/database).
 */

export type ActionResult<T = unknown> = { ok: true; data: T } | { ok: false; status: number; error: string };

const optionalText = (max: number) => z.string().trim().max(max).nullable().optional().transform((v) => (v ? v : null));
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide.");

export const tripSchema = z.object({
  title: z.string().trim().min(3, "Titre trop court.").max(120),
  summary: optionalText(220),
  description: optionalText(5_000),
  pricePerPerson: z.number().int().min(1).max(100_000_000).nullable(),
  tripType: z.enum(TRIP_TYPES),
  destinationCountry: z.string().trim().min(2, "Indiquez le pays.").max(60),
  destinationCity: optionalText(80),
  durationDays: z.number().int().min(1).max(90),
  durationNights: z.number().int().min(0).max(90),
  included: z.array(z.enum(TRAVEL_INCLUSIONS)).max(TRAVEL_INCLUSIONS.length),
  excludedNote: optionalText(400),
  depositPercent: z.number().int().min(0).max(100),
  requiredDocuments: z.array(z.enum(TRAVEL_DOCUMENTS)).max(TRAVEL_DOCUMENTS.length),
  meetingPoint: optionalText(200),
  featured: z.boolean(),
  media: z.array(z.object({ url: z.string().trim().max(300), alt: z.string().trim().max(140).default(""), demo: z.boolean().optional() })).max(20),
  itinerary: z.array(z.object({ dayNumber: z.number().int().min(1).max(90), title: z.string().trim().min(1, "Chaque jour a un titre.").max(120), description: optionalText(800) })).max(90),
});
export type TripFormInput = z.infer<typeof tripSchema>;

const departureSchema = z.object({
  listingId: z.string().min(1),
  date: isoDate,
  capacity: z.number().int().min(1).max(500),
  pricePerPerson: z.number().int().min(1).max(100_000_000).nullable(),
  label: optionalText(60),
});

const travelerSchema = z.object({
  travelerId: z.string().min(1),
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  birthDate: isoDate.nullable().optional(),
  nationality: optionalText(60),
  passportNumber: optionalText(20),
  passportExpiry: isoDate.nullable().optional(),
});

const paymentSchema = z.object({
  reservationId: z.string().min(1),
  amount: z.number().int().min(1).max(1_000_000_000),
  method: z.enum(TRAVEL_PAYMENT_METHODS),
  kind: z.enum(["deposit", "balance", "other"]),
  reference: optionalText(80),
  paidAt: isoDate.optional(),
});

const phoneBookingSchema = z.object({
  listingId: z.string().min(1),
  departureId: z.string().min(1),
  phone: z.string().trim().min(6).max(20),
  email: z.string().trim().email().max(200).optional().or(z.literal("")),
  note: optionalText(600),
  travelers: z.array(z.object({ firstName: z.string().trim().min(1).max(80), lastName: z.string().trim().min(1).max(80) })).min(1).max(20),
});

async function context(permission: Permission) {
  const membership = await getCurrentTenantMembership();
  if (!membership) return null;
  // Réservé aux agences de voyage (modules actifs), quel que soit le rôle.
  if (!isTravel(await getTenantModuleKeys(membership.tenantId))) return null;
  const actor = await requireTenantPermission(membership.tenantId, permission);
  if (!actor) return null;
  return { tenantId: membership.tenantId, userId: actor.userId, actorType: (membership.roleName === "OWNER" ? "owner" : "employee") as "owner" | "employee" };
}

const DENIED = { ok: false as const, status: 403, error: "Action non autorisée." };

function toError(error: unknown): { ok: false; status: number; error: string } {
  if (error instanceof QuotaExceededError) return { ok: false, status: 402, error: `Votre formule inclut ${error.limit} fiches. Passez à une formule supérieure pour ajouter d'autres voyages.` };
  if (
    error instanceof TravelError || error instanceof InvalidListingInputError || error instanceof InvalidListingTransitionError || error instanceof ListingConflictError ||
    error instanceof ListingHasActiveReservationsError || error instanceof ListingNotFoundError || error instanceof InvalidReservationTransitionError ||
    error instanceof ReservationNotFoundError || error instanceof ReservationUnavailableError || error instanceof AvailabilityFullError || error instanceof InvalidAvailabilityError
  ) {
    return { ok: false, status: 409, error: error.message };
  }
  if (error instanceof Error && error.message.startsWith("Image")) return { ok: false, status: 400, error: error.message };
  return { ok: false, status: 400, error: "Action impossible pour le moment." };
}

function firstIssue(error: z.ZodError) {
  const issue = error.issues[0];
  return issue ? `${issue.path.join(" › ") || "Formulaire"} : ${issue.message}` : "Données invalides.";
}

const date = (v: string | null | undefined) => (v ? new Date(`${v}T00:00:00.000Z`) : null);

// --- Voyages ---------------------------------------------------------------------------

export async function saveTrip(listingId: string | null, raw: unknown): Promise<ActionResult<{ id: string }>> {
  const ctx = await context(listingId ? "listings.edit" : "listings.create");
  if (!ctx) return DENIED;
  const parsed = tripSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, status: 400, error: firstIssue(parsed.error) };
  const input = parsed.data;
  const mediaIds = new Set<string>();
  for (const m of input.media) {
    const problem = checkImage(m.url, mediaIds);
    if (problem) return { ok: false, status: 400, error: problem };
  }
  try {
    const saved = await withTenant(ctx.tenantId, async (tx) => {
      if (mediaIds.size && (await tx.mediaAsset.count({ where: { tenantId: ctx.tenantId, id: { in: [...mediaIds] }, status: "READY" } })) !== mediaIds.size) {
        throw new Error("Image introuvable dans votre médiathèque.");
      }
      // Les photos d'un voyage sont vues par les visiteurs du site.
      for (const id of mediaIds) await setMediaAssetPublic(tx, ctx.tenantId, id, true);
      return listingId ? updateTravelPackage(tx, ctx.tenantId, listingId, input, ctx.userId) : createTravelPackage(tx, ctx.tenantId, input, ctx.userId);
    });
    return { ok: true, data: { id: saved.id } };
  } catch (error) {
    return toError(error);
  }
}

export async function changeTripStatus(listingId: string, status: "draft" | "published" | "unavailable" | "archived"): Promise<ActionResult> {
  const ctx = await context("listings.publish");
  if (!ctx) return DENIED;
  try {
    await withTenant(ctx.tenantId, async (tx) => {
      const listing = await tx.listing.findFirst({ where: { id: listingId, tenantId: ctx.tenantId, type: "travel_package" }, select: { media: true } });
      if (!listing) throw new ListingNotFoundError(listingId);
      if (status === "published" && !(Array.isArray(listing.media) && listing.media.length)) {
        throw new InvalidListingInputError("Ajoutez au moins une photo avant de mettre ce voyage en ligne.");
      }
      await setListingStatus(tx, ctx.tenantId, listingId, status, ctx.userId);
    });
    return { ok: true, data: null };
  } catch (error) {
    return toError(error);
  }
}

export async function removeTrip(listingId: string): Promise<ActionResult> {
  const ctx = await context("listings.delete");
  if (!ctx) return DENIED;
  try {
    await withTenant(ctx.tenantId, (tx) => deleteListing(tx, ctx.tenantId, listingId, ctx.userId));
    return { ok: true, data: null };
  } catch (error) {
    return toError(error);
  }
}

// --- Départs ---------------------------------------------------------------------------

export async function createDeparture(raw: unknown): Promise<ActionResult<{ id: string }>> {
  const ctx = await context("listings.manage_availability");
  if (!ctx) return DENIED;
  const parsed = departureSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, status: 400, error: firstIssue(parsed.error) };
  const d = parsed.data;
  try {
    const slot = await withTenant(ctx.tenantId, (tx) =>
      // Heure de départ conventionnelle : 7 h (UTC = heure de Dakar) le jour choisi.
      addDeparture(tx, ctx.tenantId, d.listingId, { startDate: new Date(`${d.date}T07:00:00.000Z`), capacity: d.capacity, pricePerPerson: d.pricePerPerson, label: d.label }),
    );
    return { ok: true, data: { id: slot.id } };
  } catch (error) {
    if (error instanceof Error && /Unique constraint/.test(error.message)) return { ok: false, status: 409, error: "Un départ existe déjà à cette date." };
    return toError(error);
  }
}

export async function updateDeparture(departureId: string, patch: { capacity?: number; status?: "open" | "closed" }): Promise<ActionResult> {
  const ctx = await context("listings.manage_availability");
  if (!ctx) return DENIED;
  try {
    await withTenant(ctx.tenantId, async (tx) => {
      const slot = await tx.listingAvailability.findFirst({ where: { id: departureId, tenantId: ctx.tenantId, listing: { type: "travel_package" } }, select: { id: true } });
      if (!slot) throw new InvalidAvailabilityError("Départ introuvable.");
      if (patch.capacity != null) await setAvailabilityCapacity(tx, ctx.tenantId, departureId, patch.capacity);
      if (patch.status) await setAvailabilityStatus(tx, ctx.tenantId, departureId, patch.status);
    });
    return { ok: true, data: null };
  } catch (error) {
    return toError(error);
  }
}

// --- Réservations ---------------------------------------------------------------------

async function assertBooking(tx: Parameters<Parameters<typeof withTenant>[1]>[0], tenantId: string, reservationId: string) {
  const booking = await tx.reservation.findFirst({ where: { id: reservationId, tenantId, moduleKey: DEPARTURES_MODULE }, select: { id: true } });
  if (!booking) throw new ReservationNotFoundError();
}

export async function updateBookingStatus(reservationId: string, toStatus: "confirmed" | "completed" | "canceled" | "no_show", note?: string): Promise<ActionResult> {
  const ctx = await context(toStatus === "canceled" ? "reservations.cancel" : "reservations.update_status");
  if (!ctx) return DENIED;
  try {
    await withTenant(ctx.tenantId, async (tx) => {
      await assertBooking(tx, ctx.tenantId, reservationId);
      await transitionReservationStatus(tx, ctx.tenantId, { reservationId, toStatus, actor: { userId: ctx.userId, type: ctx.actorType }, note });
    });
    return { ok: true, data: null };
  } catch (error) {
    return toError(error);
  }
}

export async function createPhoneBooking(raw: unknown): Promise<ActionResult<{ id: string }>> {
  const ctx = await context("reservations.update_status");
  if (!ctx) return DENIED;
  const parsed = phoneBookingSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, status: 400, error: firstIssue(parsed.error) };
  const b = parsed.data;
  try {
    const booking = await withTenant(ctx.tenantId, (tx) =>
      bookDeparture(tx, ctx.tenantId, {
        listingId: b.listingId,
        availabilityId: b.departureId,
        travelers: b.travelers,
        contact: { firstName: b.travelers[0]!.firstName, lastName: b.travelers[0]!.lastName, phone: b.phone, email: b.email || undefined },
        customerNote: b.note,
        channel: "phone",
        actor: { userId: ctx.userId, type: ctx.actorType },
      }),
    );
    return { ok: true, data: { id: booking.id } };
  } catch (error) {
    return toError(error);
  }
}

// --- Voyageurs et pièces ---------------------------------------------------------------

export async function saveTraveler(raw: unknown): Promise<ActionResult> {
  const ctx = await context("travelers.manage");
  if (!ctx) return DENIED;
  const parsed = travelerSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, status: 400, error: firstIssue(parsed.error) };
  const t = parsed.data;
  try {
    await withTenant(ctx.tenantId, async (tx) => {
      const existing = await tx.reservationTraveler.findFirst({ where: { id: t.travelerId, tenantId: ctx.tenantId }, select: { passportLast4: true } });
      if (!existing) throw new TravelError("Voyageur introuvable.");
      // Numéro laissé vide : le numéro chiffré existant est conservé (jamais réaffiché en clair).
      await updateTraveler(tx, ctx.tenantId, t.travelerId, { firstName: t.firstName, lastName: t.lastName, birthDate: date(t.birthDate), nationality: t.nationality, passportNumber: t.passportNumber, passportExpiry: date(t.passportExpiry) });
    });
    return { ok: true, data: null };
  } catch (error) {
    return toError(error);
  }
}

export async function changeDocumentStatus(travelerId: string, kind: string, status: string, note?: string): Promise<ActionResult> {
  const ctx = await context("travelers.manage");
  if (!ctx) return DENIED;
  if (!(TRAVEL_DOCUMENTS as readonly string[]).includes(kind) || !(DOCUMENT_STATUSES as readonly string[]).includes(status)) return { ok: false, status: 400, error: "Pièce ou statut inconnu." };
  try {
    await withTenant(ctx.tenantId, (tx) =>
      setTravelerDocumentStatus(tx, ctx.tenantId, { travelerId, kind: kind as (typeof TRAVEL_DOCUMENTS)[number], status: status as (typeof DOCUMENT_STATUSES)[number], note: note ?? null, actorUserId: ctx.userId }),
    );
    return { ok: true, data: null };
  } catch (error) {
    return toError(error);
  }
}

// --- Encaissements ---------------------------------------------------------------------

export async function recordPayment(raw: unknown): Promise<ActionResult<{ receiptNumber: string }>> {
  const ctx = await context("reservation_payments.record");
  if (!ctx) return DENIED;
  const parsed = paymentSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, status: 400, error: firstIssue(parsed.error) };
  const p = parsed.data;
  try {
    const payment = await withTenant(ctx.tenantId, async (tx) => {
      await assertBooking(tx, ctx.tenantId, p.reservationId);
      const paidAt = p.paidAt ? new Date(`${p.paidAt}T12:00:00.000Z`) : new Date();
      return recordReservationPayment(tx, ctx.tenantId, { reservationId: p.reservationId, amount: p.amount, method: p.method, kind: p.kind, reference: p.reference, paidAt: paidAt > new Date() ? new Date() : paidAt, actorUserId: ctx.userId });
    });
    return { ok: true, data: { receiptNumber: payment.receiptNumber } };
  } catch (error) {
    return toError(error);
  }
}

export async function voidPayment(paymentId: string, reason: string): Promise<ActionResult> {
  const ctx = await context("reservation_payments.record");
  if (!ctx) return DENIED;
  try {
    await withTenant(ctx.tenantId, (tx) => voidReservationPayment(tx, ctx.tenantId, paymentId, reason));
    return { ok: true, data: null };
  } catch (error) {
    return toError(error);
  }
}
