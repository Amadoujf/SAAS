import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../src/client";
import { withSuperAdminAccess, withTenant } from "../src/tenant-context";
import { testOwnerClient } from "./test-owner-client";
import { setListingStatus } from "../src/listing-registry";
import { transitionReservationStatus, AvailabilityFullError } from "../src/reservation-registry";
import { decryptSecret } from "../src/encryption";
import {
  addDeparture,
  bookDeparture,
  createTravelPackage,
  departureManifest,
  getTravelBookingByToken,
  listTravelPackages,
  recordReservationPayment,
  setTravelerDocumentStatus,
  summarizePayments,
  TravelError,
  travelOverview,
  updateTravelPackage,
  voidReservationPayment,
} from "../src/travel-registry";

/**
 * Voyage (étape 5) sur PostgreSQL RÉEL : voyages (fiche + fiche technique + programme),
 * départs, réservations nominatives (places prises atomiquement, même en concurrence),
 * pièces, encaissements (jamais au-delà du total, immuables), isolation entre agences.
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
  console.warn("[travel.test] Base de données injoignable — suite ignorée (skip).");
}

const guest = { userId: null, type: "customer" as const };
const inDays = (n: number) => new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate() + n, 7));

describe.skipIf(!databaseAvailable)("Voyage (réel, PostgreSQL)", () => {
  const suffix = Date.now();
  const sectorKey = `test-sector-travel-${suffix}`;
  let agencyA: string;
  let agencyB: string;
  let tripId: string;
  let departureId: string;
  let bookingId: string;
  let bookingToken: string;

  beforeAll(async () => {
    await withSuperAdminAccess(async (tx) => {
      await tx.sector.create({ data: { key: sectorKey, name: "Secteur de test", defaultModuleKeys: [], isSystem: false } });
      const data = (s: string) => ({ slug: `test-voyage-${s}-${suffix}`, name: `Agence ${s}`, businessType: "ECOMMERCE" as const, sectorKey, status: "ACTIVE" as const, billingExemptedAt: new Date() });
      agencyA = (await tx.tenant.create({ data: data("a") })).id;
      agencyB = (await tx.tenant.create({ data: data("b") })).id;
    });
  });

  afterAll(async () => {
    const o = testOwnerClient();
    const ids = { in: [agencyA, agencyB] };
    await o.reservationPayment.deleteMany({ where: { tenantId: ids } });
    await o.travelerDocument.deleteMany({ where: { tenantId: ids } });
    await o.reservationTraveler.deleteMany({ where: { tenantId: ids } });
    await o.reservationStatusHistory.deleteMany({ where: { tenantId: ids } });
    await o.reservation.deleteMany({ where: { tenantId: ids } });
    await o.listingAvailability.deleteMany({ where: { tenantId: ids } });
    await o.travelItineraryDay.deleteMany({ where: { tenantId: ids } });
    await o.travelPackageDetails.deleteMany({ where: { tenantId: ids } });
    await o.listingRevision.deleteMany({ where: { tenantId: ids } });
    await o.listing.deleteMany({ where: { tenantId: ids } });
    await o.customer.deleteMany({ where: { tenantId: ids } });
    await o.counter.deleteMany({ where: { tenantId: ids } });
    await o.tenant.deleteMany({ where: { id: ids } });
    await o.sector.deleteMany({ where: { key: sectorKey } });
    await o.$disconnect();
  });

  it("crée un voyage : fiche par personne, fiche technique, programme ; un départ déduit son retour de la durée", async () => {
    const trip = await withTenant(agencyA, (tx) =>
      createTravelPackage(
        tx,
        agencyA,
        {
          title: "Casamance, rivières et forêts sacrées",
          tripType: "circuit",
          destinationCountry: "Sénégal",
          destinationCity: "Ziguinchor",
          durationDays: 5,
          durationNights: 4,
          pricePerPerson: 350_000,
          included: ["hotel", "transfers", "guide", "full_board"],
          requiredDocuments: ["id_card"],
          depositPercent: 30,
          itinerary: [
            { dayNumber: 1, title: "Dakar → Ziguinchor" },
            { dayNumber: 2, title: "Bolongs en pirogue" },
          ],
        },
        null,
      ),
    );
    tripId = trip.id;
    expect(trip.priceUnit).toBe("per_person");
    expect(trip.travel?.itinerary.map((d) => d.dayNumber)).toEqual([1, 2]);
    await withTenant(agencyA, (tx) => setListingStatus(tx, agencyA, tripId, "published", null));

    const departure = await withTenant(agencyA, (tx) => addDeparture(tx, agencyA, tripId, { startDate: inDays(30), capacity: 3 }));
    departureId = departure.id;
    expect(departure.endAt!.getTime() - departure.startAt.getTime()).toBe(4 * 86_400_000);

    await expect(withTenant(agencyA, (tx) => addDeparture(tx, agencyA, tripId, { startDate: inDays(-1), capacity: 3 }))).rejects.toThrow(TravelError);
    await expect(withTenant(agencyA, (tx) => updateTravelPackage(tx, agencyA, tripId, { itinerary: [{ dayNumber: 1, title: "A" }, { dayNumber: 1, title: "B" }] }, null))).rejects.toThrow(/même jour/);
  });

  it("réserve : un voyageur par place, montant recalculé, pièces à fournir, passeport chiffré", async () => {
    const booking = await withTenant(agencyA, (tx) =>
      bookDeparture(tx, agencyA, {
        listingId: tripId,
        availabilityId: departureId,
        travelers: [
          { firstName: "Awa", lastName: "Ndiaye", passportNumber: "a 1234567" },
          { firstName: "Moussa", lastName: "Ndiaye" },
        ],
        contact: { firstName: "Awa", lastName: "Ndiaye", phone: "+221 77 111 22 33" },
        actor: guest,
      }),
    );
    bookingId = booking.id;
    bookingToken = booking.accessToken;
    expect(booking.quantity).toBe(2);
    expect(booking.totalAmount).toBe(700_000);
    const full = await withTenant(agencyA, (tx) => getTravelBookingByToken(tx, agencyA, bookingToken));
    expect(full!.travelers).toHaveLength(2);
    expect(full!.travelers[0]!.isLead).toBe(true);
    expect(full!.travelers[0]!.passportLast4).toBe("4567");
    expect(JSON.stringify(full!.travelers[0]!.passportCipher)).not.toContain("A1234567");
    expect(decryptSecret(full!.travelers[0]!.passportCipher as never)).toBe("A1234567");
    expect(full!.travelers.every((t) => t.documents.length === 1 && t.documents[0]!.status === "missing")).toBe(true);

    await expect(withTenant(agencyA, (tx) => bookDeparture(tx, agencyA, { listingId: tripId, availabilityId: departureId, travelers: [{ firstName: "X", lastName: "" }], contact: { firstName: "X", phone: "770000000" }, actor: guest }))).rejects.toThrow(TravelError);
  });

  it("dernière place : deux réservations simultanées, une seule réussit", async () => {
    const attempt = (name: string) =>
      withTenant(agencyA, (tx) => bookDeparture(tx, agencyA, { listingId: tripId, availabilityId: departureId, travelers: [{ firstName: name, lastName: "Sarr" }], contact: { firstName: name, phone: `77${name.length}000000` }, actor: guest }));
    const results = await Promise.allSettled([attempt("Fatou"), attempt("Ibrahima")]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
    expect(rejected.reason).toBeInstanceOf(AvailabilityFullError);
    const slot = await withTenant(agencyA, (tx) => tx.listingAvailability.findFirstOrThrow({ where: { id: departureId } }));
    expect(slot.reservedCount).toBe(3);
  });

  it("encaissements : jamais au-delà du total, même en concurrence ; annulation motivée ; « payé » calculé", async () => {
    const pay = (amount: number) => withTenant(agencyA, (tx) => recordReservationPayment(tx, agencyA, { reservationId: bookingId, amount, method: "wave", kind: "deposit", reference: "WAVE-1", actorUserId: null }));
    const deposit = await pay(210_000);
    expect(deposit.receiptNumber).toMatch(/^REC-\d{4}-000001$/);
    const race = await Promise.allSettled([pay(400_000), pay(400_000)]);
    expect(race.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    await expect(pay(200_000)).rejects.toThrow(/reste à payer/);

    const payments = await withTenant(agencyA, (tx) => tx.reservationPayment.findMany({ where: { reservationId: bookingId } }));
    expect(summarizePayments(700_000, 30, payments)).toMatchObject({ paid: 610_000, remaining: 90_000, state: "deposit_paid", depositDue: 210_000 });

    await expect(withTenant(agencyA, (tx) => voidReservationPayment(tx, agencyA, deposit.id, " "))).rejects.toThrow(/motif/);
    await withTenant(agencyA, (tx) => voidReservationPayment(tx, agencyA, deposit.id, "Doublon de saisie"));
    const after = await withTenant(agencyA, (tx) => tx.reservationPayment.findMany({ where: { reservationId: bookingId } }));
    expect(summarizePayments(700_000, 30, after).paid).toBe(400_000);
    // Immuable : pas de modification du montant, pas de suppression.
    await expect(withTenant(agencyA, (tx) => tx.reservationPayment.update({ where: { id: deposit.id }, data: { amount: 1 } }))).rejects.toThrow();
    await expect(withTenant(agencyA, (tx) => tx.reservationPayment.delete({ where: { id: deposit.id } }))).rejects.toThrow();
  });

  it("pièces : règles visa / autres pièces ; manifeste du départ ; indicateurs", async () => {
    const traveler = await withTenant(agencyA, (tx) => tx.reservationTraveler.findFirstOrThrow({ where: { reservationId: bookingId, position: 1 } }));
    await withTenant(agencyA, (tx) => setTravelerDocumentStatus(tx, agencyA, { travelerId: traveler.id, kind: "id_card", status: "received", actorUserId: null }));
    await expect(withTenant(agencyA, (tx) => setTravelerDocumentStatus(tx, agencyA, { travelerId: traveler.id, kind: "id_card", status: "submitted", actorUserId: null }))).rejects.toThrow(/visa/);
    await withTenant(agencyA, (tx) => setTravelerDocumentStatus(tx, agencyA, { travelerId: traveler.id, kind: "visa", status: "submitted", actorUserId: null }));

    const manifest = await withTenant(agencyA, (tx) => departureManifest(tx, agencyA, departureId));
    expect(manifest!.bookings.flatMap((b) => b.travelers)).toHaveLength(3);
    const overview = await withTenant(agencyA, (tx) => travelOverview(tx, agencyA));
    expect(overview.seatsSold).toBe(3);
    expect(overview.collectedThisMonth).toBe(400_000);
    expect(overview.balanceDue).toBe(700_000 - 400_000 + 350_000);
  });

  it("annulation : places rendues ; plus aucun encaissement possible", async () => {
    await withTenant(agencyA, (tx) => transitionReservationStatus(tx, agencyA, { reservationId: bookingId, toStatus: "canceled", actor: { userId: null, type: "owner" } }));
    const slot = await withTenant(agencyA, (tx) => tx.listingAvailability.findFirstOrThrow({ where: { id: departureId } }));
    expect(slot.reservedCount).toBe(1);
    await expect(withTenant(agencyA, (tx) => recordReservationPayment(tx, agencyA, { reservationId: bookingId, amount: 1000, method: "cash", kind: "balance", actorUserId: null }))).rejects.toThrow(/annulée/);
  });

  it("isolation : une autre agence ne voit ni les voyages, ni les voyageurs, ni les encaissements", async () => {
    const [trips, travelers, payments, byToken] = await withTenant(agencyB, async (tx) => [
      await listTravelPackages(tx, agencyB),
      await tx.reservationTraveler.count(),
      await tx.reservationPayment.count(),
      await getTravelBookingByToken(tx, agencyB, bookingToken),
    ]);
    expect(trips).toHaveLength(0);
    expect(travelers).toBe(0);
    expect(payments).toBe(0);
    expect(byToken).toBeNull();
    await expect(withTenant(agencyB, (tx) => recordReservationPayment(tx, agencyB, { reservationId: bookingId, amount: 1000, method: "cash", kind: "other", actorUserId: null }))).rejects.toThrow(/introuvable/);
  });

  it("recherche publique : filtre par mois de départ et type", async () => {
    const month = inDays(30).toISOString().slice(0, 7);
    const found = await withTenant(agencyA, (tx) => listTravelPackages(tx, agencyA, { publishedOnly: true, month, tripType: "circuit" }));
    expect(found.map((t) => t.id)).toEqual([tripId]);
    const none = await withTenant(agencyA, (tx) => listTravelPackages(tx, agencyA, { publishedOnly: true, tripType: "pilgrimage" }));
    expect(none).toHaveLength(0);
  });
});
