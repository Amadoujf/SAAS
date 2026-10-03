import { Prisma } from "@prisma/client";
import type { CustomerInput } from "./customer-registry";
import { createListing, InvalidListingInputError, updateListing, type ListingInput } from "./listing-registry";
import { createReservation, ReservationNotFoundError, ReservationUnavailableError, transitionReservationStatus } from "./reservation-registry";
import {
  addDays,
  isIsoDate,
  localToUtc,
  normalizeRanges,
  slotRefusal,
  staffDaySlots,
  utcToLocal,
  weekdayOf,
  type Interval,
  type MinuteRange,
} from "./service-slots";

/**
 * Services / salons (secteur `services`) — prestations, équipe, horaires, absences,
 * rendez-vous. S'appuie sur les primitives communes : une prestation EST une fiche
 * `type = "service_offering"` + sa fiche technique (durée, préparation) ; un rendez-vous
 * EST une réservation commune du module "appointments" + la personne qui l'assure.
 *
 * Règles tenues ici (et doublées en base) :
 * - un horaire n'est accepté que s'il est RÉELLEMENT libre : dans les heures de la
 *   personne, hors absence, sans chevaucher un autre rendez-vous (verrou sur la
 *   personne pendant la vérification + contrainte d'exclusion en base) ;
 * - le prix vient de la fiche, jamais du navigateur ; un prix « à partir de » est
 *   ajusté par le salon avant l'encaissement, jamais par le client ;
 * - une personne ne réalise que les prestations qu'elle sait faire ;
 * - le client invité ne voit, ne déplace et n'annule que SON rendez-vous (jeton), dans
 *   le délai fixé par le salon ;
 * - aucun paiement n'est simulé ni présumé ; Chariow reste réservé aux abonnements.
 */

export const SERVICE_MODULE = "service_catalog";
export const APPOINTMENTS_MODULE = "appointments";
export const SLOT_STEPS = [5, 10, 15, 20, 30, 60] as const;

export class ServiceError extends Error {}

const MINUTE = 60_000;
const DEFAULT_SETTINGS = { slotStepMinutes: 15, minLeadMinutes: 60, maxAdvanceDays: 45, cancelCutoffHours: 3, autoConfirm: true };
const ACTIVE_STATUSES = ["requested", "confirmed"];

type Tx = Prisma.TransactionClient;
type Actor = { userId: string | null; type: "owner" | "employee" | "system" | "customer" };

// ============================================================================
// PRESTATIONS
// ============================================================================

export interface ServiceInput {
  title: string;
  slug?: string;
  summary?: string | null;
  description?: string | null;
  /** Prix (FCFA). Absent = sur devis. */
  price?: number | null;
  priceFrom?: boolean;
  category: string;
  durationMinutes: number;
  bufferMinutes?: number;
  onlineBooking?: boolean;
  position?: number;
  media?: ListingInput["media"];
  featured?: boolean;
  /** Personnes qui réalisent la prestation (remplace la liste). */
  staffIds?: string[];
}

function assertService(input: Partial<ServiceInput>) {
  if (input.category !== undefined && (!input.category.trim() || input.category.trim().length > 60)) throw new InvalidListingInputError("Indiquez une rubrique (60 caractères au plus).");
  if (input.durationMinutes !== undefined && (!Number.isInteger(input.durationMinutes) || input.durationMinutes < 5 || input.durationMinutes > 600)) {
    throw new InvalidListingInputError("La durée doit être comprise entre 5 minutes et 10 heures.");
  }
  if (input.bufferMinutes !== undefined && (!Number.isInteger(input.bufferMinutes) || input.bufferMinutes < 0 || input.bufferMinutes > 180)) {
    throw new InvalidListingInputError("Le temps de préparation doit être compris entre 0 et 180 minutes.");
  }
  if (input.price != null && (!Number.isInteger(input.price) || input.price < 0)) throw new InvalidListingInputError("Le prix doit être un nombre entier positif.");
}

const detailsData = (input: Partial<ServiceInput>) => ({
  ...(input.category !== undefined ? { category: input.category.trim() } : {}),
  ...(input.durationMinutes !== undefined ? { durationMinutes: input.durationMinutes } : {}),
  ...(input.bufferMinutes !== undefined ? { bufferMinutes: input.bufferMinutes } : {}),
  ...(input.priceFrom !== undefined ? { priceFrom: input.priceFrom } : {}),
  ...(input.onlineBooking !== undefined ? { onlineBooking: input.onlineBooking } : {}),
  ...(input.position !== undefined ? { position: input.position } : {}),
});

