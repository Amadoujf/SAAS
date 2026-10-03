import "server-only";
import { z } from "zod";
import {
  withTenant,
  advanceOrder,
  getStorefrontCustomization,
  saveStorefrontContent,
  updateTenantBranding,
  assignBookingTable,
  bookTable,
  createDish,
  createSection,
  createTable,
  placeOrder,
  recordOrderPayment,
  regenerateTableQr,
  setBookingOutcome,
  setDishAvailability,
  setMediaAssetPublic,
  setOptionAvailability,
  updateDish,
  updateRestaurantSettings,
  updateSection,
  updateTable,
  voidOrderPayment,
  DISH_BADGES,
  InvalidReservationTransitionError,
  KITCHEN_STATUSES,
  ReservationNotFoundError,
  RESTAURANT_PAYMENT_METHODS,
  RestaurantError,
  SiteLinkError,
  TABLE_BOOKING_MODULE,
} from "@yamacommerce/database";
import type { Permission } from "@yamacommerce/auth";
import type { Prisma } from "@yamacommerce/database";
import { getCurrentTenantMembership } from "@/lib/current-tenant";
import { requireTenantPermission } from "@/lib/tenant-permissions";
import { checkImage } from "@/lib/media/image-refs";
import { parseHomeContent } from "@/lib/storefront/home-content";
import { getTenantModuleKeys, isRestaurant } from "@/lib/modules/tenant-modules";
import { dispatchRestaurantNotifications, planRestaurantNotifications } from "./notify";
import type { PlannedNotification } from "@/lib/orders/notify";

/**
 * Actions restaurant du tableau de bord. Chaque action revérifie côté serveur la
 * permission précise du membre, la RLS isole le restaurant, et les règles métier (prix
 * recalculés, cycle cuisine, encaissements réels, couverts) vivent dans le registre.
 */

export type ActionResult<T = unknown> = { ok: true; data: T } | { ok: false; status: number; error: string };

const optionalText = (max: number) => z.string().trim().max(max).nullable().optional().transform((v) => (v ? v : null));

async function context(permission: Permission) {
  const membership = await getCurrentTenantMembership();
  if (!membership) return null;
  if (!isRestaurant(await getTenantModuleKeys(membership.tenantId))) return null;
  const actor = await requireTenantPermission(membership.tenantId, permission);
  if (!actor) return null;
  return { tenantId: membership.tenantId, userId: actor.userId, actorType: (membership.roleName === "OWNER" ? "owner" : "employee") as "owner" | "employee" };
}

const DENIED = { ok: false as const, status: 403, error: "Action non autorisée." };

function toError(error: unknown): { ok: false; status: number; error: string } {
  if (error instanceof RestaurantError || error instanceof InvalidReservationTransitionError || error instanceof ReservationNotFoundError) return { ok: false, status: 409, error: error.message };
  if (error instanceof SiteLinkError) return { ok: false, status: 400, error: error.message };
  if (error instanceof Error && error.message.startsWith("Image")) return { ok: false, status: 400, error: error.message };
  // eslint-disable-next-line no-console
  console.error("[restaurant]", error);
  return { ok: false, status: 400, error: "Action impossible pour le moment." };
}

function firstIssue(error: z.ZodError) {
  const issue = error.issues[0];
  return issue ? `${issue.path.join(" › ") || "Formulaire"} : ${issue.message}` : "Données invalides.";
}
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

/** Action suivie de notifications : planifiées dans la transaction, mises en file après. */
const runNotified = async (permission: Permission, fn: (ctx: Ctx, tx: Tx) => Promise<PlannedNotification[]>): Promise<ActionResult<null>> => {
  const ctx = await context(permission);
  const r = await run(permission, fn);
  if (!r.ok) return r;
  if (ctx) await dispatchRestaurantNotifications(ctx.tenantId, r.data);
  return { ok: true, data: null };
};

// --- Carte ------------------------------------------------------------------------------

const sectionSchema = z.object({
  name: z.string().trim().min(1, "Nom requis.").max(80),
  description: optionalText(300),
  isActive: z.boolean(),
  availableFrom: z.number().int().min(0).max(1439).nullable(),
  availableTo: z.number().int().min(1).max(1440).nullable(),
  position: z.number().int().min(0).max(10_000).optional(),
});

export const saveSection = (sectionId: string | null, raw: unknown) => {
  const p = sectionSchema.safeParse(raw);
  if (!p.success) return bad(p.error);
  return run("products.edit", async (ctx, tx) => ({ id: (sectionId ? await updateSection(tx, ctx.tenantId, sectionId, p.data) : await createSection(tx, ctx.tenantId, p.data)).id }));
};

