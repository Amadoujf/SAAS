import { Prisma } from "@prisma/client";
import { nextCounterValue } from "./counters";
import { resolveOrCreateCustomer, type CustomerInput } from "./customer-registry";
import { createListing, InvalidListingInputError, updateListing, type ListingInput } from "./listing-registry";
import { createReservation, ReservationNotFoundError, transitionReservationStatus } from "./reservation-registry";
import { recordReservationPayment, voidReservationPayment, type RecordPaymentInput } from "./travel-registry";
import { addDays, isIsoDate, localToUtc, normalizeRanges, utcToLocal, weekdayOf, type MinuteRange } from "./service-slots";

/**
 * Automobile (secteur `automobile`) — concessions, garages-vendeurs, importateurs.
 * S'appuie sur les briques communes :
 * - un véhicule EST une fiche commune (`Listing`, type « vehicle ») + sa fiche technique ;
 * - un essai EST une réservation commune (module « test_drive_appointments ») + son créneau ;
 * - un dossier de vente EST une réservation commune (module « vehicle_sales ») dont les
 *   encaissements (acompte, solde, reçus numérotés, annulation motivée) passent par le
 *   service commun des réservations ;
 * - les clients sont ceux du registre commun (téléphone normalisé, jamais de doublon).
 *
 * Règles tenues ici (et doublées en base) :
 * - jamais deux essais qui se chevauchent pour un même véhicule (verrou + exclusion) ;
 * - un seul dossier de vente en cours par véhicule ; un véhicule vendu ne se réserve plus ;
 * - un véhicule n'est « vendu » qu'après règlement complet ET remise des clés ;
 * - le prix est celui de la fiche (ou le prix convenu saisi par l'équipe) — jamais un
 *   montant venu du navigateur ; aucun paiement simulé, jamais Chariow ;
 * - le client ne voit que SON essai / SON importation (jeton).
 */

export const VEHICLE_MODULE = "listings";
export const TEST_DRIVE_MODULE = "test_drive_appointments";
export const VEHICLE_SALES_MODULE = "vehicle_sales";

export const FUELS = ["essence", "diesel", "hybride", "electrique", "gpl"] as const;
export const TRANSMISSIONS = ["manuelle", "automatique"] as const;
export const BODY_TYPES = ["citadine", "berline", "break", "suv", "4x4", "pickup", "monospace", "coupe", "utilitaire"] as const;
export const CONDITIONS = ["new", "used", "imported_used"] as const;
export const STOCK_STATUSES = ["incoming", "available", "reserved", "sold"] as const;
export const LEAD_STATUSES = ["new", "contacted", "test_drive", "negotiation", "won", "lost"] as const;
export const LEAD_INTERESTS = ["purchase", "test_drive", "trade_in", "financing", "import_request"] as const;
export const LEAD_SOURCES = ["web", "phone", "whatsapp", "walk_in"] as const;
export const IMPORT_STAGES = ["purchased", "shipped", "at_port", "customs", "ready"] as const;
export const VEHICLE_FEATURES = ["climatisation", "gps", "camera_recul", "radar_recul", "bluetooth", "toit_ouvrant", "cuir", "jantes_alu", "regulateur", "4_roues_motrices", "carplay", "sieges_chauffants"] as const;

export type LeadStatus = (typeof LEAD_STATUSES)[number];
export type ImportStage = (typeof IMPORT_STAGES)[number];

export class AutoError extends Error {}

type Tx = Prisma.TransactionClient;
type Actor = { userId: string | null; type: "owner" | "employee" | "system" | "customer" };

const includes = <T extends readonly string[]>(list: T, v: unknown): v is T[number] => typeof v === "string" && (list as readonly string[]).includes(v);
const int = (v: unknown, a: number, b: number) => Number.isInteger(v) && (v as number) >= a && (v as number) <= b;
const text = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");
const opt = (v: unknown, max: number) => text(v, max) || null;

async function tenantTimezone(tx: Tx, tenantId: string) {
  return (await tx.tenant.findUnique({ where: { id: tenantId }, select: { timezone: true } }))?.timezone || "Africa/Dakar";
}

// ============================================================================
// VÉHICULES
// ============================================================================

export interface VehicleInput {
  title?: string;
  summary?: string | null;
  description?: string | null;
  /** Prix FCFA ; absent = sur demande. */
  price?: number | null;
  media?: ListingInput["media"];
  featured?: boolean;
  make: string;
  model: string;
  version?: string | null;
  year: number;
  mileageKm?: number;
  fuel: string;
  transmission: string;
  bodyType: string;
  color?: string | null;
  engine?: string | null;
  seats?: number | null;
  condition: string;
  features?: string[];
  negotiable?: boolean;
  vin?: string | null;
  plate?: string | null;
  position?: number;
}

function assertVehicle(i: Partial<VehicleInput>) {
  if (i.make !== undefined && !text(i.make, 40)) throw new InvalidListingInputError("Indiquez la marque.");
  if (i.model !== undefined && !text(i.model, 60)) throw new InvalidListingInputError("Indiquez le modèle.");
  if (i.year !== undefined && !int(i.year, 1950, new Date().getFullYear() + 1)) throw new InvalidListingInputError("Année invalide.");
  if (i.mileageKm !== undefined && !int(i.mileageKm, 0, 2_000_000)) throw new InvalidListingInputError("Kilométrage invalide.");
  if (i.fuel !== undefined && !includes(FUELS, i.fuel)) throw new InvalidListingInputError("Carburant inconnu.");
  if (i.transmission !== undefined && !includes(TRANSMISSIONS, i.transmission)) throw new InvalidListingInputError("Boîte de vitesses inconnue.");
  if (i.bodyType !== undefined && !includes(BODY_TYPES, i.bodyType)) throw new InvalidListingInputError("Carrosserie inconnue.");
  if (i.condition !== undefined && !includes(CONDITIONS, i.condition)) throw new InvalidListingInputError("État inconnu.");
  if (i.seats != null && !int(i.seats, 1, 60)) throw new InvalidListingInputError("Nombre de places invalide.");
  if (i.features?.some((f) => !includes(VEHICLE_FEATURES, f))) throw new InvalidListingInputError("Équipement inconnu.");
  if (i.price != null && !int(i.price, 1, 5_000_000_000)) throw new InvalidListingInputError("Prix invalide.");
}

const vehicleTitle = (i: { make: string; model: string; version?: string | null; year: number }) => `${text(i.make, 40)} ${text(i.model, 60)}${i.version ? ` ${text(i.version, 40)}` : ""} ${i.year}`.slice(0, 120);

