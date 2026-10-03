import "server-only";
import { z } from "zod";
import {
  withTenant,
  getStorefrontCustomization,
  saveStorefrontContent,
  updateTenantBranding,
  advanceCourierJob,
  createDeliveryZone,
  updateDeliveryZone,
  assignCourierJob,
  cancelCourierJob,
  completeCourierReturn,
  createCourier,
  createCourierJob,
  deliverCourierJob,
  failCourierJob,
  recordRemittance,
  rotateCourierToken,
  settleSender,
  startCourierReturn,
  updateCourier,
  updateCourierSettings,
  setMediaAssetPublic,
  CourierError,
  SETTLEMENT_METHODS,
} from "@yamacommerce/database";
import type { Permission } from "@yamacommerce/auth";
import type { Prisma } from "@yamacommerce/database";
import { parseHomeContent } from "@/lib/storefront/home-content";
import { getCurrentTenantMembership } from "@/lib/current-tenant";
import { requireTenantPermission } from "@/lib/tenant-permissions";
import { checkImage } from "@/lib/media/image-refs";
import { getTenantModuleKeys, isCourier } from "@/lib/modules/tenant-modules";
import type { PlannedNotification } from "@/lib/orders/notify";
import { dispatchCourierNotifications, planCourierNotifications } from "./notify";

/**
 * Actions du bureau (tableau de bord). Chaque action revérifie la permission précise du
 * membre ; la RLS isole la société ; tarifs, preuves, statuts et sommes sont contrôlés
 * par le registre et la base (jamais par le navigateur).
 */

export type ActionResult<T = unknown> = { ok: true; data: T } | { ok: false; status: number; error: string };

async function context(permission: Permission) {
  const membership = await getCurrentTenantMembership();
  if (!membership) return null;
  if (!isCourier(await getTenantModuleKeys(membership.tenantId))) return null;
  const actor = await requireTenantPermission(membership.tenantId, permission);
  if (!actor) return null;
  return { tenantId: membership.tenantId, userId: actor.userId };
}

const DENIED = { ok: false as const, status: 403, error: "Action non autorisée." };