export const dishSchema = z.object({
  sectionId: z.string().uuid(),
  name: z.string().trim().min(1, "Nom requis.").max(120),
  description: optionalText(600),
  price: z.number().int().min(0).max(10_000_000),
  imageUrl: optionalText(300),
  badges: z.array(z.enum(DISH_BADGES)).max(4),
  isAvailable: z.boolean(),
  isActive: z.boolean(),
  prepMinutes: z.number().int().min(0).max(240),
  optionGroups: z
    .array(z.object({ name: z.string().trim().min(1, "Nom du groupe requis.").max(80), minChoices: z.number().int().min(0).max(20), maxChoices: z.number().int().min(1).max(20), options: z.array(z.object({ name: z.string().trim().min(1, "Nom du choix requis.").max(80), priceDelta: z.number().int().min(0).max(1_000_000), isAvailable: z.boolean().optional() })).min(1).max(30) }))
    .max(10),
});
export type DishFormInput = z.infer<typeof dishSchema>;

export async function saveDish(dishId: string | null, raw: unknown) {
  const p = dishSchema.safeParse(raw);
  if (!p.success) return bad(p.error);
  const input = p.data;
  return run(dishId ? "products.edit" : "products.create", async (ctx, tx) => {
    let imageDemo = false;
    if (input.imageUrl) {
      const ids = new Set<string>();
      const problem = checkImage(input.imageUrl, ids);
      if (problem) throw new Error(problem.startsWith("Image") ? problem : `Image : ${problem}`);
      if (ids.size && (await tx.mediaAsset.count({ where: { tenantId: ctx.tenantId, id: { in: [...ids] }, status: "READY" } })) !== ids.size) throw new Error("Image introuvable dans votre médiathèque.");
      for (const id of ids) await setMediaAssetPublic(tx, ctx.tenantId, id, true);
      // Une illustration de démonstration garde sa mention tant qu'on ne la remplace pas.
      if (dishId) {
        const cur = await tx.dish.findFirst({ where: { id: dishId, tenantId: ctx.tenantId }, select: { imageUrl: true, imageDemo: true } });
        imageDemo = !!cur?.imageDemo && cur.imageUrl === input.imageUrl;
      }
    }
    const data = { ...input, imageDemo };
    const saved = dishId ? await updateDish(tx, ctx.tenantId, dishId, data) : await createDish(tx, ctx.tenantId, data);
    return { id: saved!.id };
  });
}

/** Épuisé / disponible : geste de service (cuisine ou salle), pas une modification de carte. */
export const toggleDish = (dishId: string, isAvailable: boolean) => run("orders.update_status", (ctx, tx) => setDishAvailability(tx, ctx.tenantId, dishId, isAvailable).then(() => null));
export const toggleOption = (optionId: string, isAvailable: boolean) => run("orders.update_status", (ctx, tx) => setOptionAvailability(tx, ctx.tenantId, optionId, isAvailable).then(() => null));

// --- Tables et réglages ---------------------------------------------------------------

export const addTable = (raw: unknown) => {
  const p = z.object({ label: z.string().trim().min(1).max(20), seats: z.number().int().min(1).max(40), zone: optionalText(40) }).safeParse(raw);
  if (!p.success) return bad(p.error);
  return run("listings.manage_availability", (ctx, tx) => createTable(tx, ctx.tenantId, p.data).then((t) => ({ id: t.id })));
};

export const editTable = (tableId: string, raw: unknown) => {
  const p = z.object({ label: z.string().trim().min(1).max(20).optional(), seats: z.number().int().min(1).max(40).optional(), zone: optionalText(40), isActive: z.boolean().optional() }).safeParse(raw);
  if (!p.success) return bad(p.error);
  return run("listings.manage_availability", (ctx, tx) => updateTable(tx, ctx.tenantId, tableId, p.data).then(() => null));
};

export const newTableQr = (tableId: string) => run("listings.manage_availability", (ctx, tx) => regenerateTableQr(tx, ctx.tenantId, tableId).then(() => null));