const detailsData = (i: Partial<VehicleInput>) => ({
  ...(i.make !== undefined ? { make: text(i.make, 40) } : {}),
  ...(i.model !== undefined ? { model: text(i.model, 60) } : {}),
  ...(i.version !== undefined ? { version: opt(i.version, 40) } : {}),
  ...(i.year !== undefined ? { year: i.year } : {}),
  ...(i.mileageKm !== undefined ? { mileageKm: i.mileageKm } : {}),
  ...(i.fuel !== undefined ? { fuel: i.fuel } : {}),
  ...(i.transmission !== undefined ? { transmission: i.transmission } : {}),
  ...(i.bodyType !== undefined ? { bodyType: i.bodyType } : {}),
  ...(i.color !== undefined ? { color: opt(i.color, 30) } : {}),
  ...(i.engine !== undefined ? { engine: opt(i.engine, 40) } : {}),
  ...(i.seats !== undefined ? { seats: i.seats } : {}),
  ...(i.condition !== undefined ? { condition: i.condition } : {}),
  ...(i.features !== undefined ? { features: [...new Set(i.features)] } : {}),
  ...(i.negotiable !== undefined ? { negotiable: !!i.negotiable } : {}),
  ...(i.vin !== undefined ? { vin: opt(i.vin, 30) } : {}),
  ...(i.plate !== undefined ? { plate: opt(i.plate, 20) } : {}),
  ...(i.position !== undefined ? { position: i.position } : {}),
});

export async function createVehicle(tx: Tx, tenantId: string, input: VehicleInput, actorUserId: string | null, opts: { incoming?: boolean } = {}) {
  assertVehicle(input);
  const listing = await createListing(
    tx,
    tenantId,
    {
      moduleKey: VEHICLE_MODULE,
      type: "vehicle",
      title: text(input.title, 120) || vehicleTitle(input),
      summary: input.summary,
      description: input.description,
      price: input.price ?? null,
      priceUnit: input.price == null ? "on_request" : "total",
      media: input.media,
      featured: input.featured,
    },
    actorUserId,
  );
  await tx.vehicleDetails.create({
    data: { listingId: listing.id, tenantId, make: text(input.make, 40), model: text(input.model, 60), year: input.year, fuel: input.fuel, transmission: input.transmission, bodyType: input.bodyType, condition: input.condition, stockStatus: opts.incoming ? "incoming" : "available", ...detailsData(input) },
  });
  return getVehicle(tx, tenantId, listing.id);
}

export async function updateVehicle(tx: Tx, tenantId: string, listingId: string, patch: Partial<VehicleInput>, actorUserId: string | null) {
  assertVehicle(patch);
  const current = await tx.vehicleDetails.findFirst({ where: { listingId, tenantId } });
  if (!current) throw new InvalidListingInputError("Ce véhicule n'existe pas.");
  const details = detailsData(patch);
  if (Object.keys(details).length) await tx.vehicleDetails.update({ where: { listingId }, data: details });
  await updateListing(
    tx,
    tenantId,
    listingId,
    {
      ...(patch.title !== undefined ? { title: text(patch.title, 120) || vehicleTitle({ ...current, ...patch } as VehicleInput) } : {}),
      ...(patch.summary !== undefined ? { summary: patch.summary } : {}),
      ...(patch.description !== undefined ? { description: patch.description } : {}),
      ...(patch.media !== undefined ? { media: patch.media } : {}),
      ...(patch.featured !== undefined ? { featured: patch.featured } : {}),
      ...(patch.price !== undefined ? { price: patch.price, priceUnit: patch.price == null ? "on_request" : "total" } : {}),
    },
    actorUserId,
  );
  return getVehicle(tx, tenantId, listingId);
}

/** Seuls « en arrivage » et « disponible » se choisissent à la main ; réservé et vendu
 *  découlent d'un dossier de vente. */
export async function setVehicleArrival(tx: Tx, tenantId: string, listingId: string, stockStatus: "incoming" | "available") {
  const v = await tx.vehicleDetails.findFirst({ where: { listingId, tenantId } });
  if (!v) throw new AutoError("Véhicule introuvable.");
  if (v.stockStatus === "reserved" || v.stockStatus === "sold") throw new AutoError("Ce véhicule a un dossier de vente : son statut suit le dossier.");
  await tx.vehicleDetails.update({ where: { listingId }, data: { stockStatus } });
}

const vehicleInclude = { vehicle: true } satisfies Prisma.ListingInclude;

export function getVehicle(tx: Tx, tenantId: string, listingId: string) {
  return tx.listing.findFirstOrThrow({ where: { id: listingId, tenantId, deletedAt: null, type: "vehicle" }, include: vehicleInclude });
}

export interface VehicleFilters {
  publicOnly?: boolean;
  make?: string;
  fuel?: string;
  bodyType?: string;
  transmission?: string;
  condition?: string;
  priceMax?: number;
  yearMin?: number;
  stock?: string[];
  search?: string;
  sort?: "recent" | "price_asc" | "price_desc" | "year_desc" | "km_asc";
  take?: number;
}

/** Stock. Public : fiches publiées, en arrivage / disponibles / réservées (jamais vendues). */
export function listVehicles(tx: Tx, tenantId: string, q: VehicleFilters = {}) {
  const search = q.search?.trim();
  const vehicleWhere: Prisma.VehicleDetailsWhereInput = {
    ...(q.publicOnly ? { stockStatus: { in: (q.stock ?? ["incoming", "available", "reserved"]).filter((s) => s !== "sold") } } : q.stock ? { stockStatus: { in: q.stock } } : {}),
    ...(q.make ? { make: { equals: q.make, mode: "insensitive" } } : {}),
    ...(q.fuel ? { fuel: q.fuel } : {}),
    ...(q.bodyType ? { bodyType: q.bodyType } : {}),
    ...(q.transmission ? { transmission: q.transmission } : {}),
    ...(q.condition ? { condition: q.condition } : {}),
    ...(q.yearMin ? { year: { gte: q.yearMin } } : {}),
  };
  const orderBy: Prisma.ListingOrderByWithRelationInput[] =
    q.sort === "price_asc" ? [{ price: { sort: "asc", nulls: "last" } }]
    : q.sort === "price_desc" ? [{ price: { sort: "desc", nulls: "last" } }]
    : q.sort === "year_desc" ? [{ vehicle: { year: "desc" } }]
    : q.sort === "km_asc" ? [{ vehicle: { mileageKm: "asc" } }]
    : [{ featured: "desc" }, { createdAt: "desc" }];
  return tx.listing.findMany({
    where: {
      tenantId,
      deletedAt: null,
      type: "vehicle",
      ...(q.publicOnly ? { status: "published" } : {}),
      ...(q.priceMax ? { price: { lte: q.priceMax } } : {}),
      vehicle: vehicleWhere,
      ...(search ? { OR: [{ title: { contains: search, mode: "insensitive" } }, { vehicle: { OR: [{ make: { contains: search, mode: "insensitive" } }, { model: { contains: search, mode: "insensitive" } }] } }] } : {}),
    },
    include: vehicleInclude,
    orderBy,
    take: Math.min(q.take ?? 200, 500),
  });
}

