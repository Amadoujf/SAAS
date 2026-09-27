/**
 * Démonstration IMMOBILIER : agence « Almadies Immobilier » (template « Résidences »).
 * Script de DÉVELOPPEMENT uniquement — jamais exécuté par la CI ni en production.
 * Tout passe par les VRAIS moteurs (création de biens, publication, demandes de
 * visite, baux, encaissements) ; seules les dates d'encaissement sont choisies.
 * Visuels : recadrages PROVISOIRES des maquettes (voir demo-templates/MANIFEST.json),
 * marqués `demo: true`, jamais présentés comme les biens d'une agence réelle.
 *
 *   pnpm --filter @yamacommerce/database run seed:real-estate-demo
 */
import { prisma } from "./client";
import { withSuperAdminAccess, withTenant } from "./tenant-context";
import { createOwnerAccount, provisionTenantForOwner } from "./tenant-provisioning";
import { setListingStatus } from "./listing-registry";
import { transitionReservationStatus } from "./reservation-registry";
import { createLease, createProperty, recordRentPayment, requestPropertyVisit, type PropertyInput } from "./real-estate-registry";
import { saveStorefrontContent } from "./storefront-registry";

const SLUG = "almadies-immobilier";
const R = "/demo-templates/residences";
const img = (name: string, alt: string) => ({ url: `${R}/${name}.webp`, alt, demo: true });

