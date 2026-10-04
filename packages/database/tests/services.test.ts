import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../src/client";
import { withSuperAdminAccess, withTenant } from "../src/tenant-context";
import { testOwnerClient } from "./test-owner-client";
import { setListingStatus } from "../src/listing-registry";
import { transitionReservationStatus } from "../src/reservation-registry";
import { recordReservationPayment } from "../src/travel-registry";
import { addDays } from "../src/service-slots";
import {
  addTimeOff,
  bookAppointment,
  cancelAppointmentAsGuest,
  computeAvailability,
  createService,
  createStaff,
  getAppointmentByToken,
  listServices,
  rescheduleAppointment,
  salonOverview,
  ServiceError,
  setAppointmentTotal,
  updateBookingSettings,
  updateStaff,
} from "../src/service-registry";

/**
 * Salons (étape 6) sur PostgreSQL RÉEL : prestations, équipe, horaires, absences,
 * rendez-vous sans chevauchement (même en concurrence), « sans préférence », annulation
 * et déplacement par le client, prix fixé par le serveur, isolation entre salons.
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
  console.warn("[services.test] Base de données injoignable — suite ignorée (skip).");
}

const guest = { userId: null, type: "customer" as const };
const staffActor = { userId: null, type: "employee" as const };
// Jour de test : dans 7 jours (fenêtre en ligne par défaut : 45 j ; délai minimal : 60 min).
const day = addDays(new Date().toISOString().slice(0, 10), 7);
const at = (hhmm: string, d = day) => new Date(`${d}T${hhmm}:00Z`); // salons de test à Dakar (UTC+0)
const allWeek = (start: number, end: number) => [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, startMinute: start, endMinute: end }));

describe.skipIf(!databaseAvailable)("Salons (réel, PostgreSQL)", () => {
  const suffix = Date.now();
  const sectorKey = `test-sector-salon-${suffix}`;
  let salonA: string;
  let salonB: string;
  let coupeId: string;
  let tressesId: string;
  let awa: string;
  let binta: string;
  let staffB: string;

  beforeAll(async () => {
    await withSuperAdminAccess(async (tx) => {
      await tx.sector.create({ data: { key: sectorKey, name: "Secteur de test", defaultModuleKeys: [], isSystem: false } });
      const data = (s: string) => ({ slug: `test-salon-${s}-${suffix}`, name: `Salon ${s}`, businessType: "ECOMMERCE" as const, sectorKey, status: "ACTIVE" as const, billingExemptedAt: new Date(), timezone: "Africa/Dakar" });
      salonA = (await tx.tenant.create({ data: data("a") })).id;
      salonB = (await tx.tenant.create({ data: data("b") })).id;
    });
    await withTenant(salonA, async (tx) => {
      awa = (await createStaff(tx, salonA, { displayName: "Awa", hours: allWeek(9 * 60, 13 * 60) })).id;
      binta = (await createStaff(tx, salonA, { displayName: "Binta", hours: allWeek(9 * 60, 13 * 60) })).id;
      coupeId = (await createService(tx, salonA, { title: "Coupe et brushing", category: "Coiffure", durationMinutes: 60, bufferMinutes: 15, price: 8000, staffIds: [awa, binta] }, null)).id;
      tressesId = (await createService(tx, salonA, { title: "Tresses", category: "Coiffure", durationMinutes: 120, price: 15000, priceFrom: true, staffIds: [awa] }, null)).id;
      await setListingStatus(tx, salonA, coupeId, "published", null);
      await setListingStatus(tx, salonA, tressesId, "published", null);
    });
    await withTenant(salonB, async (tx) => {
      staffB = (await createStaff(tx, salonB, { displayName: "Autre salon", hours: allWeek(0, 1440) })).id;
    });
  });

  afterAll(async () => {
    const o = testOwnerClient();
    const ids = { in: [salonA, salonB] };
    await o.reservationPayment.deleteMany({ where: { tenantId: ids } });
    await o.serviceAppointment.deleteMany({ where: { tenantId: ids } });
    await o.reservationStatusHistory.deleteMany({ where: { tenantId: ids } });
    await o.reservation.deleteMany({ where: { tenantId: ids } });
    await o.staffTimeOff.deleteMany({ where: { tenantId: ids } });
    await o.staffWorkingHours.deleteMany({ where: { tenantId: ids } });
    await o.serviceStaffSkill.deleteMany({ where: { tenantId: ids } });
    await o.serviceStaff.deleteMany({ where: { tenantId: ids } });
    await o.serviceBookingSettings.deleteMany({ where: { tenantId: ids } });
    await o.serviceDetails.deleteMany({ where: { tenantId: ids } });
    await o.listingRevision.deleteMany({ where: { tenantId: ids } });
    await o.listing.deleteMany({ where: { tenantId: ids } });
    await o.customer.deleteMany({ where: { tenantId: ids } });
    await o.counter.deleteMany({ where: { tenantId: ids } });
    await o.tenant.deleteMany({ where: { id: ids } });
    await o.sector.deleteMany({ where: { key: sectorKey } });
    await o.$disconnect();
  });

  const book = (startAt: Date, extra: Partial<Parameters<typeof bookAppointment>[2]> = {}) =>
    withTenant(salonA, (tx) =>
      bookAppointment(tx, salonA, { listingId: coupeId, startAt, customer: { firstName: "Cliente", phone: `77${String(Math.floor(Math.random() * 1e7)).padStart(7, "0")}` }, actor: guest, channel: "web", ...extra }),
    );

  it("propose les horaires libres de chaque personne qualifiée", async () => {
    const r = await withTenant(salonA, (tx) => computeAvailability(tx, salonA, { listingId: tressesId, date: day, public: true }));
    // Tresses : 2 h, seule Awa les fait ; 9 h → 11 h par pas de 15 min.
    expect(r.slots[0]!.startAt.toISOString()).toBe(at("09:00").toISOString());
    expect(r.slots.at(-1)!.startAt.toISOString()).toBe(at("11:00").toISOString());
    expect(r.slots.every((s) => s.staffIds.length === 1 && s.staffIds[0] === awa)).toBe(true);
    await expect(withTenant(salonA, (tx) => computeAvailability(tx, salonA, { listingId: tressesId, date: day, staffId: binta }))).rejects.toThrow(/ne réalise pas/);
  });

  it("réserve au prix de la fiche, confirmé tout de suite, plage bloquée préparation comprise", async () => {
    const appt = await book(at("09:00"), { staffId: awa });
    expect(appt!.status).toBe("confirmed");
    expect(appt!.totalAmount).toBe(8000);
    expect(appt!.appointment!.staffId).toBe(awa);
    expect(appt!.appointment!.blockedUntil.toISOString()).toBe(at("10:15").toISOString());
    const r = await withTenant(salonA, (tx) => computeAvailability(tx, salonA, { listingId: coupeId, date: day, staffId: awa, public: true }));
    expect(r.slots.map((s) => s.startAt.toISOString())).not.toContain(at("10:00").toISOString());
    expect(r.slots.map((s) => s.startAt.toISOString())).toContain(at("10:15").toISOString());
    await expect(book(at("09:30"), { staffId: awa })).rejects.toThrow(/pris/);
  });

  it("« sans préférence » confie le rendez-vous à la personne libre la moins chargée", async () => {
    const appt = await book(at("09:00"));
    expect(appt!.appointment!.staffId).toBe(binta);
    // 09 h 30 : Awa et Binta occupées → refus.
    await expect(book(at("09:30"))).rejects.toThrow(/Plus personne/);
  });

  it("deux réservations simultanées du même horaire : une seule passe", async () => {
    const results = await Promise.allSettled([book(at("11:00"), { staffId: awa }), book(at("11:00"), { staffId: awa }), book(at("11:15"), { staffId: awa })]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const count = await withTenant(salonA, (tx) => tx.serviceAppointment.count({ where: { tenantId: salonA, staffId: awa, active: true, startAt: { gte: at("11:00"), lt: at("12:00") } } }));
    expect(count).toBe(1);
  });

  it("la base refuse d'elle-même deux plages qui se chevauchent", async () => {
    const existing = await withTenant(salonA, (tx) => tx.serviceAppointment.findFirstOrThrow({ where: { tenantId: salonA, staffId: awa, startAt: at("09:00") } }));
    await expect(
      withTenant(salonA, async (tx) => {
        const res = await tx.reservation.findFirstOrThrow({ where: { tenantId: salonA, id: { not: existing.reservationId }, moduleKey: "appointments" } });
        // Écriture directe (hors registre) : seule la contrainte d'exclusion s'y oppose.
        await tx.serviceAppointment.update({ where: { reservationId: res.id }, data: { staffId: awa, startAt: at("09:30"), endAt: at("10:30"), blockedUntil: at("10:30") } });
      }),
    ).rejects.toThrow(/no_overlap|exclusion|23P01/);
  });

  it("refuse hors horaires, horaire non proposé, trop tôt, prestation non publiée", async () => {
    await expect(book(at("13:30"), { staffId: awa })).rejects.toThrow(/heures de travail/);
    await expect(book(at("12:10"), { staffId: binta })).rejects.toThrow(/pas proposé|heures de travail/);
    await expect(book(new Date(Date.now() + 10 * 60_000), { staffId: awa })).rejects.toThrow();
    await withTenant(salonA, (tx) => setListingStatus(tx, salonA, tressesId, "unavailable", null));
    await expect(book(at("12:00", addDays(day, 1)), { listingId: tressesId })).rejects.toThrow(/ne se réserve pas en ligne/);
    await withTenant(salonA, (tx) => setListingStatus(tx, salonA, tressesId, "published", null));
    // L'équipe, elle, peut placer un horaire hors pas (client au téléphone).
    const phone = await book(at("11:05", addDays(day, 1)), { staffId: binta, channel: "phone", actor: staffActor });
    expect(phone!.channel).toBe("phone");
  });

  it("une absence retire les horaires et ne peut pas recouvrir un rendez-vous", async () => {
    const d2 = addDays(day, 2);
    await withTenant(salonA, (tx) => addTimeOff(tx, salonA, { staffId: binta, startAt: at("09:00", d2), endAt: at("13:00", d2), reason: "Formation" }));
    const r = await withTenant(salonA, (tx) => computeAvailability(tx, salonA, { listingId: coupeId, date: d2, public: true }));
    expect(r.slots.every((s) => !s.staffIds.includes(binta))).toBe(true);
    await expect(withTenant(salonA, (tx) => addTimeOff(tx, salonA, { staffId: awa, startAt: at("08:00"), endAt: at("12:00") }))).rejects.toThrow(/rendez-vous sont prévus/);
  });

  it("le client déplace puis annule SON rendez-vous ; l'annulation libère la plage", async () => {
    const d3 = addDays(day, 3);
    const appt = await book(at("10:00", d3), { staffId: awa });
    const token = appt!.accessToken;
    await withTenant(salonA, (tx) => rescheduleAppointment(tx, salonA, { reservationId: appt!.id, startAt: at("11:00", d3), actor: guest }));
    const moved = await withTenant(salonA, (tx) => getAppointmentByToken(tx, salonA, token));
    expect(moved!.startAt.toISOString()).toBe(at("11:00", d3).toISOString());
    expect(moved!.history.at(-1)!.note).toMatch(/Déplacé/);
    await withTenant(salonA, (tx) => cancelAppointmentAsGuest(tx, salonA, token));
    const after = await withTenant(salonA, (tx) => tx.serviceAppointment.findUniqueOrThrow({ where: { reservationId: appt!.id } }));
    expect(after.active).toBe(false);
    // Plage libérée : un autre client peut la prendre.
    expect((await book(at("11:00", d3), { staffId: awa }))!.status).toBe("confirmed");
    // Jeton d'un autre salon : introuvable.
    await expect(withTenant(salonB, (tx) => cancelAppointmentAsGuest(tx, salonB, token))).rejects.toThrow();
  });

  it("délai d'annulation : trop tard en ligne", async () => {
    await withTenant(salonA, (tx) => updateBookingSettings(tx, salonA, { cancelCutoffHours: 72 }));
    const tomorrow = addDays(new Date().toISOString().slice(0, 10), 1);
    const appt = await book(at("10:00", tomorrow), { staffId: awa });
    await expect(withTenant(salonA, (tx) => cancelAppointmentAsGuest(tx, salonA, appt!.accessToken))).rejects.toThrow(/moins de 72 h/);
    await expect(withTenant(salonA, (tx) => rescheduleAppointment(tx, salonA, { reservationId: appt!.id, startAt: at("11:00", tomorrow), actor: guest }))).rejects.toThrow(/moins de 72 h/);
    await withTenant(salonA, (tx) => updateBookingSettings(tx, salonA, { cancelCutoffHours: 3 }));
  });

  it("sans confirmation automatique, la demande attend le salon mais bloque la plage", async () => {
    await withTenant(salonA, (tx) => updateBookingSettings(tx, salonA, { autoConfirm: false }));
    const appt = await book(at("09:00", addDays(day, 5)), { staffId: awa });
    expect(appt!.status).toBe("requested");
    await expect(book(at("09:15", addDays(day, 5)), { staffId: awa })).rejects.toThrow(/pris/);
    await withTenant(salonA, (tx) => transitionReservationStatus(tx, salonA, { reservationId: appt!.id, toStatus: "canceled", actor: staffActor }));
    expect((await book(at("09:15", addDays(day, 5)), { staffId: awa }))!.status).toBe("requested");
    await withTenant(salonA, (tx) => updateBookingSettings(tx, salonA, { autoConfirm: true }));
  });

  it("prix « à partir de » fixé par le salon, jamais sous ce qui est encaissé", async () => {
    const appt = await book(at("09:00", addDays(day, 6)), { listingId: tressesId, staffId: awa });
    expect(appt!.totalAmount).toBe(15000);
    await withTenant(salonA, (tx) => setAppointmentTotal(tx, salonA, appt!.id, 22000));
    await withTenant(salonA, (tx) => recordReservationPayment(tx, salonA, { reservationId: appt!.id, amount: 22000, method: "wave", kind: "balance", actorUserId: null }));
    await expect(withTenant(salonA, (tx) => setAppointmentTotal(tx, salonA, appt!.id, 20000))).rejects.toThrow(/déjà encaissé/);
    await expect(withTenant(salonA, (tx) => recordReservationPayment(tx, salonA, { reservationId: appt!.id, amount: 1, method: "cash", kind: "other", actorUserId: null }))).rejects.toThrow(/reste à payer/);
  });

  it("une personne désactivée ne reçoit plus de rendez-vous en ligne", async () => {
    await withTenant(salonA, (tx) => updateStaff(tx, salonA, binta, { isActive: false }));
    const r = await withTenant(salonA, (tx) => computeAvailability(tx, salonA, { listingId: coupeId, date: addDays(day, 8), public: true }));
    expect(r.slots.every((s) => s.staffIds.every((id) => id === awa))).toBe(true);
    await withTenant(salonA, (tx) => updateStaff(tx, salonA, binta, { isActive: true }));
  });

  it("isolation : un salon ne voit ni n'utilise l'équipe ou les prestations d'un autre", async () => {
    expect(await withTenant(salonB, (tx) => listServices(tx, salonB))).toHaveLength(0);
    await expect(withTenant(salonA, (tx) => bookAppointment(tx, salonA, { listingId: coupeId, staffId: staffB, startAt: at("12:00"), customer: { firstName: "X", phone: "770000001" }, actor: guest }))).rejects.toThrow(ServiceError);
    await expect(withTenant(salonB, (tx) => createService(tx, salonB, { title: "Vol", category: "X", durationMinutes: 30, staffIds: [awa] }, null))).rejects.toThrow();
    const leak = await withTenant(salonB, (tx) => tx.serviceAppointment.count());
    expect(leak).toBe(0);
  });

  it("vue d'ensemble : chiffres du salon", async () => {
    const o = await withTenant(salonA, (tx) => salonOverview(tx, salonA, at("08:00")));
    expect(o.activeStaff).toBe(2);
    expect(o.weekCount).toBeGreaterThan(0);
  });
});
