import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../src/client";
import { withSuperAdminAccess, withTenant } from "../src/tenant-context";
import { testOwnerClient } from "./test-owner-client";
import { addDays, localToUtc } from "../src/service-slots";
import {
  advanceOrder,
  assignBookingTable,
  bookingSlots,
  bookTable,
  cancelBookingAsGuest,
  cancelOrderAsGuest,
  createDish,
  createSection,
  createTable,
  getMenu,
  getOrderByToken,
  kitchenBoard,
  paymentSummary,
  pickupSlots,
  placeOrder,
  recordOrderPayment,
  regenerateTableQr,
  restaurantOverview,
  setBookingOutcome,
  setDishAvailability,
  updateRestaurantSettings,
  voidOrderPayment,
  type PlaceOrderInput,
} from "../src/restaurant-registry";

/**
 * Restauration (étape 8) sur PostgreSQL RÉEL : carte et options, prix recalculés par le
 * serveur, commandes sur place (QR), à emporter et en livraison, cycle de la cuisine,
 * encaissements réels, réservations de table sous capacité (même en concurrence),
 * isolation entre restaurants.
 */
let databaseAvailable = true;
try {
  await prisma.$queryRaw`SELECT 1`;
} catch (error) {
  if (process.env.REQUIRE_DB_TESTS === "true") {
    throw new Error(`REQUIRE_DB_TESTS=true mais PostgreSQL est injoignable : ${error instanceof Error ? error.message : String(error)}`);
  }
  databaseAvailable = false;
  // eslint-disable-next-line no-console
  console.warn("[restaurant.test] Base de données injoignable — suite ignorée (skip).");
}

const guest = { userId: null, type: "customer" as const };
const staff = { userId: null, type: "employee" as const };
const TZ = "Africa/Dakar";
const today = new Date().toISOString().slice(0, 10); // restaurants de test à Dakar (UTC+0)
/** Midi aujourd'hui : horloge fixe pour les commandes (indépendante de l'heure du test). */
const noon = localToUtc(today, 12 * 60, TZ);
const ALL_WEEK = Array.from({ length: 7 }, (_, weekday) => ({ weekday, startMinute: 11 * 60, endMinute: 23 * 60 }));
let phoneSeq = 0;
const client = () => ({ firstName: "Client", phone: `77${String(5_000_000 + ++phoneSeq + Math.floor(Math.random() * 1000) * 100).padStart(7, "0")}` });