export const saveRestaurantSettings = (raw: unknown) => {
  const p = z
    .object({
      openingHours: z.array(z.object({ weekday: z.number().int().min(0).max(6), startMinute: z.number().int().min(0).max(1439), endMinute: z.number().int().min(1).max(1440) })).max(28),
      acceptTakeaway: z.boolean(),
      acceptDelivery: z.boolean(),
      acceptDineInQr: z.boolean(),
      acceptBookings: z.boolean(),
      deliveryFee: z.number().int().min(0).max(100_000),
      minDeliveryOrder: z.number().int().min(0).max(10_000_000),
      prepMinutes: z.number().int().min(5).max(240),
      maxCoversPerSlot: z.number().int().min(1).max(1000),
      bookingSlotMinutes: z.union([z.literal(15), z.literal(30), z.literal(60)]),
      bookingDuration: z.number().int().min(30).max(360),
      maxPartySize: z.number().int().min(1).max(60),
    })
    .safeParse(raw);
  if (!p.success) return bad(p.error);
  return run("listings.manage_availability", (ctx, tx) => updateRestaurantSettings(tx, ctx.tenantId, p.data).then(() => null));
};

// --- Commandes --------------------------------------------------------------------------

export const moveOrder = (orderId: string, to: string, note?: string) => {
  if (!(KITCHEN_STATUSES as readonly string[]).includes(to)) return Promise.resolve({ ok: false as const, status: 400, error: "Étape inconnue." });
  return runNotified(to === "canceled" ? "orders.cancel" : "orders.update_status", async (ctx, tx) => {
    await advanceOrder(tx, ctx.tenantId, orderId, to as (typeof KITCHEN_STATUSES)[number], actorOf(ctx), note);
    if (to === "ready") return planRestaurantNotifications(tx, ctx.tenantId, { orderId }, "restaurant_order_ready");
    if (to === "canceled") return planRestaurantNotifications(tx, ctx.tenantId, { orderId }, "restaurant_order_canceled");
    return [];
  });
};

const deskOrderSchema = z.object({
  mode: z.enum(["dine_in", "takeaway", "delivery"]),
  tableId: z.string().uuid().nullable(),
  items: z.array(z.object({ dishId: z.string().uuid(), quantity: z.number().int().min(1).max(50), optionIds: z.array(z.string().uuid()).max(40), note: optionalText(200) })).min(1, "Ajoutez au moins un plat.").max(40),
  firstName: z.string().trim().min(1, "Indiquez le prénom.").max(80),
  phone: optionalText(20),
  deliveryAddress: optionalText(300),
  note: optionalText(400),
  channel: z.enum(["dashboard", "phone", "whatsapp"]),
});

/** Commande saisie en salle ou au téléphone : mêmes prix recalculés, mêmes règles d'options. */
export async function createDeskOrder(raw: unknown) {
  const p = deskOrderSchema.safeParse(raw);
  if (!p.success) return bad(p.error);
  const b = p.data;
  return run("orders.update_status", async (ctx, tx) => {
    const o = await placeOrder(tx, ctx.tenantId, {
      mode: b.mode,
      tableId: b.tableId,
      items: b.items,
      customer: { firstName: b.firstName, phone: b.phone },
      deliveryAddress: b.deliveryAddress,
      note: b.note,
      channel: b.channel,
      actor: actorOf(ctx),
    });
    return { id: o.id };
  });
}

export const recordPayment = (raw: unknown) => {
  const p = z.object({ orderId: z.string().uuid(), amount: z.number().int().min(1).max(100_000_000), method: z.enum(RESTAURANT_PAYMENT_METHODS), reference: optionalText(80) }).safeParse(raw);
  if (!p.success) return bad(p.error);
  return run("orders.update_status", async (ctx, tx) => {
    const pay = await recordOrderPayment(tx, ctx.tenantId, { ...p.data, actorUserId: ctx.userId });
    return { receiptNumber: pay.receiptNumber };
  });
};

export const voidPayment = (paymentId: string, reason: string) => run("payments.refund", (ctx, tx) => voidOrderPayment(tx, ctx.tenantId, paymentId, reason).then(() => null));

// --- Réservations de table --------------------------------------------------------------

async function assertBooking(tx: Tx, tenantId: string, reservationId: string) {
  const r = await tx.reservation.findFirst({ where: { id: reservationId, tenantId, moduleKey: TABLE_BOOKING_MODULE }, select: { id: true } });
  if (!r) throw new ReservationNotFoundError();
}

