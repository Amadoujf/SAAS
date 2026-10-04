/**
 * Démonstration AUTOMOBILE : « Baobab Motors », concession et importateur à Dakar
 * (fictive). Script de DÉVELOPPEMENT uniquement — jamais exécuté par la CI ni en
 * production. Tout passe par les VRAIS moteurs (stock, essais sans chevauchement,
 * prospects, dossiers de vente avec encaissements communs, importations).
 * Visuels : silhouettes génériques ORIGINALES rendues par scripts/demo-visuals/automobile.py,
 * marquées « démonstration », sans logo ni dessin de constructeur.
 *
 *   pnpm --filter @yamacommerce/database run seed:auto-demo
 */
import { prisma } from "./client";
import { withSuperAdminAccess, withTenant } from "./tenant-context";
import { assertDemoSeedAllowed } from "./demo-guard";
import { createOwnerAccount, provisionTenantForOwner } from "./tenant-provisioning";
import { saveStorefrontContent } from "./storefront-registry";
import { setListingStatus } from "./listing-registry";
import { addDays, utcToLocal, weekdayOf } from "./service-slots";
import {
  addLeadNote,
  advanceImport,
  bookTestDrive,
  createImport,
  createVehicle,
  deliverSale,
  moveLead,
  openSale,
  recordSalePayment,
  submitLeadRequest,
  updateAutoSettings,
  type VehicleInput,
} from "./auto-registry";

// AUTO_SEED=test : entreprise de TEST séparée (essais, banc IA), jamais la démo.
const TEST = process.env.AUTO_SEED === "test";
const SLUG = TEST ? "test-auto" : "baobab-motors";
const V = "/demo-templates/automobile";
const TZ = "Africa/Dakar";
const media = (key: string, title: string) => [1, 2, 3].map((n) => ({ url: `${V}/${key}-${n}.webp`, alt: `${title} — illustration ${n}`, demo: true }));

