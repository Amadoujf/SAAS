import { Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { nextCounterValue } from "./counters";
import { resolveOrCreateCustomer, type CustomerInput } from "./customer-registry";
import { formatReservationReference, ReservationNotFoundError, transitionReservationStatus } from "./reservation-registry";
import { addDays, isIsoDate, localToUtc, normalizeRanges, utcToLocal, weekdayOf, type MinuteRange } from "./service-slots";

/**
 * Restauration (secteur `restaurant`) — carte, tables et QR codes, commandes (sur place,
 * à emporter, livraison) suivies par la cuisine, encaissements, réservations de table.
 * Module dédié : la carte n'est PAS le catalogue de la boutique (options, épuisé du
 * jour, plages de service), et une commande de restaurant n'est PAS une commande
 * e-commerce (pas de stock, pas de panier persistant, cycle cuisine).
 *
 * Règles tenues ici (et doublées en base) :
 * - le prix de chaque ligne est recalculé par le serveur depuis la carte (plat +
 *   suppléments) ; aucun montant venu du navigateur n'est lu ;
 * - les choix d'options respectent les bornes de chaque groupe ; un plat ou une option
 *   épuisé(e) n'est jamais commandé(e) ;
 * - une commande n'est payée que si un encaissement RÉEL est enregistré ; rien n'est
 *   simulé et Chariow reste réservé aux abonnements YamaCommerce ;
 * - le client ne voit et n'annule que SA commande (jeton), et seulement avant qu'elle
 *   soit acceptée par la cuisine ;
 * - les réservations de table respectent le rythme d'arrivées par créneau et le nombre
 *   de places de la salle, sous verrou (deux réservations simultanées sont sérialisées).
 */

export const TABLE_BOOKING_MODULE = "table_reservations";
export const ORDER_MODES = ["dine_in", "takeaway", "delivery"] as const;
export type OrderMode = (typeof ORDER_MODES)[number];
export const KITCHEN_STATUSES = ["new", "accepted", "preparing", "ready", "completed", "canceled"] as const;
export type KitchenStatus = (typeof KITCHEN_STATUSES)[number];
export const DISH_BADGES = ["signature", "spicy", "vegetarian", "new"] as const;
export const RESTAURANT_PAYMENT_METHODS = ["cash", "wave", "orange_money", "free_money", "card", "bank_transfer", "other"] as const;

export const KITCHEN_TRANSITIONS: Record<KitchenStatus, KitchenStatus[]> = {
  new: ["accepted", "canceled"],
  accepted: ["preparing", "canceled"],
  preparing: ["ready", "canceled"],
  ready: ["completed", "canceled"],
  completed: [],
  canceled: [],
};
/** Commandes encore « en cuisine » (écran de la cuisine, compteurs). */
export const OPEN_ORDER_STATUSES: KitchenStatus[] = ["new", "accepted", "preparing", "ready"];

export class RestaurantError extends Error {}

type Tx = Prisma.TransactionClient;
type Actor = { userId: string | null; type: "owner" | "employee" | "system" | "customer" };

const includes = <T extends readonly string[]>(list: T, v: unknown): v is T[number] => typeof v === "string" && (list as readonly string[]).includes(v);
const int = (v: unknown, a: number, b: number) => Number.isInteger(v) && (v as number) >= a && (v as number) <= b;
const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const opt = (v: unknown, max: number) => text(v, max) || null;

async function tenantTimezone(tx: Tx, tenantId: string) {
  return (await tx.tenant.findUnique({ where: { id: tenantId }, select: { timezone: true } }))?.timezone || "Africa/Dakar";
}

// ============================================================================
// RÉGLAGES ET HORAIRES
// ============================================================================

export type OpeningRange = MinuteRange & { weekday: number };

const DEFAULT_SETTINGS = {
  openingHours: [] as OpeningRange[],
  acceptTakeaway: true,
  acceptDelivery: true,
  acceptDineInQr: true,
  deliveryFee: 1000,
  minDeliveryOrder: 5000,
  prepMinutes: 25,
  acceptBookings: true,
  maxCoversPerSlot: 30,
  bookingSlotMinutes: 30,
  bookingDuration: 90,
  maxPartySize: 10,
};
export type RestaurantSettingsInput = Partial<typeof DEFAULT_SETTINGS>;

function parseHours(value: unknown): OpeningRange[] {
  return Array.isArray(value) ? (value as OpeningRange[]).filter((h) => h && Number.isInteger(h.weekday)) : [];
}

export async function getRestaurantSettings(tx: Tx, tenantId: string) {
  const row = await tx.restaurantSettings.findUnique({ where: { tenantId } });
  if (!row) return { tenantId, ...DEFAULT_SETTINGS, updatedAt: null as Date | null };
  return { ...row, openingHours: parseHours(row.openingHours) };
}

export async function updateRestaurantSettings(tx: Tx, tenantId: string, patch: RestaurantSettingsInput) {
  const data: Prisma.RestaurantSettingsUpdateInput = {};
  if (patch.openingHours !== undefined) {
    if (!Array.isArray(patch.openingHours) || patch.openingHours.some((h) => !int(h?.weekday, 0, 6))) throw new RestaurantError("Jour de la semaine invalide.");
    const all: OpeningRange[] = [];
    for (let d = 0; d < 7; d++) {
      try {
        all.push(...normalizeRanges(patch.openingHours.filter((h) => h.weekday === d)).map((r) => ({ weekday: d, startMinute: r.startMinute, endMinute: r.endMinute })));
      } catch (e) {
        throw new RestaurantError(e instanceof Error ? e.message : "Horaires invalides.");
      }
    }
    data.openingHours = all as unknown as Prisma.InputJsonValue;
  }
  for (const k of ["acceptTakeaway", "acceptDelivery", "acceptDineInQr", "acceptBookings"] as const) {
    if (patch[k] !== undefined) {
      if (typeof patch[k] !== "boolean") throw new RestaurantError("Réglage invalide.");
      data[k] = patch[k];
    }
  }
  const bounds: [keyof RestaurantSettingsInput, number, number, string][] = [
    ["deliveryFee", 0, 100_000, "Frais de livraison invalides."],
    ["minDeliveryOrder", 0, 10_000_000, "Minimum de commande invalide."],
    ["prepMinutes", 5, 240, "Temps de préparation invalide."],
    ["maxCoversPerSlot", 1, 1000, "Nombre de couverts par créneau invalide."],
    ["bookingDuration", 30, 360, "Durée de table invalide."],
    ["maxPartySize", 1, 60, "Taille de groupe invalide."],
  ];
  for (const [k, a, b, msg] of bounds) {
    if (patch[k] !== undefined) {
      if (!int(patch[k], a, b)) throw new RestaurantError(msg);
      (data as Record<string, unknown>)[k] = patch[k];
    }
  }
  if (patch.bookingSlotMinutes !== undefined) {
    if (![15, 30, 60].includes(patch.bookingSlotMinutes)) throw new RestaurantError("Pas des créneaux invalide.");
    data.bookingSlotMinutes = patch.bookingSlotMinutes;
  }
  const createData = { ...DEFAULT_SETTINGS, ...data, openingHours: (data.openingHours ?? []) as Prisma.InputJsonValue } as Omit<Prisma.RestaurantSettingsUncheckedCreateInput, "tenantId">;
  return tx.restaurantSettings.upsert({ where: { tenantId }, create: { tenantId, ...createData }, update: data });
}

/** Plages d'ouverture d'une date locale. */
export function openingRangesOn(hours: OpeningRange[], date: string): MinuteRange[] {
  const wd = weekdayOf(date);
  return hours.filter((h) => h.weekday === wd).sort((a, b) => a.startMinute - b.startMinute);
}

const isOpenAt = (hours: OpeningRange[], date: string, minute: number) => openingRangesOn(hours, date).some((r) => minute >= r.startMinute && minute < r.endMinute);

/** État d'ouverture « maintenant » et prochaine ouverture (affichage public). */
export async function serviceStatus(tx: Tx, tenantId: string, now = new Date()) {
  const [tz, settings] = await Promise.all([tenantTimezone(tx, tenantId), getRestaurantSettings(tx, tenantId)]);
  const local = utcToLocal(now, tz);
  const today = openingRangesOn(settings.openingHours, local.date);
  const current = today.find((r) => local.minute >= r.startMinute && local.minute < r.endMinute) ?? null;
  let next: { date: string; minute: number } | null = null;
  for (let i = 0; i < 8 && !next; i++) {
    const date = addDays(local.date, i);
    const r = openingRangesOn(settings.openingHours, date).find((x) => i > 0 || x.startMinute > local.minute);
    if (r) next = { date, minute: r.startMinute };
  }
  return { timezone: tz, today: local.date, minute: local.minute, open: !!current, closesAt: current?.endMinute ?? null, next, settings };
}

/**
 * Heures de retrait / livraison proposées pour aujourd'hui : par pas de 15 min, à partir
 * de maintenant + temps de préparation, dans les plages d'ouverture.
 */
export async function pickupSlots(tx: Tx, tenantId: string, now = new Date()) {
  const [tz, settings] = await Promise.all([tenantTimezone(tx, tenantId), getRestaurantSettings(tx, tenantId)]);
  const local = utcToLocal(now, tz);
  const earliest = local.minute + settings.prepMinutes;
  const slots: { minute: number; at: Date }[] = [];
  for (const r of openingRangesOn(settings.openingHours, local.date)) {
    for (let m = Math.ceil(Math.max(earliest, r.startMinute + settings.prepMinutes) / 15) * 15; m < r.endMinute; m += 15) {
      slots.push({ minute: m, at: localToUtc(local.date, m, tz) });
    }
  }
  return { date: local.date, timezone: tz, slots };
}

// ============================================================================
// CARTE
// ============================================================================

export interface SectionInput {
  name: string;
  description?: string | null;
  position?: number;
  isActive?: boolean;
  availableFrom?: number | null;
  availableTo?: number | null;
}

function sectionData(i: Partial<SectionInput>) {
  const data: Prisma.MenuSectionUncheckedUpdateInput = {};
  if (i.name !== undefined) {
    const name = text(i.name, 80);
    if (!name) throw new RestaurantError("Donnez un nom à la rubrique.");
    data.name = name;
  }
  if (i.description !== undefined) data.description = opt(i.description, 300);
  if (i.position !== undefined) data.position = int(i.position, 0, 10_000) ? i.position : 0;
  if (i.isActive !== undefined) data.isActive = !!i.isActive;
  if (i.availableFrom !== undefined || i.availableTo !== undefined) {
    const from = i.availableFrom ?? null;
    const to = i.availableTo ?? null;
    if ((from === null) !== (to === null)) throw new RestaurantError("Indiquez le début et la fin de la plage de service.");
    if (from !== null && (!int(from, 0, 1439) || !int(to, 1, 1440) || from >= (to as number))) throw new RestaurantError("Plage de service invalide.");
    data.availableFrom = from;
    data.availableTo = to;
  }
  return data;
}

export async function createSection(tx: Tx, tenantId: string, input: SectionInput) {
  const data = sectionData(input);
  const position = input.position ?? (await tx.menuSection.count({ where: { tenantId } }));
  return tx.menuSection.create({ data: { ...(data as Prisma.MenuSectionUncheckedCreateInput), tenantId, name: data.name as string, position } });
}

export async function updateSection(tx: Tx, tenantId: string, sectionId: string, patch: Partial<SectionInput>) {
  const { count } = await tx.menuSection.updateMany({ where: { id: sectionId, tenantId }, data: sectionData(patch) as Prisma.MenuSectionUpdateManyMutationInput });
  if (!count) throw new RestaurantError("Rubrique introuvable.");
  return tx.menuSection.findFirstOrThrow({ where: { id: sectionId, tenantId } });
}

export interface OptionGroupInput {
  name: string;
  minChoices: number;
  maxChoices: number;
  options: { name: string; priceDelta?: number; isAvailable?: boolean }[];
}

export interface DishInput {
  sectionId: string;
  name: string;
  description?: string | null;
  price: number;
  imageUrl?: string | null;
  imageDemo?: boolean;
  badges?: string[];
  isAvailable?: boolean;
  isActive?: boolean;
  position?: number;
  prepMinutes?: number;
  /** Remplace tous les groupes d'options (les commandes passées gardent leur instantané). */
  optionGroups?: OptionGroupInput[];
}

function checkGroups(groups: OptionGroupInput[]) {
  if (!Array.isArray(groups) || groups.length > 10) throw new RestaurantError("Dix groupes d'options au plus.");
  return groups.map((g, gi) => {
    const name = text(g?.name, 80);
    if (!name) throw new RestaurantError("Chaque groupe d'options a un nom.");
    const options = (Array.isArray(g.options) ? g.options : []).map((o, oi) => {
      const oname = text(o?.name, 80);
      if (!oname) throw new RestaurantError(`« ${name} » : chaque choix a un nom.`);
      const priceDelta = o.priceDelta ?? 0;
      if (!int(priceDelta, 0, 1_000_000)) throw new RestaurantError(`« ${oname} » : supplément invalide.`);
      return { name: oname, priceDelta, isAvailable: o.isAvailable ?? true, position: oi };
    });
    if (!options.length || options.length > 30) throw new RestaurantError(`« ${name} » : entre 1 et 30 choix.`);
    if (!int(g.minChoices, 0, 20) || !int(g.maxChoices, 1, 20) || g.minChoices > g.maxChoices) throw new RestaurantError(`« ${name} » : nombre de choix invalide.`);
    if (g.minChoices > options.length) throw new RestaurantError(`« ${name} » : pas assez de choix pour le minimum demandé.`);
    return { name, minChoices: g.minChoices, maxChoices: Math.min(g.maxChoices, options.length), position: gi, options };
  });
}

async function dishData(tx: Tx, tenantId: string, i: Partial<DishInput>) {
  const data: Prisma.DishUncheckedUpdateInput = {};
  if (i.sectionId !== undefined) {
    const s = await tx.menuSection.findFirst({ where: { id: i.sectionId, tenantId }, select: { id: true } });
    if (!s) throw new RestaurantError("Rubrique introuvable.");
    data.sectionId = s.id;
  }
  if (i.name !== undefined) {
    const name = text(i.name, 120);
    if (!name) throw new RestaurantError("Donnez un nom au plat.");
    data.name = name;
  }
  if (i.description !== undefined) data.description = opt(i.description, 600);
  if (i.price !== undefined) {
    if (!int(i.price, 0, 10_000_000)) throw new RestaurantError("Prix invalide (FCFA, nombre entier).");
    data.price = i.price;
  }
  if (i.imageUrl !== undefined) data.imageUrl = opt(i.imageUrl, 500);
  if (i.imageDemo !== undefined) data.imageDemo = !!i.imageDemo;
  if (i.badges !== undefined) {
    if (!Array.isArray(i.badges) || i.badges.some((b) => !includes(DISH_BADGES, b))) throw new RestaurantError("Pastille inconnue.");
    data.badges = [...new Set(i.badges)];
  }
  if (i.isAvailable !== undefined) data.isAvailable = !!i.isAvailable;
  if (i.isActive !== undefined) data.isActive = !!i.isActive;
  if (i.position !== undefined) data.position = int(i.position, 0, 10_000) ? i.position : 0;
  if (i.prepMinutes !== undefined) {
    if (!int(i.prepMinutes, 0, 240)) throw new RestaurantError("Temps de préparation invalide.");
    data.prepMinutes = i.prepMinutes;
  }
  return data;
}

async function replaceGroups(tx: Tx, tenantId: string, dishId: string, groups: OptionGroupInput[]) {
  const clean = checkGroups(groups);
  const old = await tx.dishOptionGroup.findMany({ where: { tenantId, dishId }, select: { id: true } });
  if (old.length) {
    await tx.dishOption.deleteMany({ where: { tenantId, groupId: { in: old.map((g) => g.id) } } });
    await tx.dishOptionGroup.deleteMany({ where: { tenantId, dishId } });
  }
  for (const g of clean) {
    const group = await tx.dishOptionGroup.create({ data: { tenantId, dishId, name: g.name, minChoices: g.minChoices, maxChoices: g.maxChoices, position: g.position } });
    await tx.dishOption.createMany({ data: g.options.map((o) => ({ tenantId, groupId: group.id, ...o })) });
  }
}

export async function createDish(tx: Tx, tenantId: string, input: DishInput) {
  if (!input.sectionId) throw new RestaurantError("Choisissez une rubrique.");
  const data = await dishData(tx, tenantId, input);
  const position = input.position ?? (await tx.dish.count({ where: { tenantId, sectionId: input.sectionId } }));
  const dish = await tx.dish.create({ data: { ...(data as Prisma.DishUncheckedCreateInput), tenantId, position } });
  if (input.optionGroups?.length) await replaceGroups(tx, tenantId, dish.id, input.optionGroups);
  return getDish(tx, tenantId, dish.id);
}

export async function updateDish(tx: Tx, tenantId: string, dishId: string, patch: Partial<DishInput>) {
  const { count } = await tx.dish.updateMany({ where: { id: dishId, tenantId }, data: (await dishData(tx, tenantId, patch)) as Prisma.DishUpdateManyMutationInput });
  if (!count) throw new RestaurantError("Plat introuvable.");
  if (patch.optionGroups !== undefined) await replaceGroups(tx, tenantId, dishId, patch.optionGroups);
  return getDish(tx, tenantId, dishId);
}

/** « Épuisé » / « de nouveau disponible » en un geste (plat ou choix d'option). */
export async function setDishAvailability(tx: Tx, tenantId: string, dishId: string, isAvailable: boolean) {
  const { count } = await tx.dish.updateMany({ where: { id: dishId, tenantId }, data: { isAvailable } });
  if (!count) throw new RestaurantError("Plat introuvable.");
}

export async function setOptionAvailability(tx: Tx, tenantId: string, optionId: string, isAvailable: boolean) {
  const { count } = await tx.dishOption.updateMany({ where: { id: optionId, tenantId }, data: { isAvailable } });
  if (!count) throw new RestaurantError("Choix introuvable.");
}

const dishInclude = { optionGroups: { orderBy: { position: "asc" as const }, include: { options: { orderBy: { position: "asc" as const } } } } } satisfies Prisma.DishInclude;

export function getDish(tx: Tx, tenantId: string, dishId: string) {
  return tx.dish.findFirst({ where: { id: dishId, tenantId }, include: { ...dishInclude, section: { select: { id: true, name: true } } } });
}

/** Carte complète. `publicOnly` : rubriques et plats actifs seulement (les épuisés restent affichés, grisés). */
export function getMenu(tx: Tx, tenantId: string, q: { publicOnly?: boolean } = {}) {
  return tx.menuSection.findMany({
    where: { tenantId, ...(q.publicOnly ? { isActive: true } : {}) },
    orderBy: { position: "asc" },
    include: { dishes: { where: q.publicOnly ? { isActive: true } : {}, orderBy: { position: "asc" }, include: dishInclude } },
  });
}

// ============================================================================
// TABLES
// ============================================================================

export async function createTable(tx: Tx, tenantId: string, input: { label: string; seats: number; zone?: string | null }) {
  const label = text(input.label, 20);
  if (!label) throw new RestaurantError("Donnez un nom ou un numéro à la table.");
  if (!int(input.seats, 1, 40)) throw new RestaurantError("Nombre de places invalide.");
  if (await tx.diningTable.findFirst({ where: { tenantId, label }, select: { id: true } })) throw new RestaurantError(`La table « ${label} » existe déjà.`);
  const position = await tx.diningTable.count({ where: { tenantId } });
  return tx.diningTable.create({ data: { tenantId, label, seats: input.seats, zone: opt(input.zone, 40), position } });
}

export async function updateTable(tx: Tx, tenantId: string, tableId: string, patch: { label?: string; seats?: number; zone?: string | null; isActive?: boolean }) {
  const data: Prisma.DiningTableUpdateManyMutationInput = {};
  if (patch.label !== undefined) {
    const label = text(patch.label, 20);
    if (!label) throw new RestaurantError("Donnez un nom ou un numéro à la table.");
    if (await tx.diningTable.findFirst({ where: { tenantId, label, id: { not: tableId } }, select: { id: true } })) throw new RestaurantError(`La table « ${label} » existe déjà.`);
    data.label = label;
  }
  if (patch.seats !== undefined) {
    if (!int(patch.seats, 1, 40)) throw new RestaurantError("Nombre de places invalide.");
    data.seats = patch.seats;
  }
  if (patch.zone !== undefined) data.zone = opt(patch.zone, 40);
  if (patch.isActive !== undefined) data.isActive = !!patch.isActive;
  const { count } = await tx.diningTable.updateMany({ where: { id: tableId, tenantId }, data });
  if (!count) throw new RestaurantError("Table introuvable.");
  return tx.diningTable.findFirstOrThrow({ where: { id: tableId, tenantId } });
}

/** Nouveau QR code : l'ancien (photographié, recopié) cesse immédiatement de fonctionner. */
export async function regenerateTableQr(tx: Tx, tenantId: string, tableId: string) {
  const { count } = await tx.diningTable.updateMany({ where: { id: tableId, tenantId }, data: { qrToken: randomUUID() } });
  if (!count) throw new RestaurantError("Table introuvable.");
  return tx.diningTable.findFirstOrThrow({ where: { id: tableId, tenantId } });
}

export function listTables(tx: Tx, tenantId: string) {
  return tx.diningTable.findMany({ where: { tenantId }, orderBy: [{ position: "asc" }, { label: "asc" }] });
}

export function getTableByQr(tx: Tx, tenantId: string, qrToken: string) {
  return tx.diningTable.findFirst({ where: { tenantId, qrToken, isActive: true } });
}

// ============================================================================
// COMMANDES
// ============================================================================

export interface OrderLineInput {
  dishId: string;
  quantity: number;
  optionIds?: string[];
  note?: string | null;
}

export interface PlaceOrderInput {
  mode: OrderMode;
  items: OrderLineInput[];
  /** Sur place depuis le QR code de la table (site public). */
  tableQrToken?: string | null;
  /** Sur place saisi par l'équipe. */
  tableId?: string | null;
  customer?: CustomerInput | null;
  /** Heure souhaitée (à emporter / livraison) ; absente = dès que possible. */
  requestedFor?: Date | null;
  deliveryAddress?: string | null;
  note?: string | null;
  channel?: "web" | "qr" | "dashboard" | "phone" | "whatsapp";
  actor: Actor;
  now?: Date;
}

/** Prix d'une ligne recalculé depuis la carte, options vérifiées. */
async function priceLines(tx: Tx, tenantId: string, lines: OrderLineInput[], ctx: { fromPublic: boolean; localMinute: number }) {
  if (!Array.isArray(lines) || !lines.length) throw new RestaurantError("Votre commande est vide.");
  if (lines.length > 40) throw new RestaurantError("Quarante lignes au plus par commande.");
  const dishes = await tx.dish.findMany({
    where: { tenantId, id: { in: lines.map((l) => l.dishId).filter((x) => typeof x === "string") } },
    include: { ...dishInclude, section: true },
  });
  return lines.map((l) => {
    const dish = dishes.find((d) => d.id === l.dishId);
    if (!dish || !dish.isActive || !dish.section.isActive) throw new RestaurantError("Un plat de votre commande n'est plus à la carte.");
    if (!dish.isAvailable) throw new RestaurantError(`« ${dish.name} » est épuisé pour le moment.`);
    const s = dish.section;
    if (ctx.fromPublic && s.availableFrom !== null && s.availableTo !== null && (ctx.localMinute < s.availableFrom || ctx.localMinute >= s.availableTo)) {
      throw new RestaurantError(`« ${dish.name} » n'est pas servi à cette heure-ci.`);
    }
    if (!int(l.quantity, 1, 50)) throw new RestaurantError(`« ${dish.name} » : quantité invalide.`);
    const chosen = [...new Set(Array.isArray(l.optionIds) ? l.optionIds : [])];
    const all = dish.optionGroups.flatMap((g) => g.options.map((o) => ({ ...o, group: g })));
    if (chosen.some((id) => !all.some((o) => o.id === id))) throw new RestaurantError(`« ${dish.name} » : choix invalide.`);
    const picked: { group: string; option: string; priceDelta: number }[] = [];
    for (const g of dish.optionGroups) {
      const inGroup = g.options.filter((o) => chosen.includes(o.id));
      if (inGroup.length < g.minChoices) throw new RestaurantError(`« ${dish.name} » : choisissez ${g.minChoices === 1 ? "une option" : `${g.minChoices} options`} pour « ${g.name} ».`);
      if (inGroup.length > g.maxChoices) throw new RestaurantError(`« ${dish.name} » : ${g.maxChoices} choix au plus pour « ${g.name} ».`);
      for (const o of inGroup) {
        if (!o.isAvailable) throw new RestaurantError(`« ${o.name} » est épuisé pour le moment.`);
        picked.push({ group: g.name, option: o.name, priceDelta: o.priceDelta });
      }
    }
    const unitPrice = dish.price + picked.reduce((sum, p) => sum + p.priceDelta, 0);
    return { dishId: dish.id, nameSnapshot: dish.name, unitPrice, quantity: l.quantity, options: picked, note: opt(l.note, 200), total: unitPrice * l.quantity, prepMinutes: dish.prepMinutes };
  });
}

export function formatKitchenNumber(date: string, value: number) {
  return `${date.replace(/-/g, "").slice(2)}-${String(value).padStart(3, "0")}`;
}

export async function placeOrder(tx: Tx, tenantId: string, input: PlaceOrderInput) {
  const now = input.now ?? new Date();
  const fromPublic = input.actor.type === "customer";
  if (!includes(ORDER_MODES, input.mode)) throw new RestaurantError("Mode de commande invalide.");
  const [tz, settings] = await Promise.all([tenantTimezone(tx, tenantId), getRestaurantSettings(tx, tenantId)]);
  const local = utcToLocal(now, tz);

  if (fromPublic) {
    if (input.mode === "takeaway" && !settings.acceptTakeaway) throw new RestaurantError("La vente à emporter est fermée pour le moment.");
    if (input.mode === "delivery" && !settings.acceptDelivery) throw new RestaurantError("La livraison est fermée pour le moment.");
    if (input.mode === "dine_in" && !settings.acceptDineInQr) throw new RestaurantError("La commande à table est fermée : adressez-vous au personnel.");
  }

  // Table (sur place) : par son QR code (public) ou choisie par l'équipe.
  let tableId: string | null = null;
  if (input.mode === "dine_in") {
    const table = fromPublic
      ? input.tableQrToken ? await getTableByQr(tx, tenantId, input.tableQrToken) : null
      : input.tableId ? await tx.diningTable.findFirst({ where: { id: input.tableId, tenantId, isActive: true } }) : null;
    if (!table) throw new RestaurantError(fromPublic ? "QR code de table invalide : scannez celui posé sur votre table." : "Choisissez une table.");
    tableId = table.id;
  }

  // Heure : ouverte maintenant (dès que possible, sur place) ou heure choisie dans les horaires.
  let requestedFor: Date | null = null;
  if (input.requestedFor && input.mode !== "dine_in") {
    const at = new Date(input.requestedFor);
    if (Number.isNaN(at.getTime())) throw new RestaurantError("Heure invalide.");
    const l = utcToLocal(at, tz);
    if (fromPublic) {
      if (l.date !== local.date) throw new RestaurantError("Les commandes se passent pour aujourd'hui.");
      if (at.getTime() < now.getTime() + (settings.prepMinutes - 1) * 60_000) throw new RestaurantError(`Comptez au moins ${settings.prepMinutes} min de préparation : choisissez une heure plus tardive.`);
      if (!isOpenAt(settings.openingHours, l.date, l.minute)) throw new RestaurantError("Le restaurant est fermé à cette heure-là.");
    }
    requestedFor = at;
  } else if (fromPublic && !isOpenAt(settings.openingHours, local.date, local.minute)) {
    throw new RestaurantError("Le restaurant est fermé pour le moment.");
  }

  const lines = await priceLines(tx, tenantId, input.items, { fromPublic, localMinute: requestedFor ? utcToLocal(requestedFor, tz).minute : local.minute });
  const subtotal = lines.reduce((s, l) => s + l.total, 0);

  let deliveryAddress: string | null = null;
  let deliveryFee = 0;
  if (input.mode === "delivery") {
    deliveryAddress = opt(input.deliveryAddress, 300);
    if (!deliveryAddress || deliveryAddress.length < 6) throw new RestaurantError("Indiquez l'adresse de livraison (quartier, repère).");
    if (fromPublic && subtotal < settings.minDeliveryOrder) throw new RestaurantError(`Livraison à partir de ${settings.minDeliveryOrder.toLocaleString("fr-FR")} FCFA de commande.`);
    deliveryFee = settings.deliveryFee;
  }

  const firstName = text(input.customer?.firstName, 80);
  const phone = text(input.customer?.phone, 30);
  if (!firstName) throw new RestaurantError("Indiquez votre prénom.");
  if (input.mode !== "dine_in" && !phone) throw new RestaurantError("Indiquez un numéro de téléphone pour être joint.");
  const customer = phone ? await resolveOrCreateCustomer(tx, tenantId, { firstName, lastName: opt(input.customer?.lastName, 80), phone, email: opt(input.customer?.email, 160) }) : null;

  const number = formatKitchenNumber(local.date, await nextCounterValue(tx, tenantId, `resto-order-${local.date}`));
  const order = await tx.restaurantOrder.create({
    data: {
      tenantId,
      number,
      mode: input.mode,
      tableId,
      customerId: customer?.id ?? null,
      customerName: [firstName, text(input.customer?.lastName, 80)].filter(Boolean).join(" "),
      customerPhone: customer?.phone ?? (phone || null),
      requestedFor,
      deliveryAddress,
      note: opt(input.note, 400),
      subtotal,
      deliveryFee,
      total: subtotal + deliveryFee,
      channel: input.channel ?? (input.mode === "dine_in" && fromPublic ? "qr" : fromPublic ? "web" : "dashboard"),
    },
  });
  await tx.restaurantOrderItem.createMany({
    data: lines.map(({ prepMinutes: _p, options, ...l }) => ({ ...l, tenantId, orderId: order.id, options: options as unknown as Prisma.InputJsonValue })),
  });
  await tx.restaurantOrderEvent.create({ data: { tenantId, orderId: order.id, fromStatus: null, toStatus: "new", changedBy: input.actor.userId, changedByType: input.actor.type } });
  return (await getOrder(tx, tenantId, order.id))!;
}

/** Fait avancer (ou annule) une commande dans le cycle de la cuisine, sous verrou. */
export async function advanceOrder(tx: Tx, tenantId: string, orderId: string, toStatus: KitchenStatus, actor: Actor, note?: string | null) {
  const locked = await tx.$queryRaw<{ status: string }[]>`SELECT "status" FROM "RestaurantOrder" WHERE "id" = ${orderId} AND "tenantId" = ${tenantId} FOR UPDATE`;
  if (!locked[0]) throw new RestaurantError("Commande introuvable.");
  const from = locked[0].status as KitchenStatus;
  if (from === toStatus) return (await getOrder(tx, tenantId, orderId))!;
  if (!KITCHEN_TRANSITIONS[from]?.includes(toStatus)) throw new RestaurantError(`Impossible de passer de « ${from} » à « ${toStatus} ».`);
  const reason = opt(note, 300);
  if (toStatus === "canceled" && actor.type !== "customer" && !reason) throw new RestaurantError("Indiquez le motif de l'annulation.");
  if (toStatus === "canceled") {
    const paid = await tx.restaurantPayment.count({ where: { tenantId, orderId, voidedAt: null } });
    if (paid) throw new RestaurantError("Un encaissement est enregistré : annulez-le d'abord (remboursement) avant d'annuler la commande.");
  }
  const at = new Date();
  await tx.restaurantOrder.update({
    where: { id: orderId },
    data: {
      status: toStatus,
      ...(toStatus === "accepted" ? { acceptedAt: at } : {}),
      ...(toStatus === "ready" ? { readyAt: at } : {}),
      ...(toStatus === "completed" ? { completedAt: at } : {}),
      ...(toStatus === "canceled" ? { canceledAt: at } : {}),
    },
  });
  await tx.restaurantOrderEvent.create({ data: { tenantId, orderId, fromStatus: from, toStatus, changedBy: actor.userId, changedByType: actor.type, note: reason } });
  return (await getOrder(tx, tenantId, orderId))!;
}

/** Le client annule SA commande tant que la cuisine ne l'a pas acceptée. */
export async function cancelOrderAsGuest(tx: Tx, tenantId: string, accessToken: string) {
  const order = await tx.restaurantOrder.findFirst({ where: { tenantId, accessToken }, select: { id: true, status: true } });
  if (!order) throw new RestaurantError("Commande introuvable.");
  if (order.status !== "new") throw new RestaurantError("La cuisine a déjà pris votre commande : appelez le restaurant pour la modifier.");
  return advanceOrder(tx, tenantId, order.id, "canceled", { userId: null, type: "customer" }, "Annulée par le client");
}

// ── Encaissements ──────────────────────────────────────────────────────────

export function paymentSummary(total: number, payments: { amount: number; voidedAt: Date | null }[]) {
  const paid = payments.filter((p) => !p.voidedAt).reduce((s, p) => s + p.amount, 0);
  return { paid, due: Math.max(0, total - paid), state: paid <= 0 ? ("unpaid" as const) : paid >= total ? ("paid" as const) : ("partial" as const) };
}

export async function recordOrderPayment(tx: Tx, tenantId: string, input: { orderId: string; amount: number; method: string; reference?: string | null; actorUserId: string | null }) {
  const locked = await tx.$queryRaw<{ status: string; total: number }[]>`SELECT "status", "total" FROM "RestaurantOrder" WHERE "id" = ${input.orderId} AND "tenantId" = ${tenantId} FOR UPDATE`;
  if (!locked[0]) throw new RestaurantError("Commande introuvable.");
  if (locked[0].status === "canceled") throw new RestaurantError("Commande annulée : aucun encaissement possible.");
  if (!includes(RESTAURANT_PAYMENT_METHODS, input.method)) throw new RestaurantError("Moyen de paiement invalide.");
  if (!int(input.amount, 1, 100_000_000)) throw new RestaurantError("Montant invalide.");
  const payments = await tx.restaurantPayment.findMany({ where: { tenantId, orderId: input.orderId }, select: { amount: true, voidedAt: true } });
  const { due } = paymentSummary(locked[0].total, payments);
  if (input.amount > due) throw new RestaurantError(due ? `Il reste ${due.toLocaleString("fr-FR")} FCFA à encaisser.` : "Cette commande est déjà réglée.");
  const year = new Date().getFullYear();
  const receiptNumber = `TK-${year}-${String(await nextCounterValue(tx, tenantId, `resto-receipt-${year}`)).padStart(6, "0")}`;
  return tx.restaurantPayment.create({
    data: { tenantId, orderId: input.orderId, receiptNumber, amount: input.amount, method: input.method, reference: opt(input.reference, 80), recordedBy: input.actorUserId },
  });
}

export async function voidOrderPayment(tx: Tx, tenantId: string, paymentId: string, reason: string) {
  const why = text(reason, 300);
  if (!why) throw new RestaurantError("Indiquez le motif de l'annulation de l'encaissement.");
  const p = await tx.restaurantPayment.findFirst({ where: { id: paymentId, tenantId } });
  if (!p) throw new RestaurantError("Encaissement introuvable.");
  if (p.voidedAt) throw new RestaurantError("Encaissement déjà annulé.");
  return tx.restaurantPayment.update({ where: { id: p.id }, data: { voidedAt: new Date(), voidReason: why } });
}

// ── Lectures ───────────────────────────────────────────────────────────────

const orderInclude = {
  items: { orderBy: { id: "asc" as const } },
  table: { select: { id: true, label: true, zone: true } },
  payments: { orderBy: { paidAt: "asc" as const } },
  events: { orderBy: { createdAt: "asc" as const } },
} satisfies Prisma.RestaurantOrderInclude;

export function getOrder(tx: Tx, tenantId: string, orderId: string) {
  return tx.restaurantOrder.findFirst({ where: { id: orderId, tenantId }, include: orderInclude });
}

export function getOrderByToken(tx: Tx, tenantId: string, accessToken: string) {
  return tx.restaurantOrder.findFirst({ where: { accessToken, tenantId }, include: orderInclude });
}

export function listOrders(tx: Tx, tenantId: string, q: { status?: string[]; mode?: string; from?: Date; to?: Date; search?: string; take?: number } = {}) {
  const search = q.search?.trim();
  return tx.restaurantOrder.findMany({
    where: {
      tenantId,
      ...(q.status ? { status: { in: q.status } } : {}),
      ...(q.mode ? { mode: q.mode } : {}),
      ...(q.from || q.to ? { createdAt: { ...(q.from ? { gte: q.from } : {}), ...(q.to ? { lt: q.to } : {}) } } : {}),
      ...(search
        ? { OR: [{ number: { contains: search } }, { customerName: { contains: search, mode: "insensitive" as const } }, { customerPhone: { contains: search.replace(/\s/g, "") } }] }
        : {}),
    },
    include: orderInclude,
    orderBy: { createdAt: "desc" },
    take: Math.min(q.take ?? 200, 500),
  });
}

/** Écran de la cuisine : commandes en cours, les plus anciennes d'abord. */
export function kitchenBoard(tx: Tx, tenantId: string) {
  return tx.restaurantOrder.findMany({ where: { tenantId, status: { in: OPEN_ORDER_STATUSES } }, include: orderInclude, orderBy: { createdAt: "asc" }, take: 200 });
}

// ============================================================================
// RÉSERVATIONS DE TABLE
// ============================================================================

async function tableBookingsOverlapping(tx: Tx, tenantId: string, start: Date, end: Date, excludeReservationId?: string) {
  return tx.reservation.findMany({
    where: { tenantId, moduleKey: TABLE_BOOKING_MODULE, status: { in: ["requested", "confirmed"] }, startAt: { lt: end }, endAt: { gt: start }, ...(excludeReservationId ? { id: { not: excludeReservationId } } : {}) },
    select: { id: true, startAt: true, endAt: true, quantity: true, tableBooking: { select: { tableId: true } } },
  });
}

/**
 * Créneaux de réservation d'une date : dans les horaires (dernière arrivée 1 h avant la
 * fermeture), au plus tôt 1 h après maintenant, avec le nombre de couverts encore
 * possibles (rythme d'arrivées du créneau ET places de la salle).
 */
export async function bookingSlots(tx: Tx, tenantId: string, date: string, partySize: number, now = new Date()) {
  if (!isIsoDate(date)) throw new RestaurantError("Date invalide.");
  const [tz, settings, tables] = await Promise.all([tenantTimezone(tx, tenantId), getRestaurantSettings(tx, tenantId), tx.diningTable.findMany({ where: { tenantId, isActive: true }, select: { seats: true } })]);
  const seats = tables.reduce((s, t) => s + t.seats, 0);
  const dayStart = localToUtc(date, 0, tz);
  const booked = await tableBookingsOverlapping(tx, tenantId, dayStart, new Date(dayStart.getTime() + 36 * 3600_000));
  const earliest = now.getTime() + 60 * 60_000;
  const slots: { minute: number; at: Date; remaining: number; available: boolean }[] = [];
  for (const r of openingRangesOn(settings.openingHours, date)) {
    const first = Math.ceil(r.startMinute / settings.bookingSlotMinutes) * settings.bookingSlotMinutes;
    for (let m = first; m + 60 <= r.endMinute; m += settings.bookingSlotMinutes) {
      const at = localToUtc(date, m, tz);
      const end = new Date(at.getTime() + settings.bookingDuration * 60_000);
      const arriving = booked.filter((b) => b.startAt.getTime() === at.getTime()).reduce((s, b) => s + b.quantity, 0);
      const seated = booked.filter((b) => b.startAt < end && (b.endAt ?? b.startAt) > at).reduce((s, b) => s + b.quantity, 0);
      const remaining = Math.max(0, Math.min(settings.maxCoversPerSlot - arriving, seats ? seats - seated : settings.maxCoversPerSlot));
      slots.push({ minute: m, at, remaining, available: at.getTime() >= earliest && remaining >= partySize });
    }
  }
  return { date, timezone: tz, maxPartySize: settings.maxPartySize, acceptBookings: settings.acceptBookings, slots };
}

export interface BookTableInput {
  date: string;
  minute: number;
  partySize: number;
  customer?: CustomerInput | null;
  customerId?: string | null;
  customerNote?: string | null;
  occasion?: string | null;
  tableId?: string | null;
  channel?: "web" | "dashboard" | "phone" | "whatsapp";
  actor: Actor;
  now?: Date;
}

export async function bookTable(tx: Tx, tenantId: string, input: BookTableInput) {
  const fromPublic = input.actor.type === "customer";
  // Verrou unique par restaurant : deux réservations simultanées sont sérialisées et la
  // seconde recompte les couverts APRÈS la première.
  const settings = await getRestaurantSettings(tx, tenantId);
  if (!settings.updatedAt) await updateRestaurantSettings(tx, tenantId, {});
  await tx.$queryRaw`SELECT "tenantId" FROM "RestaurantSettings" WHERE "tenantId" = ${tenantId} FOR UPDATE`;
  if (fromPublic && !settings.acceptBookings) throw new RestaurantError("Les réservations en ligne sont fermées : appelez le restaurant.");
  if (!int(input.partySize, 1, 60)) throw new RestaurantError("Nombre de couverts invalide.");
  if (fromPublic && input.partySize > settings.maxPartySize) throw new RestaurantError(`Au-delà de ${settings.maxPartySize} personnes, appelez le restaurant pour organiser votre venue.`);
  if (!int(input.minute, 0, 1439)) throw new RestaurantError("Heure invalide.");
  const tz = await tenantTimezone(tx, tenantId);
  const at = localToUtc(input.date, input.minute, tz);
  const end = new Date(at.getTime() + settings.bookingDuration * 60_000);
  if (fromPublic) {
    const { slots } = await bookingSlots(tx, tenantId, input.date, input.partySize, input.now);
    const slot = slots.find((s) => s.minute === input.minute);
    if (!slot) throw new RestaurantError("Ce créneau n'est pas proposé.");
    if (!slot.available) throw new RestaurantError(slot.remaining > 0 ? `Plus que ${slot.remaining} couvert${slot.remaining > 1 ? "s" : ""} sur ce créneau.` : "Ce créneau est complet : choisissez une autre heure.");
  } else if (at.getTime() < (input.now ?? new Date()).getTime() - 30 * 60_000) {
    throw new RestaurantError("Cette heure est passée.");
  }

  let tableId: string | null = null;
  if (input.tableId) tableId = await checkTableFree(tx, tenantId, input.tableId, input.partySize, at, end);

  let customerId = input.customerId ?? null;
  if (customerId) {
    if (!(await tx.customer.findFirst({ where: { id: customerId, tenantId }, select: { id: true } }))) throw new RestaurantError("Client introuvable.");
  } else {
    if (!text(input.customer?.firstName, 80) || !text(input.customer?.phone, 30)) throw new RestaurantError("Nom et téléphone requis pour réserver.");
    customerId = (await resolveOrCreateCustomer(tx, tenantId, { firstName: text(input.customer!.firstName, 80), lastName: opt(input.customer!.lastName, 80), phone: text(input.customer!.phone, 30), email: opt(input.customer!.email, 160) })).id;
  }
  const year = new Date().getFullYear();
  const reservation = await tx.reservation.create({
    data: {
      tenantId,
      reference: formatReservationReference(year, await nextCounterValue(tx, tenantId, `reservation-${year}`)),
      customerId,
      moduleKey: TABLE_BOOKING_MODULE,
      startAt: at,
      endAt: end,
      quantity: input.partySize,
      customerNote: opt(input.customerNote, 400),
      channel: input.channel ?? (fromPublic ? "web" : "dashboard"),
    },
  });
  await tx.reservationStatusHistory.create({ data: { tenantId, reservationId: reservation.id, fromStatus: null, toStatus: "requested", changedBy: input.actor.userId, changedByType: input.actor.type } });
  await tx.restaurantTableBooking.create({ data: { reservationId: reservation.id, tenantId, partySize: input.partySize, tableId, occasion: opt(input.occasion, 60) } });
  await transitionReservationStatus(tx, tenantId, { reservationId: reservation.id, toStatus: "confirmed", actor: fromPublic ? { userId: null, type: "system" } : input.actor });
  return (await getTableBooking(tx, tenantId, reservation.id))!;
}

async function checkTableFree(tx: Tx, tenantId: string, tableId: string, partySize: number, start: Date, end: Date, excludeReservationId?: string) {
  const table = await tx.diningTable.findFirst({ where: { id: tableId, tenantId, isActive: true } });
  if (!table) throw new RestaurantError("Table introuvable.");
  if (table.seats < partySize) throw new RestaurantError(`La table ${table.label} n'a que ${table.seats} places.`);
  const clash = (await tableBookingsOverlapping(tx, tenantId, start, end, excludeReservationId)).some((b) => b.tableBooking?.tableId === table.id);
  if (clash) throw new RestaurantError(`La table ${table.label} est déjà réservée sur ce créneau.`);
  return table.id;
}

async function lockBooking(tx: Tx, tenantId: string, reservationId: string) {
  const r = await tx.$queryRaw<{ status: string }[]>`SELECT "status" FROM "Reservation" WHERE "id" = ${reservationId} AND "tenantId" = ${tenantId} AND "moduleKey" = ${TABLE_BOOKING_MODULE} FOR UPDATE`;
  if (!r[0]) throw new ReservationNotFoundError();
  return r[0].status;
}

/** Place (ou retire) la réservation sur une table précise. */
export async function assignBookingTable(tx: Tx, tenantId: string, reservationId: string, tableId: string | null) {
  const status = await lockBooking(tx, tenantId, reservationId);
  if (!["requested", "confirmed"].includes(status)) throw new RestaurantError("Cette réservation n'est plus active.");
  const r = await tx.reservation.findFirstOrThrow({ where: { id: reservationId, tenantId }, include: { tableBooking: true } });
  const id = tableId ? await checkTableFree(tx, tenantId, tableId, r.quantity, r.startAt, r.endAt ?? r.startAt, r.id) : null;
  await tx.restaurantTableBooking.update({ where: { reservationId }, data: { tableId: id } });
  return (await getTableBooking(tx, tenantId, reservationId))!;
}

/** Arrivée des convives (la réservation est honorée), absence, ou annulation par l'équipe. */
export async function setBookingOutcome(tx: Tx, tenantId: string, reservationId: string, outcome: "arrived" | "no_show" | "canceled", actor: Actor, note?: string | null) {
  const status = await lockBooking(tx, tenantId, reservationId);
  if (status === "requested" && outcome !== "canceled") await transitionReservationStatus(tx, tenantId, { reservationId, toStatus: "confirmed", actor });
  if (outcome === "canceled" && !opt(note, 300)) throw new RestaurantError("Indiquez le motif de l'annulation.");
  await transitionReservationStatus(tx, tenantId, { reservationId, toStatus: outcome === "arrived" ? "completed" : outcome, actor, note: opt(note, 300) });
  return (await getTableBooking(tx, tenantId, reservationId))!;
}

/** Le client annule SA réservation, jusqu'à l'heure prévue. */
export async function cancelBookingAsGuest(tx: Tx, tenantId: string, accessToken: string) {
  const r = await tx.reservation.findFirst({ where: { tenantId, accessToken, moduleKey: TABLE_BOOKING_MODULE }, select: { id: true, status: true, startAt: true } });
  if (!r) throw new ReservationNotFoundError();
  if (!["requested", "confirmed"].includes(r.status)) throw new RestaurantError("Cette réservation n'est plus active.");
  if (r.startAt <= new Date()) throw new RestaurantError("L'heure est passée : appelez le restaurant.");
  return transitionReservationStatus(tx, tenantId, { reservationId: r.id, toStatus: "canceled", actor: { userId: null, type: "customer" }, note: "Annulée en ligne par le client" });
}

const bookingInclude = {
  customer: { select: { id: true, firstName: true, lastName: true, phone: true, email: true } },
  tableBooking: { include: { table: { select: { id: true, label: true, seats: true, zone: true } } } },
  history: { orderBy: { createdAt: "asc" as const } },
} satisfies Prisma.ReservationInclude;

export function getTableBooking(tx: Tx, tenantId: string, reservationId: string) {
  return tx.reservation.findFirst({ where: { id: reservationId, tenantId, moduleKey: TABLE_BOOKING_MODULE }, include: bookingInclude });
}

export function getTableBookingByToken(tx: Tx, tenantId: string, accessToken: string) {
  return tx.reservation.findFirst({ where: { accessToken, tenantId, moduleKey: TABLE_BOOKING_MODULE }, include: bookingInclude });
}

export async function listTableBookings(tx: Tx, tenantId: string, q: { date?: string; from?: Date; to?: Date; status?: string[]; take?: number } = {}) {
  let range: { gte?: Date; lt?: Date } = {};
  if (q.date) {
    const tz = await tenantTimezone(tx, tenantId);
    range = { gte: localToUtc(q.date, 0, tz), lt: localToUtc(addDays(q.date, 1), 0, tz) };
  } else if (q.from || q.to) range = { ...(q.from ? { gte: q.from } : {}), ...(q.to ? { lt: q.to } : {}) };
  return tx.reservation.findMany({
    where: { tenantId, moduleKey: TABLE_BOOKING_MODULE, ...(q.status ? { status: { in: q.status } } : {}), ...(range.gte || range.lt ? { startAt: range } : {}) },
    include: bookingInclude,
    orderBy: { startAt: "asc" },
    take: Math.min(q.take ?? 300, 500),
  });
}

// ============================================================================
// VUE D'ENSEMBLE
// ============================================================================

export async function restaurantOverview(tx: Tx, tenantId: string, now = new Date()) {
  const tz = await tenantTimezone(tx, tenantId);
  const today = utcToLocal(now, tz).date;
  const from = localToUtc(today, 0, tz);
  const to = localToUtc(addDays(today, 1), 0, tz);
  const [orders, open, ready, payments, bookings, soldOut] = await Promise.all([
    tx.restaurantOrder.findMany({ where: { tenantId, createdAt: { gte: from, lt: to }, status: { not: "canceled" } }, select: { total: true, mode: true } }),
    tx.restaurantOrder.count({ where: { tenantId, status: { in: ["new", "accepted", "preparing"] } } }),
    tx.restaurantOrder.count({ where: { tenantId, status: "ready" } }),
    tx.restaurantPayment.findMany({ where: { tenantId, voidedAt: null, paidAt: { gte: from, lt: to } }, select: { amount: true } }),
    tx.reservation.findMany({ where: { tenantId, moduleKey: TABLE_BOOKING_MODULE, status: { in: ["requested", "confirmed", "completed"] }, startAt: { gte: from, lt: to } }, select: { quantity: true } }),
    tx.dish.count({ where: { tenantId, isActive: true, isAvailable: false } }),
  ]);
  return {
    timezone: tz,
    today,
    ordersToday: orders.length,
    orderedAmount: orders.reduce((s, o) => s + o.total, 0),
    byMode: Object.fromEntries(ORDER_MODES.map((m) => [m, orders.filter((o) => o.mode === m).length])) as Record<OrderMode, number>,
    inKitchen: open,
    ready,
    collectedToday: payments.reduce((s, p) => s + p.amount, 0),
    bookingsToday: bookings.length,
    coversToday: bookings.reduce((s, b) => s + b.quantity, 0),
    soldOut,
  };
}
