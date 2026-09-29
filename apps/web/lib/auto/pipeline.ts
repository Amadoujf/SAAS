import "server-only";
import { z } from "zod";
import {
  withTenant,
  addLeadNote,
  advanceImport,
  bookTestDrive,
  cancelSale,
  createImport,
  createVehicle,
  deleteListing,
  deliverSale,
  moveLead,
  openSale,
  recordSalePayment,
  setListingStatus,
  setMediaAssetPublic,
  setTestDriveOutcome,
  setVehicleArrival,
  submitLeadRequest,
  updateAutoSettings,
  updateVehicle,
  voidSalePayment,
  AutoError,
  BODY_TYPES,
  CONDITIONS,
  FUELS,
  IMPORT_STAGES,
  InvalidListingInputError,
  InvalidListingTransitionError,
  InvalidReservationTransitionError,
  LEAD_INTERESTS,
  LEAD_SOURCES,
  LEAD_STATUSES,
  ReservationNotFoundError,
  ReservationUnavailableError,
  TRANSMISSIONS,
  TravelError,
  TRAVEL_PAYMENT_METHODS,
  VEHICLE_FEATURES,
} from "@yamacommerce/database";
import type { Permission } from "@yamacommerce/auth";
import { getCurrentTenantMembership } from "@/lib/current-tenant";
import { requireTenantPermission } from "@/lib/tenant-permissions";
import { checkImage } from "@/lib/media/image-refs";
import { getTenantModuleKeys, isAutomobile } from "@/lib/modules/tenant-modules";
import type { PlannedNotification } from "@/lib/orders/notify";
import { dispatchAutoNotifications, planAutoNotifications } from "./notify";

/**
 * Actions de la concession (tableau de bord). Chaque action revérifie côté serveur la
 * permission précise du membre ; la RLS isole la concession ; les règles (un seul
 * dossier par véhicule, essais sans chevauchement, remise après règlement complet,
 * encaissements sans trop-perçu) vivent dans le registre et en base.
 */

export type ActionResult<T = unknown> = { ok: true; data: T } | { ok: false; status: number; error: string };

async function context(permission: Permission) {
  const membership = await getCurrentTenantMembership();
  if (!membership) return null;
  if (!isAutomobile(await getTenantModuleKeys(membership.tenantId))) return null;
  const actor = await requireTenantPermission(membership.tenantId, permission);
  if (!actor) return null;
  return { tenantId: membership.tenantId, userId: actor.userId, actorType: (membership.roleName === "OWNER" ? "owner" : "employee") as "owner" | "employee" };
}

const DENIED = { ok: false as const, status: 403, error: "Action non autorisée." };

function toError(error: unknown): { ok: false; status: number; error: string } {
  if (
    error instanceof AutoError ||
    error instanceof TravelError ||
    error instanceof InvalidListingInputError ||
    error instanceof InvalidListingTransitionError ||
    error instanceof InvalidReservationTransitionError ||
    error instanceof ReservationNotFoundError ||
    error instanceof ReservationUnavailableError
  )
    return { ok: false, status: 409, error: error.message };
  if (error instanceof Error && error.message.startsWith("Image")) return { ok: false, status: 400, error: error.message };
  // eslint-disable-next-line no-console
  console.error("[auto]", error);
  return { ok: false, status: 400, error: "Action impossible pour le moment." };
}

const firstIssue = (error: z.ZodError) => {
  const issue = error.issues[0];
  return issue ? `${issue.path.join(" › ") || "Formulaire"} : ${issue.message}` : "Données invalides.";
};
const bad = (error: z.ZodError) => Promise.resolve({ ok: false as const, status: 400, error: firstIssue(error) });

type Tx = Parameters<Parameters<typeof withTenant>[1]>[0];
type Ctx = NonNullable<Awaited<ReturnType<typeof context>>>;
const run = async <T>(permission: Permission, fn: (ctx: Ctx, tx: Tx) => Promise<T>): Promise<ActionResult<T>> => {
  const ctx = await context(permission);
  if (!ctx) return DENIED;
  try {
    return { ok: true, data: await withTenant(ctx.tenantId, (tx) => fn(ctx, tx)) };
  } catch (error) {
    return toError(error);
  }
};
const actorOf = (ctx: Ctx) => ({ userId: ctx.userId, type: ctx.actorType });