async function replaceServiceStaff(tx: Tx, tenantId: string, listingId: string, staffIds: string[]) {
  const unique = [...new Set(staffIds)];
  if (unique.length) {
    const owned = await tx.serviceStaff.count({ where: { tenantId, id: { in: unique } } });
    if (owned !== unique.length) throw new ServiceError("Membre de l'équipe introuvable.");
  }
  await tx.serviceStaffSkill.deleteMany({ where: { tenantId, listingId } });
  if (unique.length) await tx.serviceStaffSkill.createMany({ data: unique.map((staffId) => ({ tenantId, staffId, listingId })) });
}

export async function createService(tx: Tx, tenantId: string, input: ServiceInput, actorUserId: string | null) {
  assertService(input);
  const listing = await createListing(
    tx,
    tenantId,
    {
      moduleKey: SERVICE_MODULE,
      type: "service_offering",
      title: input.title,
      slug: input.slug,
      summary: input.summary,
      description: input.description,
      price: input.price ?? null,
      priceUnit: input.price == null ? "on_request" : "total",
      media: input.media,
      featured: input.featured,
    },
    actorUserId,
  );
  await tx.serviceDetails.create({ data: { listingId: listing.id, tenantId, category: input.category.trim(), durationMinutes: input.durationMinutes, ...detailsData(input) } });
  if (input.staffIds) await replaceServiceStaff(tx, tenantId, listing.id, input.staffIds);
  return getService(tx, tenantId, listing.id);
}

export async function updateService(tx: Tx, tenantId: string, listingId: string, patch: Partial<ServiceInput>, actorUserId: string | null) {
  assertService(patch);
  const current = await tx.serviceDetails.findFirst({ where: { listingId, tenantId } });
  if (!current) throw new InvalidListingInputError("Cette prestation n'existe pas.");
  const details = detailsData(patch);
  if (Object.keys(details).length) await tx.serviceDetails.update({ where: { listingId }, data: details });
  if (patch.staffIds) await replaceServiceStaff(tx, tenantId, listingId, patch.staffIds);
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
      ...(patch.price !== undefined ? { price: patch.price, priceUnit: patch.price == null ? "on_request" : "total" } : {}),
    },
    actorUserId,
  );
  return getService(tx, tenantId, listingId);
}

const serviceInclude = {
  service: { include: { skills: { select: { staffId: true, staff: { select: { id: true, displayName: true, isActive: true, acceptsOnline: true, photoUrl: true, title: true } } } } } },
} satisfies Prisma.ListingInclude;

export function getService(tx: Tx, tenantId: string, listingId: string) {
  return tx.listing.findFirstOrThrow({ where: { id: listingId, tenantId, deletedAt: null, type: "service_offering" }, include: serviceInclude });
}

export function listServices(tx: Tx, tenantId: string, q: { publishedOnly?: boolean; status?: string; category?: string; search?: string } = {}) {
  return tx.listing.findMany({
    where: {
      tenantId,
      deletedAt: null,
      type: "service_offering",
      ...(q.publishedOnly ? { status: "published" } : q.status ? { status: q.status } : {}),
      ...(q.category ? { service: { category: q.category } } : {}),
      ...(q.search ? { title: { contains: q.search, mode: "insensitive" as const } } : {}),
    },
    include: serviceInclude,
    orderBy: [{ service: { position: "asc" } }, { title: "asc" }],
    take: 300,
  });
}

export function getPublishedServiceBySlug(tx: Tx, tenantId: string, slug: string) {
  return tx.listing.findFirst({ where: { tenantId, slug, status: "published", deletedAt: null, type: "service_offering" }, include: serviceInclude });
}

// ============================================================================
// ÉQUIPE, HORAIRES, ABSENCES
// ============================================================================

export interface StaffInput {
  displayName: string;
  title?: string | null;
  bio?: string | null;
  photoUrl?: string | null;
  isActive?: boolean;
  acceptsOnline?: boolean;
  position?: number;
  /** Prestations réalisées (remplace la liste). */
  serviceIds?: string[];
  /** Horaires hebdomadaires (remplace tout) : { weekday, startMinute, endMinute }. */
  hours?: (MinuteRange & { weekday: number })[];
}

function assertStaff(input: Partial<StaffInput>) {
  if (input.displayName !== undefined && (!input.displayName.trim() || input.displayName.trim().length > 80)) throw new ServiceError("Indiquez un nom (80 caractères au plus).");
  if (input.photoUrl && !/^(\/|https:\/\/)/.test(input.photoUrl)) throw new ServiceError("Photo invalide.");
  if (input.hours) {
    if (input.hours.some((h) => !Number.isInteger(h.weekday) || h.weekday < 0 || h.weekday > 6)) throw new ServiceError("Jour de la semaine invalide.");
    for (let d = 0; d < 7; d++) {
      try {
        normalizeRanges(input.hours.filter((h) => h.weekday === d));
      } catch (e) {
        throw new ServiceError((e as Error).message);
      }
    }
  }
}

