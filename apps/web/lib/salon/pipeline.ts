import "server-only";
import { z } from "zod";
import {
  withTenant,
  addTimeOff,
  bookAppointment,
  computeAvailability,
  createService,
  createStaff,
  deleteListing,
  isIsoDate,
  recordReservationPayment,
  removeTimeOff,
  rescheduleAppointment,
  setAppointmentTotal,
  setListingStatus,
  setMediaAssetPublic,
  transitionReservationStatus,
  updateBookingSettings,
  updateService,
  updateStaff,
  utcToLocal,
  voidReservationPayment,
  localToUtc,
  APPOINTMENTS_MODULE,
  InvalidListingInputError,
  InvalidListingTransitionError,
  InvalidReservationTransitionError,
  ListingConflictError,
  ListingHasActiveReservationsError,
  ListingNotFoundError,
  QuotaExceededError,
  ReservationNotFoundError,
  ReservationUnavailableError,
  ServiceError,
  SLOT_STEPS,
  TRAVEL_PAYMENT_METHODS,
  TravelError,
} from "@yamacommerce/database";
import type { Permission } from "@yamacommerce/auth";
import { getCurrentTenantMembership } from "@/lib/current-tenant";
import { requireTenantPermission } from "@/lib/tenant-permissions";
import { checkImage } from "@/lib/media/image-refs";
import { getTenantModuleKeys, isSalon } from "@/lib/modules/tenant-modules";

/**
 * Actions salon du tableau de bord. Chaque action revérifie côté serveur la permission
 * précise du membre (jamais seulement masquée dans l'interface), la RLS isole
 * l'entreprise, et les règles métier (horaires libres, chevauchements, encaissements)
 * vivent dans le registre (packages/database).
 */

export type ActionResult<T = unknown> = { ok: true; data: T } | { ok: false; status: number; error: string };

const optionalText = (max: number) => z.string().trim().max(max).nullable().optional().transform((v) => (v ? v : null));
const minuteOfDay = z.number().int().min(0).max(1440);

export const serviceSchema = z.object({
  title: z.string().trim().min(2, "Nom trop court.").max(120),
  summary: optionalText(220),
  description: optionalText(3_000),
  category: z.string().trim().min(1, "Indiquez une rubrique.").max(60),
  durationMinutes: z.number().int().min(5).max(600),
  bufferMinutes: z.number().int().min(0).max(180),
  price: z.number().int().min(0).max(10_000_000).nullable(),
  priceFrom: z.boolean(),
  onlineBooking: z.boolean(),
  featured: z.boolean(),
  staffIds: z.array(z.string().uuid()).max(100),
  media: z.array(z.object({ url: z.string().trim().max(300), alt: z.string().trim().max(140).default(""), demo: z.boolean().optional() })).max(8),
});
export type ServiceFormInput = z.infer<typeof serviceSchema>;

export const staffSchema = z.object({
  displayName: z.string().trim().min(1, "Indiquez un nom.").max(80),
  title: optionalText(80),
  bio: optionalText(400),
  photoUrl: z.string().trim().max(300).nullable().optional(),
  isActive: z.boolean(),
  acceptsOnline: z.boolean(),
  serviceIds: z.array(z.string().uuid()).max(300),
  hours: z.array(z.object({ weekday: z.number().int().min(0).max(6), startMinute: minuteOfDay, endMinute: minuteOfDay })).max(60),
});
export type StaffFormInput = z.infer<typeof staffSchema>;

const bookingSchema = z.object({
  listingId: z.string().uuid(),
  staffId: z.string().uuid().nullable(),
  startAt: z.string().datetime(),
  customerId: z.string().uuid().nullable().optional(),
  firstName: optionalText(80),
  lastName: optionalText(80),
  phone: optionalText(20),
  note: optionalText(500),
  channel: z.enum(["phone", "dashboard", "whatsapp"]),
});

const paymentSchema = z.object({
  reservationId: z.string().uuid(),
  amount: z.number().int().min(1).max(100_000_000),
  method: z.enum(TRAVEL_PAYMENT_METHODS),
  reference: optionalText(80),
});

const settingsSchema = z.object({
  slotStepMinutes: z.number().int().refine((v) => (SLOT_STEPS as readonly number[]).includes(v), "Pas invalide."),
  minLeadMinutes: z.number().int().min(0).max(10080),
  maxAdvanceDays: z.number().int().min(1).max(365),
  cancelCutoffHours: z.number().int().min(0).max(168),
  autoConfirm: z.boolean(),
});