/** Action suivie de notifications : planifiées dans la transaction, mises en file après le commit. */
const runNotified = async <T>(permission: Permission, fn: (ctx: Ctx, tx: Tx) => Promise<{ data: T; planned: PlannedNotification[] }>): Promise<ActionResult<T>> => {
  const r = await run(permission, fn);
  if (!r.ok) return r;
  const ctx = await context(permission);
  if (ctx) await dispatchAutoNotifications(ctx.tenantId, r.data.planned);
  return { ok: true, data: r.data.data };
};

async function ownImages(tx: Tx, tenantId: string, urls: string[]) {
  const ids = new Set<string>();
  for (const url of urls) {
    const problem = checkImage(url, ids);
    if (problem) throw new Error(problem.startsWith("Image") ? problem : `Image : ${problem}`);
  }
  if (ids.size && (await tx.mediaAsset.count({ where: { tenantId, id: { in: [...ids] }, status: "READY" } })) !== ids.size) throw new Error("Image introuvable dans votre médiathèque.");
  for (const id of ids) await setMediaAssetPublic(tx, tenantId, id, true);
}

const text = (max: number) => z.string().trim().max(max);
const optionalText = (max: number) => z.string().trim().max(max).nullable().optional().transform((v) => (v ? v : null));
const customerSchema = z.object({ firstName: text(80).min(1, "Prénom requis."), lastName: optionalText(80), phone: text(30).min(6, "Téléphone requis."), email: z.string().trim().email("E-mail invalide.").max(160).nullable().optional().or(z.literal("")).transform((v) => v || null) });

// --- Stock --------------------------------------------------------------------------------

export const vehicleSchema = z.object({
  make: text(40).min(1, "Marque requise."),
  model: text(60).min(1, "Modèle requis."),
  version: optionalText(40),
  year: z.number().int().min(1950).max(new Date().getFullYear() + 1),
  mileageKm: z.number().int().min(0).max(2_000_000),
  fuel: z.enum(FUELS),
  transmission: z.enum(TRANSMISSIONS),
  bodyType: z.enum(BODY_TYPES),
  condition: z.enum(CONDITIONS),
  color: optionalText(30),
  engine: optionalText(40),
  seats: z.number().int().min(1).max(60).nullable().optional(),
  features: z.array(z.enum(VEHICLE_FEATURES)).max(VEHICLE_FEATURES.length).default([]),
  negotiable: z.boolean().default(false),
  vin: optionalText(30),
  plate: optionalText(20),
  price: z.number().int().min(1).max(5_000_000_000).nullable(),
  summary: optionalText(300),
  description: optionalText(4000),
  featured: z.boolean().default(false),
  media: z.array(z.object({ url: z.string().max(300), alt: z.string().trim().max(160).optional(), demo: z.boolean().optional() })).max(20).default([]),
  publish: z.boolean().optional(),
});

export const saveVehicle = (listingId: string | null, raw: unknown) => {
  const p = vehicleSchema.safeParse(raw);
  if (!p.success) return bad(p.error);
  const { publish, media, ...input } = p.data;
  return run(listingId ? "listings.edit" : "listings.create", async (ctx, tx) => {
    await ownImages(tx, ctx.tenantId, media.map((m) => m.url));
    // Une illustration de démonstration garde sa mention ; une image de l'entreprise, jamais.
    const cleanMedia = media.map((m) => ({ url: m.url, alt: m.alt ?? "", ...(m.demo && m.url.startsWith("/demo-templates/") ? { demo: true } : {}) }));
    const v = listingId ? await updateVehicle(tx, ctx.tenantId, listingId, { ...input, media: cleanMedia }, ctx.userId) : await createVehicle(tx, ctx.tenantId, { ...input, media: cleanMedia }, ctx.userId);
    if (publish !== undefined) {
      const to = publish ? "published" : "draft";
      if (v.status !== to) await setListingStatus(tx, ctx.tenantId, v.id, to, ctx.userId);
    }
    return { id: v.id };
  });
};

