/**
 * Démonstration SALON : « Maison Adja », coiffure, tresses, ongles et soins à Dakar.
 * Script de DÉVELOPPEMENT uniquement — jamais exécuté par la CI ni en production. Tout
 * passe par les VRAIS moteurs (prestations, équipe, horaires, rendez-vous vérifiés).
 * Visuels : illustrations ORIGINALES rendues par scripts/demo-visuals/salon.py, marquées
 * `demo: true`. Aucun portrait inventé : l'équipe s'affiche en monogramme.
 *
 *   pnpm --filter @yamacommerce/database run seed:salon-demo
 */
import { prisma } from "./client";
import { withSuperAdminAccess, withTenant } from "./tenant-context";
import { assertDemoSeedAllowed } from "./demo-guard";
import { createOwnerAccount, provisionTenantForOwner } from "./tenant-provisioning";
import { setListingStatus } from "./listing-registry";
import { saveStorefrontContent } from "./storefront-registry";
import { addTimeOff, bookAppointment, createService, createStaff, updateBookingSettings, type ServiceInput } from "./service-registry";
import { addDays, localToUtc, utcToLocal } from "./service-slots";

const SLUG = "maison-adja";
const V = "/demo-templates/salon";
const img = (name: string, alt: string) => ({ url: `${V}/${name}.webp`, alt, demo: true });
const TZ = "Africa/Dakar";
const h = (hh: number, mm = 0) => hh * 60 + mm;

// Mardi → samedi, pause déjeuner ; lundi après-midi pour certaines.
const week = (days: number[], ranges: [number, number][]) => days.flatMap((weekday) => ranges.map(([startMinute, endMinute]) => ({ weekday, startMinute, endMinute })));
const TEAM = [
  { key: "adja", displayName: "Adja", title: "Fondatrice · coiffure", bio: "Vingt ans de coiffure entre Dakar et Paris ; coupes, couleurs et coiffures de cérémonie.", hours: week([2, 3, 4, 5, 6], [[h(9), h(13)], [h(14), h(19)]]) },
  { key: "rama", displayName: "Rama", title: "Tresses et locks", bio: "Tresses collées, box braids, entretien de locks : patience et précision.", hours: [...week([2, 3, 4, 5], [[h(9), h(13)], [h(14), h(20)]]), ...week([6], [[h(8), h(20)]])] },
  { key: "mariama", displayName: "Mariama", title: "Coiffure et soins capillaires", bio: "Soins profonds, défrisage doux et brushing qui tient.", hours: [...week([1], [[h(14), h(20)]]), ...week([2, 3, 4, 5, 6], [[h(10), h(14)], [h(15), h(20)]])] },
  { key: "khadija", displayName: "Khadija", title: "Onglerie", bio: "Semi-permanent, gel et beauté des pieds, dans le respect de l'ongle.", hours: [...week([1], [[h(14), h(20)]]), ...week([2, 3, 4, 5, 6], [[h(9), h(13)], [h(14), h(19)]])] },
  { key: "fatou", displayName: "Fatou", title: "Soins du visage et du corps", bio: "Soins éclat, massages relaxants et épilation au fil.", hours: week([3, 4, 5, 6], [[h(10), h(13)], [h(14), h(19)]]) },
] as const;

