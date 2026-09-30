/**
 * Démonstration RESTAURANT : « Braise & Bissap », dibiterie et cuisine sénégalaise à
 * Ouakam (fictive). Script de DÉVELOPPEMENT uniquement — jamais exécuté par la CI ni en
 * production. Tout passe par les VRAIS moteurs (carte, tables, commandes recalculées,
 * cycle cuisine, encaissements, réservations sous capacité).
 * Visuels : illustrations ORIGINALES rendues par scripts/demo-visuals/restaurant.py,
 * marquées « démonstration », jamais présentées comme les plats d'un restaurant réel.
 *
 *   pnpm --filter @yamacommerce/database run seed:restaurant-demo
 */
import { prisma } from "./client";
import { withSuperAdminAccess, withTenant } from "./tenant-context";
import { assertDemoSeedAllowed } from "./demo-guard";
import { createOwnerAccount, provisionTenantForOwner } from "./tenant-provisioning";
import { saveStorefrontContent } from "./storefront-registry";
import { addDays, utcToLocal } from "./service-slots";
import {
  advanceOrder,
  bookTable,
  createDish,
  createSection,
  createTable,
  placeOrder,
  recordOrderPayment,
  setDishAvailability,
  updateRestaurantSettings,
  type DishInput,
  type OrderLineInput,
} from "./restaurant-registry";

const SLUG = "braise-bissap";
const V = "/demo-templates/restaurant";
const TZ = "Africa/Dakar";
const img = (name: string) => ({ imageUrl: `${V}/${name}.webp`, imageDemo: true });

