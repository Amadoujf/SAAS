import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../src/client";
import { withSuperAdminAccess, withTenant } from "../src/tenant-context";
import { testOwnerClient } from "./test-owner-client";
import { addDays } from "../src/service-slots";
import { setListingStatus } from "../src/listing-registry";
import {
  addLeadNote,
  advanceImport,
  autoOverview,
  bookTestDrive,
  cancelSale,
  cancelTestDriveAsGuest,
  createImport,
  createVehicle,
  deliverSale,
  getImportByToken,
  getPublicVehicleBySlug,
  getTestDriveByToken,
  listVehicles,
  moveLead,
  openSale,
  recordSalePayment,
  setTestDriveOutcome,
  submitLeadRequest,
  testDriveSlots,
  updateAutoSettings,
  updateVehicle,
  vehicleFacets,
  voidSalePayment,
  type VehicleInput,
} from "../src/auto-registry";

/**
 * Automobile (étape 9) sur PostgreSQL RÉEL : stock, essais sans chevauchement (même en
 * concurrence), prospects dédoublonnés, dossier de vente unique par véhicule avec
 * encaissements communs, importations suivies par jeton, isolation entre concessions.
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
  console.warn("[auto.test] Base de données injoignable — suite ignorée (skip).");
}

const guest = { userId: null, type: "customer" as const };
const staff = { userId: null, type: "employee" as const };
const TZ = "Africa/Dakar";
const tomorrow = addDays(new Date().toISOString().slice(0, 10), 1);
const ALL_WEEK = Array.from({ length: 7 }, (_, weekday) => ({ weekday, startMinute: 9 * 60, endMinute: 18 * 60 }));
let phoneSeq = 0;
const client = () => ({ firstName: "Client", phone: `78${String(6_000_000 + ++phoneSeq + Math.floor(Math.random() * 1000) * 100).padStart(7, "0")}` });

const car = (extra: Partial<VehicleInput> = {}): VehicleInput => ({
  make: "Toyota",
  model: "RAV4",
  year: 2021,
  mileageKm: 42_000,
  fuel: "hybride",
  transmission: "automatique",
  bodyType: "suv",
  condition: "used",
  price: 18_500_000,
  features: ["climatisation", "camera_recul"],
  ...extra,
});

describe.skipIf(!databaseAvailable)("Automobile (réel, PostgreSQL)", () => {
  const suffix = Date.now();
  const sectorKey = `test-sector-auto-${suffix}`;
  let autoA: string;
  let autoB: string;

  const published = async (tenant: string, input: VehicleInput) =>
    withTenant(tenant, async (tx) => {
      const v = await createVehicle(tx, tenant, input, null);
      await setListingStatus(tx, tenant, v.id, "published", null);
      return tx.listing.findFirstOrThrow({ where: { id: v.id }, include: { vehicle: true } });
    });

  beforeAll(async () => {
    await withSuperAdminAccess(async (tx) => {
      await tx.sector.create({ data: { key: sectorKey, name: "Secteur de test", defaultModuleKeys: [], isSystem: false } });
      const data = (s: string) => ({ slug: `test-auto-${s}-${suffix}`, name: `Auto ${s}`, businessType: "ECOMMERCE" as const, sectorKey, status: "ACTIVE" as const, billingExemptedAt: new Date(), timezone: TZ });
      autoA = (await tx.tenant.create({ data: data("a") })).id;
      autoB = (await tx.tenant.create({ data: data("b") })).id;
    });
    await withTenant(autoA, (tx) => updateAutoSettings(tx, autoA, { openingHours: ALL_WEEK, testDriveMinutes: 45, slotStepMinutes: 30 }));
  });

  afterAll(async () => {
    const o = testOwnerClient();
    const ids = { in: [autoA, autoB] };
    await o.reservationPayment.deleteMany({ where: { tenantId: ids } });
    await o.vehicleImportEvent.deleteMany({ where: { tenantId: ids } });
    await o.vehicleImport.deleteMany({ where: { tenantId: ids } });
    await o.vehicleSale.deleteMany({ where: { tenantId: ids } });
    await o.vehicleTestDrive.deleteMany({ where: { tenantId: ids } });
    await o.leadEvent.deleteMany({ where: { tenantId: ids } });
    await o.lead.deleteMany({ where: { tenantId: ids } });
    await o.reservationStatusHistory.deleteMany({ where: { tenantId: ids } });
    await o.reservation.deleteMany({ where: { tenantId: ids } });
    await o.vehicleDetails.deleteMany({ where: { tenantId: ids } });
    await o.listingRevision.deleteMany({ where: { tenantId: ids } });
    await o.listing.deleteMany({ where: { tenantId: ids } });
    await o.autoSettings.deleteMany({ where: { tenantId: ids } });
    await o.customer.deleteMany({ where: { tenantId: ids } });
    await o.counter.deleteMany({ where: { tenantId: ids } });
    await o.tenant.deleteMany({ where: { id: ids } });
    await o.sector.deleteMany({ where: { key: sectorKey } });
    await o.$disconnect();
  });

  it("stock : fiche technique validée, titre composé, filtres et facettes publics", async () => {
    await expect(withTenant(autoA, (tx) => createVehicle(tx, autoA, car({ fuel: "kérosène" }), null))).rejects.toThrow(/Carburant/);
    await expect(withTenant(autoA, (tx) => createVehicle(tx, autoA, car({ year: 1900 }), null))).rejects.toThrow(/Année/);
    const rav = await published(autoA, car());
    expect(rav.title).toBe("Toyota RAV4 2021");
    expect(rav.vehicle!.stockStatus).toBe("available");
    await published(autoA, car({ make: "Peugeot", model: "3008", fuel: "diesel", price: 14_000_000, year: 2019 }));
    await withTenant(autoA, (tx) => createVehicle(tx, autoA, car({ make: "Kia", model: "Sportage" }), null)); // brouillon
    const pub = await withTenant(autoA, (tx) => listVehicles(tx, autoA, { publicOnly: true }));
    expect(pub.every((v) => v.status === "published")).toBe(true);
    expect(pub.some((v) => v.vehicle!.make === "Kia")).toBe(false);
    const diesel = await withTenant(autoA, (tx) => listVehicles(tx, autoA, { publicOnly: true, fuel: "diesel" }));
    expect(diesel.map((v) => v.vehicle!.model)).toEqual(["3008"]);
    const cheap = await withTenant(autoA, (tx) => listVehicles(tx, autoA, { publicOnly: true, priceMax: 15_000_000 }));
    expect(cheap.every((v) => (v.price ?? 0) <= 15_000_000)).toBe(true);
    const facets = await withTenant(autoA, (tx) => vehicleFacets(tx, autoA));
    expect(facets.makes).toContain("Peugeot");
    expect(facets.makes).not.toContain("Kia");
    // Autre concession : rien ne fuit.
    expect(await withTenant(autoB, (tx) => listVehicles(tx, autoB, {}))).toHaveLength(0);
    expect(await withTenant(autoB, (tx) => getPublicVehicleBySlug(tx, autoB, rav.slug))).toBeNull();
  });

  it("essais : créneaux sur les horaires, permis exigé, jamais deux essais qui se chevauchent", async () => {
    const v = await published(autoA, car({ model: "Corolla", bodyType: "berline" }));
    const { slots } = await withTenant(autoA, (tx) => testDriveSlots(tx, autoA, v.id, tomorrow));
    expect(slots[0]!.minute).toBe(9 * 60);
    expect(slots.at(-1)!.minute + 45).toBeLessThanOrEqual(18 * 60);
    await expect(withTenant(autoA, (tx) => bookTestDrive(tx, autoA, { listingId: v.id, date: tomorrow, minute: 600, customer: client(), licenseConfirmed: false, actor: guest }))).rejects.toThrow(/permis/);
    await expect(withTenant(autoA, (tx) => bookTestDrive(tx, autoA, { listingId: v.id, date: tomorrow, minute: 7 * 60, customer: client(), licenseConfirmed: true, actor: guest }))).rejects.toThrow(/proposé/);
    const who = client();
    const td = await withTenant(autoA, (tx) => bookTestDrive(tx, autoA, { listingId: v.id, date: tomorrow, minute: 600, customer: who, licenseConfirmed: true, actor: guest }));
    expect(td.status).toBe("confirmed");
    expect(td.testDrive!.licenseConfirmed).toBe(true);
    // 10h30 chevauche 10h00–10h45 : refusé, même saisi par l'équipe.
    await expect(withTenant(autoA, (tx) => bookTestDrive(tx, autoA, { listingId: v.id, date: tomorrow, minute: 630, customer: client(), licenseConfirmed: true, actor: staff }))).rejects.toThrow(/déjà réservé/);
    const after = await withTenant(autoA, (tx) => testDriveSlots(tx, autoA, v.id, tomorrow));
    expect(after.slots.find((s) => s.minute === 600)!.available).toBe(false);
    expect(after.slots.find((s) => s.minute === 660)!.available).toBe(true);
    // Le client voit son essai par jeton, et un prospect « essai » est créé.
    const mine = await withTenant(autoA, (tx) => getTestDriveByToken(tx, autoA, td.accessToken));
    expect(mine!.id).toBe(td.id);
    expect(await withTenant(autoB, (tx) => getTestDriveByToken(tx, autoB, td.accessToken))).toBeNull();
    const lead = await withTenant(autoA, (tx) => tx.lead.findFirstOrThrow({ where: { tenantId: autoA, listingId: v.id } }));
    expect(lead.status).toBe("test_drive");
    // Annulation par le client : le créneau se libère.
    await withTenant(autoA, (tx) => cancelTestDriveAsGuest(tx, autoA, td.accessToken));
    const freed = await withTenant(autoA, (tx) => testDriveSlots(tx, autoA, v.id, tomorrow));
    expect(freed.slots.find((s) => s.minute === 600)!.available).toBe(true);
  });

  it("essais concurrents sur le même créneau : un seul passe", async () => {
    const v = await published(autoA, car({ model: "Hilux", bodyType: "pickup", fuel: "diesel" }));
    const results = await Promise.allSettled(
      Array.from({ length: 5 }, () => withTenant(autoA, (tx) => bookTestDrive(tx, autoA, { listingId: v.id, date: tomorrow, minute: 14 * 60, customer: client(), licenseConfirmed: true, actor: guest }))),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const active = await withTenant(autoA, (tx) => tx.vehicleTestDrive.count({ where: { listingId: v.id, active: true } }));
    expect(active).toBe(1);
  });

  it("la base refuse elle-même un chevauchement d'essais", async () => {
    const v = await published(autoA, car({ model: "Yaris", bodyType: "citadine" }));
    const td = await withTenant(autoA, (tx) => bookTestDrive(tx, autoA, { listingId: v.id, date: tomorrow, minute: 16 * 60, customer: client(), licenseConfirmed: true, actor: staff }));
    const other = await withTenant(autoA, (tx) => bookTestDrive(tx, autoA, { listingId: v.id, date: tomorrow, minute: 9 * 60, customer: client(), licenseConfirmed: true, actor: staff }));
    await expect(
      withTenant(autoA, (tx) => tx.vehicleTestDrive.update({ where: { reservationId: other.id }, data: { startAt: td.testDrive!.startAt, endAt: td.testDrive!.endAt } })),
    ).rejects.toThrow();
  });

  it("prospects : dédoublonnés par client et véhicule, perte motivée, « gagné » réservé à la vente", async () => {
    const v = await published(autoA, car({ model: "Land Cruiser", bodyType: "4x4", price: 45_000_000 }));
    const who = client();
    const a = await withTenant(autoA, (tx) => submitLeadRequest(tx, autoA, { listingId: v.id, interest: "purchase", customer: who, message: "Toujours dispo ?", actor: guest }));
    const b = await withTenant(autoA, (tx) => submitLeadRequest(tx, autoA, { listingId: v.id, interest: "financing", customer: { ...who, phone: `+221 ${who.phone}` }, tradeIn: "Corolla 2012", actor: guest }));
    expect(b.id).toBe(a.id);
    expect(b.events.length).toBe(2);
    await expect(withTenant(autoA, (tx) => moveLead(tx, autoA, a.id, "lost", staff))).rejects.toThrow(/pourquoi/);
    await expect(withTenant(autoA, (tx) => moveLead(tx, autoA, a.id, "won", staff))).rejects.toThrow(/vente/);
    await withTenant(autoA, (tx) => addLeadNote(tx, autoA, a.id, "Rappeler jeudi", staff));
    const lost = await withTenant(autoA, (tx) => moveLead(tx, autoA, a.id, "lost", staff, "Budget insuffisant"));
    expect(lost.lostReason).toBe("Budget insuffisant");
    // L'historique est inaltérable.
    await expect(withTenant(autoA, (tx) => tx.leadEvent.deleteMany({ where: { leadId: a.id } }))).rejects.toThrow();
    // Une nouvelle demande après la perte ouvre un nouveau dossier.
    const c = await withTenant(autoA, (tx) => submitLeadRequest(tx, autoA, { listingId: v.id, interest: "purchase", customer: who, actor: guest }));
    expect(c.id).not.toBe(a.id);
  });

  it("vente : un seul dossier par véhicule, reprise déduite, encaissements communs, remise après règlement complet", async () => {
    const v = await published(autoA, car({ model: "Fortuner", price: 30_000_000 }));
    await expect(withTenant(autoA, (tx) => openSale(tx, autoA, { listingId: v.id, customer: client(), tradeInValue: 5_000_000, actor: staff }))).rejects.toThrow(/Décrivez/);
    const sale = await withTenant(autoA, (tx) => openSale(tx, autoA, { listingId: v.id, customer: client(), agreedPrice: 29_000_000, tradeInValue: 4_000_000, tradeInDescription: "Corolla 2014", actor: staff }));
    expect(sale.totalAmount).toBe(25_000_000);
    expect(sale.listing.vehicle!.stockStatus).toBe("reserved");
    await expect(withTenant(autoA, (tx) => openSale(tx, autoA, { listingId: v.id, customer: client(), actor: staff }))).rejects.toThrow(/déjà un dossier/);
    // Même en contournant le registre, la base refuse un second dossier actif.
    await expect(
      withTenant(autoA, async (tx) => {
        const r = await tx.reservation.findFirstOrThrow({ where: { id: sale.id } });
        const dup = await tx.reservation.create({ data: { tenantId: autoA, listingId: v.id, customerId: r.customerId, moduleKey: "vehicle_sales", status: "confirmed", reference: `DUP-${suffix}`, startAt: new Date(Date.now() + 3600_000) } });
        await tx.vehicleSale.create({ data: { reservationId: dup.id, tenantId: autoA, listingId: v.id, agreedPrice: 1, tradeInValue: 0 } });
      }),
    ).rejects.toThrow();
    // Réservé : plus d'essai possible.
    await expect(withTenant(autoA, (tx) => bookTestDrive(tx, autoA, { listingId: v.id, date: tomorrow, minute: 600, customer: client(), licenseConfirmed: true, actor: guest }))).rejects.toThrow(/plus disponible/);
    const dep = await withTenant(autoA, (tx) => recordSalePayment(tx, autoA, { reservationId: sale.id, amount: 5_000_000, method: "bank_transfer", kind: "deposit", actorUserId: null }));
    expect(dep.receiptNumber).toMatch(/^R/);
    await expect(withTenant(autoA, (tx) => recordSalePayment(tx, autoA, { reservationId: sale.id, amount: 20_000_001, method: "cash", kind: "balance", actorUserId: null }))).rejects.toThrow(/reste à payer/);
    await expect(withTenant(autoA, (tx) => deliverSale(tx, autoA, sale.id, staff))).rejects.toThrow(/Reste à encaisser/);
    await withTenant(autoA, (tx) => recordSalePayment(tx, autoA, { reservationId: sale.id, amount: 20_000_000, method: "wave", kind: "balance", actorUserId: null }));
    const done = await withTenant(autoA, (tx) => deliverSale(tx, autoA, sale.id, staff));
    expect(done.status).toBe("completed");
    expect(done.listing.vehicle!.stockStatus).toBe("sold");
    expect(done.vehicleSale!.deliveredAt).not.toBeNull();
    const lead = await withTenant(autoA, (tx) => tx.lead.findFirstOrThrow({ where: { id: done.vehicleSale!.leadId! } }));
    expect(lead.status).toBe("won");
    // Vendu : invisible au public, impossible à revendre.
    expect(await withTenant(autoA, (tx) => getPublicVehicleBySlug(tx, autoA, v.slug))).toBeNull();
    await expect(withTenant(autoA, (tx) => openSale(tx, autoA, { listingId: v.id, customer: client(), actor: staff }))).rejects.toThrow(/déjà vendu/);
  });

  it("annulation d'une vente : encaissements annulés d'abord, puis véhicule remis en stock", async () => {
    const v = await published(autoA, car({ model: "C-HR", price: 16_000_000 }));
    const sale = await withTenant(autoA, (tx) => openSale(tx, autoA, { listingId: v.id, customer: client(), actor: staff }));
    const pay = await withTenant(autoA, (tx) => recordSalePayment(tx, autoA, { reservationId: sale.id, amount: 1_600_000, method: "orange_money", kind: "deposit", actorUserId: null }));
    await expect(withTenant(autoA, (tx) => cancelSale(tx, autoA, sale.id, staff, "Financement refusé"))).rejects.toThrow(/annulez-les/);
    await expect(withTenant(autoA, (tx) => voidSalePayment(tx, autoA, pay.id, ""))).rejects.toThrow(/motif/);
    await withTenant(autoA, (tx) => voidSalePayment(tx, autoA, pay.id, "Acompte remboursé"));
    const canceled = await withTenant(autoA, (tx) => cancelSale(tx, autoA, sale.id, staff, "Financement refusé"));
    expect(canceled.status).toBe("canceled");
    expect(canceled.listing.vehicle!.stockStatus).toBe("available");
    // Le véhicule peut repartir dans un nouveau dossier.
    const again = await withTenant(autoA, (tx) => openSale(tx, autoA, { listingId: v.id, customer: client(), actor: staff }));
    expect(again.totalAmount).toBe(16_000_000);
  });

  it("importations : étapes dans l'ordre, arrivage puis disponible, suivi par jeton isolé", async () => {
    const v = await published(autoA, car({ make: "Hyundai", model: "Tucson", condition: "imported_used" }));
    const who = client();
    const imp = await withTenant(autoA, (tx) => createImport(tx, autoA, { listingId: v.id, origin: "Belgique", eta: addDays(tomorrow, 20), vessel: "Grande Dakar", customer: who, actorUserId: null }));
    expect(imp.reference).toMatch(/^IMP-\d{4}-0001$/);
    expect(imp.listing.vehicle!.stockStatus).toBe("incoming");
    await expect(withTenant(autoA, (tx) => createImport(tx, autoA, { listingId: v.id, origin: "France", actorUserId: null }))).rejects.toThrow(/déjà en cours/);
    // Arrivage visible au public mais pas encore à l'essai.
    expect((await withTenant(autoA, (tx) => getPublicVehicleBySlug(tx, autoA, v.slug)))!.vehicle!.stockStatus).toBe("incoming");
    await expect(withTenant(autoA, (tx) => bookTestDrive(tx, autoA, { listingId: v.id, date: tomorrow, minute: 600, customer: client(), licenseConfirmed: true, actor: guest }))).rejects.toThrow(/pas encore arrivé/);
    await withTenant(autoA, (tx) => advanceImport(tx, autoA, imp.id, "shipped", null));
    await expect(withTenant(autoA, (tx) => advanceImport(tx, autoA, imp.id, "purchased", null))).rejects.toThrow(/étape en étape/);
    await withTenant(autoA, (tx) => advanceImport(tx, autoA, imp.id, "customs", null, { note: "Dédouanement en cours" }));
    const ready = await withTenant(autoA, (tx) => advanceImport(tx, autoA, imp.id, "ready", null));
    expect(ready.listing.vehicle!.stockStatus).toBe("available");
    expect(ready.events.map((e) => e.toStage)).toEqual(["purchased", "shipped", "customs", "ready"]);
    await expect(withTenant(autoA, (tx) => advanceImport(tx, autoA, imp.id, "canceled", null, { note: "x" }))).rejects.toThrow(/terminée/);
    const tracked = await withTenant(autoA, (tx) => getImportByToken(tx, autoA, imp.accessToken));
    expect(tracked!.id).toBe(imp.id);
    expect(await withTenant(autoB, (tx) => getImportByToken(tx, autoB, imp.accessToken))).toBeNull();
    await expect(withTenant(autoA, (tx) => tx.vehicleImportEvent.updateMany({ where: { importId: imp.id }, data: { note: "réécrit" } }))).rejects.toThrow();
  });

  it("statut manuel limité et vue d'ensemble cohérente", async () => {
    const v = await withTenant(autoA, (tx) => createVehicle(tx, autoA, car({ model: "Prado" }), null, { incoming: true }));
    expect(v.vehicle!.stockStatus).toBe("incoming");
    const upd = await withTenant(autoA, (tx) => updateVehicle(tx, autoA, v.id, { mileageKm: 12_000, price: null }, null));
    expect(upd.priceUnit).toBe("on_request");
    expect(upd.vehicle!.mileageKm).toBe(12_000);
    const o = await withTenant(autoA, (tx) => autoOverview(tx, autoA));
    expect(o.sold).toBeGreaterThanOrEqual(1);
    expect(o.incoming).toBeGreaterThanOrEqual(1);
    expect(o.collectedThisMonth).toBe(25_000_000);
    const other = await withTenant(autoB, (tx) => autoOverview(tx, autoB));
    expect(other.available + other.sold + other.collectedThisMonth).toBe(0);
  });

  it("essai : résultat enregistré, annulation par l'équipe motivée", async () => {
    const v = await published(autoA, car({ model: "Camry", bodyType: "berline" }));
    const td = await withTenant(autoA, (tx) => bookTestDrive(tx, autoA, { listingId: v.id, date: tomorrow, minute: 11 * 60, customer: client(), licenseConfirmed: true, actor: staff }));
    await expect(withTenant(autoA, (tx) => setTestDriveOutcome(tx, autoA, td.id, "canceled", staff))).rejects.toThrow(/motif/);
    const done = await withTenant(autoA, (tx) => setTestDriveOutcome(tx, autoA, td.id, "done", staff));
    expect(done.status).toBe("completed");
    // Un essai effectué garde son créneau occupé (historique réel), sans bloquer une autre heure.
    const s = await withTenant(autoA, (tx) => testDriveSlots(tx, autoA, v.id, tomorrow));
    expect(s.slots.find((x) => x.minute === 11 * 60)!.available).toBe(false);
  });
});