async function replaceStaffServices(tx: Tx, tenantId: string, staffId: string, serviceIds: string[]) {
  const unique = [...new Set(serviceIds)];
  if (unique.length) {
    const owned = await tx.serviceDetails.count({ where: { tenantId, listingId: { in: unique } } });
    if (owned !== unique.length) throw new ServiceError("Prestation introuvable.");
  }
  await tx.serviceStaffSkill.deleteMany({ where: { tenantId, staffId } });
  if (unique.length) await tx.serviceStaffSkill.createMany({ data: unique.map((listingId) => ({ tenantId, staffId, listingId })) });
}

async function replaceHours(tx: Tx, tenantId: string, staffId: string, hours: (MinuteRange & { weekday: number })[]) {
  await tx.staffWorkingHours.deleteMany({ where: { tenantId, staffId } });
  if (hours.length) await tx.staffWorkingHours.createMany({ data: hours.map((h) => ({ tenantId, staffId, weekday: h.weekday, startMinute: h.startMinute, endMinute: h.endMinute })) });
}

const staffFields = (input: Partial<StaffInput>) => ({
  ...(input.displayName !== undefined ? { displayName: input.displayName.trim() } : {}),
  ...(input.title !== undefined ? { title: input.title?.trim() || null } : {}),
  ...(input.bio !== undefined ? { bio: input.bio?.trim() || null } : {}),
  ...(input.photoUrl !== undefined ? { photoUrl: input.photoUrl || null } : {}),
  ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
  ...(input.acceptsOnline !== undefined ? { acceptsOnline: input.acceptsOnline } : {}),
  ...(input.position !== undefined ? { position: input.position } : {}),
});

export async function createStaff(tx: Tx, tenantId: string, input: StaffInput) {
  assertStaff(input);
  const staff = await tx.serviceStaff.create({ data: { tenantId, displayName: input.displayName.trim(), ...staffFields(input) } });
  if (input.serviceIds) await replaceStaffServices(tx, tenantId, staff.id, input.serviceIds);
  if (input.hours) await replaceHours(tx, tenantId, staff.id, input.hours);
  return getStaff(tx, tenantId, staff.id);
}

export async function updateStaff(tx: Tx, tenantId: string, staffId: string, patch: Partial<StaffInput>) {
  assertStaff(patch);
  const { count } = await tx.serviceStaff.updateMany({ where: { id: staffId, tenantId }, data: staffFields(patch) });
  if (count === 0) throw new ServiceError("Membre de l'équipe introuvable.");
  if (patch.serviceIds) await replaceStaffServices(tx, tenantId, staffId, patch.serviceIds);
  if (patch.hours) await replaceHours(tx, tenantId, staffId, patch.hours);
  return getStaff(tx, tenantId, staffId);
}

// Fonction (pas constante) : « absences en cours ou à venir » se calcule à chaque lecture.
const staffInclude = () =>
  ({
    skills: { select: { listingId: true } },
    hours: { orderBy: [{ weekday: "asc" as const }, { startMinute: "asc" as const }] },
    timeOff: { where: { endAt: { gte: new Date() } }, orderBy: { startAt: "asc" as const } },
  }) satisfies Prisma.ServiceStaffInclude;

export function getStaff(tx: Tx, tenantId: string, staffId: string) {
  return tx.serviceStaff.findFirstOrThrow({ where: { id: staffId, tenantId }, include: staffInclude() });
}

export function listStaff(tx: Tx, tenantId: string, q: { activeOnly?: boolean; onlineOnly?: boolean } = {}) {
  return tx.serviceStaff.findMany({
    where: { tenantId, ...(q.activeOnly ? { isActive: true } : {}), ...(q.onlineOnly ? { acceptsOnline: true } : {}) },
    include: staffInclude(),
    orderBy: [{ position: "asc" }, { displayName: "asc" }],
  });
}

/** Absence : refusée si elle recouvre des rendez-vous à venir (à déplacer d'abord). */
export async function addTimeOff(tx: Tx, tenantId: string, input: { staffId: string; startAt: Date; endAt: Date; reason?: string | null }) {
  if (!(input.startAt < input.endAt)) throw new ServiceError("L'absence doit se terminer après son début.");
  const staff = await tx.serviceStaff.findFirst({ where: { id: input.staffId, tenantId }, select: { id: true } });
  if (!staff) throw new ServiceError("Membre de l'équipe introuvable.");
  await lockStaff(tx, tenantId, input.staffId);
  const clashes = await tx.serviceAppointment.count({
    where: { tenantId, staffId: input.staffId, active: true, startAt: { lt: input.endAt }, endAt: { gt: input.startAt }, reservation: { status: { in: ACTIVE_STATUSES } } },
  });
  if (clashes > 0) throw new ServiceError(`${clashes} rendez-vous sont prévus pendant cette absence : déplacez-les ou annulez-les d'abord.`);
  return tx.staffTimeOff.create({ data: { tenantId, staffId: input.staffId, startAt: input.startAt, endAt: input.endAt, reason: input.reason?.trim() || null } });
}

