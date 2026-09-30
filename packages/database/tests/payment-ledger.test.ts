import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../src/client";
import { withSuperAdminAccess, withTenant } from "../src/tenant-context";
import { testOwnerClient } from "./test-owner-client";
import { createListing } from "../src/listing-registry";
import { createReservation } from "../src/reservation-registry";
import { recordReservationPayment } from "../src/travel-registry";
import { createDish, createSection, placeOrder, recordOrderPayment, updateRestaurantSettings } from "../src/restaurant-registry";
import { listTenantPayments } from "../src/payment-ledger";
import { localToUtc } from "../src/service-slots";

/**
 * Service commun des encaissements (réel, PostgreSQL) : une seule série de reçus par
 * entreprise, que l'argent vienne d'une commande du restaurant ou d'une réservation ;
 * journal unifié ; moyens de paiement contrôlés par la base sur les deux tables.
 */
let databaseAvailable = true;
try {
  await prisma.$queryRaw`SELECT 1`;
} catch (error) {
  if (process.env.REQUIRE_DB_TESTS === "true") throw new Error(`REQUIRE_DB_TESTS=true mais PostgreSQL est injoignable : ${error instanceof Error ? error.message : String(error)}`);
  databaseAvailable = false;
}

describe.skipIf(!databaseAvailable)("Encaissements : service commun (réel, PostgreSQL)", () => {
  const suffix = Date.now();
  const sectorKey = `test-sector-ledger-${suffix}`;
  let t: string;
  let other: string;
  const staff = { userId: null, type: "employee" as const };

  beforeAll(async () => {
    await withSuperAdminAccess(async (tx) => {
      await tx.sector.create({ data: { key: sectorKey, name: "Secteur de test", defaultModuleKeys: [], isSystem: false } });
      const d = (s: string) => ({ slug: `test-ledger-${s}-${suffix}`, name: `Ledger ${s}`, businessType: "ECOMMERCE" as const, sectorKey, status: "ACTIVE" as const, billingExemptedAt: new Date(), timezone: "Africa/Dakar" });
      t = (await tx.tenant.create({ data: d("a") })).id;
      other = (await tx.tenant.create({ data: d("b") })).id;
    });
  });

  afterAll(async () => {
    const o = testOwnerClient();
    const ids = { in: [t, other] };
    await o.restaurantPayment.deleteMany({ where: { tenantId: ids } });
    await o.restaurantOrderEvent.deleteMany({ where: { tenantId: ids } });
    await o.restaurantOrderItem.deleteMany({ where: { tenantId: ids } });
    await o.restaurantOrder.deleteMany({ where: { tenantId: ids } });
    await o.reservationPayment.deleteMany({ where: { tenantId: ids } });
    await o.reservationStatusHistory.deleteMany({ where: { tenantId: ids } });
    await o.reservation.deleteMany({ where: { tenantId: ids } });
    await o.listingRevision.deleteMany({ where: { tenantId: ids } });
    await o.listing.deleteMany({ where: { tenantId: ids } });
    await o.dish.deleteMany({ where: { tenantId: ids } });
    await o.menuSection.deleteMany({ where: { tenantId: ids } });
    await o.restaurantSettings.deleteMany({ where: { tenantId: ids } });
    await o.customer.deleteMany({ where: { tenantId: ids } });
    await o.counter.deleteMany({ where: { tenantId: ids } });
    await o.tenant.deleteMany({ where: { id: ids } });
    await o.sector.deleteMany({ where: { key: sectorKey } });
    await o.$disconnect();
  });

  it("une seule série de reçus, un journal unifié, aucun mélange entre entreprises", async () => {
    const today = new Date().toISOString().slice(0, 10);
    const order = await withTenant(t, async (tx) => {
      await updateRestaurantSettings(tx, t, { openingHours: Array.from({ length: 7 }, (_, weekday) => ({ weekday, startMinute: 0, endMinute: 1440 })) });
      const section = await createSection(tx, t, { name: "Plats" });
      const dish = await createDish(tx, t, { sectionId: section.id, name: "Yassa", price: 3500 });
      return placeOrder(tx, t, { mode: "takeaway", items: [{ dishId: dish!.id, quantity: 2 }], customer: { firstName: "Awa", phone: "77 100 20 30" }, actor: { userId: null, type: "customer" }, now: localToUtc(today, 12 * 60, "Africa/Dakar") });
    });
    const reservation = await withTenant(t, async (tx) => {
      const l = await createListing(tx, t, { moduleKey: "listings", type: "property", title: "Prestation", price: 20_000 }, null);
      await tx.listing.update({ where: { id: l.id }, data: { status: "published" } });
      return createReservation(tx, t, { listingId: l.id, requestedStartAt: new Date(Date.now() + 86_400_000), customer: { firstName: "Moussa", phone: "77 200 30 40" }, actor: staff });
    });
    const p1 = await withTenant(t, (tx) => recordOrderPayment(tx, t, { orderId: order.id, amount: 7000, method: "free_money", actorUserId: null }));
    const p2 = await withTenant(t, (tx) => recordReservationPayment(tx, t, { reservationId: reservation.id, amount: 5000, method: "card_terminal", kind: "deposit", actorUserId: null }));
    const n = (r: string) => Number(r.split("-")[2]);
    expect(p1.receiptNumber).toMatch(/^REC-\d{4}-\d{6}$/);
    expect(p2.receiptNumber).toMatch(/^REC-\d{4}-\d{6}$/);
    expect(n(p2.receiptNumber)).toBe(n(p1.receiptNumber) + 1);
    const ledger = await withTenant(t, (tx) => listTenantPayments(tx, t));
    expect(ledger.map((e) => e.source).sort()).toEqual(["reservation", "restaurant_order"]);
    expect(ledger.every((e) => e.channel === "manual")).toBe(true);
    expect(await withTenant(other, (tx) => listTenantPayments(tx, other))).toHaveLength(0);
    // Un moyen de paiement inconnu est refusé par la base elle-même (contrainte CHECK),
    // sur les deux tables — vérifié avec le rôle propriétaire, qui n'est pas soumis aux
    // droits restreints de l'application.
    const o = testOwnerClient();
    await expect(o.restaurantPayment.update({ where: { id: p1.id }, data: { method: "card" } })).rejects.toThrow(/RestaurantPayment_method_check/);
    await expect(o.reservationPayment.update({ where: { id: p2.id }, data: { method: "paydunya_online" } })).rejects.toThrow(/ReservationPayment_method_check/);
    await o.$disconnect();
  });
});