const PROPERTIES: (PropertyInput & { key: string; publish: boolean })[] = [
  {
    key: "villa-almadies", publish: true, featured: true,
    title: "Villa contemporaine face à l'océan", propertyType: "villa", dealType: "sale", price: 850_000_000,
    summary: "Cinq chambres, piscine à débordement et terrasse plein ouest sur l'Atlantique.",
    description: "Nichée au calme de la pointe des Almadies, cette villa d'architecte ouvre toutes ses pièces de vie sur une terrasse de 120 m² et une piscine à débordement face à l'océan.\n\nAu rez-de-chaussée : un séjour traversant de 80 m², une cuisine équipée et une suite parentale. À l'étage : quatre chambres avec salle d'eau, dont deux avec vue mer.\n\nGardiennage 24 h/24, groupe électrogène, forage.",
    bedrooms: 5, bathrooms: 5, surfaceM2: 420, landSurfaceM2: 900, furnished: false,
    amenities: ["pool", "sea_view", "guard", "generator", "terrace", "air_conditioning", "parking"],
    agencyReference: "ALM-0142", location: { region: "Dakar", commune: "Almadies", neighborhood: "Pointe des Almadies" },
    media: [img("hero-villa", "Villa blanche, piscine à débordement et palmiers face à l'océan"), img("villa-facade", "Façade vitrée et terrasse de la villa"), img("piscine-mer", "Piscine et terrasse en pierre"), img("salon-exterieur", "Salon extérieur sur la terrasse")],
  },
  {
    key: "appartement-mermoz", publish: true, featured: true,
    title: "Appartement lumineux avec terrasse", propertyType: "apartment", dealType: "rent", price: 650_000,
    summary: "Trois pièces meublé, terrasse filante et vue dégagée, à deux pas de la VDN.",
    description: "Au dernier étage d'une résidence sécurisée avec ascenseur, un trois pièces entièrement meublé et climatisé : séjour ouvert sur une terrasse filante, deux chambres dont une suite, cuisine équipée.\n\nParking en sous-sol et gardiennage. Disponible immédiatement.",
    bedrooms: 2, bathrooms: 2, surfaceM2: 115, furnished: true,
    amenities: ["terrace", "elevator", "air_conditioning", "parking", "guard", "furnished_kitchen"],
    agencyReference: "ALM-0157", location: { region: "Dakar", commune: "Mermoz-Sacré-Cœur", neighborhood: "Mermoz" },
    media: [img("colonne-palmiers", "Terrasse avec palmiers et vue mer"), img("salon-exterieur", "Salon de terrasse"), img("panorama-piscine", "Piscine de la résidence")],
  },
  {
    key: "villa-ngor", publish: true, featured: true,
    title: "Villa avec piscine à Ngor", propertyType: "villa", dealType: "rent", price: 2_500_000,
    summary: "Quatre chambres, jardin tropical et piscine, dans une rue calme de Ngor.",
    description: "Villa de plain-pied sur une parcelle arborée : séjour cathédrale, quatre chambres climatisées, bureau, cuisine équipée ouverte sur le jardin et la piscine.\n\nIdéale pour une famille ou une représentation diplomatique. Bail de deux ans minimum.",
    bedrooms: 4, bathrooms: 3, surfaceM2: 280, landSurfaceM2: 650, furnished: false,
    amenities: ["pool", "garden", "guard", "generator", "air_conditioning", "parking"],
    agencyReference: "ALM-0161", location: { region: "Dakar", commune: "Ngor", neighborhood: "Ngor Village" },
    media: [img("piscine-mer", "Piscine et terrasse de la villa"), img("villa-facade", "Façade de la villa"), img("panorama-piscine", "Vue sur la piscine")],
  },
  {
    key: "terrain-saly", publish: true,
    title: "Terrain constructible près de la plage", propertyType: "land", dealType: "sale", price: 45_000_000,
    summary: "500 m² viabilisés à 300 mètres de la plage de Saly, titre foncier.",
    description: "Parcelle plane de 500 m², viabilisée (eau, électricité), dans un lotissement résidentiel calme. Titre foncier individuel. À 300 mètres de la plage et à 5 minutes du centre de Saly.",
    landSurfaceM2: 500, amenities: [],
    agencyReference: "ALM-0133", location: { region: "Thiès", commune: "Saly Portudal", neighborhood: "Saly Niakh Niakhal" },
    media: [img("panorama-piscine", "Vue sur la mer depuis le secteur")],
  },
  {
    key: "studio-point-e", publish: true,
    title: "Studio meublé à Point E", propertyType: "apartment", dealType: "rent", price: 300_000,
    summary: "Studio moderne et climatisé, idéal pour un jeune actif, proche de l'UCAD.",
    description: "Studio de 38 m² refait à neuf : pièce de vie avec coin nuit, kitchenette équipée, salle d'eau. Charges d'eau comprises. Résidence gardée.",
    bedrooms: 1, bathrooms: 1, surfaceM2: 38, furnished: true,
    amenities: ["air_conditioning", "guard", "furnished_kitchen"],
    agencyReference: "ALM-0170", location: { region: "Dakar", commune: "Fann-Point E-Amitié", neighborhood: "Point E" },
    media: [img("salon-exterieur", "Espace détente de la résidence")],
  },
  {
    key: "bureaux-plateau", publish: false,
    title: "Plateau de bureaux au Plateau", propertyType: "office", dealType: "rent", price: 1_800_000,
    summary: "180 m² de bureaux cloisonnables, fibre optique, en plein centre d'affaires.",
    bathrooms: 2, surfaceM2: 180, amenities: ["elevator", "air_conditioning", "generator", "parking"],
    agencyReference: "ALM-0175", location: { region: "Dakar", commune: "Dakar-Plateau", neighborhood: "Plateau" },
    media: [],
  },
];

