import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../src/client";
import { withSuperAdminAccess, withTenant } from "../src/tenant-context";
import { testOwnerClient } from "./test-owner-client";
import { setListingStatus } from "../src/listing-registry";
import { transitionReservationStatus } from "../src/reservation-registry";
import { recordReservationPayment } from "../src/travel-registry";
import { addDays } from "../src/service-slots";
import {
  addRoom,
  bookStay,
  cancelStayAsGuest,
  changeStay,
  checkIn,
  checkOut,
  createRoomType,
  HotelError,
  hotelOverview,
  hotelPlanning,
  listRoomTypes,
  roomTypeCalendar,
  searchAvailability,
  setRate,
  setRoomHousekeeping,
  updateHotelSettings,
} from "../src/hotel-registry";

/**
 * Hôtels (étape 7) sur PostgreSQL RÉEL : types, chambres, tarifs par période, séjours
 * sans surréservation (même en concurrence), capacité, arrivée/départ, ménage,
 * annulation par le client, isolation entre établissements.
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
  console.warn("[hotel.test] Base de données injoignable — suite ignorée (skip).");
}

const guest = { userId: null, type: "customer" as const };
const staffActor = { userId: null, type: "employee" as const };
const today = new Date().toISOString().slice(0, 10); // établissements de test à Dakar (UTC+0)
const d = (n: number) => addDays(today, n);
let phoneSeq = 0;
const client = () => ({ firstName: "Client", phone: `77${String(4_000_000 + ++phoneSeq + Math.floor(Math.random() * 1000) * 100).padStart(7, "0")}` });

describe.skipIf(!databaseAvailable)("Hôtels (réel, PostgreSQL)", () => {
  const suffix = Date.now();
  const sectorKey = `test-sector-hotel-${suffix}`;
  let hotelA: string;
  let hotelB: string;
  let doubleId: string;
  let suiteId: string;
  let r101: string;
  let r102: string;
  let r201: string;

  beforeAll(async () => {
    await withSuperAdminAccess(async (tx) => {
      await tx.sector.create({ data: { key: sectorKey, name: "Secteur de test", defaultModuleKeys: [], isSystem: false } });
      const data = (s: string) => ({ slug: `test-hotel-${s}-${suffix}`, name: `Hôtel ${s}`, businessType: "ECOMMERCE" as const, sectorKey, status: "ACTIVE" as const, billingExemptedAt: new Date(), timezone: "Africa/Dakar" });
      hotelA = (await tx.tenant.create({ data: data("a") })).id;
      hotelB = (await tx.tenant.create({ data: data("b") })).id;
    });
    await withTenant(hotelA, async (tx) => {
      doubleId = (await createRoomType(tx, hotelA, { title: "Chambre double", nightlyPrice: 40_000, maxAdults: 2, maxChildren: 1, bedSummary: "1 grand lit", amenities: ["wifi", "air_conditioning"] }, null)).id;
      suiteId = (await createRoomType(tx, hotelA, { title: "Suite", nightlyPrice: 90_000, maxAdults: 4, bedSummary: "2 grands lits", minNights: 2 }, null)).id;
      r101 = (await addRoom(tx, hotelA, { listingId: doubleId, number: "101" })).id;
      r102 = (await addRoom(tx, hotelA, { listingId: doubleId, number: "102" })).id;
      r201 = (await addRoom(tx, hotelA, { listingId: suiteId, number: "201" })).id;
      await setListingStatus(tx, hotelA, doubleId, "published", null);
      await setListingStatus(tx, hotelA, suiteId, "published", null);
      // Haute saison sur la 2e nuit à partir de J+11.
      await setRate(tx, hotelA, { listingId: doubleId, startDate: d(11), endDate: d(12), nightlyPrice: 55_000, label: "Fête" });
    });
  });

  afterAll(async () => {
    const o = testOwnerClient();
    const ids = { in: [hotelA, hotelB] };
    await o.reservationPayment.deleteMany({ where: { tenantId: ids } });
    await o.hotelStay.deleteMany({ where: { tenantId: ids } });
    await o.reservationStatusHistory.deleteMany({ where: { tenantId: ids } });
    await o.reservation.deleteMany({ where: { tenantId: ids } });
    await o.roomRate.deleteMany({ where: { tenantId: ids } });
    await o.hotelRoom.deleteMany({ where: { tenantId: ids } });
    await o.hotelSettings.deleteMany({ where: { tenantId: ids } });
    await o.roomTypeDetails.deleteMany({ where: { tenantId: ids } });
    await o.listingRevision.deleteMany({ where: { tenantId: ids } });
    await o.listing.deleteMany({ where: { tenantId: ids } });
    await o.customer.deleteMany({ where: { tenantId: ids } });
    await o.counter.deleteMany({ where: { tenantId: ids } });
    await o.tenant.deleteMany({ where: { id: ids } });
    await o.sector.deleteMany({ where: { key: sectorKey } });
    await o.$disconnect();
  });

  const book = (extra: Partial<Parameters<typeof bookStay>[2]> & { arrival: string; departure: string }) =>
    withTenant(hotelA, (tx) => bookStay(tx, hotelA, { listingId: doubleId, adults: 2, customer: client(), actor: guest, channel: "web", ...extra }));

  it("prix calculé nuit par nuit, tarif de période compris", async () => {
    const r = await withTenant(hotelA, (tx) => searchAvailability(tx, hotelA, { arrival: d(10), departure: d(13), adults: 2, public: true }));
    const double = r.results.find((x) => x.listing.id === doubleId)!;
    expect(double.nights).toBe(3);
    expect(double.nightly!.map((n) => n.price)).toEqual([40_000, 55_000, 40_000]);
    expect(double.total).toBe(135_000);
    expect(double.freeCount).toBe(2);
    const suite = r.results.find((x) => x.listing.id === suiteId)!;
    expect(suite.bookable).toBe(true);
    const oneNight = await withTenant(hotelA, (tx) => searchAvailability(tx, hotelA, { arrival: d(10), departure: d(11), adults: 2, public: true }));
    expect(oneNight.results.find((x) => x.listing.id === suiteId)!.reason).toBe("min_nights:2");
  });

  it("réserve une chambre précise au prix du serveur ; plus de chambre = refus", async () => {
    const s1 = await book({ arrival: d(10), departure: d(13) });
    expect(s1!.status).toBe("confirmed");
    expect(s1!.totalAmount).toBe(135_000);
    expect(s1!.quantity).toBe(3);
    const s2 = await book({ arrival: d(11), departure: d(12) });
    expect(new Set([s1!.stay!.roomId, s2!.stay!.roomId])).toEqual(new Set([r101, r102]));
    await expect(book({ arrival: d(11), departure: d(13) })).rejects.toThrow(/Plus aucune chambre/);
    // Le jour du départ reste libre pour une arrivée.
    expect((await book({ arrival: d(13), departure: d(14) }))!.status).toBe("confirmed");
  });

  it("réservations simultanées de la dernière chambre : une seule passe", async () => {
    const results = await Promise.allSettled([book({ arrival: d(20), departure: d(22), listingId: suiteId }), book({ arrival: d(20), departure: d(22), listingId: suiteId }), book({ arrival: d(21), departure: d(23), listingId: suiteId })]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  });

  it("la base refuse d'elle-même deux séjours qui se chevauchent dans une chambre", async () => {
    await expect(
      withTenant(hotelA, async (tx) => {
        const other = await tx.hotelStay.findFirstOrThrow({ where: { tenantId: hotelA, roomId: { not: r101 }, listingId: doubleId } });
        const target = await tx.hotelStay.findFirstOrThrow({ where: { tenantId: hotelA, roomId: r101 } });
        await tx.hotelStay.update({ where: { reservationId: other.reservationId }, data: { roomId: r101, arrival: target.arrival, departure: target.departure, nights: target.nights } });
      }),
    ).rejects.toThrow(/no_overlap|exclusion|23P01/);
  });

  it("refuse capacité dépassée, dates passées ou inversées, chambre hors service", async () => {
    await expect(book({ arrival: d(30), departure: d(31), adults: 3 })).rejects.toThrow(/Capacité/);
    await expect(book({ arrival: d(-1), departure: d(1) })).rejects.toThrow(/passée/);
    await expect(book({ arrival: d(31), departure: d(30) })).rejects.toThrow(/suivre/);
    await withTenant(hotelA, (tx) => setRoomHousekeeping(tx, hotelA, r201, "out_of_service"));
    await expect(book({ arrival: d(40), departure: d(42), listingId: suiteId })).rejects.toThrow(/Plus aucune chambre/);
    await withTenant(hotelA, (tx) => setRoomHousekeeping(tx, hotelA, r201, "clean"));
  });

  it("calendrier : chambres libres et prix de chaque nuit", async () => {
    const cal = await withTenant(hotelA, (tx) => roomTypeCalendar(tx, hotelA, doubleId, d(10), 5));
    expect(cal.map((c) => c.free)).toEqual([1, 0, 1, 1, 2]);
    expect(cal[1]!.price).toBe(55_000);
  });

  it("arrivée, changement de chambre, prolongation, départ → chambre à nettoyer", async () => {
    const s = await withTenant(hotelA, (tx) => bookStay(tx, hotelA, { listingId: doubleId, arrival: today, departure: d(2), adults: 1, customer: client(), actor: staffActor, channel: "dashboard" }));
    const other = s!.stay!.roomId === r101 ? r102 : r101;
    await withTenant(hotelA, (tx) => changeStay(tx, hotelA, { reservationId: s!.id, roomId: other, actor: staffActor }));
    await withTenant(hotelA, (tx) => checkIn(tx, hotelA, s!.id, staffActor));
    await expect(withTenant(hotelA, (tx) => changeStay(tx, hotelA, { reservationId: s!.id, arrival: d(1), actor: staffActor }))).rejects.toThrow(/seule la date de départ/);
    const longer = await withTenant(hotelA, (tx) => changeStay(tx, hotelA, { reservationId: s!.id, departure: d(3), actor: staffActor }));
    expect(longer!.quantity).toBe(3);
    expect(longer!.totalAmount).toBe(120_000);
    await expect(withTenant(hotelA, (tx) => setRoomHousekeeping(tx, hotelA, other, "out_of_service"))).rejects.toThrow(/occupe/);
    await withTenant(hotelA, (tx) => checkOut(tx, hotelA, s!.id, staffActor));
    const room = await withTenant(hotelA, (tx) => tx.hotelRoom.findUniqueOrThrow({ where: { id: other } }));
    expect(room.housekeeping).toBe("dirty");
    const done = await withTenant(hotelA, (tx) => tx.reservation.findUniqueOrThrow({ where: { id: s!.id } }));
    expect(done.status).toBe("completed");
  });

  it("arrivée impossible avant la date prévue", async () => {
    const s = await book({ arrival: d(50), departure: d(51) });
    await expect(withTenant(hotelA, (tx) => checkIn(tx, hotelA, s!.id, staffActor))).rejects.toThrow(/ultérieure/);
  });

  it("annulation en ligne : délai, paiement enregistré, libération de la chambre", async () => {
    await withTenant(hotelA, (tx) => updateHotelSettings(tx, hotelA, { cancelFreeHours: 48 }));
    const late = await book({ arrival: d(1), departure: d(2) });
    await expect(withTenant(hotelA, (tx) => cancelStayAsGuest(tx, hotelA, late!.accessToken))).rejects.toThrow(/moins de 48 h/);
    const paid = await book({ arrival: d(60), departure: d(61) });
    await withTenant(hotelA, (tx) => recordReservationPayment(tx, hotelA, { reservationId: paid!.id, amount: 10_000, method: "wave", kind: "deposit", actorUserId: null }));
    await expect(withTenant(hotelA, (tx) => cancelStayAsGuest(tx, hotelA, paid!.accessToken))).rejects.toThrow(/paiement/);
    const ok = await book({ arrival: d(70), departure: d(72), listingId: suiteId });
    await withTenant(hotelA, (tx) => cancelStayAsGuest(tx, hotelA, ok!.accessToken));
    const stay = await withTenant(hotelA, (tx) => tx.hotelStay.findUniqueOrThrow({ where: { reservationId: ok!.id } }));
    expect(stay.active).toBe(false);
    expect((await book({ arrival: d(70), departure: d(72), listingId: suiteId }))!.status).toBe("confirmed");
    await expect(withTenant(hotelB, (tx) => cancelStayAsGuest(tx, hotelB, paid!.accessToken))).rejects.toThrow();
  });

  it("sans confirmation automatique, la demande attend mais bloque la chambre ; l'annulation par l'équipe libère", async () => {
    await withTenant(hotelA, (tx) => updateHotelSettings(tx, hotelA, { autoConfirm: false }));
    const s = await book({ arrival: d(80), departure: d(82), listingId: suiteId });
    expect(s!.status).toBe("requested");
    await expect(book({ arrival: d(81), departure: d(83), listingId: suiteId })).rejects.toThrow(/Plus aucune chambre/);
    await withTenant(hotelA, (tx) => transitionReservationStatus(tx, hotelA, { reservationId: s!.id, toStatus: "canceled", actor: staffActor }));
    expect((await book({ arrival: d(81), departure: d(83), listingId: suiteId }))!.status).toBe("requested");
    await withTenant(hotelA, (tx) => updateHotelSettings(tx, hotelA, { autoConfirm: true }));
  });

  it("tarifs : pas deux périodes qui se chevauchent", async () => {
    await expect(withTenant(hotelA, (tx) => setRate(tx, hotelA, { listingId: doubleId, startDate: d(10), endDate: d(15), nightlyPrice: 60_000 }))).rejects.toThrow(HotelError);
  });

  it("planning et vue d'ensemble", async () => {
    const p = await withTenant(hotelA, (tx) => hotelPlanning(tx, hotelA, d(9), 7));
    expect(p.rooms.map((r) => r.number)).toEqual(["101", "102", "201"]);
    expect(p.stays.length).toBeGreaterThan(0);
    const o = await withTenant(hotelA, (tx) => hotelOverview(tx, hotelA));
    expect(o.rooms).toBe(3);
  });

  it("isolation : un établissement ne voit ni n'utilise les chambres d'un autre", async () => {
    expect(await withTenant(hotelB, (tx) => listRoomTypes(tx, hotelB))).toHaveLength(0);
    await expect(withTenant(hotelB, (tx) => bookStay(tx, hotelB, { listingId: doubleId, arrival: d(90), departure: d(91), adults: 1, customer: client(), actor: guest }))).rejects.toThrow(HotelError);
    await expect(withTenant(hotelB, (tx) => addRoom(tx, hotelB, { listingId: doubleId, number: "999" }))).rejects.toThrow(HotelError);
    expect(await withTenant(hotelB, (tx) => tx.hotelStay.count())).toBe(0);
  });
});