export async function removeTimeOff(tx: Tx, tenantId: string, timeOffId: string) {
  const { count } = await tx.staffTimeOff.deleteMany({ where: { id: timeOffId, tenantId } });
  if (count === 0) throw new ServiceError("Absence introuvable.");
}

// ============================================================================
// RÉGLAGES
// ============================================================================

export async function getBookingSettings(tx: Tx, tenantId: string) {
  const row = await tx.serviceBookingSettings.findUnique({ where: { tenantId } });
  return row ?? { tenantId, ...DEFAULT_SETTINGS, updatedAt: null };
}

export async function updateBookingSettings(tx: Tx, tenantId: string, patch: Partial<typeof DEFAULT_SETTINGS>) {
  if (patch.slotStepMinutes !== undefined && !(SLOT_STEPS as readonly number[]).includes(patch.slotStepMinutes)) throw new ServiceError("Pas entre deux horaires invalide.");
  if (patch.minLeadMinutes !== undefined && (!Number.isInteger(patch.minLeadMinutes) || patch.minLeadMinutes < 0 || patch.minLeadMinutes > 10080)) throw new ServiceError("Délai minimal invalide.");
  if (patch.maxAdvanceDays !== undefined && (!Number.isInteger(patch.maxAdvanceDays) || patch.maxAdvanceDays < 1 || patch.maxAdvanceDays > 365)) throw new ServiceError("Fenêtre de réservation invalide (1 à 365 jours).");
  if (patch.cancelCutoffHours !== undefined && (!Number.isInteger(patch.cancelCutoffHours) || patch.cancelCutoffHours < 0 || patch.cancelCutoffHours > 168)) throw new ServiceError("Délai d'annulation invalide.");
  return tx.serviceBookingSettings.upsert({ where: { tenantId }, create: { tenantId, ...DEFAULT_SETTINGS, ...patch }, update: patch });
}

async function tenantTimezone(tx: Tx, tenantId: string) {
  return (await tx.tenant.findUnique({ where: { id: tenantId }, select: { timezone: true } }))?.timezone || "Africa/Dakar";
}

// ============================================================================
// DISPONIBILITÉS
// ============================================================================

async function lockStaff(tx: Tx, tenantId: string, staffId: string) {
  // Verrou de ligne : deux réservations simultanées pour la même personne sont
  // sérialisées ; la seconde relit les rendez-vous APRÈS la première.
  await tx.$queryRaw`SELECT "id" FROM "ServiceStaff" WHERE "id" = ${staffId} AND "tenantId" = ${tenantId} FOR UPDATE`;
}

async function staffDay(tx: Tx, tenantId: string, staffId: string, from: Date, to: Date, excludeReservationId?: string) {
  const [busy, timeOff] = await Promise.all([
    tx.serviceAppointment.findMany({
      where: { tenantId, staffId, active: true, startAt: { lt: to }, blockedUntil: { gt: from }, ...(excludeReservationId ? { reservationId: { not: excludeReservationId } } : {}) },
      select: { startAt: true, blockedUntil: true },
    }),
    tx.staffTimeOff.findMany({ where: { tenantId, staffId, startAt: { lt: to }, endAt: { gt: from } }, select: { startAt: true, endAt: true } }),
  ]);
  return {
    busy: busy.map((b): Interval => ({ start: b.startAt, end: b.blockedUntil })),
    timeOff: timeOff.map((t): Interval => ({ start: t.startAt, end: t.endAt })),
  };
}

export interface AvailabilityQuery {
  listingId: string;
  /** Date locale du salon (AAAA-MM-JJ). */
  date: string;
  /** Personne choisie ; absent = « sans préférence ». */
  staffId?: string | null;
  /** Site public : délai minimal, fenêtre, pas, réservable en ligne. */
  public?: boolean;
  now?: Date;
}

/**
 * Horaires libres d'une prestation un jour donné, avec les personnes disponibles pour
 * chacun (triées de la moins chargée à la plus chargée ce jour-là).
 */