export function getPublicVehicleBySlug(tx: Tx, tenantId: string, slug: string) {
  return tx.listing.findFirst({ where: { tenantId, slug, type: "vehicle", status: "published", deletedAt: null, vehicle: { stockStatus: { in: ["incoming", "available", "reserved"] } } }, include: vehicleInclude });
}

/** Filtres proposés au public, d'après le stock visible (jamais une marque absente). */
export async function vehicleFacets(tx: Tx, tenantId: string) {
  const rows = await tx.vehicleDetails.findMany({
    where: { tenantId, stockStatus: { in: ["incoming", "available", "reserved"] }, listing: { status: "published", deletedAt: null } },
    select: { make: true, fuel: true, bodyType: true, year: true, listing: { select: { price: true } } },
  });
  const uniq = (xs: string[]) => [...new Set(xs)].sort((a, b) => a.localeCompare(b, "fr"));
  const prices = rows.map((r) => r.listing.price).filter((p): p is number => p != null);
  return {
    count: rows.length,
    makes: uniq(rows.map((r) => r.make)),
    fuels: uniq(rows.map((r) => r.fuel)),
    bodyTypes: uniq(rows.map((r) => r.bodyType)),
    yearMin: rows.length ? Math.min(...rows.map((r) => r.year)) : null,
    priceMax: prices.length ? Math.max(...prices) : null,
  };
}

// ============================================================================
// RÉGLAGES ET ESSAIS
// ============================================================================

export type ShowroomHours = MinuteRange & { weekday: number };
const DEFAULT_SETTINGS = { openingHours: [] as ShowroomHours[], testDriveMinutes: 45, slotStepMinutes: 30, maxAdvanceDays: 30, depositPercent: 10 };
export type AutoSettingsInput = Partial<typeof DEFAULT_SETTINGS>;

export async function getAutoSettings(tx: Tx, tenantId: string) {
  const row = await tx.autoSettings.findUnique({ where: { tenantId } });
  if (!row) return { tenantId, ...DEFAULT_SETTINGS, updatedAt: null as Date | null };
  return { ...row, openingHours: (Array.isArray(row.openingHours) ? row.openingHours : []) as unknown as ShowroomHours[] };
}

export async function updateAutoSettings(tx: Tx, tenantId: string, patch: AutoSettingsInput) {
  const data: Prisma.AutoSettingsUpdateInput = {};
  if (patch.openingHours !== undefined) {
    if (!Array.isArray(patch.openingHours) || patch.openingHours.some((h) => !int(h?.weekday, 0, 6))) throw new AutoError("Jour de la semaine invalide.");
    const all: ShowroomHours[] = [];
    for (let d = 0; d < 7; d++) {
      try {
        all.push(...normalizeRanges(patch.openingHours.filter((h) => h.weekday === d)).map((r) => ({ weekday: d, startMinute: r.startMinute, endMinute: r.endMinute })));
      } catch (e) {
        throw new AutoError(e instanceof Error ? e.message : "Horaires invalides.");
      }
    }
    data.openingHours = all as unknown as Prisma.InputJsonValue;
  }
  if (patch.testDriveMinutes !== undefined) {
    if (!int(patch.testDriveMinutes, 15, 240)) throw new AutoError("Durée d'essai invalide.");
    data.testDriveMinutes = patch.testDriveMinutes;
  }
  if (patch.slotStepMinutes !== undefined) {
    if (![15, 30, 60].includes(patch.slotStepMinutes)) throw new AutoError("Pas des créneaux invalide.");
    data.slotStepMinutes = patch.slotStepMinutes;
  }
  if (patch.maxAdvanceDays !== undefined) {
    if (!int(patch.maxAdvanceDays, 1, 180)) throw new AutoError("Fenêtre de réservation invalide.");
    data.maxAdvanceDays = patch.maxAdvanceDays;
  }
  if (patch.depositPercent !== undefined) {
    if (!int(patch.depositPercent, 0, 100)) throw new AutoError("Acompte invalide.");
    data.depositPercent = patch.depositPercent;
  }
  const createData = { ...DEFAULT_SETTINGS, ...data, openingHours: (data.openingHours ?? []) as Prisma.InputJsonValue } as Omit<Prisma.AutoSettingsUncheckedCreateInput, "tenantId">;
  return tx.autoSettings.upsert({ where: { tenantId }, create: { tenantId, ...createData }, update: data });
}

const openingOn = (hours: ShowroomHours[], date: string) => hours.filter((h) => h.weekday === weekdayOf(date)).sort((a, b) => a.startMinute - b.startMinute);

/** Créneaux d'essai d'un véhicule pour une date : horaires du showroom, essais déjà
 *  pris retirés, au plus tôt 2 h après maintenant. */
export async function testDriveSlots(tx: Tx, tenantId: string, listingId: string, date: string, now = new Date()) {
  if (!isIsoDate(date)) throw new AutoError("Date invalide.");
  const [tz, settings, vehicle] = await Promise.all([tenantTimezone(tx, tenantId), getAutoSettings(tx, tenantId), tx.vehicleDetails.findFirst({ where: { listingId, tenantId } })]);
  if (!vehicle) throw new AutoError("Véhicule introuvable.");
  const today = utcToLocal(now, tz).date;
  if (date < today || date > addDays(today, settings.maxAdvanceDays)) return { date, timezone: tz, bookable: false, slots: [] as { minute: number; at: Date; available: boolean }[] };
  const bookable = vehicle.stockStatus === "available";
  const dayStart = localToUtc(date, 0, tz);
  const busy = await tx.vehicleTestDrive.findMany({ where: { tenantId, listingId, active: true, startAt: { lt: new Date(dayStart.getTime() + 30 * 3600_000) }, endAt: { gt: dayStart } }, select: { startAt: true, endAt: true } });
  const earliest = now.getTime() + 2 * 3600_000;
  const slots: { minute: number; at: Date; available: boolean }[] = [];
  for (const r of openingOn(settings.openingHours, date)) {
    for (let m = Math.ceil(r.startMinute / settings.slotStepMinutes) * settings.slotStepMinutes; m + settings.testDriveMinutes <= r.endMinute; m += settings.slotStepMinutes) {
      const at = localToUtc(date, m, tz);
      const end = new Date(at.getTime() + settings.testDriveMinutes * 60_000);
      const free = !busy.some((b) => b.startAt < end && b.endAt > at);
      slots.push({ minute: m, at, available: bookable && free && at.getTime() >= earliest });
    }
  }
  return { date, timezone: tz, bookable, slots };
}

