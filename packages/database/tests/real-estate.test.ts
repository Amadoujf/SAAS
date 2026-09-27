import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../src/client";
import { withSuperAdminAccess, withTenant } from "../src/tenant-context";
import { testOwnerClient } from "./test-owner-client";
import { setListingStatus } from "../src/listing-registry";
import {
  createLease,
  createProperty,
  endLease,
  ensureRentSchedule,
  isRentLate,
  LeaseError,
  listProperties,
  recordRentPayment,
  rentOverview,
  requestPropertyVisit,
  updateProperty,
} from "../src/real-estate-registry";

/**
 * Immobilier (étape 4) sur PostgreSQL RÉEL : biens (fiche + fiche technique), visites,
 * baux (un seul actif par bien, même en concurrence), échéancier idempotent, loyers
 * « payés » uniquement sur encaissement enregistré, isolation entre agences.
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
  console.warn("[real-estate.test] Base de données injoignable — suite ignorée (skip).");
}

const guest = { userId: null, type: "customer" as const };
const monthsAgo = (n: number) => {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - n, 1));
};

describe.skipIf(!databaseAvailable)("Immobilier (réel, PostgreSQL)", () => {
  const suffix = Date.now();
  const sectorKey = `test-sector-realestate-${suffix}`;
  let agencyA: string;
  let agencyB: string;
  let villaId: string;
  let apartmentId: string;

  beforeAll(async () => {
    await withSuperAdminAccess(async (tx) => {
      await tx.sector.create({ data: { key: sectorKey, name: "Secteur de test", defaultModuleKeys: [], isSystem: false } });
      const data = (s: string) => ({ slug: `test-immo-${s}-${suffix}`, name: `Agence ${s}`, businessType: "ECOMMERCE" as const, sectorKey, status: "ACTIVE" as const, billingExemptedAt: new Date() });
      agencyA = (await tx.tenant.create({ data: data("a") })).id;
      agencyB = (await tx.tenant.create({ data: data("b") })).id;
    });
  });

  afterAll(async () => {
    const o = testOwnerClient();
    const ids = { in: [agencyA, agencyB] };
    await o.rentPayment.deleteMany({ where: { tenantId: ids } });
    await o.lease.deleteMany({ where: { tenantId: ids } });
    await o.reservationStatusHistory.deleteMany({ where: { tenantId: ids } });
    await o.reservation.deleteMany({ where: { tenantId: ids } });
    await o.propertyDetails.deleteMany({ where: { tenantId: ids } });
    await o.listingRevision.deleteMany({ where: { tenantId: ids } });
    await o.listing.deleteMany({ where: { tenantId: ids } });
    await o.customer.deleteMany({ where: { tenantId: ids } });
    await o.counter.deleteMany({ where: { tenantId: ids } });
    await o.tenant.deleteMany({ where: { id: ids } });
    await o.sector.deleteMany({ where: { key: sectorKey } });
    await o.$disconnect();
  });

  it("crée un bien : fiche + fiche technique, unité de prix selon la transaction", async () => {
    const villa = await withTenant(agencyA, (tx) =>
      createProperty(tx, agencyA, { title: "Villa contemporaine aux Almadies", propertyType: "villa", dealType: "sale", price: 650_000_000, bedrooms: 5, bathrooms: 4, surfaceM2: 420, amenities: ["pool", "sea_view", "guard"], location: { commune: "Almadies", region: "Dakar" } }, null),
    );
    const apartment = await withTenant(agencyA, (tx) =>
      createProperty(tx, agencyA, { title: "Appartement 3 pièces Mermoz", propertyType: "apartment", dealType: "rent", price: 450_000, bedrooms: 2, surfaceM2: 95, furnished: true, location: { commune: "Mermoz" } }, null),
    );
    villaId = villa.id;
    apartmentId = apartment.id;
    expect(villa.priceUnit).toBe("total");
    expect(apartment.priceUnit).toBe("per_month");
    expect(villa.property?.amenities).toEqual(["pool", "sea_view", "guard"]);

    const updated = await withTenant(agencyA, (tx) => updateProperty(tx, agencyA, apartmentId, { price: null }, null));
    expect(updated.priceUnit).toBe("on_request");
    await withTenant(agencyA, (tx) => updateProperty(tx, agencyA, apartmentId, { price: 450_000, bedrooms: 3 }, null));
    const revisions = await withTenant(agencyA, (tx) => tx.listingRevision.count({ where: { listingId: apartmentId } }));
    expect(revisions).toBe(3);
  });

  it("refuse une fiche technique invalide (type, équipement, surface)", async () => {
    await expect(withTenant(agencyA, (tx) => createProperty(tx, agencyA, { title: "X", propertyType: "castle" as never, dealType: "sale" }, null))).rejects.toThrow(/Type de bien/);
    await expect(withTenant(agencyA, (tx) => createProperty(tx, agencyA, { title: "X", propertyType: "house", dealType: "sale", amenities: ["helipad"] }, null))).rejects.toThrow(/Équipement/);
    await expect(withTenant(agencyA, (tx) => createProperty(tx, agencyA, { title: "X", propertyType: "house", dealType: "sale", surfaceM2: -3 }, null))).rejects.toThrow(/surface/);
  });

  it("recherche : filtres typés et biens publiés uniquement pour le site", async () => {
    await withTenant(agencyA, (tx) => setListingStatus(tx, agencyA, villaId, "published", null));
    const forSite = await withTenant(agencyA, (tx) => listProperties(tx, agencyA, { publishedOnly: true }));
    expect(forSite.map((l) => l.id)).toEqual([villaId]);
    const rentals = await withTenant(agencyA, (tx) => listProperties(tx, agencyA, { dealType: "rent" }));
    expect(rentals.map((l) => l.id)).toEqual([apartmentId]);
    const big = await withTenant(agencyA, (tx) => listProperties(tx, agencyA, { minBedrooms: 4 }));
    expect(big.map((l) => l.id)).toEqual([villaId]);
    const cheap = await withTenant(agencyA, (tx) => listProperties(tx, agencyA, { maxPrice: 1_000_000 }));
    expect(cheap.map((l) => l.id)).toEqual([apartmentId]);
  });

  it("demande de visite : réservation gratuite du module visit_requests, à confirmer", async () => {
    const preferredAt = new Date(Date.now() + 3 * 86_400_000);
    const visit = await withTenant(agencyA, (tx) =>
      requestPropertyVisit(tx, agencyA, { listingId: villaId, preferredAt, customer: { firstName: "Mariama", lastName: "Ba", phone: "77 222 33 44" }, message: "Samedi matin si possible", actor: guest }),
    );
    expect(visit.moduleKey).toBe("visit_requests");
    expect(visit.status).toBe("requested");
    expect(visit.totalAmount).toBeNull();
    expect(visit.customerNote).toBe("Samedi matin si possible");
  });

  it("bail : refusé sur un bien à vendre ; crée l'échéancier et retire le bien du site", async () => {
    await expect(
      withTenant(agencyA, (tx) => createLease(tx, agencyA, { listingId: villaId, occupant: { firstName: "Test", phone: "770000001" }, startDate: monthsAgo(2), monthlyRent: 100_000 }, null)),
    ).rejects.toBeInstanceOf(LeaseError);

    await withTenant(agencyA, (tx) => setListingStatus(tx, agencyA, apartmentId, "published", null));
    const lease = await withTenant(agencyA, (tx) =>
      createLease(tx, agencyA, { listingId: apartmentId, occupant: { firstName: "Cheikh", lastName: "Mbaye", phone: "76 111 22 33" }, landlordName: "M. Diop", startDate: monthsAgo(2), monthlyRent: 450_000, charges: 25_000, depositAmount: 900_000, dueDay: 5 }, null),
    );
    expect(lease.reference).toMatch(/^BAIL-\d{4}-\d{4}$/);
    const schedule = await withTenant(agencyA, (tx) => tx.rentPayment.findMany({ where: { leaseId: lease.id }, orderBy: { dueDate: "asc" } }));
    expect(schedule).toHaveLength(4); // il y a 2 mois, le mois dernier, ce mois-ci, le mois prochain
    expect(schedule.every((p) => p.amountDue === 475_000 && p.status === "pending")).toBe(true);
    expect(isRentLate(schedule[0]!)).toBe(true);
    const listing = await withTenant(agencyA, (tx) => tx.listing.findUniqueOrThrow({ where: { id: apartmentId } }));
    expect(listing.status).toBe("unavailable");

    // Idempotent : relancer ne duplique rien.
    expect(await withTenant(agencyA, (tx) => ensureRentSchedule(tx, agencyA, lease.id, new Date()))).toBe(0);
  });

  it("CONCURRENCE RÉELLE : deux baux simultanés sur le même bien — un seul réussit", async () => {
    const studio = await withTenant(agencyA, (tx) => createProperty(tx, agencyA, { title: "Studio Point E", propertyType: "apartment", dealType: "rent", price: 200_000 }, null));
    const attempts = await Promise.allSettled([0, 1].map((i) =>
      withTenant(agencyA, (tx) => createLease(tx, agencyA, { listingId: studio.id, occupant: { firstName: `Locataire ${i}`, phone: `7800000${i}0` }, startDate: monthsAgo(0), monthlyRent: 200_000 }, null)),
    ));
    expect(attempts.filter((a) => a.status === "fulfilled")).toHaveLength(1);
    const rejected = attempts.find((a): a is PromiseRejectedResult => a.status === "rejected");
    expect(rejected?.reason).toBeInstanceOf(LeaseError);
    expect(await withTenant(agencyA, (tx) => tx.lease.count({ where: { listingId: studio.id, status: "active" } }))).toBe(1);
  });

  it("loyer : partiel reste dû, complet → payé avec quittance ; jamais au-delà du dû ni deux fois", async () => {
    const payment = await withTenant(agencyA, (tx) => tx.rentPayment.findFirstOrThrow({ where: { tenantId: agencyA, lease: { listingId: apartmentId } }, orderBy: { dueDate: "asc" } }));
    const partial = await withTenant(agencyA, (tx) => recordRentPayment(tx, agencyA, { rentPaymentId: payment.id, amountPaid: 200_000, method: "wave", paymentReference: "WV-123" }, null));
    expect(partial.status).toBe("pending");
    expect(partial.amountPaid).toBe(200_000);
    await expect(withTenant(agencyA, (tx) => recordRentPayment(tx, agencyA, { rentPaymentId: payment.id, amountPaid: 300_000, method: "cash" }, null))).rejects.toThrow(/dépasse/);
    const paid = await withTenant(agencyA, (tx) => recordRentPayment(tx, agencyA, { rentPaymentId: payment.id, amountPaid: 275_000, method: "cash" }, null));
    expect(paid.status).toBe("paid");
    expect(paid.receiptNumber).toMatch(/^QUIT-\d{4}-\d{6}$/);
    await expect(withTenant(agencyA, (tx) => recordRentPayment(tx, agencyA, { rentPaymentId: payment.id, amountPaid: 1, method: "cash" }, null))).rejects.toThrow(/déjà/);
  });

  it("la base refuse un loyer « payé » sans encaissement enregistré (même en contournant le registre)", async () => {
    const pending = await withTenant(agencyA, (tx) => tx.rentPayment.findFirstOrThrow({ where: { tenantId: agencyA, status: "pending", amountPaid: 0 } }));
    await expect(withTenant(agencyA, (tx) => tx.rentPayment.update({ where: { id: pending.id }, data: { status: "paid" } }))).rejects.toThrow();
  });

  it("vue d'ensemble des loyers et fin de bail (échéances futures annulées, dettes passées conservées)", async () => {
    const overview = await withTenant(agencyA, (tx) => rentOverview(tx, agencyA));
    expect(overview.activeLeases).toBe(2);
    expect(overview.lateCount).toBeGreaterThanOrEqual(1);
    expect(overview.lateAmount).toBeGreaterThan(0);

    const lease = await withTenant(agencyA, (tx) => tx.lease.findFirstOrThrow({ where: { listingId: apartmentId, status: "active" } }));
    const endDate = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1));
    await withTenant(agencyA, (tx) => endLease(tx, agencyA, lease.id, { endDate, status: "ended" }, null));
    const payments = await withTenant(agencyA, (tx) => tx.rentPayment.findMany({ where: { leaseId: lease.id } }));
    expect(payments.filter((p) => p.dueDate > endDate).every((p) => p.status === "canceled")).toBe(true);
    expect(payments.some((p) => p.dueDate < endDate && p.status === "pending")).toBe(true); // dette conservée
    await expect(withTenant(agencyA, (tx) => endLease(tx, agencyA, lease.id, { endDate, status: "ended" }, null))).rejects.toBeInstanceOf(LeaseError);
  });

  it("isolation : une autre agence ne voit ni les biens, ni les baux, ni les loyers", async () => {
    const seen = await withTenant(agencyB, async (tx) => ({
      properties: await tx.propertyDetails.count(),
      leases: await tx.lease.count(),
      rents: await tx.rentPayment.count(),
      listed: await listProperties(tx, agencyB, {}),
    }));
    expect(seen).toEqual({ properties: 0, leases: 0, rents: 0, listed: [] });
    await expect(
      withTenant(agencyB, (tx) => createLease(tx, agencyB, { listingId: apartmentId, occupant: { firstName: "Intrus", phone: "770009999" }, startDate: new Date(), monthlyRent: 1 }, null)),
    ).rejects.toBeInstanceOf(LeaseError);
  });
});