describe.skipIf(!databaseAvailable)("Restauration (réel, PostgreSQL)", () => {
  const suffix = Date.now();
  const sectorKey = `test-sector-resto-${suffix}`;
  let restoA: string;
  let restoB: string;
  let plats: string;
  let petitDej: string;
  let yassa: string;
  let thiebou: string;
  let omelette: string;
  let sideRiz: string;
  let sideAttieke: string;
  let extraOeuf: string;
  let extraPiment: string;
  let table4: { id: string; qrToken: string };
  let table2: { id: string; qrToken: string };

  beforeAll(async () => {
    await withSuperAdminAccess(async (tx) => {
      await tx.sector.create({ data: { key: sectorKey, name: "Secteur de test", defaultModuleKeys: [], isSystem: false } });
      const data = (s: string) => ({ slug: `test-resto-${s}-${suffix}`, name: `Resto ${s}`, businessType: "ECOMMERCE" as const, sectorKey, status: "ACTIVE" as const, billingExemptedAt: new Date(), timezone: TZ });
      restoA = (await tx.tenant.create({ data: data("a") })).id;
      restoB = (await tx.tenant.create({ data: data("b") })).id;
    });
    await withTenant(restoA, async (tx) => {
      await updateRestaurantSettings(tx, restoA, { openingHours: ALL_WEEK, deliveryFee: 1500, minDeliveryOrder: 6000, prepMinutes: 20, maxCoversPerSlot: 10, bookingSlotMinutes: 30, bookingDuration: 90, maxPartySize: 8 });
      plats = (await createSection(tx, restoA, { name: "Plats" })).id;
      petitDej = (await createSection(tx, restoA, { name: "Petit déjeuner", availableFrom: 7 * 60, availableTo: 11 * 60 })).id;
      const y = await createDish(tx, restoA, {
        sectionId: plats,
        name: "Yassa poulet",
        price: 3500,
        badges: ["signature"],
        optionGroups: [
          { name: "Accompagnement", minChoices: 1, maxChoices: 1, options: [{ name: "Riz blanc" }, { name: "Attiéké", priceDelta: 500 }] },
          { name: "Suppléments", minChoices: 0, maxChoices: 2, options: [{ name: "Œuf", priceDelta: 300 }, { name: "Piment", priceDelta: 0 }, { name: "Frites", priceDelta: 700 }] },
        ],
      });
      yassa = y!.id;
      sideRiz = y!.optionGroups[0]!.options[0]!.id;
      sideAttieke = y!.optionGroups[0]!.options[1]!.id;
      extraOeuf = y!.optionGroups[1]!.options[0]!.id;
      extraPiment = y!.optionGroups[1]!.options[1]!.id;
      thiebou = (await createDish(tx, restoA, { sectionId: plats, name: "Thiéboudienne", price: 4000 }))!.id;
      omelette = (await createDish(tx, restoA, { sectionId: petitDej, name: "Omelette", price: 1500 }))!.id;
      table4 = await createTable(tx, restoA, { label: "4", seats: 4, zone: "Terrasse" });
      table2 = await createTable(tx, restoA, { label: "2", seats: 2 });
    });
  });

  afterAll(async () => {
    const o = testOwnerClient();
    const ids = { in: [restoA, restoB] };
    await o.restaurantPayment.deleteMany({ where: { tenantId: ids } });
    await o.restaurantOrderEvent.deleteMany({ where: { tenantId: ids } });
    await o.restaurantOrderItem.deleteMany({ where: { tenantId: ids } });
    await o.restaurantOrder.deleteMany({ where: { tenantId: ids } });
    await o.restaurantTableBooking.deleteMany({ where: { tenantId: ids } });
    await o.reservationStatusHistory.deleteMany({ where: { tenantId: ids } });
    await o.reservation.deleteMany({ where: { tenantId: ids } });
    await o.diningTable.deleteMany({ where: { tenantId: ids } });
    await o.dishOption.deleteMany({ where: { tenantId: ids } });
    await o.dishOptionGroup.deleteMany({ where: { tenantId: ids } });
    await o.dish.deleteMany({ where: { tenantId: ids } });
    await o.menuSection.deleteMany({ where: { tenantId: ids } });
    await o.restaurantSettings.deleteMany({ where: { tenantId: ids } });
    await o.customer.deleteMany({ where: { tenantId: ids } });
    await o.counter.deleteMany({ where: { tenantId: ids } });
    await o.tenant.deleteMany({ where: { id: ids } });
    await o.sector.deleteMany({ where: { key: sectorKey } });
    await o.$disconnect();
  });

  const order = (extra: Partial<PlaceOrderInput>, tenant = restoA) =>
    withTenant(tenant, (tx) =>
      placeOrder(tx, tenant, { mode: "takeaway", items: [{ dishId: thiebou, quantity: 1 }], customer: client(), actor: guest, now: noon, ...extra }),
    );

  it("carte publique : rubriques et options dans l'ordre", async () => {
    const menu = await withTenant(restoA, (tx) => getMenu(tx, restoA, { publicOnly: true }));
    expect(menu.map((s) => s.name)).toEqual(["Plats", "Petit déjeuner"]);
    expect(menu[0]!.dishes.map((d) => d.name)).toEqual(["Yassa poulet", "Thiéboudienne"]);
    expect(menu[0]!.dishes[0]!.optionGroups.map((g) => g.name)).toEqual(["Accompagnement", "Suppléments"]);
  });

  it("prix recalculé par le serveur (plat + suppléments), jamais celui du navigateur", async () => {
    const o = await order({
      items: [
        { dishId: yassa, quantity: 2, optionIds: [sideAttieke, extraOeuf, extraPiment], price: 1 } as never,
        { dishId: thiebou, quantity: 1 },
      ],
      ...({ total: 10 } as object),
    });
    expect(o.items[0]!.unitPrice).toBe(3500 + 500 + 300);
    expect(o.items[0]!.total).toBe(8600);
    expect(o.items[0]!.options).toEqual([
      { group: "Accompagnement", option: "Attiéké", priceDelta: 500 },
      { group: "Suppléments", option: "Œuf", priceDelta: 300 },
      { group: "Suppléments", option: "Piment", priceDelta: 0 },
    ]);
    expect(o.subtotal).toBe(12_600);
    expect(o.total).toBe(12_600);
    expect(o.status).toBe("new");
    expect(o.number).toMatch(/^\d{6}-\d{3}$/);
    expect(o.events.map((e) => e.toStatus)).toEqual(["new"]);
  });

  it("options : minimum, maximum, choix d'un autre plat refusés", async () => {
    await expect(order({ items: [{ dishId: yassa, quantity: 1 }] })).rejects.toThrow(/choisissez une option pour « Accompagnement »/);
    await expect(order({ items: [{ dishId: yassa, quantity: 1, optionIds: [sideRiz, sideAttieke] }] })).rejects.toThrow(/1 choix au plus/);
    await expect(order({ items: [{ dishId: thiebou, quantity: 1, optionIds: [sideRiz] }] })).rejects.toThrow(/choix invalide/);
    await expect(order({ items: [{ dishId: thiebou, quantity: 0 }] })).rejects.toThrow(/quantité invalide/);
    await expect(order({ items: [] })).rejects.toThrow(/vide/);
  });

  it("plat épuisé et rubrique hors de sa plage de service : refus", async () => {
    await withTenant(restoA, (tx) => setDishAvailability(tx, restoA, thiebou, false));
    await expect(order({})).rejects.toThrow(/épuisé/);
    await withTenant(restoA, (tx) => setDishAvailability(tx, restoA, thiebou, true));
    await expect(order({ items: [{ dishId: omelette, quantity: 1 }] })).rejects.toThrow(/pas servi à cette heure/);
    const breakfast = localToUtc(today, 9 * 60, TZ);
    // L'équipe peut toujours saisir (ex. commande passée plus tôt au comptoir).
    expect((await order({ items: [{ dishId: omelette, quantity: 1 }], actor: staff, now: breakfast })).total).toBe(1500);
  });

  it("sur place : uniquement avec le QR code d'une table ; un QR régénéré invalide l'ancien", async () => {
    const o = await order({ mode: "dine_in", tableQrToken: table4.qrToken, customer: { firstName: "Awa" } });
    expect(o.table!.label).toBe("4");
    expect(o.channel).toBe("qr");
    expect(o.customerPhone).toBeNull();
    await expect(order({ mode: "dine_in", tableQrToken: "00000000-0000-0000-0000-000000000000" })).rejects.toThrow(/QR code de table invalide/);
    await expect(order({ mode: "dine_in", tableId: table4.id })).rejects.toThrow(/QR code/);
    const fresh = await withTenant(restoA, (tx) => regenerateTableQr(tx, restoA, table2.id));
    await expect(order({ mode: "dine_in", tableQrToken: table2.qrToken })).rejects.toThrow(/QR code/);
    expect((await order({ mode: "dine_in", tableQrToken: fresh.qrToken })).table!.label).toBe("2");
    table2 = fresh;
  });

  it("à emporter : téléphone requis, heure dans les horaires et après la préparation", async () => {
    await expect(order({ customer: { firstName: "Sans téléphone" } })).rejects.toThrow(/téléphone/);
    await expect(order({ requestedFor: new Date(noon.getTime() + 5 * 60_000) })).rejects.toThrow(/20 min de préparation/);
    await expect(order({ requestedFor: localToUtc(today, 23 * 60 + 30, TZ) })).rejects.toThrow(/fermé à cette heure/);
    const at = new Date(noon.getTime() + 45 * 60_000);
    expect((await order({ requestedFor: at })).requestedFor!.toISOString()).toBe(at.toISOString());
    const { slots } = await withTenant(restoA, (tx) => pickupSlots(tx, restoA, noon));
    expect(slots[0]!.minute).toBe(12 * 60 + 30); // 12:00 + 20 min, arrondi au quart d'heure
    expect(slots.at(-1)!.minute).toBe(22 * 60 + 45);
  });

  it("livraison : adresse requise, minimum de commande, frais ajoutés par le serveur", async () => {
    await expect(order({ mode: "delivery", deliveryAddress: "" })).rejects.toThrow(/adresse/);
    await expect(order({ mode: "delivery", deliveryAddress: "Sacré-Cœur 3, villa 12" })).rejects.toThrow(/Livraison à partir de 6/);
    const o = await order({ mode: "delivery", deliveryAddress: "Sacré-Cœur 3, villa 12", items: [{ dishId: thiebou, quantity: 2 }] });
    expect(o.deliveryFee).toBe(1500);
    expect(o.total).toBe(9500);
  });

  it("restaurant fermé : pas de commande en ligne ; l'équipe peut saisir", async () => {
    await expect(order({ now: localToUtc(today, 8 * 60, TZ) })).rejects.toThrow(/fermé pour le moment/);
    await withTenant(restoA, (tx) => updateRestaurantSettings(tx, restoA, { acceptDelivery: false }));
    await expect(order({ mode: "delivery", deliveryAddress: "Mermoz, rue 12", items: [{ dishId: thiebou, quantity: 2 }] })).rejects.toThrow(/livraison est fermée/);
    await withTenant(restoA, (tx) => updateRestaurantSettings(tx, restoA, { acceptDelivery: true }));
    expect((await order({ actor: staff, now: localToUtc(today, 8 * 60, TZ), channel: "phone" })).channel).toBe("phone");
  });

  it("cuisine : étapes dans l'ordre, motif obligatoire pour annuler, écran de cuisine", async () => {
    const o = await order({});
    await expect(withTenant(restoA, (tx) => advanceOrder(tx, restoA, o.id, "ready", staff))).rejects.toThrow(/Impossible/);
    for (const s of ["accepted", "preparing", "ready"] as const) await withTenant(restoA, (tx) => advanceOrder(tx, restoA, o.id, s, staff));
    const board = await withTenant(restoA, (tx) => kitchenBoard(tx, restoA));
    expect(board.find((b) => b.id === o.id)!.status).toBe("ready");
    await expect(withTenant(restoA, (tx) => advanceOrder(tx, restoA, o.id, "canceled", staff))).rejects.toThrow(/motif/);
    const done = await withTenant(restoA, (tx) => advanceOrder(tx, restoA, o.id, "completed", staff));
    expect(done.events.map((e) => e.toStatus)).toEqual(["new", "accepted", "preparing", "ready", "completed"]);
    expect(done.readyAt).not.toBeNull();
    expect((await withTenant(restoA, (tx) => kitchenBoard(tx, restoA))).some((b) => b.id === o.id)).toBe(false);
  });

  it("le client suit et annule SA commande, seulement avant l'acceptation", async () => {
    const o = await order({});
    const seen = await withTenant(restoA, (tx) => getOrderByToken(tx, restoA, o.accessToken));
    expect(seen!.id).toBe(o.id);
    expect(await withTenant(restoB, (tx) => getOrderByToken(tx, restoB, o.accessToken))).toBeNull();
    const accepted = await order({});
    await withTenant(restoA, (tx) => advanceOrder(tx, restoA, accepted.id, "accepted", staff));
    await expect(withTenant(restoA, (tx) => cancelOrderAsGuest(tx, restoA, accepted.accessToken))).rejects.toThrow(/déjà pris/);
    expect((await withTenant(restoA, (tx) => cancelOrderAsGuest(tx, restoA, o.accessToken))).status).toBe("canceled");
  });

  it("encaissements réels : pas de trop-perçu, commande payée seulement si encaissée, annulation motivée", async () => {
    const o = await order({ items: [{ dishId: thiebou, quantity: 2 }] });
    expect(paymentSummary(o.total, o.payments).state).toBe("unpaid");
    await expect(withTenant(restoA, (tx) => recordOrderPayment(tx, restoA, { orderId: o.id, amount: 9000, method: "cash", actorUserId: null }))).rejects.toThrow(/Il reste 8/);
    const p1 = await withTenant(restoA, (tx) => recordOrderPayment(tx, restoA, { orderId: o.id, amount: 5000, method: "wave", reference: "WV-1", actorUserId: null }));
    expect(p1.receiptNumber).toMatch(/^TK-\d{4}-\d{6}$/);
    await expect(withTenant(restoA, (tx) => recordOrderPayment(tx, restoA, { orderId: o.id, amount: 3000, method: "chariow", actorUserId: null }))).rejects.toThrow(/Moyen de paiement/);
    await withTenant(restoA, (tx) => recordOrderPayment(tx, restoA, { orderId: o.id, amount: 3000, method: "cash", actorUserId: null }));
    let fresh = await withTenant(restoA, (tx) => getOrderByToken(tx, restoA, o.accessToken));
    expect(paymentSummary(fresh!.total, fresh!.payments)).toEqual({ paid: 8000, due: 0, state: "paid" });
    await expect(withTenant(restoA, (tx) => advanceOrder(tx, restoA, o.id, "canceled", staff, "Client parti"))).rejects.toThrow(/encaissement est enregistré/);
    await expect(withTenant(restoA, (tx) => voidOrderPayment(tx, restoA, p1.id, ""))).rejects.toThrow(/motif/);
    await withTenant(restoA, (tx) => voidOrderPayment(tx, restoA, p1.id, "Erreur de saisie"));
    fresh = await withTenant(restoA, (tx) => getOrderByToken(tx, restoA, o.accessToken));
    expect(paymentSummary(fresh!.total, fresh!.payments).state).toBe("partial");
  });

  it("la base protège : lignes et historique immuables, montants cohérents, isolation", async () => {
    const o = await order({});
    await expect(withTenant(restoA, (tx) => tx.restaurantOrderItem.updateMany({ where: { orderId: o.id }, data: { unitPrice: 1 } }))).rejects.toThrow(/permission denied/);
    await expect(withTenant(restoA, (tx) => tx.restaurantOrderEvent.deleteMany({ where: { orderId: o.id } }))).rejects.toThrow(/permission denied/);
    await expect(withTenant(restoA, (tx) => tx.restaurantOrder.update({ where: { id: o.id }, data: { total: 1 } }))).rejects.toThrow(/RestaurantOrder_amounts_check|check constraint/);
    // Un autre restaurant ne voit rien et ne peut pas commander les plats de A.
    expect(await withTenant(restoB, (tx) => tx.restaurantOrder.findMany({ where: { id: o.id } }))).toEqual([]);
    await withTenant(restoB, (tx) => updateRestaurantSettings(tx, restoB, { openingHours: ALL_WEEK }));
    await expect(order({}, restoB)).rejects.toThrow(/plus à la carte/);
  });

  it("réservations : créneaux dans les horaires, rythme d'arrivées et places de la salle", async () => {
    const date = addDays(today, 2);
    const s = await withTenant(restoA, (tx) => bookingSlots(tx, restoA, date, 2));
    expect(s.slots[0]!.minute).toBe(11 * 60);
    expect(s.slots.at(-1)!.minute).toBe(22 * 60); // dernière arrivée 1 h avant la fermeture
    // La salle a 6 places (tables de 4 et 2) : elle borne les couverts assis.
    expect(s.slots[0]!.remaining).toBe(6);
    const b = (partySize: number, minute: number, extra = {}) =>
      withTenant(restoA, (tx) => bookTable(tx, restoA, { date, minute, partySize, customer: client(), actor: guest, ...extra }));
    const first = await b(4, 20 * 60);
    expect(first.status).toBe("confirmed");
    expect(first.quantity).toBe(4);
    await expect(b(4, 20 * 60 + 30)).rejects.toThrow(/Plus que 2 couverts/);
    await expect(b(9, 13 * 60)).rejects.toThrow(/Au-delà de 8 personnes/);
    await expect(b(2, 7 * 60)).rejects.toThrow(/pas proposé/);
    // Après la durée de la table (90 min), les places se libèrent.
    expect((await b(4, 21 * 60 + 30)).status).toBe("confirmed");
  });

  it("réservations simultanées sur les dernières places : une seule passe", async () => {
    const date = addDays(today, 3);
    const book = () => withTenant(restoA, (tx) => bookTable(tx, restoA, { date, minute: 13 * 60, partySize: 4, customer: client(), actor: guest }));
    const results = await Promise.allSettled([book(), book(), book()]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  });

  it("placement à table, arrivée, absence ; le client annule SA réservation", async () => {
    const date = addDays(today, 4);
    const r1 = await withTenant(restoA, (tx) => bookTable(tx, restoA, { date, minute: 19 * 60, partySize: 2, customer: client(), actor: guest, occasion: "Anniversaire" }));
    const r2 = await withTenant(restoA, (tx) => bookTable(tx, restoA, { date, minute: 19 * 60 + 30, partySize: 2, customer: client(), actor: guest }));
    await expect(withTenant(restoA, (tx) => assignBookingTable(tx, restoA, r1.id, table2.id))).resolves.toBeTruthy();
    await expect(withTenant(restoA, (tx) => assignBookingTable(tx, restoA, r2.id, table2.id))).rejects.toThrow(/déjà réservée/);
    const placed = await withTenant(restoA, (tx) => assignBookingTable(tx, restoA, r2.id, table4.id));
    expect(placed.tableBooking!.table!.label).toBe("4");
    await expect(withTenant(restoA, (tx) => setBookingOutcome(tx, restoA, r1.id, "canceled", staff))).rejects.toThrow(/motif/);
    expect((await withTenant(restoA, (tx) => setBookingOutcome(tx, restoA, r1.id, "arrived", staff))).status).toBe("completed");
    await expect(withTenant(restoB, (tx) => cancelBookingAsGuest(tx, restoB, r2.accessToken))).rejects.toThrow(/introuvable/);
    expect((await withTenant(restoA, (tx) => cancelBookingAsGuest(tx, restoA, r2.accessToken))).reservation.status).toBe("canceled");
  });

  it("vue d'ensemble du jour : commandes, cuisine, encaissé", async () => {
    const ov = await withTenant(restoA, (tx) => restaurantOverview(tx, restoA));
    expect(ov.ordersToday).toBeGreaterThan(5);
    expect(ov.inKitchen).toBeGreaterThan(0);
    expect(ov.collectedToday).toBe(3000); // 5 000 (annulé) + 3 000
    expect(ov.byMode.delivery).toBeGreaterThanOrEqual(1);
  });
});