export interface BookTestDriveInput {
  listingId: string;
  date: string;
  minute: number;
  customer?: CustomerInput | null;
  customerId?: string | null;
  licenseConfirmed: boolean;
  note?: string | null;
  channel?: "web" | "dashboard" | "phone" | "whatsapp";
  actor: Actor;
  now?: Date;
}

export async function bookTestDrive(tx: Tx, tenantId: string, input: BookTestDriveInput) {
  const fromPublic = input.actor.type === "customer";
  // Verrou sur le véhicule : deux demandes simultanées sont sérialisées.
  const locked = await tx.$queryRaw<{ stockStatus: string }[]>`SELECT "stockStatus" FROM "VehicleDetails" WHERE "listingId" = ${input.listingId} AND "tenantId" = ${tenantId} FOR UPDATE`;
  if (!locked[0]) throw new AutoError("Véhicule introuvable.");
  if (locked[0].stockStatus !== "available") throw new AutoError(locked[0].stockStatus === "incoming" ? "Ce véhicule n'est pas encore arrivé : laissez-nous vos coordonnées, nous vous prévenons." : "Ce véhicule n'est plus disponible à l'essai.");
  if (fromPublic && !input.licenseConfirmed) throw new AutoError("Confirmez que vous avez un permis de conduire valide.");
  if (!int(input.minute, 0, 1439)) throw new AutoError("Heure invalide.");
  const settings = await getAutoSettings(tx, tenantId);
  const tz = await tenantTimezone(tx, tenantId);
  if (fromPublic) {
    const { slots } = await testDriveSlots(tx, tenantId, input.listingId, input.date, input.now);
    const slot = slots.find((s) => s.minute === input.minute);
    if (!slot) throw new AutoError("Ce créneau n'est pas proposé.");
    if (!slot.available) throw new AutoError("Ce créneau vient d'être pris : choisissez-en un autre.");
  }
  const startAt = localToUtc(input.date, input.minute, tz);
  const endAt = new Date(startAt.getTime() + settings.testDriveMinutes * 60_000);
  const clash = await tx.vehicleTestDrive.count({ where: { tenantId, listingId: input.listingId, active: true, startAt: { lt: endAt }, endAt: { gt: startAt } } });
  if (clash) throw new AutoError("Ce véhicule est déjà réservé pour un essai à cette heure.");
  const reservation = await createReservation(tx, tenantId, {
    listingId: input.listingId,
    requestedStartAt: startAt,
    customerId: input.customerId ?? null,
    customer: input.customer ?? null,
    customerNote: input.note ?? null,
    channel: input.channel ?? (fromPublic ? "web" : "dashboard"),
    moduleKey: TEST_DRIVE_MODULE,
    pricing: "none",
    actor: input.actor,
  });
  await tx.reservation.update({ where: { id: reservation.id }, data: { endAt } });
  try {
    await tx.vehicleTestDrive.create({ data: { reservationId: reservation.id, tenantId, listingId: input.listingId, startAt, endAt, licenseConfirmed: !!input.licenseConfirmed } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError || (e instanceof Error && /no_overlap|23P01|exclusion/.test(e.message))) throw new AutoError("Ce créneau vient d'être pris : choisissez-en un autre.");
    throw e;
  }
  await transitionReservationStatus(tx, tenantId, { reservationId: reservation.id, toStatus: "confirmed", actor: fromPublic ? { userId: null, type: "system" } : input.actor });
  // Un essai est un signal commercial : il alimente (ou crée) le prospect.
  await upsertLeadFromActivity(tx, tenantId, { customerId: reservation.customerId, listingId: input.listingId, interest: "test_drive", source: input.channel ?? (fromPublic ? "web" : "walk_in"), body: `Essai réservé (${reservation.reference})`, actor: input.actor, advanceTo: "test_drive" });
  return (await getTestDrive(tx, tenantId, reservation.id))!;
}

async function lockModuleReservation(tx: Tx, tenantId: string, reservationId: string, moduleKey: string) {
  const r = await tx.$queryRaw<{ status: string }[]>`SELECT "status" FROM "Reservation" WHERE "id" = ${reservationId} AND "tenantId" = ${tenantId} AND "moduleKey" = ${moduleKey} FOR UPDATE`;
  if (!r[0]) throw new ReservationNotFoundError();
  return r[0].status;
}

/** Essai effectué, client absent, ou annulé (motif requis côté équipe). */
export async function setTestDriveOutcome(tx: Tx, tenantId: string, reservationId: string, outcome: "done" | "no_show" | "canceled", actor: Actor, note?: string | null) {
  const status = await lockModuleReservation(tx, tenantId, reservationId, TEST_DRIVE_MODULE);
  if (!["requested", "confirmed"].includes(status)) throw new AutoError("Cet essai n'est plus actif.");
  if (outcome === "canceled" && actor.type !== "customer" && !opt(note, 300)) throw new AutoError("Indiquez le motif de l'annulation.");
  if (status === "requested" && outcome !== "canceled") await transitionReservationStatus(tx, tenantId, { reservationId, toStatus: "confirmed", actor });
  await transitionReservationStatus(tx, tenantId, { reservationId, toStatus: outcome === "done" ? "completed" : outcome, actor, note: opt(note, 300) });
  return (await getTestDrive(tx, tenantId, reservationId))!;
}

export async function cancelTestDriveAsGuest(tx: Tx, tenantId: string, accessToken: string) {
  const r = await tx.reservation.findFirst({ where: { tenantId, accessToken, moduleKey: TEST_DRIVE_MODULE }, select: { id: true, status: true, startAt: true } });
  if (!r) throw new ReservationNotFoundError();
  if (!["requested", "confirmed"].includes(r.status)) throw new AutoError("Cet essai n'est plus actif.");
  if (r.startAt <= new Date()) throw new AutoError("L'heure est passée : appelez le showroom.");
  return setTestDriveOutcome(tx, tenantId, r.id, "canceled", { userId: null, type: "customer" }, "Annulé en ligne par le client");
}

const testDriveInclude = {
  listing: { select: { id: true, title: true, slug: true, media: true, price: true, vehicle: true } },
  customer: { select: { id: true, firstName: true, lastName: true, phone: true, email: true } },
  testDrive: true,
  history: { orderBy: { createdAt: "asc" as const } },
} satisfies Prisma.ReservationInclude;

export function getTestDrive(tx: Tx, tenantId: string, reservationId: string) {
  return tx.reservation.findFirst({ where: { id: reservationId, tenantId, moduleKey: TEST_DRIVE_MODULE }, include: testDriveInclude });
}

export function getTestDriveByToken(tx: Tx, tenantId: string, accessToken: string) {
  return tx.reservation.findFirst({ where: { accessToken, tenantId, moduleKey: TEST_DRIVE_MODULE }, include: testDriveInclude });
}

export async function listTestDrives(tx: Tx, tenantId: string, q: { date?: string; from?: Date; to?: Date; status?: string[] } = {}) {
  let range: { gte?: Date; lt?: Date } = {};
  if (q.date) {
    const tz = await tenantTimezone(tx, tenantId);
    range = { gte: localToUtc(q.date, 0, tz), lt: localToUtc(addDays(q.date, 1), 0, tz) };
  } else range = { ...(q.from ? { gte: q.from } : {}), ...(q.to ? { lt: q.to } : {}) };
  return tx.reservation.findMany({
    where: { tenantId, moduleKey: TEST_DRIVE_MODULE, ...(q.status ? { status: { in: q.status } } : {}), ...(range.gte || range.lt ? { startAt: range } : {}) },
    include: testDriveInclude,
    orderBy: { startAt: "asc" },
    take: 300,
  });
}

// ============================================================================
// PROSPECTS
// ============================================================================

const LEAD_FLOW: Record<LeadStatus, number> = { new: 0, contacted: 1, test_drive: 2, negotiation: 3, won: 4, lost: 4 };

/** Une demande ou un essai d'un client DÉJÀ suivi pour ce véhicule enrichit son dossier
 *  au lieu d'en créer un second. */
async function upsertLeadFromActivity(tx: Tx, tenantId: string, a: { customerId: string; listingId: string | null; interest: (typeof LEAD_INTERESTS)[number]; source: string; body: string; actor: Actor; advanceTo?: LeadStatus; message?: string | null; budget?: number | null }) {
  const source = includes(LEAD_SOURCES, a.source) ? a.source : a.source === "dashboard" ? "walk_in" : "web";
  const open = await tx.lead.findFirst({ where: { tenantId, customerId: a.customerId, listingId: a.listingId, status: { notIn: ["won", "lost"] } }, orderBy: { createdAt: "desc" } });
  if (open) {
    await tx.leadEvent.create({ data: { tenantId, leadId: open.id, kind: "request", body: a.body, createdBy: a.actor.userId, createdByType: a.actor.type } });
    if (a.advanceTo && LEAD_FLOW[a.advanceTo] > LEAD_FLOW[open.status as LeadStatus]) await moveLead(tx, tenantId, open.id, a.advanceTo, { userId: null, type: "system" });
    else await tx.lead.update({ where: { id: open.id }, data: { updatedAt: new Date() } });
    return open.id;
  }
  const lead = await tx.lead.create({
    data: { tenantId, customerId: a.customerId, listingId: a.listingId, interest: a.interest, source, status: a.advanceTo ?? "new", message: a.message ?? null, budget: a.budget ?? null },
  });
  await tx.leadEvent.create({ data: { tenantId, leadId: lead.id, kind: "created", toStatus: lead.status, body: a.body, createdBy: a.actor.userId, createdByType: a.actor.type } });
  return lead.id;
}

export interface LeadRequestInput {
  listingId?: string | null;
  interest: string;
  customer: CustomerInput;
  message?: string | null;
  budget?: number | null;
  tradeIn?: string | null;
  source?: string;
  actor: Actor;
}

/** Demande depuis le site (ou saisie par l'équipe) : client dédoublonné, prospect créé ou enrichi. */
export async function submitLeadRequest(tx: Tx, tenantId: string, input: LeadRequestInput) {
  if (!includes(LEAD_INTERESTS, input.interest)) throw new AutoError("Type de demande inconnu.");
  if (!text(input.customer?.firstName, 80) || !text(input.customer?.phone, 30)) throw new AutoError("Nom et téléphone requis.");
  if (input.budget != null && !int(input.budget, 1, 5_000_000_000)) throw new AutoError("Budget invalide.");
  let listingId: string | null = null;
  if (input.listingId) {
    const l = await tx.listing.findFirst({ where: { id: input.listingId, tenantId, type: "vehicle", deletedAt: null, ...(input.actor.type === "customer" ? { status: "published" } : {}) }, select: { id: true } });
    if (!l) throw new AutoError("Ce véhicule n'est plus proposé.");
    listingId = l.id;
  }
  const customer = await resolveOrCreateCustomer(tx, tenantId, { firstName: text(input.customer.firstName, 80), lastName: opt(input.customer.lastName, 80), phone: text(input.customer.phone, 30), email: opt(input.customer.email, 160) });
  const parts = [opt(input.message, 800), input.tradeIn ? `Reprise proposée : ${text(input.tradeIn, 200)}` : null].filter(Boolean);
  const leadId = await upsertLeadFromActivity(tx, tenantId, {
    customerId: customer.id,
    listingId,
    interest: input.interest as (typeof LEAD_INTERESTS)[number],
    source: input.source ?? (input.actor.type === "customer" ? "web" : "phone"),
    body: parts.join(" — ") || "Demande de contact",
    actor: input.actor,
    message: parts.join("\n") || null,
    budget: input.budget ?? null,
  });
  return (await getLead(tx, tenantId, leadId))!;
}

export async function moveLead(tx: Tx, tenantId: string, leadId: string, to: string, actor: Actor, note?: string | null) {
  if (!includes(LEAD_STATUSES, to)) throw new AutoError("Étape inconnue.");
  const locked = await tx.$queryRaw<{ status: string }[]>`SELECT "status" FROM "Lead" WHERE "id" = ${leadId} AND "tenantId" = ${tenantId} FOR UPDATE`;
  if (!locked[0]) throw new AutoError("Prospect introuvable.");
  const from = locked[0].status;
  if (from === to) return (await getLead(tx, tenantId, leadId))!;
  if (from === "won") throw new AutoError("Ce prospect a acheté : son dossier est clos.");
  const reason = opt(note, 300);
  if (to === "lost" && !reason) throw new AutoError("Indiquez pourquoi le prospect est perdu.");
  if (to === "won" && actor.type !== "system") throw new AutoError("Un prospect est « gagné » à la remise d'un véhicule vendu (dossier de vente).");
  await tx.lead.update({ where: { id: leadId }, data: { status: to, ...(to === "lost" ? { lostReason: reason } : { lostReason: null }) } });
  await tx.leadEvent.create({ data: { tenantId, leadId, kind: "status", fromStatus: from, toStatus: to, body: reason, createdBy: actor.userId, createdByType: actor.type } });
  return (await getLead(tx, tenantId, leadId))!;
}

export async function addLeadNote(tx: Tx, tenantId: string, leadId: string, body: string, actor: Actor, nextActionAt?: Date | null) {
  const note = text(body, 800);
  if (!note) throw new AutoError("La note est vide.");
  const lead = await tx.lead.findFirst({ where: { id: leadId, tenantId }, select: { id: true } });
  if (!lead) throw new AutoError("Prospect introuvable.");
  await tx.leadEvent.create({ data: { tenantId, leadId, kind: "note", body: note, createdBy: actor.userId, createdByType: actor.type } });
  await tx.lead.update({ where: { id: leadId }, data: { ...(nextActionAt !== undefined ? { nextActionAt } : {}), updatedAt: new Date() } });
  return (await getLead(tx, tenantId, leadId))!;
}

const leadInclude = {
  customer: { select: { id: true, firstName: true, lastName: true, phone: true, email: true } },
  listing: { select: { id: true, title: true, slug: true, price: true, media: true, vehicle: { select: { stockStatus: true, year: true, mileageKm: true } } } },
  events: { orderBy: { createdAt: "asc" as const } },
  sales: { select: { reservationId: true, active: true, agreedPrice: true } },
} satisfies Prisma.LeadInclude;

export function getLead(tx: Tx, tenantId: string, leadId: string) {
  return tx.lead.findFirst({ where: { id: leadId, tenantId }, include: leadInclude });
}

export function listLeads(tx: Tx, tenantId: string, q: { status?: string[]; search?: string; take?: number } = {}) {
  const search = q.search?.trim();
  return tx.lead.findMany({
    where: {
      tenantId,
      ...(q.status ? { status: { in: q.status } } : {}),
      ...(search ? { OR: [{ customer: { OR: [{ firstName: { contains: search, mode: "insensitive" } }, { lastName: { contains: search, mode: "insensitive" } }, { phone: { contains: search.replace(/\s/g, "") } }] } }, { listing: { title: { contains: search, mode: "insensitive" } } }] } : {}),
    },
    include: leadInclude,
    orderBy: [{ updatedAt: "desc" }],
    take: Math.min(q.take ?? 300, 500),
  });
}

// ============================================================================
// DOSSIERS DE VENTE (réservation commune + encaissements communs)
// ============================================================================

export interface OpenSaleInput {
  listingId: string;
  leadId?: string | null;
  customerId?: string | null;
  customer?: CustomerInput | null;
  agreedPrice?: number | null;
  tradeInValue?: number;
  tradeInDescription?: string | null;
  note?: string | null;
  actor: Actor;
}

/** Ouvre le dossier : le véhicule passe « réservé » ; montant = prix convenu − reprise. */
export async function openSale(tx: Tx, tenantId: string, input: OpenSaleInput) {
  const locked = await tx.$queryRaw<{ stockStatus: string }[]>`SELECT "stockStatus" FROM "VehicleDetails" WHERE "listingId" = ${input.listingId} AND "tenantId" = ${tenantId} FOR UPDATE`;
  if (!locked[0]) throw new AutoError("Véhicule introuvable.");
  if (locked[0].stockStatus === "sold") throw new AutoError("Ce véhicule est déjà vendu.");
  if (locked[0].stockStatus === "reserved") throw new AutoError("Ce véhicule a déjà un dossier de vente en cours.");
  const listing = await tx.listing.findFirstOrThrow({ where: { id: input.listingId, tenantId }, select: { price: true, title: true } });
  const agreedPrice = input.agreedPrice ?? listing.price;
  if (!agreedPrice || !int(agreedPrice, 1, 5_000_000_000)) throw new AutoError("Fixez le prix convenu.");
  const tradeInValue = input.tradeInValue ?? 0;
  if (!int(tradeInValue, 0, agreedPrice - 1)) throw new AutoError("La reprise doit être inférieure au prix convenu.");
  if (tradeInValue > 0 && !opt(input.tradeInDescription, 200)) throw new AutoError("Décrivez le véhicule repris.");
  let lead = input.leadId ? await tx.lead.findFirst({ where: { id: input.leadId, tenantId } }) : null;
  if (input.leadId && !lead) throw new AutoError("Prospect introuvable.");
  if (lead && ["won", "lost"].includes(lead.status)) throw new AutoError("Ce prospect est clos.");
  const reservation = await createReservation(tx, tenantId, {
    listingId: input.listingId,
    requestedStartAt: new Date(Date.now() + 60_000),
    customerId: lead?.customerId ?? input.customerId ?? null,
    customer: lead ? null : input.customer ?? null,
    customerNote: input.note ?? null,
    channel: "dashboard",
    moduleKey: VEHICLE_SALES_MODULE,
    pricing: "none",
    actor: input.actor,
  });
  await tx.reservation.update({ where: { id: reservation.id }, data: { totalAmount: agreedPrice - tradeInValue, unitPrice: agreedPrice } });
  if (!lead) {
    const leadId = await upsertLeadFromActivity(tx, tenantId, { customerId: reservation.customerId, listingId: input.listingId, interest: tradeInValue ? "trade_in" : "purchase", source: "walk_in", body: `Dossier de vente ouvert (${reservation.reference})`, actor: input.actor, advanceTo: "negotiation" });
    lead = await tx.lead.findFirstOrThrow({ where: { id: leadId } });
  } else if (LEAD_FLOW.negotiation > LEAD_FLOW[lead.status as LeadStatus]) {
    await moveLead(tx, tenantId, lead.id, "negotiation", input.actor);
  }
  await tx.vehicleSale.create({ data: { reservationId: reservation.id, tenantId, listingId: input.listingId, leadId: lead.id, agreedPrice, tradeInValue, tradeInDescription: opt(input.tradeInDescription, 200) } });
  await tx.vehicleDetails.update({ where: { listingId: input.listingId }, data: { stockStatus: "reserved" } });
  await transitionReservationStatus(tx, tenantId, { reservationId: reservation.id, toStatus: "confirmed", actor: input.actor });
  return (await getSale(tx, tenantId, reservation.id))!;
}

async function assertSale(tx: Tx, tenantId: string, reservationId: string) {
  const r = await tx.reservation.findFirst({ where: { id: reservationId, tenantId, moduleKey: VEHICLE_SALES_MODULE }, select: { id: true } });
  if (!r) throw new ReservationNotFoundError();
}

/** Encaissement (acompte, solde…) : service commun des réservations (reçu, jamais de trop-perçu). */
export async function recordSalePayment(tx: Tx, tenantId: string, input: { reservationId: string; amount: number; method: RecordPaymentInput["method"]; kind: RecordPaymentInput["kind"]; reference?: string | null; actorUserId: string | null }) {
  await assertSale(tx, tenantId, input.reservationId);
  return recordReservationPayment(tx, tenantId, input);
}

export async function voidSalePayment(tx: Tx, tenantId: string, paymentId: string, reason: string) {
  const p = await tx.reservationPayment.findFirst({ where: { id: paymentId, tenantId, reservation: { moduleKey: VEHICLE_SALES_MODULE } }, select: { id: true } });
  if (!p) throw new AutoError("Encaissement introuvable.");
  return voidReservationPayment(tx, tenantId, paymentId, reason);
}

/** Remise des clés : seulement si tout est réglé. Véhicule vendu, prospect gagné. */
export async function deliverSale(tx: Tx, tenantId: string, reservationId: string, actor: Actor) {
  const status = await lockModuleReservation(tx, tenantId, reservationId, VEHICLE_SALES_MODULE);
  if (status !== "confirmed") throw new AutoError("Ce dossier n'est plus en cours.");
  const r = await tx.reservation.findFirstOrThrow({ where: { id: reservationId }, include: { payments: true, vehicleSale: true } });
  const paid = r.payments.filter((p) => !p.voidedAt).reduce((s, p) => s + p.amount, 0);
  if (paid < (r.totalAmount ?? 0)) throw new AutoError(`Reste à encaisser : ${(r.totalAmount ?? 0) - paid} FCFA. Le véhicule est remis une fois tout réglé.`);
  await transitionReservationStatus(tx, tenantId, { reservationId, toStatus: "completed", actor, note: "Véhicule remis au client" });
  await tx.vehicleSale.update({ where: { reservationId }, data: { deliveredAt: new Date() } });
  await tx.vehicleDetails.update({ where: { listingId: r.vehicleSale!.listingId }, data: { stockStatus: "sold" } });
  if (r.vehicleSale!.leadId) await moveLead(tx, tenantId, r.vehicleSale!.leadId, "won", { userId: actor.userId, type: "system" });
  return (await getSale(tx, tenantId, reservationId))!;
}

/** Annulation motivée : uniquement sans encaissement en cours (remboursement d'abord). */
export async function cancelSale(tx: Tx, tenantId: string, reservationId: string, actor: Actor, reason: string) {
  const why = text(reason, 300);
  if (!why) throw new AutoError("Indiquez le motif de l'annulation.");
  const status = await lockModuleReservation(tx, tenantId, reservationId, VEHICLE_SALES_MODULE);
  if (status !== "confirmed" && status !== "requested") throw new AutoError("Ce dossier n'est plus en cours.");
  const r = await tx.reservation.findFirstOrThrow({ where: { id: reservationId }, include: { payments: true, vehicleSale: true } });
  if (r.payments.some((p) => !p.voidedAt)) throw new AutoError("Des encaissements sont enregistrés : annulez-les d'abord (remboursement), avec leur motif.");
  await transitionReservationStatus(tx, tenantId, { reservationId, toStatus: "canceled", actor, note: why });
  await tx.vehicleDetails.update({ where: { listingId: r.vehicleSale!.listingId }, data: { stockStatus: "available" } });
  return (await getSale(tx, tenantId, reservationId))!;
}

const saleInclude = {
  listing: { select: { id: true, title: true, slug: true, media: true, price: true, vehicle: true } },
  customer: { select: { id: true, firstName: true, lastName: true, phone: true, email: true } },
  vehicleSale: true,
  payments: { orderBy: { paidAt: "asc" as const } },
  history: { orderBy: { createdAt: "asc" as const } },
} satisfies Prisma.ReservationInclude;

export function getSale(tx: Tx, tenantId: string, reservationId: string) {
  return tx.reservation.findFirst({ where: { id: reservationId, tenantId, moduleKey: VEHICLE_SALES_MODULE }, include: saleInclude });
}

export function listSales(tx: Tx, tenantId: string, q: { status?: string[] } = {}) {
  return tx.reservation.findMany({ where: { tenantId, moduleKey: VEHICLE_SALES_MODULE, ...(q.status ? { status: { in: q.status } } : {}) }, include: saleInclude, orderBy: { createdAt: "desc" }, take: 300 });
}

// ============================================================================
// IMPORTATIONS
// ============================================================================

export async function createImport(tx: Tx, tenantId: string, input: { listingId: string; origin: string; eta?: string | null; vessel?: string | null; containerRef?: string | null; customerId?: string | null; customer?: CustomerInput | null; note?: string | null; actorUserId: string | null }) {
  const v = await tx.vehicleDetails.findFirst({ where: { listingId: input.listingId, tenantId } });
  if (!v) throw new AutoError("Véhicule introuvable.");
  if (v.stockStatus === "sold") throw new AutoError("Ce véhicule est vendu.");
  if (await tx.vehicleImport.count({ where: { tenantId, listingId: input.listingId, stage: { notIn: ["ready", "canceled"] } } })) throw new AutoError("Une importation est déjà en cours pour ce véhicule.");
  const origin = text(input.origin, 60);
  if (!origin) throw new AutoError("Indiquez le pays de provenance.");
  if (input.eta && !isIsoDate(input.eta)) throw new AutoError("Date d'arrivée invalide.");
  let customerId = input.customerId ?? null;
  if (!customerId && input.customer?.firstName && input.customer.phone) customerId = (await resolveOrCreateCustomer(tx, tenantId, input.customer)).id;
  const year = new Date().getFullYear();
  const reference = `IMP-${year}-${String(await nextCounterValue(tx, tenantId, `import-${year}`)).padStart(4, "0")}`;
  const imp = await tx.vehicleImport.create({
    data: { tenantId, reference, listingId: input.listingId, customerId, origin, eta: input.eta ? new Date(`${input.eta}T00:00:00Z`) : null, vessel: opt(input.vessel, 60), containerRef: opt(input.containerRef, 40), note: opt(input.note, 400) },
  });
  await tx.vehicleImportEvent.create({ data: { tenantId, importId: imp.id, toStage: "purchased", note: `Achat à l'étranger (${origin})`, createdBy: input.actorUserId } });
  if (v.stockStatus === "available") await tx.vehicleDetails.update({ where: { listingId: input.listingId }, data: { stockStatus: "incoming" } });
  return (await getImport(tx, tenantId, imp.id))!;
}

/** Étape suivante (ou annulation) ; « prêt » rend le véhicule disponible (sauf s'il est déjà réservé). */
export async function advanceImport(tx: Tx, tenantId: string, importId: string, to: string, actorUserId: string | null, patch: { eta?: string | null; vessel?: string | null; containerRef?: string | null; note?: string | null } = {}) {
  const locked = await tx.$queryRaw<{ stage: string; listingId: string }[]>`SELECT "stage", "listingId" FROM "VehicleImport" WHERE "id" = ${importId} AND "tenantId" = ${tenantId} FOR UPDATE`;
  if (!locked[0]) throw new AutoError("Importation introuvable.");
  const from = locked[0].stage;
  if (from === "ready" || from === "canceled") throw new AutoError("Cette importation est terminée.");
  if (to !== "canceled") {
    if (!includes(IMPORT_STAGES, to)) throw new AutoError("Étape inconnue.");
    if (IMPORT_STAGES.indexOf(to) <= IMPORT_STAGES.indexOf(from as ImportStage)) throw new AutoError("Une importation avance d'étape en étape.");
  } else if (!opt(patch.note, 300)) throw new AutoError("Indiquez le motif de l'annulation.");
  if (patch.eta && !isIsoDate(patch.eta)) throw new AutoError("Date d'arrivée invalide.");
  await tx.vehicleImport.update({
    where: { id: importId },
    data: {
      stage: to,
      ...(patch.eta !== undefined ? { eta: patch.eta ? new Date(`${patch.eta}T00:00:00Z`) : null } : {}),
      ...(patch.vessel !== undefined ? { vessel: opt(patch.vessel, 60) } : {}),
      ...(patch.containerRef !== undefined ? { containerRef: opt(patch.containerRef, 40) } : {}),
    },
  });
  await tx.vehicleImportEvent.create({ data: { tenantId, importId, fromStage: from, toStage: to, note: opt(patch.note, 300), createdBy: actorUserId } });
  const v = await tx.vehicleDetails.findFirstOrThrow({ where: { listingId: locked[0].listingId } });
  if ((to === "ready" || to === "canceled") && v.stockStatus === "incoming") await tx.vehicleDetails.update({ where: { listingId: v.listingId }, data: { stockStatus: "available" } });
  return (await getImport(tx, tenantId, importId))!;
}

const importInclude = {
  listing: { select: { id: true, title: true, slug: true, media: true, price: true, status: true, vehicle: true } },
  customer: { select: { id: true, firstName: true, lastName: true, phone: true } },
  events: { orderBy: { createdAt: "asc" as const } },
} satisfies Prisma.VehicleImportInclude;

export function getImport(tx: Tx, tenantId: string, importId: string) {
  return tx.vehicleImport.findFirst({ where: { id: importId, tenantId }, include: importInclude });
}

export function getImportByToken(tx: Tx, tenantId: string, accessToken: string) {
  return tx.vehicleImport.findFirst({ where: { accessToken, tenantId }, include: importInclude });
}

export function listImports(tx: Tx, tenantId: string, q: { open?: boolean } = {}) {
  return tx.vehicleImport.findMany({ where: { tenantId, ...(q.open ? { stage: { notIn: ["ready", "canceled"] } } : {}) }, include: importInclude, orderBy: [{ eta: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }], take: 300 });
}

// ============================================================================
// VUE D'ENSEMBLE
// ============================================================================

export async function autoOverview(tx: Tx, tenantId: string, now = new Date()) {
  const tz = await tenantTimezone(tx, tenantId);
  const today = utcToLocal(now, tz).date;
  const dayFrom = localToUtc(today, 0, tz);
  const dayTo = localToUtc(addDays(today, 1), 0, tz);
  const monthFrom = localToUtc(`${today.slice(0, 7)}-01`, 0, tz);
  const [stock, drivesToday, newLeads, openLeads, salesOpen, payments, incoming] = await Promise.all([
    tx.vehicleDetails.groupBy({ by: ["stockStatus"], where: { tenantId, listing: { deletedAt: null } }, _count: true }),
    tx.reservation.count({ where: { tenantId, moduleKey: TEST_DRIVE_MODULE, status: { in: ["requested", "confirmed"] }, startAt: { gte: dayFrom, lt: dayTo } } }),
    tx.lead.count({ where: { tenantId, status: "new" } }),
    tx.lead.count({ where: { tenantId, status: { notIn: ["won", "lost"] } } }),
    tx.reservation.count({ where: { tenantId, moduleKey: VEHICLE_SALES_MODULE, status: "confirmed" } }),
    tx.reservationPayment.findMany({ where: { tenantId, voidedAt: null, paidAt: { gte: monthFrom }, reservation: { moduleKey: VEHICLE_SALES_MODULE } }, select: { amount: true } }),
    tx.vehicleImport.count({ where: { tenantId, stage: { notIn: ["ready", "canceled"] } } }),
  ]);
  const by = Object.fromEntries(stock.map((s) => [s.stockStatus, s._count])) as Record<string, number>;
  return {
    timezone: tz,
    today,
    available: by.available ?? 0,
    reserved: by.reserved ?? 0,
    incoming: by.incoming ?? 0,
    sold: by.sold ?? 0,
    importsInProgress: incoming,
    drivesToday,
    newLeads,
    openLeads,
    salesOpen,
    collectedThisMonth: payments.reduce((s, p) => s + p.amount, 0),
  };
}