export async function computeAvailability(tx: Tx, tenantId: string, q: AvailabilityQuery) {
  if (!isIsoDate(q.date)) throw new ServiceError("Date invalide.");
  const now = q.now ?? new Date();
  const [service, settings, tz] = await Promise.all([
    tx.serviceDetails.findFirst({ where: { listingId: q.listingId, tenantId }, include: { listing: { select: { status: true, deletedAt: true } } } }),
    getBookingSettings(tx, tenantId),
    tenantTimezone(tx, tenantId),
  ]);
  if (!service || service.listing.deletedAt) throw new ServiceError("Prestation introuvable.");
  if (q.public && (service.listing.status !== "published" || !service.onlineBooking)) throw new ServiceError("Cette prestation ne se réserve pas en ligne.");

  const staff = await tx.serviceStaff.findMany({
    where: {
      tenantId,
      isActive: true,
      ...(q.public ? { acceptsOnline: true } : {}),
      ...(q.staffId ? { id: q.staffId } : {}),
      skills: { some: { listingId: q.listingId } },
    },
    include: { hours: { where: { weekday: weekdayOf(q.date) } } },
    orderBy: [{ position: "asc" }, { displayName: "asc" }],
  });
  if (q.staffId && staff.length === 0) throw new ServiceError("Cette personne ne réalise pas cette prestation.");

  const dayStart = localToUtc(q.date, 0, tz);
  const dayEnd = localToUtc(addDays(q.date, 1), 0, tz);
  const earliest = q.public ? new Date(now.getTime() + settings.minLeadMinutes * MINUTE) : now;
  const latest = q.public ? new Date(now.getTime() + settings.maxAdvanceDays * 86_400_000) : null;

  const bySlot = new Map<number, { staffId: string; load: number }[]>();
  for (const s of staff) {
    const { busy, timeOff } = await staffDay(tx, tenantId, s.id, dayStart, new Date(dayEnd.getTime() + 12 * 3600_000));
    const hours = normalizeRanges(s.hours.map((h) => ({ startMinute: h.startMinute, endMinute: h.endMinute })));
    const slots = staffDaySlots({
      date: q.date,
      tz,
      durationMinutes: service.durationMinutes,
      bufferMinutes: service.bufferMinutes,
      stepMinutes: settings.slotStepMinutes,
      hours,
      busy,
      timeOff,
      earliest,
      latest,
    });
    const load = busy.filter((b) => b.start >= dayStart && b.start < dayEnd).length;
    for (const start of slots) {
      const list = bySlot.get(start.getTime()) ?? [];
      list.push({ staffId: s.id, load });
      bySlot.set(start.getTime(), list);
    }
  }
  return {
    timezone: tz,
    durationMinutes: service.durationMinutes,
    slots: [...bySlot.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([t, list]) => ({ startAt: new Date(t), staffIds: list.sort((a, b) => a.load - b.load).map((x) => x.staffId) })),
  };
}

/** Prochains jours (à partir de `from`) ayant au moins un horaire libre — pour le calendrier public. */
export async function openDays(tx: Tx, tenantId: string, q: Omit<AvailabilityQuery, "date"> & { from: string; days: number }) {
  const out: { date: string; count: number }[] = [];
  for (let i = 0; i < Math.min(q.days, 62); i++) {
    const date = addDays(q.from, i);
    const { slots } = await computeAvailability(tx, tenantId, { ...q, date });
    out.push({ date, count: slots.length });
  }
  return out;
}

async function assertSlotFree(
  tx: Tx,
  tenantId: string,
  args: { staffId: string; start: Date; durationMinutes: number; bufferMinutes: number; tz: string; publicRules: { minLeadMinutes: number; maxAdvanceDays: number; slotStepMinutes: number } | null; excludeReservationId?: string },
) {
  const local = utcToLocal(args.start, args.tz);
  const hours = await tx.staffWorkingHours.findMany({ where: { tenantId, staffId: args.staffId, weekday: local.weekday }, select: { startMinute: true, endMinute: true } });
  const from = new Date(args.start.getTime() - 12 * 3600_000);
  const to = new Date(args.start.getTime() + (args.durationMinutes + args.bufferMinutes) * MINUTE + 12 * 3600_000);
  const { busy, timeOff } = await staffDay(tx, tenantId, args.staffId, from, to, args.excludeReservationId);
  const now = new Date();
  return slotRefusal({
    start: args.start,
    tz: args.tz,
    durationMinutes: args.durationMinutes,
    bufferMinutes: args.bufferMinutes,
    hours,
    busy,
    timeOff,
    earliest: args.publicRules ? new Date(now.getTime() + args.publicRules.minLeadMinutes * MINUTE) : now,
    latest: args.publicRules ? new Date(now.getTime() + args.publicRules.maxAdvanceDays * 86_400_000) : null,
    stepMinutes: args.publicRules?.slotStepMinutes ?? null,
  });
}

const isOverlapViolation = (e: unknown) =>
  (e instanceof Prisma.PrismaClientKnownRequestError && (e.meta as { code?: string } | undefined)?.code === "23P01") ||
  (e instanceof Error && /ServiceAppointment_no_overlap|23P01|conflicting key value violates exclusion constraint/.test(e.message));

// ============================================================================
// RENDEZ-VOUS
// ============================================================================

export interface BookAppointmentInput {
  listingId: string;
  /** Personne choisie ; absent = la moins chargée parmi celles libres à cet horaire. */
  staffId?: string | null;
  startAt: Date;
  customerId?: string | null;
  customer?: CustomerInput | null;
  customerNote?: string | null;
  channel?: "web" | "dashboard" | "phone" | "whatsapp";
  actor: Actor;
}

