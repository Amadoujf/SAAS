import "server-only";
import { z } from "zod";
import {
  withTenant,
  createProperty,
  updateProperty,
  setListingStatus,
  deleteListing,
  transitionReservationStatus,
  createLease,
  endLease,
  recordRentPayment,
  setMediaAssetPublic,
  PROPERTY_TYPES,
  DEAL_TYPES,
  PROPERTY_AMENITIES,
  RENT_PAYMENT_METHODS,
  QuotaExceededError,
  InvalidListingInputError,
  InvalidListingTransitionError,
  ListingConflictError,
  ListingHasActiveReservationsError,
  ListingNotFoundError,
  InvalidReservationTransitionError,
  ReservationNotFoundError,
  LeaseError,
  VISIT_MODULE,
} from "@yamacommerce/database";
import type { Permission } from "@yamacommerce/auth";
import { getCurrentTenantMembership } from "@/lib/current-tenant";
import { requireTenantPermission } from "@/lib/tenant-permissions";
import { checkImage } from "@/lib/media/image-refs";
import { getTenantModuleKeys, isRealEstate } from "@/lib/modules/tenant-modules";

/**
 * Actions immobilier du dashboard. Chaque action revérifie côté serveur la permission
 * précise du membre (jamais seulement masquée dans l'interface), la RLS isole
 * l'entreprise, et les règles métier vivent dans les registres (packages/database).
 */

export type ActionResult<T = unknown> = { ok: true; data: T } | { ok: false; status: number; error: string };

const int = (max: number) => z.number().int().min(0).max(max);
const optionalText = (max: number) => z.string().trim().max(max).nullable().optional().transform((v) => (v ? v : null));

export const propertySchema = z.object({
  title: z.string().trim().min(3, "Titre trop court.").max(120),
  summary: optionalText(220),
  description: optionalText(5_000),
  price: z.number().int().min(1).max(100_000_000_000).nullable(),
  propertyType: z.enum(PROPERTY_TYPES),
  dealType: z.enum(DEAL_TYPES),
  bedrooms: int(50).nullable(),
  bathrooms: int(50).nullable(),
  surfaceM2: z.number().int().min(1).max(1_000_000).nullable(),
  landSurfaceM2: z.number().int().min(1).max(10_000_000).nullable(),
  furnished: z.boolean(),
  amenities: z.array(z.enum(PROPERTY_AMENITIES)).max(PROPERTY_AMENITIES.length),
  agencyReference: optionalText(40),
  featured: z.boolean(),
  location: z.object({
    region: z.string().trim().max(60).optional(),
    commune: z.string().trim().max(80).optional(),
    neighborhood: z.string().trim().max(80).optional(),
  }),
  media: z.array(z.object({ url: z.string().trim().max(300), alt: z.string().trim().max(140).default(""), demo: z.boolean().optional() })).max(20),
});
export type PropertyFormInput = z.infer<typeof propertySchema>;

const leaseSchema = z.object({
  listingId: z.string().min(1),
  occupant: z.object({ firstName: z.string().trim().min(1).max(80), lastName: z.string().trim().max(80).optional(), phone: z.string().trim().min(6).max(20), email: z.string().trim().email().max(200).optional().or(z.literal("")) }),
  landlordName: optionalText(120),
  landlordPhone: optionalText(20),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  monthlyRent: z.number().int().min(1).max(1_000_000_000),
  charges: z.number().int().min(0).max(1_000_000_000).default(0),
  depositAmount: z.number().int().min(0).max(10_000_000_000).default(0),
  dueDay: z.number().int().min(1).max(28).default(5),
  notes: optionalText(1_000),
});

