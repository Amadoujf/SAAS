import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../src/client";
import { withSuperAdminAccess, withTenant } from "../src/tenant-context";
import { testOwnerClient } from "./test-owner-client";
import {
  addAvailability,
  createListing,
  deleteListing,
  InvalidListingTransitionError,
  ListingHasActiveReservationsError,
  setAvailabilityCapacity,
  setListingStatus,
  updateListing,
  InvalidAvailabilityError,
} from "../src/listing-registry";
import {
  AvailabilityFullError,
  cancelReservationByCustomer,
  computeReservationAmount,
  createReservation,
  getReservationByAccessToken,
  InvalidReservationTransitionError,
  ReservationUnavailableError,
  transitionReservationStatus,
} from "../src/reservation-registry";
import { countQuotaUsage, QuotaExceededError } from "../src/subscription-usage";

/**
 * Primitives Listing / Reservation (étape 3, docs/04 §4.5.2) sur PostgreSQL RÉEL :
 * isolation RLS entre entreprises, clés étrangères « même entreprise », historiques
 * immuables, quota « fiches », prix recalculé par le serveur, concurrence réelle sur
 * la dernière place et sur la double annulation. Même politique que les autres suites
 * DB : ignorée en local sans PostgreSQL, obligatoire en CI via REQUIRE_DB_TESTS.
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
  console.warn("[listing-reservation.test] Base de données injoignable — suite ignorée (skip).");
}

const owner = { userId: null, type: "owner" as const };
const guest = { userId: null, type: "customer" as const };
const inDays = (d: number) => new Date(Date.now() + d * 86_400_000);

describe.skipIf(!databaseAvailable)("Listing / Reservation (réel, PostgreSQL)", () => {
  const suffix = Date.now();
  const sectorKey = `test-sector-listings-${suffix}`;
  let tenantAId: string;
  let tenantBId: string;

  beforeAll(async () => {
    await withSuperAdminAccess(async (tx) => {
      await tx.sector.create({ data: { key: sectorKey, name: "Secteur de test", defaultModuleKeys: [], isSystem: false } });
      // A : dérogation Super Admin (illimité). B : quota explicite de 1 fiche.
      tenantAId = (await tx.tenant.create({ data: { slug: `test-listings-a-${suffix}`, name: "Agence A", businessType: "ECOMMERCE", sectorKey, status: "ACTIVE", billingExemptedAt: new Date() } })).id;
      tenantBId = (await tx.tenant.create({ data: { slug: `test-listings-b-${suffix}`, name: "Agence B", businessType: "ECOMMERCE", sectorKey, status: "ACTIVE" } })).id;
      await tx.subscriptionEntitlement.create({ data: { tenantId: tenantBId, resourceKey: "records", limitValue: 1, reason: "test" } });
    });
  });

  afterAll(async () => {
    const ownerClient = testOwnerClient();
    const ids = [tenantAId, tenantBId];
    await ownerClient.reservationStatusHistory.deleteMany({ where: { tenantId: { in: ids } } });
    await ownerClient.reservation.deleteMany({ where: { tenantId: { in: ids } } });
    await ownerClient.listingAvailability.deleteMany({ where: { tenantId: { in: ids } } });
    await ownerClient.listingRevision.deleteMany({ where: { tenantId: { in: ids } } });
    await ownerClient.listing.deleteMany({ where: { tenantId: { in: ids } } });
    await ownerClient.customer.deleteMany({ where: { tenantId: { in: ids } } });
    await ownerClient.counter.deleteMany({ where: { tenantId: { in: ids } } });
    await ownerClient.subscriptionEntitlement.deleteMany({ where: { tenantId: { in: ids } } });
    await ownerClient.tenant.deleteMany({ where: { id: { in: ids } } });
    await ownerClient.sector.deleteMany({ where: { key: sectorKey } });
    await ownerClient.$disconnect();
  });

  it("crée une fiche avec une révision, slug unique par entreprise, transitions gardées", async () => {
    const [first, second] = await withTenant(tenantAId, async (tx) => [
      await createListing(tx, tenantAId, { moduleKey: "properties", type: "property", title: "Villa aux Almadies", price: 450_000_000 }, null),
      await createListing(tx, tenantAId, { moduleKey: "properties", type: "property", title: "Villa aux Almadies" }, null),
    ]);
    expect(first!.slug).toBe("villa-aux-almadies");
    expect(second!.slug).toBe("villa-aux-almadies-2");
    expect(first!.status).toBe("draft");

    await withTenant(tenantAId, async (tx) => {
      await updateListing(tx, tenantAId, first!.id, { price: 430_000_000 }, null);
      await setListingStatus(tx, tenantAId, first!.id, "published", null);
      await expect(setListingStatus(tx, tenantAId, second!.id, "unavailable", null)).rejects.toBeInstanceOf(InvalidListingTransitionError);
    });
    const revisions = await withTenant(tenantAId, (tx) => tx.listingRevision.findMany({ where: { listingId: first!.id }, orderBy: { changedAt: "asc" } }));
    expect(revisions).toHaveLength(3); // création, prix, publication
    expect((revisions[1]!.snapshot as { price: number }).price).toBe(430_000_000);
  });

  it("historique de fiche IMMUABLE : le rôle applicatif ne peut ni modifier ni effacer une révision", async () => {
    const revision = await withTenant(tenantAId, (tx) => tx.listingRevision.findFirstOrThrow({ where: { tenantId: tenantAId } }));
    await expect(withTenant(tenantAId, (tx) => tx.listingRevision.update({ where: { id: revision.id }, data: { changedBy: "pirate" } }))).rejects.toThrow();
    await expect(withTenant(tenantAId, (tx) => tx.listingRevision.delete({ where: { id: revision.id } }))).rejects.toThrow();
  });

  it("quota « fiches » : compte les fiches non supprimées et bloque au-delà de la formule", async () => {
    await withTenant(tenantBId, (tx) => createListing(tx, tenantBId, { moduleKey: "travel_offers", type: "travel_package", title: "Circuit Casamance" }, null));
    expect(await withTenant(tenantBId, (tx) => countQuotaUsage(tx, tenantBId, "records"))).toBe(1);
    await expect(
      withTenant(tenantBId, (tx) => createListing(tx, tenantBId, { moduleKey: "travel_offers", type: "travel_package", title: "Omra 2027" }, null)),
    ).rejects.toBeInstanceOf(QuotaExceededError);
  });

  it("RLS : une entreprise ne voit ni les fiches, ni les créneaux, ni les réservations d'une autre", async () => {
    const aListing = await withTenant(tenantAId, (tx) => tx.listing.findFirstOrThrow({ where: { tenantId: tenantAId } }));
    const fromB = await withTenant(tenantBId, (tx) => tx.listing.findMany({ where: { id: aListing.id } }));
    expect(fromB).toHaveLength(0);
    const allSeenByB = await withTenant(tenantBId, (tx) => tx.listing.findMany());
    expect(allSeenByB.every((l) => l.tenantId === tenantBId)).toBe(true);
    // B ne peut pas davantage écrire une ligne au nom de A.
    await expect(
      withTenant(tenantBId, (tx) => tx.listing.create({ data: { tenantId: tenantAId, moduleKey: "x", type: "property", title: "Intrus", slug: `intrus-${suffix}` } })),
    ).rejects.toThrow();
  });

  it("une réservation de B ne peut jamais pointer vers la fiche de A (clé étrangère « même entreprise »)", async () => {
    const aListing = await withTenant(tenantAId, (tx) => tx.listing.findFirstOrThrow({ where: { tenantId: tenantAId, status: "published" } }));
    await expect(
      withTenant(tenantBId, (tx) =>
        createReservation(tx, tenantBId, { listingId: aListing.id, requestedStartAt: inDays(3), customer: { firstName: "Awa", phone: "771234567" }, actor: guest }),
      ),
    ).rejects.toBeInstanceOf(ReservationUnavailableError);
    // Même en contournant le registre, la base refuse (composite FK tenantId + listingId).
    const bCustomer = await withTenant(tenantBId, (tx) => tx.customer.create({ data: { tenantId: tenantBId, firstName: "Test", phone: `+22170${String(suffix).slice(-7)}` } }));
    await expect(
      withSuperAdminAccess((tx) =>
        tx.reservation.create({ data: { tenantId: tenantBId, reference: `X-${suffix}`, listingId: aListing.id, customerId: bCustomer.id, moduleKey: "x", startAt: inDays(3) } }),
      ),
    ).rejects.toThrow();
  });

  it("prix recalculé par le serveur selon l'unité (par personne, sur devis)", () => {
    expect(computeReservationAmount(350_000, "per_person", 3)).toEqual({ unitPrice: 350_000, totalAmount: 1_050_000 });
    expect(computeReservationAmount(35_000, "per_night", 4)).toEqual({ unitPrice: 35_000, totalAmount: 140_000 });
    expect(computeReservationAmount(450_000, "per_month", 2)).toEqual({ unitPrice: 450_000, totalAmount: 450_000 });
    expect(computeReservationAmount(null, "total", 1)).toEqual({ unitPrice: null, totalAmount: null });
    expect(computeReservationAmount(10_000, "on_request", 1)).toEqual({ unitPrice: null, totalAmount: null });
  });

  it("réservation sur un créneau : montant du créneau × places, référence séquentielle, historique", async () => {
    const { listing, slot } = await withTenant(tenantAId, async (tx) => {
      const listing = await createListing(tx, tenantAId, { moduleKey: "travel_offers", type: "travel_package", title: "Saint-Louis 3 jours", price: 150_000, priceUnit: "per_person" }, null);
      await setListingStatus(tx, tenantAId, listing.id, "published", null);
      const slot = await addAvailability(tx, tenantAId, listing.id, { startAt: inDays(10), endAt: inDays(13), capacity: 5, priceOverride: 175_000 });
      return { listing, slot };
    });
    const reservation = await withTenant(tenantAId, (tx) =>
      createReservation(tx, tenantAId, { listingId: listing.id, availabilityId: slot.id, quantity: 2, customer: { firstName: "Moussa", phone: "77 555 44 33" }, actor: guest }),
    );
    expect(reservation.reference).toMatch(/^RES-\d{4}-\d{6}$/);
    expect(reservation.unitPrice).toBe(175_000);
    expect(reservation.totalAmount).toBe(350_000);
    expect(reservation.status).toBe("requested");
    const after = await withTenant(tenantAId, (tx) => tx.listingAvailability.findUniqueOrThrow({ where: { id: slot.id } }));
    expect(after.reservedCount).toBe(2);
    await expect(withTenant(tenantAId, (tx) => setAvailabilityCapacity(tx, tenantAId, slot.id, 1))).rejects.toBeInstanceOf(InvalidAvailabilityError);
  });

  it("une fiche non publiée n'est pas réservable depuis le site public", async () => {
    const draft = await withTenant(tenantAId, (tx) => createListing(tx, tenantAId, { moduleKey: "services", type: "service_offering", title: "Tresses", price: 15_000 }, null));
    await expect(
      withTenant(tenantAId, (tx) => createReservation(tx, tenantAId, { listingId: draft.id, requestedStartAt: inDays(2), customer: { firstName: "Fatou", phone: "781112233" }, actor: guest })),
    ).rejects.toBeInstanceOf(ReservationUnavailableError);
  });

  it("CONCURRENCE RÉELLE : 4 clients visent la dernière place — un seul l'obtient, jamais de surréservation", async () => {
    const { listingId, slotId } = await withTenant(tenantAId, async (tx) => {
      const listing = await createListing(tx, tenantAId, { moduleKey: "services", type: "service_offering", title: "Coupe homme", price: 5_000, priceUnit: "per_session" }, null);
      await setListingStatus(tx, tenantAId, listing.id, "published", null);
      const slot = await addAvailability(tx, tenantAId, listing.id, { startAt: inDays(1), capacity: 1 });
      return { listingId: listing.id, slotId: slot.id };
    });
    const attempts = await Promise.allSettled(
      [0, 1, 2, 3].map((i) =>
        withTenant(tenantAId, (tx) =>
          createReservation(tx, tenantAId, { listingId, availabilityId: slotId, customer: { firstName: `Client ${i}`, phone: `76000000${i}` }, actor: guest }),
        ),
      ),
    );
    expect(attempts.filter((a) => a.status === "fulfilled")).toHaveLength(1);
    const failures = attempts.filter((a): a is PromiseRejectedResult => a.status === "rejected");
    expect(failures).toHaveLength(3);
    expect(failures.every((f) => f.reason instanceof AvailabilityFullError)).toBe(true);
    const slot = await withTenant(tenantAId, (tx) => tx.listingAvailability.findUniqueOrThrow({ where: { id: slotId } }));
    expect(slot.reservedCount).toBe(1);
  });

  it("CONCURRENCE RÉELLE : double annulation simultanée — les places ne sont rendues qu'une fois", async () => {
    const { reservation, slotId } = await withTenant(tenantAId, async (tx) => {
      const listing = await createListing(tx, tenantAId, { moduleKey: "travel_offers", type: "travel_package", title: "Île de Gorée", price: 25_000, priceUnit: "per_person" }, null);
      await setListingStatus(tx, tenantAId, listing.id, "published", null);
      const slot = await addAvailability(tx, tenantAId, listing.id, { startAt: inDays(5), capacity: 10 });
      const reservation = await createReservation(tx, tenantAId, { listingId: listing.id, availabilityId: slot.id, quantity: 3, customer: { firstName: "Ndèye", phone: "775556677" }, actor: guest });
      return { reservation, slotId: slot.id };
    });
    const attempts = await Promise.allSettled([0, 1].map(() =>
      withTenant(tenantAId, (tx) => transitionReservationStatus(tx, tenantAId, { reservationId: reservation.id, toStatus: "canceled", actor: owner })),
    ));
    const changed = attempts.filter((a) => a.status === "fulfilled" && a.value.changed);
    expect(changed).toHaveLength(1);
    const slot = await withTenant(tenantAId, (tx) => tx.listingAvailability.findUniqueOrThrow({ where: { id: slotId } }));
    expect(slot.reservedCount).toBe(0);
    const history = await withTenant(tenantAId, (tx) => tx.reservationStatusHistory.findMany({ where: { reservationId: reservation.id } }));
    expect(history.map((h) => h.toStatus)).toEqual(["requested", "canceled"]);
    await expect(
      withTenant(tenantAId, (tx) => transitionReservationStatus(tx, tenantAId, { reservationId: reservation.id, toStatus: "confirmed", actor: owner })),
    ).rejects.toBeInstanceOf(InvalidReservationTransitionError);
  });

  it("accès invité : le jeton ne donne accès qu'à SA réservation, dans SON entreprise ; annulation par le client", async () => {
    const reservation = await withTenant(tenantAId, async (tx) => {
      const listing = await tx.listing.findFirstOrThrow({ where: { tenantId: tenantAId, title: "Villa aux Almadies", status: "published" } });
      return createReservation(tx, tenantAId, { listingId: listing.id, requestedStartAt: inDays(4), pricing: "none", customer: { firstName: "Ibrahima", phone: "709998877" }, customerNote: "Visite samedi matin", actor: guest });
    });
    expect(reservation.totalAmount).toBeNull();
    expect(await withTenant(tenantAId, (tx) => getReservationByAccessToken(tx, tenantAId, reservation.accessToken))).not.toBeNull();
    expect(await withTenant(tenantAId, (tx) => getReservationByAccessToken(tx, tenantAId, "00000000-0000-0000-0000-000000000000"))).toBeNull();
    // Le bon jeton, mais depuis une AUTRE entreprise : rien.
    expect(await withTenant(tenantBId, (tx) => getReservationByAccessToken(tx, tenantBId, reservation.accessToken))).toBeNull();

    const { reservation: canceled } = await withTenant(tenantAId, (tx) => cancelReservationByCustomer(tx, tenantAId, reservation.accessToken));
    expect(canceled.status).toBe("canceled");
  });

  it("une fiche avec des réservations à venir ne peut pas être supprimée ; sans elles, elle sort du quota", async () => {
    const { listingId } = await withTenant(tenantAId, async (tx) => {
      const listing = await createListing(tx, tenantAId, { moduleKey: "services", type: "service_offering", title: "Manucure", price: 8_000, priceUnit: "per_session" }, null);
      await setListingStatus(tx, tenantAId, listing.id, "published", null);
      const r = await createReservation(tx, tenantAId, { listingId: listing.id, requestedStartAt: inDays(2), customer: { firstName: "Aïssatou", phone: "784445566" }, actor: guest });
      return { listingId: listing.id, reservationId: r.id };
    });
    await expect(withTenant(tenantAId, (tx) => deleteListing(tx, tenantAId, listingId, null))).rejects.toBeInstanceOf(ListingHasActiveReservationsError);

    const before = await withTenant(tenantAId, (tx) => countQuotaUsage(tx, tenantAId, "records"));
    await withTenant(tenantAId, async (tx) => {
      const r = await tx.reservation.findFirstOrThrow({ where: { listingId } });
      await transitionReservationStatus(tx, tenantAId, { reservationId: r.id, toStatus: "canceled", actor: owner });
      await deleteListing(tx, tenantAId, listingId, null);
    });
    expect(await withTenant(tenantAId, (tx) => countQuotaUsage(tx, tenantAId, "records"))).toBe(before - 1);
  });
});