function toError(error: unknown): { ok: false; status: number; error: string } {
  if (error instanceof CourierError) return { ok: false, status: 409, error: error.message };
  if (error instanceof Error && error.message.startsWith("Image")) return { ok: false, status: 400, error: error.message };
  // eslint-disable-next-line no-console
  console.error("[courier]", error);
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
const staff = (ctx: Ctx) => ({ type: "staff" as const, userId: ctx.userId });
const runNotified = async <T>(permission: Permission, fn: (ctx: Ctx, tx: Tx) => Promise<{ data: T; planned: PlannedNotification[] }>): Promise<ActionResult<T>> => {
  const r = await run(permission, fn);
  if (!r.ok) return r;
  const ctx = await context(permission);
  if (ctx) await dispatchCourierNotifications(ctx.tenantId, r.data.planned);
  return { ok: true, data: r.data.data };
};

const text = (max: number) => z.string().trim().max(max);
const optionalText = (max: number) => z.string().trim().max(max).nullable().optional().transform((v) => (v ? v : null));

// --- Courses ----------------------------------------------------------------------------

const jobSchema = z.object({
  senderId: z.string().uuid().nullable().optional(),
  sender: z.object({ firstName: text(80).min(1, "Nom de l'expéditeur requis."), phone: text(30).min(6, "Téléphone requis.") }).nullable().optional(),
  pickupName: text(80).min(1, "Nom au retrait requis."),
  pickupPhone: text(30).min(6, "Téléphone au retrait requis."),
  pickupAddress: text(200).min(3, "Adresse de retrait requise."),
  pickupCommune: optionalText(60),
  recipientName: text(80).min(1, "Nom du destinataire requis."),
  recipientPhone: text(30).min(6, "Téléphone du destinataire requis."),
  dropoffAddress: text(200).min(3, "Adresse de livraison requise."),
  instructions: optionalText(300),
  zoneId: z.string().uuid("Choisissez la zone."),
  packageDescription: text(160).min(2, "Décrivez le colis."),
  size: z.enum(["small", "medium", "large"]),
  feePaidBy: z.enum(["sender", "recipient"]),
  codAmount: z.number().int().min(0).default(0),
  channel: z.enum(["dashboard", "phone", "whatsapp"]).default("phone"),
  delivererId: z.string().uuid().nullable().optional(),
});

export const newJob = (raw: unknown) => {
  const p = jobSchema.safeParse(raw);
  if (!p.success) return bad(p.error);
  if (!p.data.senderId && !p.data.sender) return Promise.resolve({ ok: false as const, status: 400, error: "Choisissez ou saisissez l'expéditeur." });
  const { delivererId, ...input } = p.data;
  return runNotified("delivery.assign", async (ctx, tx) => {
    const job = await createCourierJob(tx, ctx.tenantId, { ...input, sender: input.sender ?? null, actor: staff(ctx) });
    if (delivererId) await assignCourierJob(tx, ctx.tenantId, job.id, delivererId, staff(ctx));
    return { data: { id: job.id }, planned: await planCourierNotifications(tx, ctx.tenantId, job.id, "courier_job_created") };
  });
};

export const assign = (jobId: string, delivererId: string) => run("delivery.assign", (ctx, tx) => assignCourierJob(tx, ctx.tenantId, jobId, delivererId, staff(ctx)).then(() => null));
export const cancel = (jobId: string, reason: string) => run("delivery.assign", (ctx, tx) => cancelCourierJob(tx, ctx.tenantId, jobId, reason, staff(ctx)).then(() => null));
export const startReturn = (jobId: string, delivererId: string | null) => run("delivery.assign", (ctx, tx) => startCourierReturn(tx, ctx.tenantId, jobId, delivererId, staff(ctx)).then(() => null));

/** Le bureau peut aussi saisir l'avancement (livreur sans téléphone) : mêmes règles. */
export const progress = (jobId: string, to: "picked_up" | "in_transit" | "returned") =>
  runNotified("delivery.update_status", async (ctx, tx) => {
    if (to === "returned") await completeCourierReturn(tx, ctx.tenantId, jobId, staff(ctx));
    else await advanceCourierJob(tx, ctx.tenantId, jobId, to, staff(ctx));
    return { data: null, planned: to === "in_transit" ? await planCourierNotifications(tx, ctx.tenantId, jobId, "courier_job_on_the_way") : [] };
  });

const deliverSchema = z.object({ proof: z.union([z.object({ type: z.literal("code"), code: z.string().max(4) }), z.object({ type: z.literal("name"), name: text(80) })]), collectedAmount: z.number().int().min(0) });

export const deliver = (jobId: string, raw: unknown) => {
  const p = deliverSchema.safeParse(raw);
  if (!p.success) return bad(p.error);
  return runNotified("delivery.update_status", async (ctx, tx) => {
    await deliverCourierJob(tx, ctx.tenantId, jobId, { ...p.data, actor: staff(ctx) });
    return { data: null, planned: await planCourierNotifications(tx, ctx.tenantId, jobId, "courier_job_delivered") };
  });
};

export const fail = (jobId: string, reason: string) =>
  runNotified("delivery.update_status", async (ctx, tx) => {
    await failCourierJob(tx, ctx.tenantId, jobId, reason, staff(ctx));
    return { data: null, planned: await planCourierNotifications(tx, ctx.tenantId, jobId, "courier_job_failed") };
  });

// --- Livreurs --------------------------------------------------------------------------

const courierSchema = z.object({ name: text(80).min(1, "Nom requis."), phone: text(30).min(6, "Téléphone requis."), vehicleType: optionalText(30) });

export const saveCourier = (delivererId: string | null, raw: unknown) => {
  const p = courierSchema.partial().extend({ isActive: z.boolean().optional() }).safeParse(raw);
  if (!p.success) return bad(p.error);
  return run("delivery.manage_zones", async (ctx, tx) => {
    if (delivererId) return { id: (await updateCourier(tx, ctx.tenantId, delivererId, p.data)).id };
    const full = courierSchema.safeParse(raw);
    if (!full.success) throw new CourierError(firstIssue(full.error));
    return { id: (await createCourier(tx, ctx.tenantId, full.data)).id };
  });
};

export const renewCourierLink = (delivererId: string) => run("delivery.manage_zones", (ctx, tx) => rotateCourierToken(tx, ctx.tenantId, delivererId).then(() => null));

// --- Espèces ---------------------------------------------------------------------------

const remitSchema = z.object({ delivererId: z.string().uuid(), receivedAmount: z.number().int().min(0), discrepancyNote: optionalText(300) });

export const remit = (raw: unknown) => {
  const p = remitSchema.safeParse(raw);
  if (!p.success) return bad(p.error);
  return run("reservation_payments.record", async (ctx, tx) => {
    const r = await recordRemittance(tx, ctx.tenantId, { ...p.data, receivedBy: ctx.userId });
    return { receiptNumber: r.receiptNumber };
  });
};

const settleSchema = z.object({ senderId: z.string().uuid(), method: z.enum(SETTLEMENT_METHODS), reference: optionalText(80) });

export const settle = (raw: unknown) => {
  const p = settleSchema.safeParse(raw);
  if (!p.success) return bad(p.error);
  return run("reservation_payments.record", async (ctx, tx) => {
    const s = await settleSender(tx, ctx.tenantId, { ...p.data, settledBy: ctx.userId });
    return { receiptNumber: s.receiptNumber };
  });
};

// --- Réglages et vitrine ----------------------------------------------------------------

const settingsSchema = z.object({ mediumSurcharge: z.number().int().min(0).max(1_000_000).optional(), largeSurcharge: z.number().int().min(0).max(1_000_000).optional(), maxCod: z.number().int().min(0).max(10_000_000).optional(), maxAttempts: z.number().int().min(1).max(10).optional(), publicRequests: z.boolean().optional() });

export const saveSettings = (raw: unknown) => {
  const p = settingsSchema.safeParse(raw);
  if (!p.success) return bad(p.error);
  return run("delivery.manage_zones", (ctx, tx) => updateCourierSettings(tx, ctx.tenantId, p.data).then(() => null));
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

export const saveCourierHome = (raw: unknown) => {
  const p = z
    .object({ coverUrl: z.string().trim().max(300).nullable(), eyebrow: z.string().trim().max(60), title: z.string().trim().min(1, "Donnez un titre.").max(80), subtitle: z.string().trim().max(220), contactPhone: optionalText(30), contactWhatsapp: optionalText(30), contactAddress: optionalText(160) })
    .safeParse(raw);
  if (!p.success) return bad(p.error);
  const i = p.data;
  return run("settings.branding", async (ctx, tx) => {
    if (i.coverUrl) await ownImages(tx, ctx.tenantId, [i.coverUrl]);
    const current = await getStorefrontCustomization(tx, ctx.tenantId);
    const content = parseHomeContent(current.content, current.tenantName);
    const prev = content.hero.slides[0];
    const keepDemo = !!prev?.demo && prev.imageUrl === i.coverUrl;
    content.hero.slides = [{ id: "trajet", imageUrl: i.coverUrl, mobileImageUrl: keepDemo ? prev!.mobileImageUrl : null, imageAlt: i.title, demo: keepDemo, productId: null, eyebrow: i.eyebrow, title: i.title, subtitle: i.subtitle, ctaLabel: "Envoyer un colis", ctaHref: "/envoyer", theme: "dark" }];
    await saveStorefrontContent(tx, ctx.tenantId, content as unknown as Prisma.InputJsonValue, ctx.userId);
    await updateTenantBranding(tx, ctx.tenantId, { contactPhone: i.contactPhone, contactWhatsapp: i.contactWhatsapp, contactAddress: i.contactAddress });
    return null;
  });
};

// --- Zones et tarifs ------------------------------------------------------------------------

const zoneSchema = z.object({ name: text(80).min(1, "Nom de la zone requis."), region: text(60).min(1, "Région requise."), commune: optionalText(60), fee: z.number().int().min(0).max(1_000_000), estimatedDays: z.number().int().min(0).max(30).nullable().optional(), isActive: z.boolean().optional() });

/** Zone tarifaire (création, modification, désactivation) — jamais supprimée : l'historique des courses y renvoie. */
export const saveZone = (zoneId: string | null, raw: unknown) => {
  const p = zoneSchema.safeParse(raw);
  if (!p.success) return bad(p.error);
  return run("delivery.manage_zones", async (ctx, tx) => {
    try {
      const z = zoneId ? await updateDeliveryZone(tx, ctx.tenantId, zoneId, p.data) : await createDeliveryZone(tx, ctx.tenantId, { ...p.data, bulkySurcharge: 0 });
      return { id: z.id };
    } catch (error) {
      if (error instanceof Error && !(error instanceof CourierError)) throw new CourierError(error.message);
      throw error;
    }
  });
};