export const deskBooking = (raw: unknown) => {
  const p = z
    .object({
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      minute: z.number().int().min(0).max(1439),
      partySize: z.number().int().min(1).max(60),
      firstName: z.string().trim().min(1, "Indiquez le prénom.").max(80),
      lastName: optionalText(80),
      phone: z.string().trim().min(6, "Indiquez le téléphone.").max(20),
      tableId: z.string().uuid().nullable(),
      occasion: optionalText(60),
      note: optionalText(400),
      channel: z.enum(["dashboard", "phone", "whatsapp"]),
    })
    .safeParse(raw);
  if (!p.success) return bad(p.error);
  const b = p.data;
  return run("reservations.update_status", async (ctx, tx) => {
    const r = await bookTable(tx, ctx.tenantId, { date: b.date, minute: b.minute, partySize: b.partySize, customer: { firstName: b.firstName, lastName: b.lastName, phone: b.phone }, tableId: b.tableId, occasion: b.occasion, customerNote: b.note, channel: b.channel, actor: actorOf(ctx) });
    return { id: r.id };
  });
};

export const placeBooking = (reservationId: string, tableId: string | null) =>
  run("reservations.update_status", async (ctx, tx) => {
    await assertBooking(tx, ctx.tenantId, reservationId);
    await assignBookingTable(tx, ctx.tenantId, reservationId, tableId);
    return null;
  });

export const bookingOutcome = (reservationId: string, outcome: "arrived" | "no_show" | "canceled", note?: string) =>
  runNotified(outcome === "canceled" ? "reservations.cancel" : "reservations.update_status", async (ctx, tx) => {
    await assertBooking(tx, ctx.tenantId, reservationId);
    await setBookingOutcome(tx, ctx.tenantId, reservationId, outcome, actorOf(ctx), note);
    return outcome === "canceled" ? planRestaurantNotifications(tx, ctx.tenantId, { reservationId }, "table_booking_canceled") : [];
  });

// --- Vitrine en une minute (« Mon site ») ---------------------------------------------

async function ownImage(tx: Tx, tenantId: string, url: string | null) {
  if (!url) return;
  const ids = new Set<string>();
  const problem = checkImage(url, ids);
  if (problem) throw new Error(problem.startsWith("Image") ? problem : `Image : ${problem}`);
  if (ids.size && (await tx.mediaAsset.count({ where: { tenantId, id: { in: [...ids] }, status: "READY" } })) !== ids.size) throw new Error("Image introuvable dans votre médiathèque.");
  for (const id of ids) await setMediaAssetPublic(tx, tenantId, id, true);
}

/** Couverture, accroche et coordonnées affichées sur l'accueil du restaurant. */
export const saveRestaurantHome = (raw: unknown) => {
  const p = z
    .object({
      coverUrl: z.string().trim().max(300).nullable(),
      eyebrow: z.string().trim().max(60),
      title: z.string().trim().min(1, "Donnez un titre.").max(80),
      subtitle: z.string().trim().max(220),
      contactPhone: optionalText(30),
      contactWhatsapp: optionalText(30),
      contactAddress: optionalText(160),
    })
    .safeParse(raw);
  if (!p.success) return bad(p.error);
  const i = p.data;
  return run("settings.branding", async (ctx, tx) => {
    await ownImage(tx, ctx.tenantId, i.coverUrl);
    const current = await getStorefrontCustomization(tx, ctx.tenantId);
    const content = parseHomeContent(current.content, current.tenantName);
    const prev = content.hero.slides[0];
    // Une illustration de démonstration garde sa mention tant qu'on ne la remplace pas.
    const keepDemo = !!prev?.demo && prev.imageUrl === i.coverUrl;
    content.hero.slides = [
      {
        id: "restaurant",
        imageUrl: i.coverUrl,
        mobileImageUrl: keepDemo ? prev!.mobileImageUrl : null,
        imageAlt: i.title,
        demo: keepDemo,
        productId: null,
        eyebrow: i.eyebrow,
        title: i.title,
        subtitle: i.subtitle,
        ctaLabel: "Commander",
        ctaHref: "/carte",
        theme: "dark",
      },
    ];
    await saveStorefrontContent(tx, ctx.tenantId, content as unknown as Prisma.InputJsonValue, ctx.userId);
    await updateTenantBranding(tx, ctx.tenantId, { contactPhone: i.contactPhone, contactWhatsapp: i.contactWhatsapp, contactAddress: i.contactAddress });
    return null;
  });
};

/** Photo d'un plat en un geste (depuis « Mon site »). */
export const setDishPhoto = (dishId: string, imageUrl: string | null) =>
  run("products.edit", async (ctx, tx) => {
    await ownImage(tx, ctx.tenantId, imageUrl);
    const { count } = await tx.dish.updateMany({ where: { id: dishId, tenantId: ctx.tenantId }, data: { imageUrl, imageDemo: false } });
    if (!count) throw new RestaurantError("Plat introuvable.");
    return null;
  });