async function main() {
  const existing = await withSuperAdminAccess((tx) => tx.tenant.findUnique({ where: { slug: SLUG } }));
  if (existing) {
    console.info("Démonstration immobilière déjà présente — rien à faire.");
    return;
  }
  const owner = await createOwnerAccount({ email: "moussa@almadies-immobilier.sn", fullName: "Moussa Diallo", password: "Demo!2026" });
  const { tenantId } = await provisionTenantForOwner({
    ownerUserId: owner.id,
    name: "Almadies Immobilier",
    subdomain: SLUG,
    subdomainSuffix: process.env.PLATFORM_SUBDOMAIN_SUFFIX ?? "yamacommerce.ai",
    sectorKey: "real_estate",
    planName: "Business",
    templatePreference: "residences",
  });
  await withSuperAdminAccess(async (tx) => {
    const t = await tx.tenant.findUniqueOrThrow({ where: { id: tenantId } });
    await tx.tenant.update({
      where: { id: tenantId },
      data: { branding: { ...(t.branding as object), demoData: true, contactPhone: "+221 33 820 00 00", contactWhatsapp: "+221770000000", contactEmail: "contact@almadies-immobilier.sn", contactAddress: "Route des Almadies, Dakar" } },
    });
  });

  const ids: Record<string, string> = {};
  await withTenant(tenantId, async (tx) => {
    for (const { key, publish, ...input } of PROPERTIES) {
      const p = await createProperty(tx, tenantId, input, owner.id);
      ids[key] = p.id;
      if (publish) await setListingStatus(tx, tenantId, p.id, "published", owner.id);
    }
  });

  // Demandes de visite reçues du site (vrai moteur), dont deux déjà confirmées.
  const inDays = (d: number, h: number) => new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate() + d, h));
  const visits = [
    { key: "villa-almadies", d: 2, h: 10, who: { firstName: "Mariama", lastName: "Ba", phone: "77 614 22 30" }, msg: "Nous revenons de l'étranger en décembre, pouvons-nous visiter ce samedi ?", confirm: true },
    { key: "appartement-mermoz", d: 1, h: 17, who: { firstName: "Ousmane", lastName: "Sarr", phone: "78 102 55 41" }, msg: "Disponible après le travail.", confirm: false },
    { key: "villa-ngor", d: 4, h: 11, who: { firstName: "Claire", lastName: "Mendy", phone: "76 330 18 02" }, msg: "Pour une famille de cinq personnes, bail de deux ans.", confirm: true },
    { key: "studio-point-e", d: 3, h: 15, who: { firstName: "Abdou", lastName: "Faye", phone: "70 812 64 90" }, msg: "", confirm: false },
  ];
  await withTenant(tenantId, async (tx) => {
    for (const v of visits) {
      const r = await requestPropertyVisit(tx, tenantId, { listingId: ids[v.key]!, preferredAt: inDays(v.d, v.h), customer: v.who, message: v.msg || null, actor: { userId: null, type: "customer" } });
      if (v.confirm) await transitionReservationStatus(tx, tenantId, { reservationId: r.id, toStatus: "confirmed", actor: { userId: owner.id, type: "owner" } });
    }
  });

  // Deux baux : l'un à jour, l'autre avec un loyer en retard (encaissements réels saisis).
  const monthsAgo = (n: number) => new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() - n, 1));
  const bureaux = ids["bureaux-plateau"]!;
  await withTenant(tenantId, async (tx) => {
    // Le plateau de bureaux est loué : bail ouvert il y a 4 mois, loyers encaissés sauf le mois dernier.
    const lease1 = await createLease(tx, tenantId, { listingId: bureaux, occupant: { firstName: "Cabinet", lastName: "Ndiaye Conseil", phone: "33 821 45 67" }, landlordName: "SCI Teranga Patrimoine", landlordPhone: "77 500 12 12", startDate: monthsAgo(4), monthlyRent: 1_800_000, charges: 150_000, depositAmount: 3_600_000, dueDay: 5 }, owner.id);
    const p1 = await tx.rentPayment.findMany({ where: { leaseId: lease1.id }, orderBy: { dueDate: "asc" } });
    for (const [i, p] of p1.entries()) {
      if (p.dueDate > new Date() || i === p1.length - 3) continue; // le mois dernier reste impayé
      if (p.dueDate.getUTCMonth() === new Date().getUTCMonth()) continue;
      await recordRentPayment(tx, tenantId, { rentPaymentId: p.id, amountPaid: p.amountDue, method: "bank_transfer", paymentReference: `VIR-${p.period}`, paidAt: new Date(p.dueDate.getTime() + 2 * 86_400_000) }, owner.id);
    }
  });
  // Un appartement loué depuis deux mois (loyers à jour) : il n'apparaît plus sur le site.
  await withTenant(tenantId, async (tx) => {
    const studio = await createProperty(tx, tenantId, {
      title: "Appartement deux pièces à Sacré-Cœur", propertyType: "apartment", dealType: "rent", price: 400_000,
      summary: "Deux pièces rénové, balcon, résidence calme.", bedrooms: 1, bathrooms: 1, surfaceM2: 60, furnished: false,
      amenities: ["air_conditioning", "guard"], agencyReference: "ALM-0149", location: { region: "Dakar", commune: "Mermoz-Sacré-Cœur", neighborhood: "Sacré-Cœur 3" },
      media: [img("villa-facade", "Résidence")],
    }, owner.id);
    await setListingStatus(tx, tenantId, studio.id, "published", owner.id);
    const lease2 = await createLease(tx, tenantId, { listingId: studio.id, occupant: { firstName: "Khady", lastName: "Sow", phone: "77 450 98 21" }, landlordName: "Mme Aminata Gueye", startDate: monthsAgo(2), monthlyRent: 400_000, charges: 20_000, depositAmount: 800_000, dueDay: 1 }, owner.id);
    const p2 = await tx.rentPayment.findMany({ where: { leaseId: lease2.id, dueDate: { lte: new Date() } }, orderBy: { dueDate: "asc" } });
    for (const p of p2) await recordRentPayment(tx, tenantId, { rentPaymentId: p.id, amountPaid: p.amountDue, method: "wave", paymentReference: `WV-${p.period}`, paidAt: new Date(Math.min(Date.now(), p.dueDate.getTime() + 86_400_000)) }, owner.id);
  });

  // Accueil « Résidences » : carrousel, biens à la une, repères, engagements.
  await withTenant(tenantId, (tx) =>
    saveStorefrontContent(tx, tenantId, {
      announcement: null,
      hero: {
        autoplaySeconds: 7,
        slides: [
          { id: "exception", imageUrl: `${R}/hero-villa.webp`, mobileImageUrl: `${R}/hero-villa-mobile.webp`, imageAlt: "Villa blanche avec piscine à débordement face à l'océan", demo: true, productId: ids["villa-almadies"]!, eyebrow: "Villas · Appartements · Terrains", title: "Des lieux d'exception au Sénégal.", subtitle: "Vente, location et gestion de biens d'exception, de Dakar à la Petite-Côte.", ctaLabel: "Voir les propriétés", ctaHref: "/biens", theme: "dark" },
          { id: "louer", imageUrl: `${R}/piscine-mer.webp`, mobileImageUrl: `${R}/colonne-palmiers.webp`, imageAlt: "Terrasse et piscine d'une villa à Ngor", demo: true, productId: ids["villa-ngor"]!, eyebrow: "Location", title: "Vivre à Ngor, les pieds dans l'eau.", subtitle: "Villas et appartements meublés, sélectionnés et visités par l'agence.", ctaLabel: "Biens à louer", ctaHref: "/biens?transaction=rent", theme: "dark" },
          { id: "investir", imageUrl: `${R}/villa-facade.webp`, mobileImageUrl: `${R}/colonne-palmiers.webp`, imageAlt: "Façade vitrée d'une villa contemporaine", demo: true, productId: ids["appartement-mermoz"]!, eyebrow: "Investir", title: "Investir en toute confiance.", subtitle: "Titres vérifiés, accompagnement notarial et gestion locative de A à Z.", ctaLabel: "Biens à vendre", ctaHref: "/biens?transaction=sale", theme: "dark" },
        ],
      },
      featuredCategoryIds: [],
      featuredProductIds: [ids["villa-almadies"]!, ids["villa-ngor"]!, ids["appartement-mermoz"]!, ids["terrain-saly"]!, ids["studio-point-e"]!],
      collections: [
        { id: "acheter", eyebrow: "", title: "Acheter", subtitle: "Villas, appartements et terrains à titre foncier, de Dakar à Saly.", imageUrl: `${R}/villa-facade.webp`, demo: true, href: "/biens?transaction=sale" },
        { id: "louer", eyebrow: "", title: "Louer", subtitle: "Des biens meublés ou vides, visités et vérifiés par l'agence.", imageUrl: `${R}/panorama-piscine.webp`, demo: true, href: "/biens?transaction=rent" },
      ],
      reassurance: [
        { icon: "shield", title: "Titres vérifiés", text: "Chaque bien contrôlé avant publication" },
        { icon: "phone", title: "Un conseiller dédié", text: "Du premier appel à la remise des clés" },
        { icon: "card", title: "Loyers suivis", text: "Quittances et relances pour les propriétaires" },
        { icon: "leaf", title: "Visites accompagnées", text: "Sur rendez-vous, 7 jours sur 7" },
      ],
    }, owner.id),
  );
  console.info("Démonstration immobilière créée : Almadies Immobilier (moussa@almadies-immobilier.sn / Demo!2026).");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