async function main() {
  assertDemoSeedAllowed();
  const existing = await withSuperAdminAccess((tx) => tx.tenant.findUnique({ where: { slug: SLUG } }));
  if (existing) {
    console.info("Démonstration automobile déjà présente — rien à faire.");
    return;
  }
  const owner = await createOwnerAccount({ email: TEST ? "awa@test-auto.sn" : "awa@baobab-motors.sn", fullName: "Awa Diallo", password: "Demo!2026" });
  const { tenantId } = await provisionTenantForOwner({
    ownerUserId: owner.id,
    name: TEST ? "Garage de test" : "Baobab Motors",
    subdomain: SLUG,
    subdomainSuffix: process.env.PLATFORM_SUBDOMAIN_SUFFIX ?? "yamacommerce.ai",
    sectorKey: "automobile",
    planName: "Business",
    templatePreference: "piste",
  });
  await withSuperAdminAccess(async (tx) => {
    const t = await tx.tenant.findUniqueOrThrow({ where: { id: tenantId } });
    await tx.tenant.update({
      where: { id: tenantId },
      data: { isDemo: true, timezone: TZ, branding: { ...(t.branding as object), contactPhone: "+221 33 820 17 40", contactWhatsapp: "+221771201740", contactEmail: "contact@baobab-motors.sn", contactAddress: "Route de Rufisque, Hann Maristes, Dakar" } },
    });
  });
  const staff = { userId: owner.id, type: "owner" as const };

  // Showroom : du lundi au vendredi 8 h 30 – 18 h 30, samedi 9 h – 17 h, fermé le dimanche.
  const hours = [1, 2, 3, 4, 5].map((weekday) => ({ weekday, startMinute: 8 * 60 + 30, endMinute: 18 * 60 + 30 })).concat([{ weekday: 6, startMinute: 9 * 60, endMinute: 17 * 60 }]);
  await withTenant(tenantId, (tx) => updateAutoSettings(tx, tenantId, { openingHours: hours, testDriveMinutes: 45, slotStepMinutes: 30, maxAdvanceDays: 21, depositPercent: 10 }));

  const stock: [string, VehicleInput][] = [
    ["rav4", { make: "Toyota", model: "RAV4", version: "Hybride Dynamic", year: 2021, mileageKm: 38_500, fuel: "hybride", transmission: "automatique", bodyType: "suv", color: "Blanc nacré", engine: "2.5 hybride 218 ch", seats: 5, condition: "used", price: 18_900_000, featured: true, negotiable: true, features: ["climatisation", "camera_recul", "radar_recul", "carplay", "regulateur", "jantes_alu"], summary: "Première main, entretien complet au réseau, consommation maîtrisée en ville.", description: "Véhicule contrôlé en atelier (freins, trains roulants, batterie hybride).\nCarnet d'entretien à jour, deux clés, pneus récents." }],
    ["hilux", { make: "Toyota", model: "Hilux", version: "Double cabine", year: 2020, mileageKm: 72_000, fuel: "diesel", transmission: "manuelle", bodyType: "pickup", color: "Gris argent", engine: "2.4 D-4D 150 ch", seats: 5, condition: "used", price: 21_500_000, featured: true, features: ["climatisation", "4_roues_motrices", "bluetooth", "regulateur"], summary: "Le pick-up de travail qui ne lâche pas : 4×4, benne protégée, attelage.", description: "Utilisé par une entreprise de BTP, suivi régulier. Benne avec revêtement, attelage d'origine." }],
    ["tucson", { make: "Hyundai", model: "Tucson", version: "Executive", year: 2022, mileageKm: 21_300, fuel: "essence", transmission: "automatique", bodyType: "suv", color: "Bleu nuit", engine: "1.6 T-GDi 180 ch", seats: 5, condition: "used", price: 17_200_000, featured: true, features: ["climatisation", "gps", "camera_recul", "cuir", "sieges_chauffants", "carplay", "toit_ouvrant"], summary: "Presque neuf, toutes options, garantie constructeur restante." }],
    ["picanto", { make: "Kia", model: "Picanto", year: 2021, mileageKm: 29_800, fuel: "essence", transmission: "manuelle", bodyType: "citadine", color: "Rouge", engine: "1.0 67 ch", seats: 4, condition: "used", price: 6_400_000, features: ["climatisation", "bluetooth"], summary: "Idéale pour la ville : se gare partout, consomme très peu." }],
    ["prado", { make: "Toyota", model: "Land Cruiser Prado", version: "VX", year: 2019, mileageKm: 88_000, fuel: "diesel", transmission: "automatique", bodyType: "4x4", color: "Noir", engine: "2.8 D-4D 177 ch", seats: 7, condition: "imported_used", price: 32_000_000, featured: true, features: ["climatisation", "4_roues_motrices", "cuir", "gps", "camera_recul", "regulateur", "jantes_alu"], summary: "Sept places, 4×4 permanent, importé et dédouané." }],
    ["508", { make: "Peugeot", model: "508", version: "Allure", year: 2020, mileageKm: 54_000, fuel: "diesel", transmission: "automatique", bodyType: "berline", color: "Gris platine", engine: "1.5 BlueHDi 130 ch", seats: 5, condition: "used", price: 12_900_000, features: ["climatisation", "gps", "camera_recul", "carplay", "regulateur"], summary: "Berline confortable pour la route, faible consommation." }],
    ["swift", { make: "Suzuki", model: "Swift", year: 2020, mileageKm: 41_000, fuel: "essence", transmission: "manuelle", bodyType: "citadine", color: "Jaune", engine: "1.2 83 ch", seats: 5, condition: "used", price: 5_900_000, features: ["climatisation", "bluetooth"] }],
    ["l200", { make: "Mitsubishi", model: "L200", version: "Double cabine", year: 2021, mileageKm: 46_000, fuel: "diesel", transmission: "manuelle", bodyType: "pickup", color: "Blanc", engine: "2.2 DI-D 150 ch", seats: 5, condition: "imported_used", price: 16_800_000, summary: "En provenance de Belgique : arrivée prévue dans trois semaines." }],
    ["santafe", { make: "Hyundai", model: "Santa Fe", year: 2021, mileageKm: 35_000, fuel: "diesel", transmission: "automatique", bodyType: "suv", color: "Vert gris", engine: "2.2 CRDi 200 ch", seats: 7, condition: "imported_used", price: 22_000_000, features: ["climatisation", "4_roues_motrices", "cuir", "camera_recul"], summary: "Sept places, arrivé au port : dédouanement en cours." }],
    ["corolla", { make: "Toyota", model: "Corolla", year: 2019, mileageKm: 63_000, fuel: "essence", transmission: "automatique", bodyType: "berline", color: "Blanc", engine: "1.6 132 ch", seats: 5, condition: "used", price: 9_200_000, features: ["climatisation", "bluetooth", "camera_recul"] }],
  ];
  const ids: Record<string, string> = {};
  await withTenant(tenantId, async (tx) => {
    for (const [key, input] of stock) {
      const v = await createVehicle(tx, tenantId, { ...input, media: media(key, `${input.make} ${input.model}`) }, owner.id);
      await setListingStatus(tx, tenantId, v.id, "published", owner.id);
      ids[key] = v.id;
    }
  });

  // Importations : le L200 en mer, le Santa Fe au dédouanement (client déjà trouvé).
  const today = utcToLocal(new Date(), TZ).date;
  await withTenant(tenantId, async (tx) => {
    const a = await createImport(tx, tenantId, { listingId: ids.l200!, origin: "Belgique (Anvers)", eta: addDays(today, 21), vessel: "Grande Dakar", containerRef: "MSKU 481 220-7", actorUserId: owner.id });
    await advanceImport(tx, tenantId, a.id, "shipped", owner.id, { note: "Embarqué à Anvers" });
    const b = await createImport(tx, tenantId, { listingId: ids.santafe!, origin: "Corée du Sud (Busan)", eta: addDays(today, 6), vessel: "Hoegh Trigon", customer: { firstName: "Mamadou", lastName: "Diop", phone: "77 540 18 26" }, actorUserId: owner.id });
    await advanceImport(tx, tenantId, b.id, "shipped", owner.id);
    await advanceImport(tx, tenantId, b.id, "at_port", owner.id, { note: "Déchargé au port autonome de Dakar" });
    await advanceImport(tx, tenantId, b.id, "customs", owner.id, { note: "Déclaration déposée" });
  });

  // Ventes : Corolla remise (payée en deux fois), Prado réservé avec acompte.
  await withTenant(tenantId, async (tx) => {
    const c = await openSale(tx, tenantId, { listingId: ids.corolla!, customer: { firstName: "Fatou", lastName: "Ndiaye", phone: "76 331 90 12" }, agreedPrice: 9_000_000, actor: staff });
    await recordSalePayment(tx, tenantId, { reservationId: c.id, amount: 900_000, method: "wave", kind: "deposit", reference: "WV-55120", actorUserId: owner.id });
    await recordSalePayment(tx, tenantId, { reservationId: c.id, amount: 8_100_000, method: "bank_transfer", kind: "balance", reference: "VIR CBAO 0932", actorUserId: owner.id });
    await deliverSale(tx, tenantId, c.id, staff);
    const p = await openSale(tx, tenantId, { listingId: ids.prado!, customer: { firstName: "Ousmane", lastName: "Sy", phone: "77 612 48 03" }, agreedPrice: 31_000_000, tradeInValue: 6_500_000, tradeInDescription: "Toyota Fortuner 2014, 160 000 km", actor: staff });
    await recordSalePayment(tx, tenantId, { reservationId: p.id, amount: 2_450_000, method: "orange_money", kind: "deposit", reference: "OM-77310", actorUserId: owner.id });
  });

  // Essais : les prochains jours ouverts.
  const openDays: string[] = [];
  for (let i = 1; openDays.length < 3; i++) if (weekdayOf(addDays(today, i)) !== 0) openDays.push(addDays(today, i));
  const drives: [string, number, number, [string, string, string]][] = [
    ["rav4", 0, 10 * 60, ["Khady", "Sarr", "77 204 61 90"]],
    ["tucson", 0, 11 * 60, ["Moussa", "Faye", "78 450 12 77"]],
    ["hilux", 0, 15 * 60, ["Ibrahima", "Ndoye", "77 812 33 05"]],
    ["rav4", 1, 9 * 60 + 30, ["Aminata", "Ba", "76 118 42 60"]],
    ["508", 1, 14 * 60, ["Cheikh", "Gueye", "70 245 81 19"]],
    ["picanto", 2, 10 * 60 + 30, ["Rama", "Seck", "77 390 72 44"]],
  ];
  for (const [key, day, minute, [firstName, lastName, phone]] of drives) {
    await withTenant(tenantId, (tx) => bookTestDrive(tx, tenantId, { listingId: ids[key]!, date: openDays[day]!, minute, customer: { firstName, lastName, phone }, licenseConfirmed: true, channel: day === 0 ? "web" : "phone", actor: day === 0 ? { userId: null, type: "customer" } : staff }));
  }

  // Prospects : demandes du site, un contacté, un perdu (motif).
  await withTenant(tenantId, async (tx) => {
    const l1 = await submitLeadRequest(tx, tenantId, { listingId: ids.hilux!, interest: "financing", customer: { firstName: "Abdou", lastName: "Mbaye", phone: "77 661 20 38" }, budget: 8_000_000, message: "Possible avec 8 millions d'apport ?", actor: { userId: null, type: "customer" } });
    await moveLead(tx, tenantId, l1.id, "contacted", staff);
    await addLeadNote(tx, tenantId, l1.id, "Rappelé : dossier bancaire à la CBAO, revient jeudi avec ses relevés.", staff);
    await submitLeadRequest(tx, tenantId, { listingId: ids.picanto!, interest: "trade_in", customer: { firstName: "Mariama", lastName: "Kane", phone: "76 902 15 44" }, tradeIn: "Hyundai i10 2015, 98 000 km", actor: { userId: null, type: "customer" } });
    await submitLeadRequest(tx, tenantId, { listingId: null, interest: "import_request", customer: { firstName: "Serigne", lastName: "Lo", phone: "77 128 55 30" }, budget: 25_000_000, message: "Je cherche un Toyota Land Cruiser 300, 2022, blanc.", actor: { userId: null, type: "customer" } });
    const l4 = await submitLeadRequest(tx, tenantId, { listingId: ids.swift!, interest: "purchase", customer: { firstName: "Nogaye", lastName: "Fall", phone: "78 390 61 02" }, message: "Toujours disponible ?", actor: { userId: null, type: "customer" } });
    await moveLead(tx, tenantId, l4.id, "contacted", staff);
    await moveLead(tx, tenantId, l4.id, "lost", staff, "A acheté un véhicule neuf ailleurs");
  });

  await withTenant(tenantId, (tx) =>
    saveStorefrontContent(tx, tenantId, {
      announcement: { text: "Arrivage : Hyundai Santa Fe 7 places, disponible à l'essai la semaine prochaine", href: "/vehicules?stock=arrivage" },
      hero: {
        autoplaySeconds: 7,
        slides: [
          { id: "piste", imageUrl: `${V}/showroom.webp`, mobileImageUrl: `${V}/showroom-mobile.webp`, imageAlt: "SUV bleu nuit en studio", demo: true, productId: null, eyebrow: "Concession · Hann Maristes, Dakar", title: "Baobab Motors", subtitle: "Véhicules contrôlés en atelier, essai sur rendez-vous, reprise de votre véhicule et importation sur commande.", ctaLabel: "Voir les véhicules", ctaHref: "/vehicules", theme: "dark" },
        ],
      },
      featuredCategoryIds: [],
      featuredProductIds: [],
      collections: [],
      reassurance: [],
    }, owner.id),
  );
  console.info(`[${SLUG}] Démonstration automobile créée : Baobab Motors (awa@baobab-motors.sn / Demo!2026), ${stock.length} véhicules, ${drives.length} essais.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
