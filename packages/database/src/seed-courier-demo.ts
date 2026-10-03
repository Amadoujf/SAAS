/**
 * Démonstration LIVRAISON : « Sama Coursier », société de coursiers à Dakar (fictive).
 * Script de DÉVELOPPEMENT uniquement — jamais exécuté par la CI ni en production. Tout
 * passe par les VRAIS moteurs (tarifs de zone, affectation, remise avec code, échecs,
 * retours, versements des livreurs, reversements aux expéditeurs).
 *
 *   pnpm --filter @yamacommerce/database run seed:courier-demo
 *
 * Société de TEST pour les vérifications navigateur (jamais la démo) :
 *   COURIER_SEED=test pnpm --filter @yamacommerce/database run seed:courier-demo
 */
import { prisma } from "./client";
import { withSuperAdminAccess, withTenant } from "./tenant-context";
import { assertDemoSeedAllowed } from "./demo-guard";
import { createOwnerAccount, provisionTenantForOwner } from "./tenant-provisioning";
import { saveStorefrontContent } from "./storefront-registry";
import { createDeliveryZone } from "./commerce-registry";
import {
  advanceCourierJob,
  assignCourierJob,
  completeCourierReturn,
  createCourier,
  createCourierJob,
  deliverCourierJob,
  failCourierJob,
  recordRemittance,
  settleSender,
  startCourierReturn,
  updateCourierSettings,
  type CourierJobInput,
} from "./courier-registry";

const TEST = process.env.COURIER_SEED === "test";
const SLUG = TEST ? "test-livraison" : "sama-coursier";
const NAME = TEST ? "Livraison de test" : "Sama Coursier";
const MAIL = TEST ? "test-livraison.sn" : "sama-coursier.sn";