async function context(permission: Permission) {
  const membership = await getCurrentTenantMembership();
  if (!membership) return null;
  // Réservé aux salons (modules actifs), quel que soit le rôle.
  if (!isSalon(await getTenantModuleKeys(membership.tenantId))) return null;
  const actor = await requireTenantPermission(membership.tenantId, permission);
  if (!actor) return null;
  return { tenantId: membership.tenantId, userId: actor.userId, actorType: (membership.roleName === "OWNER" ? "owner" : "employee") as "owner" | "employee" };
}

const DENIED = { ok: false as const, status: 403, error: "Action non autorisée." };

function toError(error: unknown): { ok: false; status: number; error: string } {
  if (error instanceof QuotaExceededError) return { ok: false, status: 402, error: `Votre formule inclut ${error.limit} fiches. Passez à une formule supérieure pour ajouter d'autres prestations.` };
  if (
    error instanceof ServiceError || error instanceof TravelError || error instanceof InvalidListingInputError || error instanceof InvalidListingTransitionError ||
    error instanceof ListingConflictError || error instanceof ListingHasActiveReservationsError || error instanceof ListingNotFoundError ||
    error instanceof InvalidReservationTransitionError || error instanceof ReservationNotFoundError || error instanceof ReservationUnavailableError
  ) {
    return { ok: false, status: 409, error: error.message };
  }
  if (error instanceof Error && error.message.startsWith("Image")) return { ok: false, status: 400, error: error.message };
  // eslint-disable-next-line no-console
  console.error("[salon]", error);
  return { ok: false, status: 400, error: "Action impossible pour le moment." };
}

function firstIssue(error: z.ZodError) {
  const issue = error.issues[0];
  return issue ? `${issue.path.join(" › ") || "Formulaire"} : ${issue.message}` : "Données invalides.";
}

type Tx = Parameters<Parameters<typeof withTenant>[1]>[0];

async function assertAppointment(tx: Tx, tenantId: string, reservationId: string) {
  const r = await tx.reservation.findFirst({ where: { id: reservationId, tenantId, moduleKey: APPOINTMENTS_MODULE }, select: { id: true } });
  if (!r) throw new ReservationNotFoundError();
}

async function publishImages(tx: Tx, tenantId: string, urls: string[]) {
  const ids = new Set<string>();
  for (const url of urls) {
    const problem = checkImage(url, ids);
    if (problem) throw new Error(problem.startsWith("Image") ? problem : `Image : ${problem}`);
  }
  if (ids.size && (await tx.mediaAsset.count({ where: { tenantId, id: { in: [...ids] }, status: "READY" } })) !== ids.size) throw new Error("Image introuvable dans votre médiathèque.");
  // Les photos d'une prestation ou d'un membre de l'équipe sont vues sur le site.
  for (const id of ids) await setMediaAssetPublic(tx, tenantId, id, true);
}

// --- Prestations -----------------------------------------------------------------------

export async function saveService(listingId: string | null, raw: unknown): Promise<ActionResult<{ id: string }>> {
  const ctx = await context(listingId ? "listings.edit" : "listings.create");
  if (!ctx) return DENIED;
  const parsed = serviceSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, status: 400, error: firstIssue(parsed.error) };
  const input = parsed.data;
  try {
    const saved = await withTenant(ctx.tenantId, async (tx) => {
      await publishImages(tx, ctx.tenantId, input.media.map((m) => m.url));
      return listingId ? updateService(tx, ctx.tenantId, listingId, input, ctx.userId) : createService(tx, ctx.tenantId, input, ctx.userId);
    });
    return { ok: true, data: { id: saved.id } };
  } catch (error) {
    return toError(error);
  }
}

export async function changeServiceStatus(listingId: string, status: "draft" | "published" | "unavailable" | "archived"): Promise<ActionResult> {
  const ctx = await context("listings.publish");
  if (!ctx) return DENIED;
  try {
    await withTenant(ctx.tenantId, async (tx) => {
      const listing = await tx.listing.findFirst({ where: { id: listingId, tenantId: ctx.tenantId, type: "service_offering" }, select: { id: true } });
      if (!listing) throw new ListingNotFoundError(listingId);
      await setListingStatus(tx, ctx.tenantId, listingId, status, ctx.userId);
    });
    return { ok: true, data: null };
  } catch (error) {
    return toError(error);
  }
}