export async function bookAppointment(tx: Tx, tenantId: string, input: BookAppointmentInput) {
  const fromPublic = input.actor.type === "customer" || (input.channel ?? "web") === "web";
  if (!(input.startAt instanceof Date) || Number.isNaN(input.startAt.getTime())) throw new ServiceError("Horaire invalide.");
  const [service, settings, tz] = await Promise.all([
    tx.serviceDetails.findFirst({ where: { listingId: input.listingId, tenantId }, include: { listing: { select: { status: true, deletedAt: true } } } }),
    getBookingSettings(tx, tenantId),
    tenantTimezone(tx, tenantId),
  ]);
  if (!service || service.listing.deletedAt) throw new ServiceError("Prestation introuvable.");
  if (fromPublic && (service.listing.status !== "published" || !service.onlineBooking)) throw new ServiceError("Cette prestation ne se réserve pas en ligne.");

  const candidates = await tx.serviceStaff.findMany({
    where: { tenantId, isActive: true, ...(fromPublic ? { acceptsOnline: true } : {}), ...(input.staffId ? { id: input.staffId } : {}), skills: { some: { listingId: input.listingId } } },
    select: { id: true },
    orderBy: [{ position: "asc" }, { displayName: "asc" }],
  });
  if (input.staffId && candidates.length === 0) throw new ServiceError("Cette personne ne réalise pas cette prestation.");
  if (candidates.length === 0) throw new ServiceError("Personne ne réalise cette prestation pour le moment.");

  // « Sans préférence » : la personne la moins chargée ce jour-là parmi celles libres.
  const local = utcToLocal(input.startAt, tz);
  const dayStart = localToUtc(local.date, 0, tz);
  const dayEnd = localToUtc(addDays(local.date, 1), 0, tz);
  const loads = await tx.serviceAppointment.groupBy({
    by: ["staffId"],
    where: { tenantId, active: true, staffId: { in: candidates.map((c) => c.id) }, startAt: { gte: dayStart, lt: dayEnd } },
    _count: { _all: true },
  });
  const loadOf = (id: string) => loads.find((l) => l.staffId === id)?._count._all ?? 0;
  const ordered = [...candidates].sort((a, b) => loadOf(a.id) - loadOf(b.id));

  const publicRules = fromPublic ? settings : null;
  let chosen: string | null = null;
  let refusal: string | null = null;
  for (const c of ordered) {
    await lockStaff(tx, tenantId, c.id);
    refusal = await assertSlotFree(tx, tenantId, { staffId: c.id, start: input.startAt, durationMinutes: service.durationMinutes, bufferMinutes: service.bufferMinutes, tz, publicRules });
    if (!refusal) {
      chosen = c.id;
      break;
    }
  }
  if (!chosen) throw new ServiceError(ordered.length > 1 ? "Plus personne n'est libre à cet horaire : choisissez-en un autre." : refusal ?? "Cet horaire n'est pas disponible.");

  const reservation = await createReservation(tx, tenantId, {
    listingId: input.listingId,
    requestedStartAt: input.startAt,
    quantity: 1,
    customerId: input.customerId ?? null,
    customer: input.customer ?? null,
    customerNote: input.customerNote ?? null,
    channel: input.channel ?? "web",
    moduleKey: APPOINTMENTS_MODULE,
    actor: input.actor,
  });
  const endAt = new Date(input.startAt.getTime() + service.durationMinutes * MINUTE);
  await tx.reservation.update({ where: { id: reservation.id }, data: { endAt } });
  try {
    await tx.serviceAppointment.create({
      data: { reservationId: reservation.id, tenantId, staffId: chosen, listingId: input.listingId, startAt: input.startAt, endAt, blockedUntil: new Date(endAt.getTime() + service.bufferMinutes * MINUTE) },
    });
  } catch (e) {
    if (isOverlapViolation(e)) throw new ServiceError("Cet horaire vient d'être pris : choisissez-en un autre.");
    throw e;
  }
  // En ligne : confirmé tout de suite si le salon l'a choisi ; saisi par l'équipe : confirmé.
  if (!fromPublic || settings.autoConfirm) {
    await transitionReservationStatus(tx, tenantId, { reservationId: reservation.id, toStatus: "confirmed", actor: fromPublic ? { userId: null, type: "system" } : input.actor });
  }
  return getAppointment(tx, tenantId, reservation.id);
}

/**
 * Déplace un rendez-vous (autre horaire, éventuellement autre personne). Le client ne
 * peut le faire qu'en ligne, sur SON rendez-vous, avant le délai d'annulation et sur
 * un horaire proposé ; l'équipe peut placer n'importe quel horaire libre.
 */