async function main() {
  assertDemoSeedAllowed();
  const existing = await withSuperAdminAccess((tx) => tx.tenant.findUnique({ where: { slug: SLUG } }));
  if (existing) {
    console.info("Démonstration restaurant déjà présente — rien à faire.");
    return;
  }
  const owner = await createOwnerAccount({ email: "fatou@braise-bissap.sn", fullName: "Fatou Sarr", password: "Demo!2026" });
  const { tenantId } = await provisionTenantForOwner({
    ownerUserId: owner.id,
    name: "Braise & Bissap",
    subdomain: SLUG,
    subdomainSuffix: process.env.PLATFORM_SUBDOMAIN_SUFFIX ?? "yamacommerce.ai",
    sectorKey: "restaurant",
    planName: "Business",
    templatePreference: "braise",
  });
  await withSuperAdminAccess(async (tx) => {
    const t = await tx.tenant.findUniqueOrThrow({ where: { id: tenantId } });
    await tx.tenant.update({
      where: { id: tenantId },
      data: { isDemo: true, timezone: TZ, branding: { ...(t.branding as object), contactPhone: "+221 33 860 44 12", contactWhatsapp: "+221776044120", contactEmail: "bonjour@braise-bissap.sn", contactAddress: "Route de la Corniche, Ouakam, Dakar" } },
    });
  });
  const owner_ = { userId: owner.id, type: "owner" as const };

  // Réglages : dibiterie ouverte tard (jusqu'à 4 h) et à midi.
  const hours = Array.from({ length: 7 }, (_, weekday) => [
    { weekday, startMinute: 0, endMinute: 4 * 60 },
    { weekday, startMinute: 11 * 60, endMinute: 1440 },
  ]).flat();
  const ids: Record<string, string> = {};
  const tables: Record<string, string> = {};
  await withTenant(tenantId, async (tx) => {
    await tx.paymentProviderConfig.createMany({
      data: [
        { tenantId, provider: "wave_direct", isEnabled: true, mode: "live", label: "Wave", accountNumber: "77 604 41 20", accountHolderName: "Braise & Bissap", publicInstructions: null },
        { tenantId, provider: "orange_money_direct", isEnabled: true, mode: "live", label: "Orange Money", accountNumber: "78 604 41 20", accountHolderName: "Braise & Bissap", publicInstructions: null },
      ],
    });
    await updateRestaurantSettings(tx, tenantId, { openingHours: hours, deliveryFee: 1000, minDeliveryOrder: 5000, prepMinutes: 25, maxCoversPerSlot: 16, bookingSlotMinutes: 30, bookingDuration: 90, maxPartySize: 10 });

    const grill = (await createSection(tx, tenantId, { name: "Grillades", description: "Au feu de bois, servies sur papier avec oignons et moutarde." })).id;
    const plats = (await createSection(tx, tenantId, { name: "Plats du jour", description: "Cuisinés chaque matin : quand c'est fini, c'est fini." })).id;
    const midi = (await createSection(tx, tenantId, { name: "Formule midi", availableFrom: 11 * 60, availableTo: 15 * 60 })).id;
    const petites = (await createSection(tx, tenantId, { name: "Petites faims" })).id;
    const boissons = (await createSection(tx, tenantId, { name: "Boissons maison" })).id;
    const desserts = (await createSection(tx, tenantId, { name: "Desserts" })).id;

    const dishes: [string, DishInput][] = [
      ["dibi", { sectionId: grill, name: "Dibi d'agneau", price: 6500, badges: ["signature"], prepMinutes: 25, description: "Agneau grillé au feu de bois, oignons crus, moutarde et piment à part.", ...img("dibi-agneau"),
        optionGroups: [
          { name: "Portion", minChoices: 1, maxChoices: 1, options: [{ name: "Demi-kilo" }, { name: "Un kilo", priceDelta: 5500 }] },
          { name: "Accompagnement", minChoices: 1, maxChoices: 1, options: [{ name: "Pain" }, { name: "Frites", priceDelta: 500 }, { name: "Attiéké", priceDelta: 500 }] },
          { name: "Sauces", minChoices: 0, maxChoices: 2, options: [{ name: "Moutarde-oignons" }, { name: "Piment maison" }] },
        ] }],
      ["brochettes", { sectionId: grill, name: "Brochettes mixtes", price: 4500, prepMinutes: 20, description: "Bœuf, poivron et oignon, marinade citron-gingembre. Quatre brochettes.", ...img("braise-brochettes"),
        optionGroups: [{ name: "Accompagnement", minChoices: 1, maxChoices: 1, options: [{ name: "Frites" }, { name: "Attiéké" }, { name: "Salade" }] }] }],
      ["thieb", { sectionId: plats, name: "Thiéboudienne", price: 4000, badges: ["signature"], prepMinutes: 10, description: "Riz rouge, poisson farci, carotte, chou, manioc, aubergine.", ...img("thieboudienne") }],
      ["yassa", { sectionId: plats, name: "Yassa poulet", price: 3500, prepMinutes: 10, description: "Poulet mariné citron-oignons, sauce fondante.", ...img("yassa-poulet"),
        optionGroups: [
          { name: "Accompagnement", minChoices: 1, maxChoices: 1, options: [{ name: "Riz blanc" }, { name: "Attiéké", priceDelta: 500 }] },
          { name: "Suppléments", minChoices: 0, maxChoices: 2, options: [{ name: "Œuf dur", priceDelta: 300 }, { name: "Olives" }, { name: "Piment" }] },
        ] }],
      ["mafe", { sectionId: plats, name: "Mafé bœuf", price: 3500, badges: ["spicy"], prepMinutes: 10, description: "Sauce arachide mijotée, bœuf fondant, riz blanc.", ...img("mafe") }],
      ["formule", { sectionId: midi, name: "Formule plat + boisson", price: 4500, badges: ["new"], prepMinutes: 10, description: "Le plat du jour de votre choix et une boisson maison.",
        optionGroups: [
          { name: "Plat", minChoices: 1, maxChoices: 1, options: [{ name: "Thiéboudienne" }, { name: "Yassa poulet" }, { name: "Mafé bœuf" }] },
          { name: "Boisson", minChoices: 1, maxChoices: 1, options: [{ name: "Bissap" }, { name: "Bouye" }, { name: "Gingembre" }] },
        ] }],
      ["fataya", { sectionId: petites, name: "Fatayas (4 pièces)", price: 2000, prepMinutes: 10, description: "Chaussons frits, sauce tomate pimentée.", ...img("fataya"),
        optionGroups: [{ name: "Farce", minChoices: 1, maxChoices: 1, options: [{ name: "Viande" }, { name: "Poisson" }] }] }],
      ["pastels", { sectionId: petites, name: "Pastels au poisson (6 pièces)", price: 2000, prepMinutes: 10, badges: ["spicy"] }],
      ["bissap", { sectionId: boissons, name: "Bissap glacé", price: 1000, description: "Fleurs d'hibiscus, menthe fraîche. 50 cl.", ...img("bissap-bouye") }],
      ["bouye", { sectionId: boissons, name: "Jus de bouye", price: 1200, description: "Pain de singe, lait, vanille. 50 cl." }],
      ["gingembre", { sectionId: boissons, name: "Jus de gingembre", price: 1000, badges: ["spicy"], description: "Bien relevé. 50 cl." }],
      ["eau", { sectionId: boissons, name: "Eau minérale 1,5 L", price: 700 }],
      ["thiakry", { sectionId: desserts, name: "Thiakry", price: 1500, badges: ["vegetarian"], description: "Couscous de mil, lait caillé sucré, raisins secs.", ...img("thiakry") }],
    ];
    for (const [key, d] of dishes) ids[key] = (await createDish(tx, tenantId, d))!.id;
    // Épuisé ce soir : le client le voit, grisé, sans pouvoir le commander.
    await setDishAvailability(tx, tenantId, ids.pastels!, false);

    for (const [label, seats, zone] of [["1", 2, "Salle"], ["2", 2, "Salle"], ["3", 4, "Salle"], ["4", 4, "Salle"], ["5", 4, "Salle"], ["6", 6, "Salle"], ["T1", 4, "Terrasse"], ["T2", 4, "Terrasse"], ["T3", 8, "Terrasse"]] as const) {
      tables[label] = (await createTable(tx, tenantId, { label, seats, zone })).id;
    }
  });

  // Options par nom (les identifiants sont générés).
  const optionIds = async (dishKey: string, names: string[]) =>
    withTenant(tenantId, async (tx) => {
      const opts = await tx.dishOption.findMany({ where: { tenantId, group: { dishId: ids[dishKey]! } }, select: { id: true, name: true } });
      return names.map((n) => opts.find((o) => o.name === n)!.id);
    });
  const L = async (dishKey: string, quantity: number, opts: string[] = [], note?: string): Promise<OrderLineInput> => ({ dishId: ids[dishKey]!, quantity, optionIds: opts.length ? await optionIds(dishKey, opts) : [], note: note ?? null });

  const customers = [["Moussa", "77 612 30 44"], ["Aïda", "76 441 19 02"], ["Cheikh", "78 220 71 65"], ["Mariama", "77 903 55 18"], ["Babacar", "70 318 42 97"], ["Ndèye", "77 145 88 03"]] as const;
  type Plan = { mode: "dine_in" | "takeaway" | "delivery"; table?: string; who: number; lines: () => Promise<OrderLineInput[]>; channel: "web" | "qr" | "dashboard" | "phone"; address?: string; to?: ("accepted" | "preparing" | "ready" | "completed")[]; pay?: { method: string; ref?: string }; cancel?: string };
  const plan: Plan[] = [
    { mode: "dine_in", table: "3", who: 0, channel: "qr", lines: async () => [await L("dibi", 1, ["Un kilo", "Frites", "Moutarde-oignons", "Piment maison"]), await L("bissap", 3)], to: ["accepted", "preparing", "ready", "completed"], pay: { method: "wave", ref: "WV-88412" } },
    { mode: "takeaway", who: 1, channel: "web", lines: async () => [await L("thieb", 2), await L("bouye", 2)], to: ["accepted", "preparing", "ready", "completed"], pay: { method: "cash" } },
    { mode: "delivery", who: 2, channel: "web", address: "Mermoz, rue 12 x 15, immeuble bleu, 2e étage", lines: async () => [await L("yassa", 2, ["Attiéké", "Œuf dur"]), await L("fataya", 1, ["Viande"])], to: ["accepted", "preparing", "ready", "completed"], pay: { method: "orange_money", ref: "OM-20931" } },
    { mode: "dine_in", table: "T3", who: 3, channel: "dashboard", lines: async () => [await L("brochettes", 3, ["Attiéké"]), await L("dibi", 1, ["Demi-kilo", "Pain", "Moutarde-oignons"]), await L("gingembre", 4)], to: ["accepted", "preparing", "ready"] },
    { mode: "takeaway", who: 4, channel: "phone", lines: async () => [await L("mafe", 1), await L("thiakry", 2)], to: ["accepted", "preparing"] },
    { mode: "dine_in", table: "5", who: 5, channel: "qr", lines: async () => [await L("dibi", 1, ["Demi-kilo", "Frites", "Piment maison"], "Bien cuit s'il vous plaît"), await L("bissap", 2)], to: ["accepted"] },
    { mode: "delivery", who: 0, channel: "web", address: "Ouakam, cité Avion, villa 41 (portail vert)", lines: async () => [await L("thieb", 1), await L("yassa", 1, ["Riz blanc", "Olives"]), await L("eau", 1)] },
    { mode: "takeaway", who: 1, channel: "web", lines: async () => [await L("fataya", 2, ["Poisson"])], cancel: "Client parti avant la préparation" },
  ];
  for (const p of plan) {
    const [firstName, phone] = customers[p.who]!;
    const o = await withTenant(tenantId, async (tx) =>
      placeOrder(tx, tenantId, {
        mode: p.mode,
        tableId: p.table ? tables[p.table] : null,
        items: await p.lines(),
        customer: { firstName, phone: p.mode === "dine_in" && p.channel === "qr" ? null : phone },
        deliveryAddress: p.address ?? null,
        channel: p.channel,
        actor: p.channel === "qr" || p.channel === "web" ? { userId: null, type: "system" } : owner_,
      }),
    );
    await withTenant(tenantId, async (tx) => {
      for (const s of p.to ?? []) await advanceOrder(tx, tenantId, o.id, s, owner_);
      if (p.pay) await recordOrderPayment(tx, tenantId, { orderId: o.id, amount: o.total, method: p.pay.method, reference: p.pay.ref ?? null, actorUserId: owner.id });
      if (p.cancel) await advanceOrder(tx, tenantId, o.id, "canceled", owner_, p.cancel);
    });
  }

  // Réservations : ce soir et demain — ou, si la soirée est déjà entamée (script lancé
  // tard), à partir de demain : jamais un créneau déjà passé.
  const local = utcToLocal(new Date(), TZ);
  const today = local.minute < 19 * 60 ? local.date : addDays(local.date, 1);
  const bookings: [number, number, number, string | null, string | null][] = [
    // [jour +N, minute, couverts, table, occasion]
    [0, 20 * 60, 4, "4", null], [0, 20 * 60 + 30, 2, null, "Dîner en amoureux"], [0, 21 * 60, 6, "6", "Anniversaire"], [0, 21 * 60 + 30, 3, null, null],
    [1, 13 * 60, 8, "T3", "Repas d'affaires"], [1, 20 * 60, 2, null, null], [1, 20 * 60 + 30, 5, null, "Famille"], [2, 21 * 60, 4, null, null],
  ];
  const guests = [["Awa", "Ndiaye", "77 481 22 90"], ["Ibrahima", "Fall", "76 512 08 33"], ["Sokhna", "Diop", "78 147 66 21"], ["Pape", "Sow", "77 390 14 58"], ["Rokhaya", "Mbaye", "70 622 91 37"], ["Omar", "Thiam", "77 219 70 06"], ["Coumba", "Kane", "76 804 35 12"], ["Serigne", "Ba", "77 655 02 49"]] as const;
  for (const [i, [d, minute, party, table, occasion]] of bookings.entries()) {
    const [firstName, lastName, phone] = guests[i]!;
    await withTenant(tenantId, (tx) =>
      bookTable(tx, tenantId, { date: addDays(today, d), minute, partySize: party, customer: { firstName, lastName, phone }, tableId: table ? tables[table] : null, occasion, channel: i % 3 === 0 ? "phone" : "web", actor: owner_ }),
    );
  }

  await withTenant(tenantId, (tx) =>
    saveStorefrontContent(tx, tenantId, {
      announcement: { text: "Nouveau : la formule midi plat + boisson à 4 500 FCFA", href: "/carte" },
      hero: {
        autoplaySeconds: 7,
        slides: [
          { id: "braise", imageUrl: `${V}/braise-brochettes.webp`, mobileImageUrl: `${V}/braise-brochettes-mobile.webp`, imageAlt: "Brochettes sur la braise", demo: true, productId: null, eyebrow: "Dibiterie · Ouakam, Dakar", title: "Braise & Bissap", subtitle: "Grillades au feu de bois, plats du jour et jus maison. À emporter, livré chez vous, ou à table jusqu'à 4 h du matin.", ctaLabel: "Commander", ctaHref: "/carte", theme: "dark" },
        ],
      },
      featuredCategoryIds: [],
      featuredProductIds: [],
      collections: [],
      reassurance: [],
    }, owner.id),
  );
  console.info(`Démonstration restaurant créée : Braise & Bissap (fatou@braise-bissap.sn / Demo!2026), ${plan.length} commandes, ${bookings.length} réservations.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