export async function removeService(listingId: string): Promise<ActionResult> {
  const ctx = await context("listings.delete");
  if (!ctx) return DENIED;
  try {
    await withTenant(ctx.tenantId, (tx) => deleteListing(tx, ctx.tenantId, listingId, ctx.userId));
    return { ok: true, data: null };
  } catch (error) {
    return toError(error);
  }
}

// --- Équipe, horaires, absences, règles -------------------------------------------------

export async function saveStaff(staffId: string | null, raw: unknown): Promise<ActionResult<{ id: string }>> {
  const ctx = await context("listings.manage_availability");
  if (!ctx) return DENIED;
  const parsed = staffSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, status: 400, error: firstIssue(parsed.error) };
  const input = { ...parsed.data, photoUrl: parsed.data.photoUrl || null };
  try {
    const saved = await withTenant(ctx.tenantId, async (tx) => {
      if (input.photoUrl) await publishImages(tx, ctx.tenantId, [input.photoUrl]);
      return staffId ? updateStaff(tx, ctx.tenantId, staffId, input) : createStaff(tx, ctx.tenantId, input);
    });
    return { ok: true, data: { id: saved.id } };
  } catch (error) {
    return toError(error);
  }
}

export async function createTimeOff(raw: unknown): Promise<ActionResult> {
  const ctx = await context("listings.manage_availability");
  if (!ctx) return DENIED;
  const parsed = z.object({ staffId: z.string().uuid(), from: z.string().refine(isIsoDate, "Date invalide."), to: z.string().refine(isIsoDate, "Date invalide."), reason: optionalText(120) }).safeParse(raw);
  if (!parsed.success) return { ok: false, status: 400, error: firstIssue(parsed.error) };
  const t = parsed.data;
  if (t.to < t.from) return { ok: false, status: 400, error: "La fin de l'absence précède son début." };
  try {
    await withTenant(ctx.tenantId, async (tx) => {
      const tz = (await tx.tenant.findUnique({ where: { id: ctx.tenantId }, select: { timezone: true } }))?.timezone || "Africa/Dakar";
      // Journées entières, du début du premier jour à la fin du dernier (heure du salon).
      const next = new Date(`${t.to}T00:00:00Z`);
      next.setUTCDate(next.getUTCDate() + 1);
      await addTimeOff(tx, ctx.tenantId, { staffId: t.staffId, startAt: localToUtc(t.from, 0, tz), endAt: localToUtc(next.toISOString().slice(0, 10), 0, tz), reason: t.reason });
    });
    return { ok: true, data: null };
  } catch (error) {
    return toError(error);
  }
}

export async function deleteTimeOff(timeOffId: string): Promise<ActionResult> {
  const ctx = await context("listings.manage_availability");
  if (!ctx) return DENIED;
  try {
    await withTenant(ctx.tenantId, (tx) => removeTimeOff(tx, ctx.tenantId, timeOffId));
    return { ok: true, data: null };
  } catch (error) {
    return toError(error);
  }
}

export async function saveBookingSettings(raw: unknown): Promise<ActionResult> {
  const ctx = await context("listings.manage_availability");
  if (!ctx) return DENIED;
  const parsed = settingsSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, status: 400, error: firstIssue(parsed.error) };
  try {
    await withTenant(ctx.tenantId, (tx) => updateBookingSettings(tx, ctx.tenantId, parsed.data));
    return { ok: true, data: null };
  } catch (error) {
    return toError(error);
  }
}

// --- Rendez-vous ------------------------------------------------------------------------

/** Horaires libres pour l'équipe (sans les restrictions du site : délai, pas, fenêtre). */
export async function staffAvailability(q: { listingId: string; date: string; staffId: string | null }): Promise<ActionResult<{ startAt: string; label: string; staffIds: string[] }[]>> {
  const ctx = await context("reservations.view");
  if (!ctx) return DENIED;
  if (!isIsoDate(q.date)) return { ok: false, status: 400, error: "Date invalide." };
  try {
    const r = await withTenant(ctx.tenantId, (tx) => computeAvailability(tx, ctx.tenantId, { listingId: q.listingId, date: q.date, staffId: q.staffId }));
    return {
      ok: true,
      data: r.slots.map((s) => {
        const m = utcToLocal(s.startAt, r.timezone).minute;
        return { startAt: s.startAt.toISOString(), label: `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`, staffIds: s.staffIds };
      }),
    };
  } catch (error) {
    return toError(error);
  }
}