const rentSchema = z.object({
  rentPaymentId: z.string().min(1),
  amountPaid: z.number().int().min(1).max(10_000_000_000),
  method: z.enum(RENT_PAYMENT_METHODS),
  paymentReference: optionalText(80),
  paidAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

async function context(permission: Permission) {
  const membership = await getCurrentTenantMembership();
  if (!membership) return null;
  // Réservé aux entreprises du secteur immobilier (modules actifs), quel que soit le rôle.
  if (!isRealEstate(await getTenantModuleKeys(membership.tenantId))) return null;
  const actor = await requireTenantPermission(membership.tenantId, permission);
  if (!actor) return null;
  return { tenantId: membership.tenantId, userId: actor.userId, actorType: (membership.roleName === "OWNER" ? "owner" : "employee") as "owner" | "employee" };
}

const DENIED = { ok: false as const, status: 403, error: "Action non autorisée." };

function toError(error: unknown): { ok: false; status: number; error: string } {
  if (error instanceof QuotaExceededError) {
    return { ok: false, status: 402, error: `Votre formule inclut ${error.limit} fiches. Passez à une formule supérieure pour ajouter d'autres biens.` };
  }
  if (
    error instanceof InvalidListingInputError || error instanceof InvalidListingTransitionError || error instanceof ListingConflictError ||
    error instanceof ListingHasActiveReservationsError || error instanceof ListingNotFoundError || error instanceof InvalidReservationTransitionError ||
    error instanceof ReservationNotFoundError || error instanceof LeaseError
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

export async function saveProperty(listingId: string | null, raw: unknown): Promise<ActionResult<{ id: string }>> {
  const ctx = await context(listingId ? "listings.edit" : "listings.create");
  if (!ctx) return DENIED;
  const parsed = propertySchema.safeParse(raw);
  if (!parsed.success) return { ok: false, status: 400, error: firstIssue(parsed.error) };
  const input = parsed.data;
  const mediaIds = new Set<string>();
  for (const m of input.media) {
    const problem = checkImage(m.url, mediaIds);
    if (problem) return { ok: false, status: 400, error: problem };
  }
  const location = Object.fromEntries(Object.entries(input.location).filter(([, v]) => v)) as PropertyFormInput["location"];
  try {
    const saved = await withTenant(ctx.tenantId, async (tx) => {
      if (mediaIds.size && (await tx.mediaAsset.count({ where: { tenantId: ctx.tenantId, id: { in: [...mediaIds] }, status: "READY" } })) !== mediaIds.size) {
        throw new Error("Image introuvable dans votre médiathèque.");
      }
      // Les photos d'un bien sont vues par les visiteurs du site.
      for (const id of mediaIds) await setMediaAssetPublic(tx, ctx.tenantId, id, true);
      const data = { ...input, location: Object.keys(location).length ? location : null };
      return listingId ? updateProperty(tx, ctx.tenantId, listingId, data, ctx.userId) : createProperty(tx, ctx.tenantId, data, ctx.userId);
    });
    return { ok: true, data: { id: saved.id } };
  } catch (error) {
    return toError(error);
  }
}

export async function changePropertyStatus(listingId: string, status: "draft" | "published" | "unavailable" | "archived"): Promise<ActionResult> {
  const ctx = await context("listings.publish");
  if (!ctx) return DENIED;
  try {
    await withTenant(ctx.tenantId, async (tx) => {
      const listing = await tx.listing.findFirst({ where: { id: listingId, tenantId: ctx.tenantId, type: "property" }, select: { media: true } });
      if (!listing) throw new ListingNotFoundError(listingId);
      if (status === "published" && !(Array.isArray(listing.media) && listing.media.length)) {
        throw new InvalidListingInputError("Ajoutez au moins une photo avant de mettre ce bien en ligne.");
      }
      await setListingStatus(tx, ctx.tenantId, listingId, status, ctx.userId);
    });
    return { ok: true, data: null };
  } catch (error) {
    return toError(error);
  }
}

export async function removeProperty(listingId: string): Promise<ActionResult> {
  const ctx = await context("listings.delete");
  if (!ctx) return DENIED;
  try {
    await withTenant(ctx.tenantId, async (tx) => {
      if (await tx.lease.count({ where: { tenantId: ctx.tenantId, listingId, status: "active" } })) {
        throw new LeaseError("Ce bien a un bail en cours : terminez-le avant de supprimer le bien.");
      }
      await deleteListing(tx, ctx.tenantId, listingId, ctx.userId);
    });
    return { ok: true, data: null };
  } catch (error) {
    return toError(error);
  }
}

export async function updateVisitStatus(reservationId: string, toStatus: "confirmed" | "completed" | "canceled" | "no_show", note?: string): Promise<ActionResult> {
  const ctx = await context(toStatus === "canceled" ? "reservations.cancel" : "reservations.update_status");
  if (!ctx) return DENIED;
  try {
    await withTenant(ctx.tenantId, async (tx) => {
      // Seules les visites passent par ici (jamais une réservation d'un autre module).
      const visit = await tx.reservation.findFirst({ where: { id: reservationId, tenantId: ctx.tenantId, moduleKey: VISIT_MODULE }, select: { id: true } });
      if (!visit) throw new ReservationNotFoundError();
      await transitionReservationStatus(tx, ctx.tenantId, { reservationId, toStatus, actor: { userId: ctx.userId, type: ctx.actorType }, note });
    });
    return { ok: true, data: null };
  } catch (error) {
    return toError(error);
  }
}

const utc = (ymd: string) => new Date(`${ymd}T00:00:00.000Z`);

export async function openLease(raw: unknown): Promise<ActionResult<{ id: string; reference: string }>> {
  const ctx = await context("leases.manage");
  if (!ctx) return DENIED;
  const parsed = leaseSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, status: 400, error: firstIssue(parsed.error) };
  const input = parsed.data;
  try {
    const lease = await withTenant(ctx.tenantId, (tx) =>
      createLease(
        tx,
        ctx.tenantId,
        {
          listingId: input.listingId,
          occupant: { firstName: input.occupant.firstName, lastName: input.occupant.lastName || undefined, phone: input.occupant.phone, email: input.occupant.email || undefined },
          landlordName: input.landlordName,
          landlordPhone: input.landlordPhone,
          startDate: utc(input.startDate),
          endDate: input.endDate ? utc(input.endDate) : null,
          monthlyRent: input.monthlyRent,
          charges: input.charges,
          depositAmount: input.depositAmount,
          dueDay: input.dueDay,
          notes: input.notes,
        },
        ctx.userId,
      ),
    );
    return { ok: true, data: { id: lease.id, reference: lease.reference } };
  } catch (error) {
    return toError(error);
  }
}

export async function closeLease(leaseId: string, endDate: string, status: "ended" | "terminated"): Promise<ActionResult> {
  const ctx = await context("leases.manage");
  if (!ctx) return DENIED;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(endDate)) return { ok: false, status: 400, error: "Date de fin invalide." };
  try {
    await withTenant(ctx.tenantId, (tx) => endLease(tx, ctx.tenantId, leaseId, { endDate: utc(endDate), status }, ctx.userId));
    return { ok: true, data: null };
  } catch (error) {
    return toError(error);
  }
}

export async function recordRent(raw: unknown): Promise<ActionResult<{ status: string; receiptNumber: string | null }>> {
  const ctx = await context("rents.record");
  if (!ctx) return DENIED;
  const parsed = rentSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, status: 400, error: firstIssue(parsed.error) };
  const input = parsed.data;
  if (input.paidAt && utc(input.paidAt) > new Date()) return { ok: false, status: 400, error: "La date d'encaissement ne peut pas être dans le futur." };
  try {
    const payment = await withTenant(ctx.tenantId, (tx) =>
      recordRentPayment(tx, ctx.tenantId, { ...input, paidAt: input.paidAt ? utc(input.paidAt) : undefined }, ctx.userId),
    );
    return { ok: true, data: { status: payment.status, receiptNumber: payment.receiptNumber } };
  } catch (error) {
    return toError(error);
  }
}
