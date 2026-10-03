import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../src/client";
import { withSuperAdminAccess, withTenant } from "../src/tenant-context";
import { testOwnerClient } from "./test-owner-client";
import { createDeliveryZone } from "../src/commerce-registry";
import {
  advanceCourierJob,
  assignCourierJob,
  cancelCourierJob,
  completeCourierReturn,
  courierOverview,
  courierReconciliation,
  createCourier,
  createCourierJob,
  deliverCourierJob,
  failCourierJob,
  getCourierSpace,
  getCourierTracking,
  quoteCourierFee,
  recordRemittance,
  rotateCourierToken,
  senderBalance,
  settleSender,
  startCourierReturn,
  updateCourier,
  updateCourierSettings,
  type CourierJobInput,
} from "../src/courier-registry";

/**
 * Livraison (étape 11) sur PostgreSQL RÉEL : tarif serveur, affectation, preuves de
 * remise, échecs plafonnés et retours, chemin des espèces (livreur → bureau →
 * expéditeur) sans double comptage, portée du livreur, isolation entre sociétés.
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
  console.warn("[courier.test] Base de données injoignable — suite ignorée (skip).");
}

const staff = { type: "staff" as const, userId: null };
let seq = 0;
const phone = () => `77${String(4_000_000 + ++seq + Math.floor(Math.random() * 1000) * 100).padStart(7, "0")}`;

describe.skipIf(!databaseAvailable)("Livraison (réel, PostgreSQL)", () => {
  const suffix = Date.now();
  const sectorKey = `test-sector-courier-${suffix}`;
  let a: string;
  let b: string;
  let zoneA: string;
  let zoneB: string;
  let moussa: { id: string; accessToken: string };
  let awa: { id: string; accessToken: string };
  let senderId: string;

  const job = (extra: Partial<CourierJobInput> = {}): CourierJobInput => ({
    senderId,
    pickupName: "Boutique Keur Yaay",
    pickupPhone: "77 100 20 30",
    pickupAddress: "Marché Sandaga, stand 12",
    recipientName: "Coumba Diop",
    recipientPhone: phone(),
    dropoffAddress: "Cité Keur Gorgui, villa 45",
    zoneId: zoneA,
    packageDescription: "Robe en wax",
    size: "small",
    feePaidBy: "sender",
    codAmount: 15_000,
    channel: "dashboard",
    actor: staff,
    ...extra,
  });
  const onRoad = async (jobId: string, driver = moussa.id) => {
    await withTenant(a, (tx) => assignCourierJob(tx, a, jobId, driver, staff));
    await withTenant(a, (tx) => advanceCourierJob(tx, a, jobId, "picked_up", { type: "deliverer", delivererId: driver }));
    await withTenant(a, (tx) => advanceCourierJob(tx, a, jobId, "in_transit", { type: "deliverer", delivererId: driver }));
  };

  beforeAll(async () => {
    await withSuperAdminAccess(async (tx) => {
      await tx.sector.create({ data: { key: sectorKey, name: "Secteur de test", defaultModuleKeys: [], isSystem: false } });
      const d = (s: string) => ({ slug: `test-courier-${s}-${suffix}`, name: `Coursier ${s}`, businessType: "ECOMMERCE" as const, sectorKey, status: "ACTIVE" as const, billingExemptedAt: new Date(), timezone: "Africa/Dakar" });
      a = (await tx.tenant.create({ data: d("a") })).id;
      b = (await tx.tenant.create({ data: d("b") })).id;
    });
    zoneA = (await withTenant(a, (tx) => createDeliveryZone(tx, a, { name: "Dakar centre", region: "Dakar", fee: 1500, bulkySurcharge: 0 }))).id;
    zoneB = (await withTenant(b, (tx) => createDeliveryZone(tx, b, { name: "Thiès", region: "Thiès", fee: 3000, bulkySurcharge: 0 }))).id;
    moussa = await withTenant(a, (tx) => createCourier(tx, a, { name: "Moussa Fall", phone: phone(), vehicleType: "Moto" }));
    awa = await withTenant(a, (tx) => createCourier(tx, a, { name: "Awa Ndiaye", phone: phone(), vehicleType: "Moto" }));
    senderId = (await withTenant(a, (tx) => tx.customer.create({ data: { tenantId: a, firstName: "Keur Yaay", phone: "+221771002030" } }))).id;
  });

  afterAll(async () => {
    const o = testOwnerClient();
    const ids = { in: [a, b] };
    await o.courierJobEvent.deleteMany({ where: { tenantId: ids } });
    await o.courierJob.deleteMany({ where: { tenantId: ids } });
    await o.courierRemittance.deleteMany({ where: { tenantId: ids } });
    await o.courierSettlement.deleteMany({ where: { tenantId: ids } });
    await o.courierSettings.deleteMany({ where: { tenantId: ids } });
    await o.deliverer.deleteMany({ where: { tenantId: ids } });
    await o.deliveryZone.deleteMany({ where: { tenantId: ids } });
    await o.customer.deleteMany({ where: { tenantId: ids } });
    await o.counter.deleteMany({ where: { tenantId: ids } });
    await o.tenant.deleteMany({ where: { id: ids } });
    await o.sector.deleteMany({ where: { key: sectorKey } });
    await o.$disconnect();
  });

  it("tarif calculé par le serveur, contrôles de saisie, zone d'une autre société refusée", async () => {
    await withTenant(a, (tx) => updateCourierSettings(tx, a, { mediumSurcharge: 500, largeSurcharge: 2000, maxCod: 100_000 }));
    expect((await withTenant(a, (tx) => quoteCourierFee(tx, a, { zoneId: zoneA, size: "large" }))).fee).toBe(3500);
    await expect(withTenant(a, (tx) => quoteCourierFee(tx, a, { zoneId: zoneB, size: "small" }))).rejects.toThrow(/Zone/);
    await expect(withTenant(a, (tx) => createCourierJob(tx, a, job({ recipientPhone: "12" })))).rejects.toThrow(/destinataire invalide/);
    await expect(withTenant(a, (tx) => createCourierJob(tx, a, job({ codAmount: 150_000 })))).rejects.toThrow(/plafond/);
    const j = await withTenant(a, (tx) => createCourierJob(tx, a, job({ size: "medium" })));
    expect(j.reference).toMatch(/^LIV-\d{4}-\d{6}$/);
    expect(j.fee).toBe(2000);
    expect(j.deliveryCode).toMatch(/^\d{4}$/);
    expect(j.status).toBe("pending");
  });

  it("livraison : code vérifié, encaissement exact, livreur limité à SES courses", async () => {
    const j = await withTenant(a, (tx) => createCourierJob(tx, a, job({ feePaidBy: "recipient", codAmount: 20_000 })));
    // Prise en charge impossible avant affectation ; un autre livreur ne voit pas la course.
    await expect(withTenant(a, (tx) => advanceCourierJob(tx, a, j.id, "picked_up", { type: "deliverer", delivererId: moussa.id }))).rejects.toThrow(/introuvable/);
    await withTenant(a, (tx) => assignCourierJob(tx, a, j.id, moussa.id, staff));
    await expect(withTenant(a, (tx) => advanceCourierJob(tx, a, j.id, "picked_up", { type: "deliverer", delivererId: awa.id }))).rejects.toThrow(/introuvable/);
    await expect(withTenant(a, (tx) => assignCourierJob(tx, a, j.id, awa.id, { type: "deliverer", delivererId: moussa.id }))).rejects.toThrow(/réservée au bureau/);
    await withTenant(a, (tx) => advanceCourierJob(tx, a, j.id, "picked_up", { type: "deliverer", delivererId: moussa.id }));
    const space = await withTenant(a, (tx) => getCourierSpace(tx, a, moussa.accessToken));
    expect(space!.jobs.find((x) => x.id === j.id)!.toCollect).toBe(21_500);
    expect((await withTenant(a, (tx) => getCourierSpace(tx, a, awa.accessToken)))!.jobs.some((x) => x.id === j.id)).toBe(false);
    // Destinataire : voit le code ; expéditeur : jamais.
    expect((await withTenant(a, (tx) => getCourierTracking(tx, a, j.recipientToken)))!.code).toBe(j.deliveryCode);
    expect((await withTenant(a, (tx) => getCourierTracking(tx, a, j.senderToken)))!.code).toBeNull();
    const driver = { type: "deliverer" as const, delivererId: moussa.id };
    const wrong = j.deliveryCode === "0000" ? "1111" : "0000";
    await expect(withTenant(a, (tx) => deliverCourierJob(tx, a, j.id, { proof: { type: "code", code: wrong }, collectedAmount: 21_500, actor: driver }))).rejects.toThrow(/Code de remise incorrect/);
    await expect(withTenant(a, (tx) => deliverCourierJob(tx, a, j.id, { proof: { type: "code", code: j.deliveryCode }, collectedAmount: 20_000, actor: driver }))).rejects.toThrow(/21500 FCFA exactement/);
    const done = await withTenant(a, (tx) => deliverCourierJob(tx, a, j.id, { proof: { type: "code", code: j.deliveryCode }, collectedAmount: 21_500, actor: driver }));
    expect(done.status).toBe("delivered");
    expect(done.collectedAmount).toBe(21_500);
    // Statut définitif, montants figés (déclencheur), même en écrivant directement.
    const o = testOwnerClient();
    await expect(o.courierJob.update({ where: { id: j.id }, data: { status: "failed", failureReason: "x" } })).rejects.toThrow(/définitif/);
    await expect(o.courierJob.update({ where: { id: j.id }, data: { collectedAmount: 1000 } })).rejects.toThrow();
    await o.$disconnect();
  });

  it("échecs plafonnés, nouvelle tentative puis retour à l'expéditeur ; annulation avant prise en charge seulement", async () => {
    await withTenant(a, (tx) => updateCourierSettings(tx, a, { maxAttempts: 2 }));
    const j = await withTenant(a, (tx) => createCourierJob(tx, a, job()));
    const driver = { type: "deliverer" as const, delivererId: moussa.id };
    await onRoad(j.id);
    await expect(withTenant(a, (tx) => failCourierJob(tx, a, j.id, " ", driver))).rejects.toThrow(/motif/);
    await withTenant(a, (tx) => failCourierJob(tx, a, j.id, "Destinataire absent", driver));
    await onRoad(j.id, awa.id);
    await withTenant(a, (tx) => failCourierJob(tx, a, j.id, "Téléphone éteint", { type: "deliverer", delivererId: awa.id }));
    await expect(withTenant(a, (tx) => assignCourierJob(tx, a, j.id, moussa.id, staff))).rejects.toThrow(/retournée/);
    await withTenant(a, (tx) => startCourierReturn(tx, a, j.id, awa.id, staff));
    const back = await withTenant(a, (tx) => completeCourierReturn(tx, a, j.id, { type: "deliverer", delivererId: awa.id }));
    expect(back.status).toBe("returned");
    expect(back.attempts).toBe(2);
    const c = await withTenant(a, (tx) => createCourierJob(tx, a, job()));
    await onRoad(c.id);
    await expect(withTenant(a, (tx) => cancelCourierJob(tx, a, c.id, "Client annule", staff))).rejects.toThrow(/déjà pris en charge/);
    const p = await withTenant(a, (tx) => createCourierJob(tx, a, job()));
    await expect(withTenant(a, (tx) => cancelCourierJob(tx, a, p.id, "", staff))).rejects.toThrow(/motif/);
    expect((await withTenant(a, (tx) => cancelCourierJob(tx, a, p.id, "Commande annulée par le client", staff))).status).toBe("canceled");
    await withTenant(a, (tx) => updateCourierSettings(tx, a, { maxAttempts: 3 }));
  });

  it("espèces : livreur → bureau (écart motivé) → expéditeur, sans double comptage", async () => {
    // Deux livraisons avec encaissement par Awa.
    const driver = { type: "deliverer" as const, delivererId: awa.id };
    const ids: string[] = [];
    for (const cod of [10_000, 5_000]) {
      const j = await withTenant(a, (tx) => createCourierJob(tx, a, job({ codAmount: cod })));
      await onRoad(j.id, awa.id);
      await withTenant(a, (tx) => deliverCourierJob(tx, a, j.id, { proof: { type: "name", name: "Le gardien" }, collectedAmount: cod, actor: driver }));
      ids.push(j.id);
    }
    const before = await withTenant(a, (tx) => senderBalance(tx, a, senderId));
    expect(before.notYetRemitted.amount).toBeGreaterThanOrEqual(15_000);
    await expect(withTenant(a, (tx) => recordRemittance(tx, a, { delivererId: awa.id, receivedAmount: 14_000, receivedBy: null }))).rejects.toThrow(/Motivez l'écart/);
    const r = await withTenant(a, (tx) => recordRemittance(tx, a, { delivererId: awa.id, receivedAmount: 14_000, discrepancyNote: "Monnaie rendue par erreur, à retenir", receivedBy: null }));
    expect(r.receiptNumber).toMatch(/^VER-\d{4}-\d{6}$/);
    expect(r.expectedAmount).toBe(15_000);
    await expect(withTenant(a, (tx) => recordRemittance(tx, a, { delivererId: awa.id, receivedAmount: 1, receivedBy: null }))).rejects.toThrow(/Aucune somme/);
    // Moussa : 21 500 encaissés (test précédent), toujours chez lui.
    const rec = await withTenant(a, (tx) => courierReconciliation(tx, a));
    expect(rec.couriers.find((c) => c.id === moussa.id)!.cash.amount).toBe(21_500);
    expect(rec.totals.shortfalls).toBe(1_000);
    // Reversement : COD des courses versées (15 000) − tarifs à la charge de l'expéditeur.
    const bal = await withTenant(a, (tx) => senderBalance(tx, a, senderId));
    expect(bal.notYetRemitted.amount).toBe(20_000); // course de Moussa : non versée, pas reversable
    const s = await withTenant(a, (tx) => settleSender(tx, a, { senderId, method: "wave", reference: "WV-1", settledBy: null }));
    expect(s.receiptNumber).toMatch(/^REV-\d{4}-\d{6}$/);
    expect(s.codTotal).toBe(15_000);
    expect(s.amount).toBe(s.codTotal - s.feesDeducted);
    await expect(withTenant(a, (tx) => settleSender(tx, a, { senderId, method: "wave", settledBy: null }))).rejects.toThrow(/Rien à régler/);
    const o = testOwnerClient();
    await expect(o.courierJob.update({ where: { id: ids[0] }, data: { settlementId: null } })).rejects.toThrow(/reversée/);
    await o.$disconnect();
  });

  it("livreur désactivé ou lien renouvelé ; vue d'ensemble ; isolation entre sociétés", async () => {
    const j = await withTenant(a, (tx) => createCourierJob(tx, a, job()));
    await withTenant(a, (tx) => assignCourierJob(tx, a, j.id, moussa.id, staff));
    await expect(withTenant(a, (tx) => updateCourier(tx, a, moussa.id, { isActive: false }))).rejects.toThrow(/courses en cours/);
    const old = moussa.accessToken;
    await withTenant(a, (tx) => rotateCourierToken(tx, a, moussa.id));
    expect(await withTenant(a, (tx) => getCourierSpace(tx, a, old))).toBeNull();
    const o = await withTenant(a, (tx) => courierOverview(tx, a));
    expect(o.onTheRoad).toBeGreaterThan(0);
    expect(o.cashInHands).toBe(21_500);
    // Société B : rien de A, aucune écriture possible sur A.
    expect(await withTenant(b, (tx) => tx.courierJob.count())).toBe(0);
    expect(await withTenant(b, (tx) => getCourierTracking(tx, b, j.senderToken))).toBeNull();
    expect(await withTenant(b, (tx) => getCourierSpace(tx, b, awa.accessToken))).toBeNull();
    await expect(withTenant(b, (tx) => assignCourierJob(tx, b, j.id, moussa.id, staff))).rejects.toThrow(/introuvable/);
    await expect(withTenant(b, (tx) => recordRemittance(tx, b, { delivererId: awa.id, receivedAmount: 0, receivedBy: null }))).rejects.toThrow(/introuvable/);
    const bSender = await withTenant(b, (tx) => tx.customer.create({ data: { tenantId: b, firstName: "B", phone: "+221779990000" } }));
    await expect(withTenant(b, (tx) => createCourierJob(tx, b, job({ senderId: bSender.id, zoneId: zoneA })))).rejects.toThrow(/Zone/);
    // Même en écrivant directement : un livreur de A ne peut pas être rattaché à une course de B.
    const jb = await withTenant(b, (tx) => createCourierJob(tx, b, job({ senderId: bSender.id, zoneId: zoneB })));
    const own = testOwnerClient();
    await expect(own.courierJob.update({ where: { id: jb.id }, data: { delivererId: moussa.id, status: "assigned" } })).rejects.toThrow();
    await own.$disconnect();
  });
});