export async function createDeskBooking(raw: unknown): Promise<ActionResult<{ id: string }>> {
  const ctx = await context("reservations.update_status");
  if (!ctx) return DENIED;
  const parsed = bookingSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, status: 400, error: firstIssue(parsed.error) };
  const b = parsed.data;
  if (!b.customerId && (!b.firstName || !b.phone)) return { ok: false, status: 400, error: "Indiquez le prénom et le téléphone du client." };
  try {
    const appt = await withTenant(ctx.tenantId, (tx) =>
      bookAppointment(tx, ctx.tenantId, {
        listingId: b.listingId,
        staffId: b.staffId,
        startAt: new Date(b.startAt),
        customerId: b.customerId ?? null,
        customer: b.customerId ? null : { firstName: b.firstName!, lastName: b.lastName, phone: b.phone },
        customerNote: b.note,
        channel: b.channel,
        actor: { userId: ctx.userId, type: ctx.actorType },
      }),
    );
    return { ok: true, data: { id: appt!.id } };
  } catch (error) {
    return toError(error);
  }
}

export async function updateAppointmentStatus(reservationId: string, toStatus: "confirmed" | "completed" | "canceled" | "no_show", note?: string): Promise<ActionResult> {
  const ctx = await context(toStatus === "canceled" ? "reservations.cancel" : "reservations.update_status");
  if (!ctx) return DENIED;
  try {
    await withTenant(ctx.tenantId, async (tx) => {
      await assertAppointment(tx, ctx.tenantId, reservationId);
      if ((toStatus === "completed" || toStatus === "no_show")) {
        const r = await tx.reservation.findFirstOrThrow({ where: { id: reservationId, tenantId: ctx.tenantId }, select: { startAt: true } });
        if (r.startAt > new Date()) throw new ServiceError("Le rendez-vous n'a pas encore commencé.");
      }
      await transitionReservationStatus(tx, ctx.tenantId, { reservationId, toStatus, actor: { userId: ctx.userId, type: ctx.actorType }, note });
    });
    return { ok: true, data: null };
  } catch (error) {
    return toError(error);
  }
}

export async function moveAppointment(reservationId: string, startAt: string, staffId: string | null): Promise<ActionResult> {
  const ctx = await context("reservations.update_status");
  if (!ctx) return DENIED;
  const when = new Date(startAt);
  if (Number.isNaN(when.getTime())) return { ok: false, status: 400, error: "Horaire invalide." };
  try {
    await withTenant(ctx.tenantId, async (tx) => {
      await assertAppointment(tx, ctx.tenantId, reservationId);
      await rescheduleAppointment(tx, ctx.tenantId, { reservationId, startAt: when, staffId, actor: { userId: ctx.userId, type: ctx.actorType } });
    });
    return { ok: true, data: null };
  } catch (error) {
    return toError(error);
  }
}

export async function setFinalPrice(reservationId: string, total: number): Promise<ActionResult> {
  const ctx = await context("reservation_payments.record");
  if (!ctx) return DENIED;
  try {
    await withTenant(ctx.tenantId, (tx) => setAppointmentTotal(tx, ctx.tenantId, reservationId, total));
    return { ok: true, data: null };
  } catch (error) {
    return toError(error);
  }
}

export async function checkout(raw: unknown): Promise<ActionResult<{ receiptNumber: string }>> {
  const ctx = await context("reservation_payments.record");
  if (!ctx) return DENIED;
  const parsed = paymentSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, status: 400, error: firstIssue(parsed.error) };
  const p = parsed.data;
  try {
    const payment = await withTenant(ctx.tenantId, async (tx) => {
      await assertAppointment(tx, ctx.tenantId, p.reservationId);
      return recordReservationPayment(tx, ctx.tenantId, { reservationId: p.reservationId, amount: p.amount, method: p.method, kind: "balance", reference: p.reference, actorUserId: ctx.userId });
    });
    return { ok: true, data: { receiptNumber: payment.receiptNumber } };
  } catch (error) {
    return toError(error);
  }
}

export async function voidCheckout(paymentId: string, reason: string): Promise<ActionResult> {
  const ctx = await context("reservation_payments.record");
  if (!ctx) return DENIED;
  try {
    await withTenant(ctx.tenantId, async (tx) => {
      const payment = await tx.reservationPayment.findFirst({ where: { id: paymentId, tenantId: ctx.tenantId, reservation: { moduleKey: APPOINTMENTS_MODULE } }, select: { id: true } });
      if (!payment) throw new ServiceError("Encaissement introuvable.");
      await voidReservationPayment(tx, ctx.tenantId, paymentId, reason);
    });
    return { ok: true, data: null };
  } catch (error) {
    return toError(error);
  }
}