export const setVehiclePublished = (listingId: string, publish: boolean) =>
  run("listings.publish", (ctx, tx) => setListingStatus(tx, ctx.tenantId, listingId, publish ? "published" : "draft", ctx.userId).then(() => null));

export const setArrival = (listingId: string, stockStatus: "incoming" | "available") => run("listings.edit", (ctx, tx) => setVehicleArrival(tx, ctx.tenantId, listingId, stockStatus).then(() => null));

export const removeVehicle = (listingId: string) =>
  run("listings.delete", async (ctx, tx) => {
    const v = await tx.vehicleDetails.findFirst({ where: { listingId, tenantId: ctx.tenantId } });
    if (v?.stockStatus === "reserved") throw new AutoError("Ce véhicule a un dossier de vente en cours : annulez le dossier d'abord.");
    await deleteListing(tx, ctx.tenantId, listingId, ctx.userId);
    return null;
  });

// --- Réglages du showroom -------------------------------------------------------------

const settingsSchema = z.object({
  openingHours: z.array(z.object({ weekday: z.number().int().min(0).max(6), startMinute: z.number().int().min(0).max(1439), endMinute: z.number().int().min(1).max(1440) })).max(28),
  testDriveMinutes: z.number().int().min(15).max(240),
  slotStepMinutes: z.union([z.literal(15), z.literal(30), z.literal(60)]),
  maxAdvanceDays: z.number().int().min(1).max(180),
  depositPercent: z.number().int().min(0).max(100),
});

export const saveShowroomSettings = (raw: unknown) => {
  const p = settingsSchema.safeParse(raw);
  if (!p.success) return bad(p.error);
  return run("listings.manage_availability", (ctx, tx) => updateAutoSettings(tx, ctx.tenantId, p.data).then(() => null));
};

// --- Essais ---------------------------------------------------------------------------

const deskDriveSchema = z.object({
  listingId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  minute: z.number().int().min(0).max(1439),
  customer: customerSchema,
  licenseConfirmed: z.boolean(),
  note: optionalText(400),
  channel: z.enum(["phone", "whatsapp", "dashboard"]).default("phone"),
});

export const deskTestDrive = (raw: unknown) => {
  const p = deskDriveSchema.safeParse(raw);
  if (!p.success) return bad(p.error);
  return runNotified("reservations.update_status", async (ctx, tx) => {
    const td = await bookTestDrive(tx, ctx.tenantId, { ...p.data, actor: actorOf(ctx) });
    return { data: { id: td.id }, planned: await planAutoNotifications(tx, ctx.tenantId, { reservationId: td.id }, "test_drive_confirmed") };
  });
};

export const testDriveOutcome = (reservationId: string, outcome: "done" | "no_show" | "canceled", note?: string) =>
  runNotified(outcome === "canceled" ? "reservations.cancel" : "reservations.update_status", async (ctx, tx) => {
    await setTestDriveOutcome(tx, ctx.tenantId, reservationId, outcome, actorOf(ctx), note ?? null);
    return { data: null, planned: outcome === "canceled" ? await planAutoNotifications(tx, ctx.tenantId, { reservationId }, "test_drive_canceled") : [] };
  });

// --- Prospects ------------------------------------------------------------------------

const deskLeadSchema = z.object({
  listingId: z.string().uuid().nullable(),
  interest: z.enum(LEAD_INTERESTS),
  source: z.enum(LEAD_SOURCES),
  customer: customerSchema,
  budget: z.number().int().min(1).max(5_000_000_000).nullable().optional(),
  tradeIn: optionalText(200),
  message: optionalText(800),
});

export const deskLead = (raw: unknown) => {
  const p = deskLeadSchema.safeParse(raw);
  if (!p.success) return bad(p.error);
  return run("customers.edit", async (ctx, tx) => {
    const l = await submitLeadRequest(tx, ctx.tenantId, { ...p.data, actor: actorOf(ctx) });
    return { id: l.id };
  });
};

export const leadStatus = (leadId: string, to: string, note?: string) => {
  if (!(LEAD_STATUSES as readonly string[]).includes(to)) return Promise.resolve({ ok: false as const, status: 400, error: "Étape inconnue." });
  return run("customers.edit", (ctx, tx) => moveLead(tx, ctx.tenantId, leadId, to, actorOf(ctx), note ?? null).then(() => null));
};