const SERVICES: (Omit<ServiceInput, "staffIds"> & { key: string; staff: (typeof TEAM)[number]["key"][] })[] = [
  { key: "brushing", title: "Brushing", category: "Coiffure", durationMinutes: 45, price: 7_000, summary: "Lavage, soin démêlant et brushing lisse ou volume.", staff: ["adja", "mariama"], media: [img("flacons", "Flacons de soin sur une étagère")] },
  { key: "coupe", title: "Coupe et brushing", category: "Coiffure", durationMinutes: 60, bufferMinutes: 15, price: 10_000, summary: "Diagnostic, coupe adaptée à votre visage, brushing.", staff: ["adja", "mariama"], featured: true },
  { key: "couleur", title: "Couleur racines", category: "Coiffure", durationMinutes: 90, bufferMinutes: 15, price: 20_000, priceFrom: true, summary: "Coloration des racines et soin fixateur ; prix selon la longueur.", staff: ["adja"] },
  { key: "defrisage", title: "Défrisage et soin profond", category: "Coiffure", durationMinutes: 120, price: 25_000, summary: "Défrisage doux, soin kératine, brushing.", staff: ["mariama"] },
  { key: "collees", title: "Tresses collées", category: "Tresses", durationMinutes: 150, price: 15_000, priceFrom: true, summary: "Motifs au choix ; mèches fournies ou apportées.", staff: ["rama", "adja"], media: [img("tresse", "Tresse et anneaux dorés")], featured: true },
  { key: "box", title: "Box braids mi-longues", category: "Tresses", durationMinutes: 300, price: 35_000, priceFrom: true, summary: "Tresses individuelles, longueur épaules à mi-dos.", staff: ["rama"] },
  { key: "tissage", title: "Pose de tissage", category: "Tresses", durationMinutes: 180, price: 30_000, priceFrom: true, summary: "Tissage cousu, finitions et coupe de mise en forme.", staff: ["rama", "adja"] },
  { key: "locks", title: "Entretien de locks", category: "Tresses", durationMinutes: 120, price: 20_000, summary: "Resserrage des racines, soin du cuir chevelu.", staff: ["rama"] },
  { key: "semi", title: "Manucure semi-permanente", category: "Ongles", durationMinutes: 60, price: 12_000, summary: "Préparation de l'ongle, pose semi-permanente, tenue trois semaines.", staff: ["khadija"], media: [img("vernis", "Nuancier et flacons de vernis")], featured: true },
  { key: "gel", title: "Pose gel", category: "Ongles", durationMinutes: 90, price: 20_000, summary: "Extensions au gel, forme et longueur au choix.", staff: ["khadija"] },
  { key: "pieds", title: "Beauté des pieds", category: "Ongles", durationMinutes: 60, bufferMinutes: 10, price: 12_000, summary: "Bain, gommage, soin des cuticules et vernis.", staff: ["khadija"] },
  { key: "eclat", title: "Soin du visage éclat", category: "Soins", durationMinutes: 60, bufferMinutes: 15, price: 18_000, summary: "Nettoyage, gommage doux, masque et massage du visage.", staff: ["fatou"], media: [img("galets", "Galets et serviette pliée")] },
  { key: "massage", title: "Massage relaxant", category: "Soins", durationMinutes: 60, bufferMinutes: 15, price: 20_000, summary: "Massage du corps aux huiles chaudes.", staff: ["fatou"], featured: true },
  { key: "sourcils", title: "Épilation des sourcils au fil", category: "Soins", durationMinutes: 20, price: 3_000, summary: "Ligne nette et naturelle.", staff: ["fatou", "khadija"] },
];