export async function rescheduleAppointment(tx: Tx, tenantId: string, input: { reservationId: string; startAt: Date; staffId?: string | null; actor: Actor }) {
  const fromCustomer = input.actor.type === "customer";
  const locked = await tx.$queryRaw<{ status: string }[]>`SELECT "status" FROM "Reservation" WHERE "id" = ${input.reservationId} AND "tenantId" = ${tenantId} FOR UPDATE`;
  if (!locked[0]) throw new ReservationNotFoundError();
  if (!ACTIVE_STATUSES.includes(locked[0].status)) throw new ServiceError("Ce rendez-vous ne peut plus être déplacé.");
  const appt = await tx.serviceAppointment.findFirst({ where: { reservationId: input.reservationId, tenantId }, include: { service: true } });
  if (!appt) throw new ReservationNotFoundError();
  const settings = await getBookingSettings(tx, tenantId);
  const tz = await tenantTimezone(tx, tenantId);
  if (fromCustomer && appt.startAt.getTime() - Date.now() < settings.cancelCutoffHours * 3600_000) {
    throw new ServiceError(`Le rendez-vous est dans moins de ${settings.cancelCutoffHours} h : appelez le salon pour le déplacer.`);
  }
  const staffId = input.staffId ?? appt.staffId;
  const skilled = await tx.serviceStaff.findFirst({ where: { id: staffId, tenantId, isActive: true, ...(fromCustomer ? { acceptsOnline: true } : {}), skills: { some: { listingId: appt.listingId } } }, select: { id: true } });
  if (!skilled) throw new ServiceError("Cette personne ne réalise pas cette prestation.");
  await lockStaff(tx, tenantId, staffId);
  const refusal = await assertSlotFree(tx, tenantId, {
    staffId,
    start: input.startAt,
    durationMinutes: appt.service.durationMinutes,
    bufferMinutes: appt.service.bufferMinutes,
    tz,
    publicRules: fromCustomer ? settings : null,
    excludeReservationId: input.reservationId,
  });
  if (refusal) throw new ServiceError(refusal);
  const endAt = new Date(input.startAt.getTime() + appt.service.durationMinutes * MINUTE);
  try {
    await tx.serviceAppointment.update({
      where: { reservationId: input.reservationId },
      data: { staffId, startAt: input.startAt, endAt, blockedUntil: new Date(endAt.getTime() + appt.service.bufferMinutes * MINUTE) },
    });
  } catch (e) {
    if (isOverlapViolation(e)) throw new ServiceError("Cet horaire vient d'être pris : choisissez-en un autre.");
    throw e;
  }
  await tx.reservation.update({ where: { id: input.reservationId }, data: { startAt: input.startAt, endAt } });
  const fmt = (d: Date) => { const l = utcToLocal(d, tz); return `${l.date.split("-").reverse().join("/")} ${String(Math.floor(l.minute / 60)).padStart(2, "0")}h${String(l.minute % 60).padStart(2, "0")}`; };
  await tx.reservationStatusHistory.create({
    data: { tenantId, reservationId: input.reservationId, fromStatus: locked[0].status, toStatus: locked[0].status, changedBy: input.actor.userId, changedByType: input.actor.type, note: `Déplacé du ${fmt(appt.startAt)} au ${fmt(input.startAt)}` },
  });
  return getAppointment(tx, tenantId, input.reservationId);
}

/** Annulation par le client, sur SON rendez-vous, avant le délai fixé par le salon. */
export async function cancelAppointmentAsGuest(tx: Tx, tenantId: string, accessToken: string) {
  const r = await tx.reservation.findFirst({ where: { tenantId, accessToken, moduleKey: APPOINTMENTS_MODULE }, select: { id: true, startAt: true, status: true } });
  if (!r) throw new ReservationNotFoundError();
  if (!ACTIVE_STATUSES.includes(r.status)) throw new ServiceError("Ce rendez-vous n'est plus actif.");
  const settings = await getBookingSettings(tx, tenantId);
  if (r.startAt.getTime() - Date.now() < settings.cancelCutoffHours * 3600_000) {
    throw new ServiceError(`Le rendez-vous est dans moins de ${settings.cancelCutoffHours} h : appelez le salon pour l'annuler.`);
  }
  return transitionReservationStatus(tx, tenantId, { reservationId: r.id, toStatus: "canceled", actor: { userId: null, type: "customer" }, note: "Annulé en ligne par le client" });
}