export const leadNote = (leadId: string, body: string, nextActionAt?: string | null) => {
  const next = nextActionAt ? new Date(`${nextActionAt}T09:00:00Z`) : nextActionAt === null ? null : undefined;
  if (next && Number.isNaN(next.getTime())) return Promise.resolve({ ok: false as const, status: 400, error: "Date de relance invalide." });
  return run("customers.edit", (ctx, tx) => addLeadNote(tx, ctx.tenantId, leadId, body, actorOf(ctx), next).then(() => null));
};

// --- Dossiers de vente ------------------------------------------------------------------

const saleSchema = z.object({
  listingId: z.string().uuid(),
  leadId: z.string().uuid().nullable().optional(),
  customer: customerSchema.nullable().optional(),
  agreedPrice: z.number().int().min(1).max(5_000_000_000).nullable().optional(),
  tradeInValue: z.number().int().min(0).max(5_000_000_000).default(0),
  tradeInDescription: optionalText(200),
  note: optionalText(400),
});

export const newSale = (raw: unknown) => {
  const p = saleSchema.safeParse(raw);
  if (!p.success) return bad(p.error);
  if (!p.data.leadId && !p.data.customer) return Promise.resolve({ ok: false as const, status: 400, error: "Choisissez un prospect ou saisissez le client." });
  return run("reservations.update_status", async (ctx, tx) => ({ id: (await openSale(tx, ctx.tenantId, { ...p.data, customer: p.data.customer ?? null, actor: actorOf(ctx) })).id }));
};

const paymentSchema = z.object({
  reservationId: z.string().uuid(),
  amount: z.number().int().min(1),
  method: z.enum(TRAVEL_PAYMENT_METHODS),
  kind: z.enum(["deposit", "balance", "other"]),
  reference: optionalText(80),
});

export const salePayment = (raw: unknown) => {
  const p = paymentSchema.safeParse(raw);
  if (!p.success) return bad(p.error);
  return run("reservations.update_status", async (ctx, tx) => {
    const pay = await recordSalePayment(tx, ctx.tenantId, { ...p.data, actorUserId: ctx.userId });
    return { receiptNumber: pay.receiptNumber };
  });
};

export const voidPayment = (paymentId: string, reason: string) => run("payments.refund", (ctx, tx) => voidSalePayment(tx, ctx.tenantId, paymentId, reason).then(() => null));
export const deliver = (reservationId: string) => run("reservations.update_status", (ctx, tx) => deliverSale(tx, ctx.tenantId, reservationId, actorOf(ctx)).then(() => null));
export const cancelSaleFile = (reservationId: string, reason: string) => run("reservations.cancel", (ctx, tx) => cancelSale(tx, ctx.tenantId, reservationId, actorOf(ctx), reason).then(() => null));

// --- Importations -----------------------------------------------------------------------

const importSchema = z.object({
  listingId: z.string().uuid(),
  origin: text(60).min(1, "Provenance requise."),
  eta: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  vessel: optionalText(60),
  containerRef: optionalText(40),
  customer: customerSchema.nullable().optional(),
  note: optionalText(400),
});

export const newImport = (raw: unknown) => {
  const p = importSchema.safeParse(raw);
  if (!p.success) return bad(p.error);
  return run("listings.edit", async (ctx, tx) => ({ id: (await createImport(tx, ctx.tenantId, { ...p.data, customer: p.data.customer ?? null, actorUserId: ctx.userId })).id }));
};

export const importStage = (importId: string, to: string, patch: { eta?: string | null; note?: string | null }) => {
  if (to !== "canceled" && !(IMPORT_STAGES as readonly string[]).includes(to)) return Promise.resolve({ ok: false as const, status: 400, error: "Étape inconnue." });
  return runNotified("listings.edit", async (ctx, tx) => {
    await advanceImport(tx, ctx.tenantId, importId, to, ctx.userId, patch);
    // Le client rattaché est prévenu à chaque étape réelle (jamais « envoyé » sans fournisseur).
    return { data: null, planned: await planAutoNotifications(tx, ctx.tenantId, { importId }, "vehicle_import_update") };
  });
};