async function main() {
  assertDemoSeedAllowed();
  const existing = await withSuperAdminAccess((tx) => tx.tenant.findUnique({ where: { slug: SLUG } }));
  if (existing) {
    console.info("Démonstration salon déjà présente — rien à faire.");
    return;
  }
  const owner = await createOwnerAccount({ email: "adja@maison-adja.sn", fullName: "Adja Ndiaye", password: "Demo!2026" });
  const { tenantId } = await provisionTenantForOwner({
    ownerUserId: owner.id,
    name: "Maison Adja",
    subdomain: SLUG,
    subdomainSuffix: process.env.PLATFORM_SUBDOMAIN_SUFFIX ?? "yamacommerce.ai",
    sectorKey: "services",
    planName: "Business",
    templatePreference: "ecrin",
  });
  await withSuperAdminAccess(async (tx) => {
    const t = await tx.tenant.findUniqueOrThrow({ where: { id: tenantId } });
    await tx.tenant.update({
      where: { id: tenantId },
      data: { isDemo: true, timezone: TZ, branding: { ...(t.branding as object), contactPhone: "+221 33 860 12 12", contactWhatsapp: "+221776001212", contactEmail: "bonjour@maison-adja.sn", contactAddress: "Rue 10, Mermoz Pyrotechnie, Dakar" } },
    });
  });

  // Comptes Wave / Orange Money déclarés par le salon (règlement AU SALON, jamais en ligne).
  await withTenant(tenantId, async (tx) => {
    await tx.paymentProviderConfig.createMany({
      data: [
        { tenantId, provider: "wave_direct", isEnabled: true, mode: "live", label: "Wave", accountNumber: "77 600 12 12", accountHolderName: "Maison Adja", publicInstructions: null },
        { tenantId, provider: "orange_money_direct", isEnabled: true, mode: "live", label: "Orange Money", accountNumber: "78 600 12 12", accountHolderName: "Maison Adja", publicInstructions: null },
      ],
    });
    await updateBookingSettings(tx, tenantId, { slotStepMinutes: 15, minLeadMinutes: 60, maxAdvanceDays: 45, cancelCutoffHours: 3, autoConfirm: true });
  });

  const staff: Record<string, string> = {};
  const services: Record<string, string> = {};
  await withTenant(tenantId, async (tx) => {
    for (const [i, t] of TEAM.entries()) staff[t.key] = (await createStaff(tx, tenantId, { displayName: t.displayName, title: t.title, bio: t.bio, position: i, hours: [...t.hours] })).id;
    for (const [i, { key, staff: who, ...input }] of SERVICES.entries()) {
      const s = await createService(tx, tenantId, { ...input, position: i, staffIds: who.map((k) => staff[k]!) }, owner.id);
      services[key] = s.id;
      await setListingStatus(tx, tenantId, s.id, "published", owner.id);
    }
    // Fatou en formation le jour de la semaine prochaine le plus proche.
    const today = utcToLocal(new Date(), TZ).date;
    const d = addDays(today, 9);
    await addTimeOff(tx, tenantId, { staffId: staff.fatou!, startAt: localToUtc(d, h(0), TZ), endAt: localToUtc(addDays(d, 1), h(0), TZ), reason: "Formation" });
  });

  // Rendez-vous à venir, pris par le VRAI moteur (horaires vérifiés). Un horaire refusé
  // (jour fermé, déjà pris) est simplement ignoré : rien n'est forcé.
  const clients = [
    ["Aïssatou", "Diallo", "77 512 34 56"], ["Coumba", "Sarr", "76 440 18 22"], ["Nafi", "Gueye", "78 220 90 11"], ["Seynabou", "Mbaye", "77 301 55 70"],
    ["Awa", "Cissé", "70 612 48 03"], ["Dior", "Faye", "77 845 12 09"], ["Ndèye", "Thiam", "76 118 33 47"], ["Marème", "Kane", "77 690 21 84"],
    ["Fatima", "Sow", "78 455 02 66"], ["Oumy", "Ndour", "77 233 71 15"], ["Bineta", "Diouf", "76 905 64 38"], ["Yacine", "Ba", "77 378 49 20"],
  ] as const;
  const plan: [number, string, string, number, number, "web" | "phone"][] = [
    // [jour +N, prestation, personne, heure, minute, canal]
    [1, "coupe", "adja", 10, 0, "web"], [1, "collees", "rama", 9, 30, "web"], [1, "semi", "khadija", 11, 0, "web"], [1, "eclat", "fatou", 15, 0, "phone"],
    [1, "brushing", "mariama", 16, 30, "web"], [1, "sourcils", "khadija", 16, 0, "web"], [2, "box", "rama", 9, 0, "phone"], [2, "couleur", "adja", 14, 30, "web"],
    [2, "gel", "khadija", 14, 0, "web"], [2, "massage", "fatou", 17, 0, "web"], [3, "defrisage", "mariama", 10, 30, "web"], [3, "pieds", "khadija", 9, 30, "web"],
    [3, "tissage", "rama", 14, 0, "phone"], [4, "coupe", "adja", 11, 0, "web"], [4, "locks", "rama", 15, 0, "web"], [5, "eclat", "fatou", 11, 0, "web"],
    [5, "semi", "khadija", 17, 0, "web"], [6, "brushing", "adja", 9, 30, "web"],
  ];
  const today = utcToLocal(new Date(), TZ).date;
  let made = 0;
  for (const [i, [dayOffset, svc, who, hh, mm, channel]] of plan.entries()) {
    const [firstName, lastName, phone] = clients[i % clients.length]!;
    try {
      await withTenant(tenantId, (tx) =>
        bookAppointment(tx, tenantId, {
          listingId: services[svc]!,
          staffId: staff[who]!,
          startAt: localToUtc(addDays(today, dayOffset), h(hh, mm), TZ),
          customer: { firstName, lastName, phone },
          channel,
          actor: channel === "web" ? { userId: null, type: "customer" } : { userId: owner.id, type: "owner" },
        }),
      );
      made += 1;
    } catch {
      // Jour de fermeture ou horaire déjà pris : ignoré, jamais forcé.
    }
  }

  await withTenant(tenantId, (tx) =>
    saveStorefrontContent(tx, tenantId, {
      announcement: null,
      hero: {
        autoplaySeconds: 7,
        slides: [
          { id: "maison", imageUrl: `${V}/arche-lumiere.webp`, mobileImageUrl: null, imageAlt: "Arche éclairée, vase et herbes de pampa", demo: true, productId: null, eyebrow: "Coiffure · Tresses · Ongles · Soins", title: "Prenez le temps, on garde l'heure.", subtitle: "Choisissez votre soin, la personne qui vous accueille et l'horaire qui vous va : votre rendez-vous est confirmé aussitôt.", ctaLabel: "Prendre rendez-vous", ctaHref: "/reserver", theme: "light" },
        ],
      },
      featuredCategoryIds: [],
      featuredProductIds: [],
      collections: [],
      reassurance: [],
    }, owner.id),
  );
  console.info(`Démonstration salon créée : Maison Adja (adja@maison-adja.sn / Demo!2026), ${made} rendez-vous.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