/** Prix final d'une prestation « à partir de » ou sur devis, fixé par le salon avant encaissement. */
export async function setAppointmentTotal(tx: Tx, tenantId: string, reservationId: string, total: number) {
  if (!Number.isInteger(total) || total < 0 || total > 10_000_000) throw new ServiceError("Montant invalide.");
  const locked = await tx.$queryRaw<{ status: string }[]>`SELECT "status" FROM "Reservation" WHERE "id" = ${reservationId} AND "tenantId" = ${tenantId} AND "moduleKey" = ${APPOINTMENTS_MODULE} FOR UPDATE`;
  if (!locked[0]) throw new ReservationNotFoundError();
  if (locked[0].status === "canceled") throw new ServiceError("Rendez-vous annulé.");
  const payments = await tx.reservationPayment.findMany({ where: { tenantId, reservationId, voidedAt: null }, select: { amount: true } });
  const paid = payments.reduce((s, p) => s + p.amount, 0);
  if (total < paid) throw new ServiceError(`Le montant ne peut pas être inférieur à ce qui est déjà encaissé (${paid} FCFA).`);
  await tx.reservation.update({ where: { id: reservationId }, data: { totalAmount: total, unitPrice: total } });
  return getAppointment(tx, tenantId, reservationId);
}

// ============================================================================
// LECTURES MÉTIER
// ============================================================================

const appointmentInclude = {
  listing: { select: { id: true, title: true, slug: true, price: true, media: true, service: { select: { durationMinutes: true, bufferMinutes: true, priceFrom: true, category: true } } } },
  customer: { select: { id: true, firstName: true, lastName: true, phone: true, email: true } },
  appointment: { include: { staff: { select: { id: true, displayName: true, photoUrl: true, title: true } } } },
  payments: { orderBy: { paidAt: "asc" as const } },
  history: { orderBy: { createdAt: "asc" as const } },
} satisfies Prisma.ReservationInclude;

export function getAppointment(tx: Tx, tenantId: string, reservationId: string) {
  return tx.reservation.findFirst({ where: { id: reservationId, tenantId, moduleKey: APPOINTMENTS_MODULE }, include: appointmentInclude });
}

export function getAppointmentByToken(tx: Tx, tenantId: string, accessToken: string) {
  return tx.reservation.findFirst({ where: { accessToken, tenantId, moduleKey: APPOINTMENTS_MODULE }, include: appointmentInclude });
}

export function listAppointments(tx: Tx, tenantId: string, q: { from?: Date; to?: Date; staffId?: string; status?: string[]; search?: string; take?: number; order?: "asc" | "desc" } = {}) {
  const search = q.search?.trim();
  return tx.reservation.findMany({
    where: {
      tenantId,
      moduleKey: APPOINTMENTS_MODULE,
      ...(q.status ? { status: { in: q.status } } : {}),
      ...(q.from || q.to ? { startAt: { ...(q.from ? { gte: q.from } : {}), ...(q.to ? { lt: q.to } : {}) } } : {}),
      ...(q.staffId ? { appointment: { staffId: q.staffId } } : {}),
      ...(search
        ? { OR: [{ reference: { contains: search, mode: "insensitive" as const } }, { customer: { OR: [{ firstName: { contains: search, mode: "insensitive" as const } }, { lastName: { contains: search, mode: "insensitive" as const } }, { phone: { contains: search.replace(/\s/g, "") } }] } }] }
        : {}),
    },
    include: appointmentInclude,
    orderBy: { startAt: q.order ?? "asc" },
    take: Math.min(q.take ?? 200, 500),
  });
}

/** Chiffres du jour et de la semaine pour la vue d'ensemble du salon. */
export async function salonOverview(tx: Tx, tenantId: string, now = new Date()) {
  const tz = await tenantTimezone(tx, tenantId);
  const today = utcToLocal(now, tz).date;
  const dayStart = localToUtc(today, 0, tz);
  const dayEnd = localToUtc(addDays(today, 1), 0, tz);
  const weekEnd = localToUtc(addDays(today, 7), 0, tz);
  const [todayAppts, weekCount, pending, collected, staffCount] = await Promise.all([
    tx.reservation.findMany({ where: { tenantId, moduleKey: APPOINTMENTS_MODULE, status: { in: ["requested", "confirmed", "completed"] }, startAt: { gte: dayStart, lt: dayEnd } }, select: { totalAmount: true, status: true } }),
    tx.reservation.count({ where: { tenantId, moduleKey: APPOINTMENTS_MODULE, status: { in: ACTIVE_STATUSES }, startAt: { gte: dayStart, lt: weekEnd } } }),
    tx.reservation.count({ where: { tenantId, moduleKey: APPOINTMENTS_MODULE, status: "requested", startAt: { gte: now } } }),
    tx.reservationPayment.aggregate({ where: { tenantId, voidedAt: null, paidAt: { gte: dayStart, lt: dayEnd }, reservation: { moduleKey: APPOINTMENTS_MODULE } }, _sum: { amount: true } }),
    tx.serviceStaff.count({ where: { tenantId, isActive: true } }),
  ]);
  return {
    timezone: tz,
    today,
    todayCount: todayAppts.length,
    todayExpected: todayAppts.reduce((s, a) => s + (a.totalAmount ?? 0), 0),
    weekCount,
    pendingRequests: pending,
    collectedToday: collected._sum.amount ?? 0,
    activeStaff: staffCount,
  };
}