async function main() {
  assertDemoSeedAllowed();
  if (await withSuperAdminAccess((tx) => tx.tenant.findUnique({ where: { slug: SLUG } }))) {
    console.info(`${NAME} déjà présent — rien à faire.`);
    return;
  }
  const owner = await createOwnerAccount({ email: `bureau@${MAIL}`, fullName: "Ibrahima Sène", password: "Demo!2026" });
  const { tenantId } = await provisionTenantForOwner({ ownerUserId: owner.id, name: NAME, subdomain: SLUG, subdomainSuffix: process.env.PLATFORM_SUBDOMAIN_SUFFIX ?? "yamacommerce.ai", sectorKey: "delivery", planName: "Business", templatePreference: "trajet" });
  await withSuperAdminAccess(async (tx) => {
    const t = await tx.tenant.findUniqueOrThrow({ where: { id: tenantId } });
    await tx.tenant.update({ where: { id: tenantId }, data: { isDemo: true, timezone: "Africa/Dakar", branding: { ...(t.branding as object), contactPhone: "+221 33 822 40 18", contactWhatsapp: "+221778224018", contactEmail: `bureau@${MAIL}`, contactAddress: "Avenue Blaise Diagne, Médina, Dakar" } } });
  });
  const staff = { type: "staff" as const, userId: owner.id };
  await withTenant(tenantId, (tx) => updateCourierSettings(tx, tenantId, { mediumSurcharge: 500, largeSurcharge: 1500, maxCod: 300_000, maxAttempts: 3, publicRequests: true }));

  const zones: Record<string, string> = {};
  for (const [key, name, region, fee, days] of [
    ["plateau", "Plateau · Médina", "Dakar", 1500, 0],
    ["mermoz", "Mermoz · Sacré-Cœur · Fann", "Dakar", 2000, 0],
    ["almadies", "Almadies · Ngor · Ouakam", "Dakar", 2500, 0],
    ["parcelles", "Parcelles · Grand Yoff", "Dakar", 2500, 0],
    ["pikine", "Pikine · Guédiawaye", "Dakar", 3000, 0],
    ["rufisque", "Rufisque · Diamniadio", "Dakar", 3500, 1],
    ["thies", "Thiès", "Thiès", 5000, 1],
  ] as const) {
    zones[key] = (await withTenant(tenantId, (tx) => createDeliveryZone(tx, tenantId, { name, region, fee, bulkySurcharge: 0, estimatedDays: days }))).id;
  }
  const couriers: Record<string, string> = {};
  for (const [key, name, phone, vehicle] of [["moussa", "Moussa Diop", "77 610 22 41", "Moto"], ["aliou", "Aliou Ba", "78 402 19 63", "Moto"], ["fatou", "Fatou Gueye", "76 905 33 12", "Moto"], ["cheikh", "Cheikh Ndiaye", "77 231 80 54", "Voiture"]] as const) {
    couriers[key] = (await withTenant(tenantId, (tx) => createCourier(tx, tenantId, { name, phone, vehicleType: vehicle }))).id;
  }
  const senders: Record<string, { firstName: string; phone: string; address: string }> = {
    wax: { firstName: "Boutique Ndèye Wax", phone: "77 540 12 88", address: "Marché HLM, cantine 41" },
    cosm: { firstName: "Fatou Cosmétiques", phone: "76 223 45 10", address: "Liberté 6, villa 212" },
    elec: { firstName: "Diallo Électronique", phone: "77 880 31 09", address: "Rue Sandiniéry, Plateau" },
    pat: { firstName: "Pâtisserie Awa", phone: "70 118 60 27", address: "Sacré-Cœur 3, villa 8740" },
  };
  const job = (s: keyof typeof senders, zone: string, recipient: [string, string, string], extra: Partial<CourierJobInput> = {}): CourierJobInput => ({
    sender: { firstName: senders[s]!.firstName, phone: senders[s]!.phone },
    pickupName: senders[s]!.firstName,
    pickupPhone: senders[s]!.phone,
    pickupAddress: senders[s]!.address,
    recipientName: recipient[0],
    recipientPhone: recipient[1],
    dropoffAddress: recipient[2],
    zoneId: zones[zone]!,
    packageDescription: "Colis",
    size: "small",
    feePaidBy: "sender",
    codAmount: 0,
    channel: "phone",
    actor: staff,
    ...extra,
  });
  const make = (i: CourierJobInput) => withTenant(tenantId, (tx) => createCourierJob(tx, tenantId, i));
  const drive = async (id: string, c: string) => {
    const d = { type: "deliverer" as const, delivererId: couriers[c]! };
    await withTenant(tenantId, (tx) => assignCourierJob(tx, tenantId, id, couriers[c]!, staff));
    await withTenant(tenantId, (tx) => advanceCourierJob(tx, tenantId, id, "picked_up", d));
    await withTenant(tenantId, (tx) => advanceCourierJob(tx, tenantId, id, "in_transit", d));
  };
  const deliver = async (j: { id: string; deliveryCode: string; codAmount: number; fee: number; feePaidBy: string }, c: string, byName?: string) =>
    withTenant(tenantId, (tx) => deliverCourierJob(tx, tenantId, j.id, { proof: byName ? { type: "name", name: byName } : { type: "code", code: j.deliveryCode }, collectedAmount: j.codAmount + (j.feePaidBy === "recipient" ? j.fee : 0), actor: { type: "deliverer", delivererId: couriers[c]! } }));

  // Livrées ce matin (espèces versées au bureau puis, pour la boutique wax, reversées).
  const done: [keyof typeof senders, string, [string, string, string], Partial<CourierJobInput>, string, string?][] = [
    ["wax", "mermoz", ["Aïssatou Sarr", "77 301 44 90", "Mermoz, rue MZ-12, villa 3"], { codAmount: 18_000, packageDescription: "Deux ensembles en wax" }, "moussa"],
    ["wax", "parcelles", ["Mame Faye", "78 220 16 45", "Parcelles U17, villa 221"], { codAmount: 25_000, feePaidBy: "recipient", packageDescription: "Robe de cérémonie", size: "medium" }, "aliou"],
    ["cosm", "almadies", ["Oumy Diallo", "76 441 09 83", "Ngor village, près de la mosquée"], { codAmount: 12_500, packageDescription: "Coffret soins" }, "fatou", "Sa sœur, Khady"],
    ["elec", "plateau", ["Serigne Mbaye", "77 700 51 26", "Immeuble Kébé, 4e étage"], { codAmount: 95_000, packageDescription: "Téléphone neuf, scellé" }, "moussa"],
    ["pat", "mermoz", ["Ndeye Seck", "77 188 32 07", "Sacré-Cœur 1, villa 12"], { packageDescription: "Gâteau d'anniversaire", size: "medium", instructions: "Garder à plat" }, "fatou"],
  ];
  for (const [s, z, r, extra, c, byName] of done) {
    const j = await make(job(s, z, r, extra));
    await drive(j.id, c);
    await deliver(j, c, byName);
  }
  await withTenant(tenantId, (tx) => recordRemittance(tx, tenantId, { delivererId: couriers.aliou!, receivedAmount: 28_000, receivedBy: owner.id }));
  await withTenant(tenantId, (tx) => recordRemittance(tx, tenantId, { delivererId: couriers.fatou!, receivedAmount: 12_000, discrepancyNote: "Monnaie manquante, retenue sur la prochaine course", receivedBy: owner.id }));
  const wax = await withTenant(tenantId, (tx) => tx.customer.findFirstOrThrow({ where: { tenantId, firstName: senders.wax!.firstName } }));
  // Le colis de Moussa (wax, 18 000) n'est pas encore versé : seul celui d'Aliou est reversable.
  await withTenant(tenantId, (tx) => settleSender(tx, tenantId, { senderId: wax.id, method: "wave", reference: "WV-88213", settledBy: owner.id }));

  // En cours : sur la route, pris en charge, affectée, à affecter (dont une demande en ligne).
  const onRoad = await make(job("cosm", "pikine", ["Rokhaya Ndiaye", "77 604 18 22", "Pikine Icotaf, rue 10"], { codAmount: 9_000, packageDescription: "Parfum et crème" }));
  await drive(onRoad.id, "aliou");
  const picked = await make(job("elec", "rufisque", ["Babacar Thiam", "78 115 67 40", "Rufisque, quartier Keury Souf"], { codAmount: 42_000, packageDescription: "Enceinte portable", size: "medium" }));
  await withTenant(tenantId, (tx) => assignCourierJob(tx, tenantId, picked.id, couriers.cheikh!, staff));
  await withTenant(tenantId, (tx) => advanceCourierJob(tx, tenantId, picked.id, "picked_up", { type: "deliverer", delivererId: couriers.cheikh! }));
  const assigned = await make(job("pat", "almadies", ["Marième Kane", "77 390 44 16", "Ouakam, cité Avion, villa 54"], { packageDescription: "Boîte de macarons" }));
  await withTenant(tenantId, (tx) => assignCourierJob(tx, tenantId, assigned.id, couriers.fatou!, staff));
  await make(job("wax", "thies", ["Awa Cissé", "77 612 90 31", "Thiès, quartier Randoulène"], { codAmount: 30_000, packageDescription: "Trois pagnes tissés", size: "medium" }));
  await make({ ...job("cosm", "mermoz", ["Coumba Sy", "76 330 12 85", "Fann Résidence, rue F"], { codAmount: 7_500, packageDescription: "Savons artisanaux" }), channel: "web", actor: { type: "customer" } });

  // Échec puis retour ; un échec en attente de décision.
  const back = await make(job("elec", "parcelles", ["Pape Diouf", "70 902 11 48", "Parcelles U24, villa 17"], { codAmount: 60_000, packageDescription: "Chargeur et écouteurs" }));
  await drive(back.id, "moussa");
  await withTenant(tenantId, (tx) => failCourierJob(tx, tenantId, back.id, "Refus du colis", { type: "deliverer", delivererId: couriers.moussa! }));
  await withTenant(tenantId, (tx) => startCourierReturn(tx, tenantId, back.id, couriers.moussa!, staff));
  await withTenant(tenantId, (tx) => completeCourierReturn(tx, tenantId, back.id, { type: "deliverer", delivererId: couriers.moussa! }));
  const failed = await make(job("wax", "pikine", ["Astou Mbengue", "77 455 61 02", "Guédiawaye, Hamo 5"], { codAmount: 15_000, packageDescription: "Tenue de fête" }));
  await drive(failed.id, "aliou");
  await withTenant(tenantId, (tx) => failCourierJob(tx, tenantId, failed.id, "Destinataire absent", { type: "deliverer", delivererId: couriers.aliou! }));

  await withTenant(tenantId, (tx) =>
    saveStorefrontContent(tx, tenantId, {
      announcement: { text: "Livraison dans la journée partout à Dakar · commandez avant 15 h", href: "/envoyer" },
      hero: { autoplaySeconds: 7, slides: [{ id: "trajet", imageUrl: "/demo-templates/livraison/plan-ville.webp", mobileImageUrl: null, imageAlt: "Plan de ville et tracé d'une course", demo: true, productId: null, eyebrow: "Coursiers à moto · Dakar et Thiès", title: NAME, subtitle: "Vos colis livrés dans la journée, suivis étape par étape, remis contre un code. L'argent encaissé pour vous vous est reversé avec un reçu.", ctaLabel: "Envoyer un colis", ctaHref: "/envoyer", theme: "dark" }] },
      featuredCategoryIds: [],
      featuredProductIds: [],
      collections: [],
      reassurance: [],
    }, owner.id),
  );
  const links = await withTenant(tenantId, (tx) => tx.deliverer.findMany({ where: { tenantId }, select: { name: true, accessToken: true } }));
  console.info(`${NAME} créé (bureau@${MAIL} / Demo!2026). Livreurs : ${links.map((l) => `${l.name} → /livreur/${l.accessToken}`).join(" ; ")}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
