/**
 * Démonstration VOYAGE : agence « Baobab Voyages ». Script de DÉVELOPPEMENT uniquement —
 * jamais exécuté par la CI ni en production. Tout passe par les VRAIS moteurs (voyages,
 * publication, départs, réservations nominatives, pièces, encaissements).
 * Visuels : illustrations ORIGINALES rendues par scripts/demo-visuals/voyage.py, marquées
 * `demo: true`, jamais présentées comme les voyages d'une agence réelle.
 *
 *   pnpm --filter @yamacommerce/database run seed:travel-demo
 */
import { prisma } from "./client";
import { withSuperAdminAccess, withTenant } from "./tenant-context";
import { assertDemoSeedAllowed } from "./demo-guard";
import { createOwnerAccount, provisionTenantForOwner } from "./tenant-provisioning";
import { setListingStatus } from "./listing-registry";
import { transitionReservationStatus } from "./reservation-registry";
import { addDeparture, bookDeparture, createTravelPackage, recordReservationPayment, setTravelerDocumentStatus, type TravelPackageInput } from "./travel-registry";
import { saveStorefrontContent } from "./storefront-registry";

const SLUG = "baobab-voyages";
const V = "/demo-templates/voyage";
const img = (name: string, alt: string) => ({ url: `${V}/${name}.webp`, alt, demo: true });

const TRIPS: (TravelPackageInput & { key: string; departures: { inDays: number; capacity: number; price?: number; label?: string }[] })[] = [
  {
    key: "omra", featured: true,
    title: "Omra de printemps", tripType: "pilgrimage", destinationCountry: "Arabie saoudite", destinationCity: "Médine et La Mecque",
    durationDays: 15, durationNights: 14, pricePerPerson: 1_950_000, depositPercent: 40,
    summary: "Quinze jours accompagnés, Médine puis La Mecque, hôtels proches des lieux saints.",
    description: "Un voyage préparé pour se consacrer à l'essentiel : vols directs, hôtels à distance de marche, un guide francophone et wolofophone du départ au retour.\n\nL'agence s'occupe du dossier de visa et des transferts. Une réunion d'information a lieu à l'agence deux semaines avant le départ.",
    included: ["flights", "hotel", "transfers", "full_board", "guide", "visa_assistance"],
    excludedNote: "Dépenses personnelles, excédent de bagages.",
    requiredDocuments: ["passport", "visa", "photo"], meetingPoint: "Aéroport Blaise-Diagne, comptoir de la compagnie, 4 h avant le vol",
    media: [img("palmeraie-aube", "Palmeraie à l'aube, coupoles et minarets à l'horizon")],
    itinerary: [
      { dayNumber: 1, title: "Dakar → Médine", description: "Vol direct, accueil à l'aéroport et installation à l'hôtel." },
      { dayNumber: 2, title: "Médine", description: "Visites accompagnées, temps libre." },
      { dayNumber: 6, title: "Médine → La Mecque", description: "Transfert en autocar climatisé." },
      { dayNumber: 7, title: "La Mecque", description: "Accomplissement de la Omra avec le guide." },
      { dayNumber: 15, title: "Retour à Dakar", description: "Transfert et vol retour." },
    ],
    departures: [{ inDays: 45, capacity: 40, label: "Départ de printemps" }, { inDays: 110, capacity: 40, price: 2_150_000, label: "Départ du mois sacré" }],
  },
  {
    key: "dubai", featured: true,
    title: "Dubaï, escale lumière", tripType: "stay", destinationCountry: "Émirats arabes unis", destinationCity: "Dubaï",
    durationDays: 6, durationNights: 5, pricePerPerson: 895_000, depositPercent: 30,
    summary: "Cinq nuits en hôtel quatre étoiles, désert, marina et souks, visa compris.",
    description: "Une escale pensée pour découvrir Dubaï sans courir : un hôtel central, une soirée dans le désert, la marina au coucher du soleil et du temps libre pour les souks.",
    included: ["flights", "hotel", "transfers", "breakfast", "visa_assistance", "excursions"],
    excludedNote: "Repas du midi et du soir, dépenses personnelles.",
    requiredDocuments: ["passport", "visa", "photo"], meetingPoint: "Aéroport Blaise-Diagne",
    media: [img("ville-crepuscule", "Ville de tours au crépuscule, lumières allumées")],
    itinerary: [
      { dayNumber: 1, title: "Arrivée à Dubaï", description: "Accueil et installation." },
      { dayNumber: 2, title: "Vieux Dubaï et souks", description: "Traversée de la crique en abra." },
      { dayNumber: 3, title: "Soirée dans le désert", description: "Dunes, dîner sous tente." },
      { dayNumber: 4, title: "Journée libre" },
      { dayNumber: 5, title: "Marina", description: "Promenade au coucher du soleil." },
      { dayNumber: 6, title: "Retour" },
    ],
    departures: [{ inDays: 21, capacity: 20 }, { inDays: 52, capacity: 20 }, { inDays: 84, capacity: 20, price: 975_000, label: "Vacances scolaires" }],
  },
  {
    key: "casamance", featured: true,
    title: "Casamance, rivières et forêts sacrées", tripType: "circuit", destinationCountry: "Sénégal", destinationCity: "Ziguinchor",
    durationDays: 5, durationNights: 4, pricePerPerson: 385_000, depositPercent: 30,
    summary: "Bolongs en pirogue, villages diolas et plages de Cap Skirring, en petit groupe.",
    description: "Un circuit en petit groupe (quatorze voyageurs au plus) pour découvrir la Basse-Casamance au rythme de ses rivières : pirogue dans les bolongs, cases à impluvium, marché de Ziguinchor et deux nuits face à l'océan.",
    included: ["hotel", "transfers", "full_board", "guide", "excursions"],
    excludedNote: "Vols ou traversée Dakar–Ziguinchor (sur demande).",
    requiredDocuments: ["id_card"], meetingPoint: "Port de Ziguinchor",
    media: [img("casamance-bolong", "Bolong au petit matin, pirogue et mangrove")],
    itinerary: [
      { dayNumber: 1, title: "Ziguinchor", description: "Accueil, marché et quartiers anciens." },
      { dayNumber: 2, title: "Bolongs en pirogue", description: "Mangrove, îles et villages de pêcheurs." },
      { dayNumber: 3, title: "Villages diolas", description: "Case à impluvium, forêt sacrée." },
      { dayNumber: 4, title: "Cap Skirring", description: "Plage et temps libre." },
      { dayNumber: 5, title: "Retour" },
    ],
    departures: [{ inDays: 12, capacity: 14 }, { inDays: 40, capacity: 14 }, { inDays: 68, capacity: 14 }],
  },
  {
    key: "lompoul", featured: true,
    title: "Lompoul et Saint-Louis", tripType: "excursion", destinationCountry: "Sénégal", destinationCity: "Lompoul, Saint-Louis",
    durationDays: 3, durationNights: 2, pricePerPerson: 185_000, depositPercent: 50,
    summary: "Une nuit sous tente dans les dunes, puis l'île de Saint-Louis et son pont.",
    description: "Le désert de Lompoul au coucher du soleil, une nuit sous tente, puis la ville de Saint-Louis : l'île, le pont Faidherbe et le quartier des pêcheurs de Guet Ndar.",
    included: ["hotel", "transfers", "full_board", "guide"],
    requiredDocuments: ["id_card"], meetingPoint: "Agence, Dakar Plateau, 7 h",
    media: [img("dunes-lompoul", "Dunes au coucher du soleil"), img("pont-saint-louis", "Pont métallique sur le fleuve au couchant")],
    itinerary: [
      { dayNumber: 1, title: "Dakar → Lompoul", description: "Route, dunes au coucher du soleil, nuit sous tente." },
      { dayNumber: 2, title: "Saint-Louis", description: "L'île, le pont, Guet Ndar." },
      { dayNumber: 3, title: "Retour à Dakar" },
    ],
    departures: [{ inDays: 9, capacity: 16 }, { inDays: 23, capacity: 16 }, { inDays: 37, capacity: 16 }],
  },
  {
    key: "cap-vert",
    title: "Cap-Vert, Sal et Boa Vista", tripType: "stay", destinationCountry: "Cap-Vert", destinationCity: "Sal",
    durationDays: 7, durationNights: 6, pricePerPerson: 690_000, depositPercent: 30,
    summary: "Six nuits entre deux îles, plages blanches et eaux turquoise.",
    description: "Trois nuits à Sal, trois nuits à Boa Vista, une traversée entre les deux îles. Hôtels en bord de plage, petits déjeuners compris.",
    included: ["flights", "hotel", "transfers", "breakfast"],
    requiredDocuments: ["passport"], meetingPoint: "Aéroport Blaise-Diagne",
    media: [img("ile-turquoise", "Île aux maisons colorées sur mer turquoise")],
    itinerary: [
      { dayNumber: 1, title: "Arrivée à Sal" },
      { dayNumber: 4, title: "Traversée vers Boa Vista" },
      { dayNumber: 7, title: "Retour" },
    ],
    departures: [{ inDays: 33, capacity: 12 }, { inDays: 75, capacity: 12 }],
  },
  {
    key: "fouta",
    title: "Fouta Djallon, le château d'eau", tripType: "circuit", destinationCountry: "Guinée", destinationCity: "Labé",
    durationDays: 8, durationNights: 7, pricePerPerson: 540_000, depositPercent: 30,
    summary: "Randonnées, cascades et villages peuls sur les hauts plateaux guinéens.",
    description: "Huit jours de marche facile sur les plateaux du Fouta Djallon : cascades, villages peuls, nuits chez l'habitant et en campement.",
    included: ["transfers", "full_board", "guide"],
    excludedNote: "Vols Dakar–Conakry (sur demande), boissons.",
    requiredDocuments: ["passport", "yellow_fever"], meetingPoint: "Labé",
    media: [img("fouta-djallon", "Montagnes dans la brume et cascade")],
    itinerary: [
      { dayNumber: 1, title: "Labé", description: "Accueil et briefing." },
      { dayNumber: 3, title: "Cascades", description: "Randonnée vers les chutes." },
      { dayNumber: 8, title: "Retour à Labé" },
    ],
    departures: [{ inDays: 58, capacity: 10 }],
  },
  {
    key: "saly",
    title: "Saly, séjour balnéaire", tripType: "stay", destinationCountry: "Sénégal", destinationCity: "Saly",
    durationDays: 4, durationNights: 3, pricePerPerson: 245_000, depositPercent: 30,
    summary: "Trois nuits face à l'océan, demi-pension, transferts depuis Dakar.",
    included: ["hotel", "transfers", "breakfast"],
    requiredDocuments: ["id_card"],
    media: [img("ocean-saly", "Océan au couchant et palmiers")],
    itinerary: [{ dayNumber: 1, title: "Arrivée à Saly" }, { dayNumber: 4, title: "Retour à Dakar" }],
    departures: [{ inDays: 16, capacity: 20 }, { inDays: 30, capacity: 20 }],
  },
];

async function main() {
  assertDemoSeedAllowed();
  const existing = await withSuperAdminAccess((tx) => tx.tenant.findUnique({ where: { slug: SLUG } }));
  if (existing) {
    console.info("Démonstration voyage déjà présente — rien à faire.");
    return;
  }
  const owner = await createOwnerAccount({ email: "aminata@baobab-voyages.sn", fullName: "Aminata Sow", password: "Demo!2026" });
  const { tenantId } = await provisionTenantForOwner({
    ownerUserId: owner.id,
    name: "Baobab Voyages",
    subdomain: SLUG,
    subdomainSuffix: process.env.PLATFORM_SUBDOMAIN_SUFFIX ?? "yamacommerce.ai",
    sectorKey: "travel_agency",
    planName: "Business",
    templatePreference: "horizons",
  });
  await withSuperAdminAccess(async (tx) => {
    const t = await tx.tenant.findUniqueOrThrow({ where: { id: tenantId } });
    await tx.tenant.update({
      where: { id: tenantId },
      data: { isDemo: true, branding: { ...(t.branding as object), contactPhone: "+221 33 821 40 40", contactWhatsapp: "+221771234567", contactEmail: "bonjour@baobab-voyages.sn", contactAddress: "Avenue Léopold-Sédar-Senghor, Dakar Plateau" } },
    });
  });

  // Comptes de paiement déclarés par l'agence (page Paiements) : Wave et Orange Money.
  await withTenant(tenantId, async (tx) => {
    await tx.paymentProviderConfig.createMany({
      data: [
        { tenantId, provider: "wave_direct", isEnabled: true, mode: "live", label: "Wave", accountNumber: "77 123 45 67", accountHolderName: "Baobab Voyages", publicInstructions: "Envoyez le montant puis gardez la confirmation Wave." },
        { tenantId, provider: "orange_money_direct", isEnabled: true, mode: "live", label: "Orange Money", accountNumber: "78 765 43 21", accountHolderName: "Baobab Voyages", publicInstructions: null },
      ],
    });
  });

  const inDays = (d: number) => new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate() + d, 7));
  const ids: Record<string, string> = {};
  const departures: Record<string, string[]> = {};
  await withTenant(tenantId, async (tx) => {
    for (const { key, departures: deps, ...input } of TRIPS) {
      const trip = await createTravelPackage(tx, tenantId, input, owner.id);
      ids[key] = trip.id;
      await setListingStatus(tx, tenantId, trip.id, "published", owner.id);
      departures[key] = [];
      for (const d of deps) departures[key]!.push((await addDeparture(tx, tenantId, trip.id, { startDate: inDays(d.inDays), capacity: d.capacity, pricePerPerson: d.price ?? null, label: d.label ?? null })).id);
    }
  });

  // Réservations reçues (site, téléphone), encaissements réellement saisis, pièces suivies.
  const guest = { userId: null, type: "customer" as const };
  const staff = { userId: owner.id, type: "owner" as const };
  const bookings = [
    { trip: "omra", dep: 0, travelers: [["Ousmane", "Diop", "A0123456"], ["Ndèye", "Diop", "A0654321"]], contact: { firstName: "Ousmane", lastName: "Diop", phone: "77 540 11 20" }, pay: [["deposit", 1_560_000, "wave"]], confirm: true, docs: { passport: "received", visa: "submitted", photo: "received" } },
    { trip: "omra", dep: 0, travelers: [["Mame", "Fall", "B1122334"]], contact: { firstName: "Mame", lastName: "Fall", phone: "76 201 88 45" }, pay: [["deposit", 780_000, "orange_money"], ["balance", 1_170_000, "bank_transfer"]], confirm: true, docs: { passport: "approved", visa: "approved", photo: "received" } },
    { trip: "dubai", dep: 0, travelers: [["Khady", "Ba", "C7788990"], ["Aliou", "Ba", "C9988776"], ["Awa", "Ba", null]], contact: { firstName: "Khady", lastName: "Ba", phone: "78 330 64 12" }, pay: [["deposit", 805_500, "wave"]], confirm: true, docs: { passport: "received" } },
    { trip: "dubai", dep: 1, travelers: [["Pape", "Ndiaye", null]], contact: { firstName: "Pape", lastName: "Ndiaye", phone: "70 118 45 90" }, pay: [], confirm: false, docs: {} },
    { trip: "casamance", dep: 0, travelers: [["Claire", "Mendy", null], ["Jean", "Mendy", null]], contact: { firstName: "Claire", lastName: "Mendy", phone: "77 612 09 33" }, pay: [["deposit", 231_000, "cash"], ["balance", 539_000, "wave"]], confirm: true, docs: { id_card: "received" } },
    { trip: "lompoul", dep: 0, travelers: [["Moussa", "Sy", null], ["Fatou", "Sy", null], ["Bamba", "Sy", null], ["Astou", "Sy", null]], contact: { firstName: "Moussa", lastName: "Sy", phone: "77 908 22 17" }, pay: [["deposit", 370_000, "wave"]], confirm: true, docs: {} },
    { trip: "lompoul", dep: 1, travelers: [["Sophie", "Diallo", null]], contact: { firstName: "Sophie", lastName: "Diallo", phone: "76 455 30 81" }, pay: [], confirm: false, docs: {} },
    { trip: "cap-vert", dep: 0, travelers: [["Ibrahima", "Kane", "D5566778"], ["Rokhaya", "Kane", "D8877665"]], contact: { firstName: "Ibrahima", lastName: "Kane", phone: "77 377 50 02" }, pay: [], confirm: false, cancel: true, docs: {} },
  ] as const;
  await withTenant(tenantId, async (tx) => {
    for (const b of bookings) {
      const r = await bookDeparture(tx, tenantId, {
        listingId: ids[b.trip]!,
        availabilityId: departures[b.trip]![b.dep]!,
        travelers: b.travelers.map(([firstName, lastName, passport]) => ({ firstName, lastName, passportNumber: passport })),
        contact: b.contact,
        channel: b.pay.length ? "web" : "phone",
        actor: guest,
      });
      for (const [kind, amount, method] of b.pay) {
        await recordReservationPayment(tx, tenantId, { reservationId: r.id, amount, method, kind, reference: method === "cash" ? null : `${method.toUpperCase()}-${r.reference.slice(-4)}`, actorUserId: owner.id });
      }
      if (b.confirm) await transitionReservationStatus(tx, tenantId, { reservationId: r.id, toStatus: "confirmed", actor: staff });
      if ("cancel" in b && b.cancel) await transitionReservationStatus(tx, tenantId, { reservationId: r.id, toStatus: "canceled", actor: staff, note: "Changement de dates demandé par le client" });
      const travelers = await tx.reservationTraveler.findMany({ where: { reservationId: r.id }, orderBy: { position: "asc" } });
      for (const [kind, status] of Object.entries(b.docs)) {
        for (const t of travelers.slice(0, kind === "passport" ? 2 : travelers.length)) {
          await setTravelerDocumentStatus(tx, tenantId, { travelerId: t.id, kind: kind as never, status: status as never, actorUserId: owner.id });
        }
      }
    }
  });

  // Accueil « Horizons » : carrousel, voyages à la une, univers, engagements.
  await withTenant(tenantId, (tx) =>
    saveStorefrontContent(tx, tenantId, {
      announcement: null,
      hero: {
        autoplaySeconds: 7,
        slides: [
          { id: "ailleurs", imageUrl: `${V}/dunes-lompoul.webp`, mobileImageUrl: `${V}/dunes-lompoul-mobile.webp`, imageAlt: "Dunes au coucher du soleil", demo: true, productId: ids["lompoul"]!, eyebrow: "Circuits · Séjours · Pèlerinages", title: "Partez, nous nous occupons du reste.", subtitle: "Des voyages préparés à Dakar, des départs garantis et un conseiller qui vous répond.", ctaLabel: "Voir les voyages", ctaHref: "/voyages", theme: "dark" },
          { id: "omra", imageUrl: `${V}/palmeraie-aube.webp`, mobileImageUrl: `${V}/palmeraie-aube-mobile.webp`, imageAlt: "Palmeraie à l'aube", demo: true, productId: ids["omra"]!, eyebrow: "Pèlerinage", title: "Omra de printemps, accompagnée.", subtitle: "Visa, vols et hôtels proches des lieux saints : un dossier suivi du début à la fin.", ctaLabel: "Découvrir", ctaHref: "/voyages?type=pilgrimage", theme: "dark" },
          { id: "senegal", imageUrl: `${V}/casamance-bolong.webp`, mobileImageUrl: `${V}/casamance-bolong-mobile.webp`, imageAlt: "Bolong de Casamance au matin", demo: true, productId: ids["casamance"]!, eyebrow: "Sénégal", title: "La Casamance au fil de l'eau.", subtitle: "Petits groupes, guides d'ici, nuits face à l'océan.", ctaLabel: "Circuits au Sénégal", ctaHref: "/voyages?pays=S%C3%A9n%C3%A9gal", theme: "dark" },
        ],
      },
      featuredCategoryIds: [],
      featuredProductIds: [ids["dubai"]!, ids["casamance"]!, ids["omra"]!, ids["lompoul"]!, ids["cap-vert"]!, ids["fouta"]!],
      collections: [
        { id: "pelerinage", eyebrow: "", title: "Pèlerinages", subtitle: "Omra et Hajj accompagnés, dossier de visa suivi.", imageUrl: `${V}/palmeraie-aube.webp`, demo: true, href: "/voyages?type=pilgrimage" },
        { id: "sejours", eyebrow: "", title: "Séjours", subtitle: "Dubaï, Cap-Vert, Saly : l'hôtel, les vols, les transferts.", imageUrl: `${V}/ile-turquoise.webp`, demo: true, href: "/voyages?type=stay" },
        { id: "circuits", eyebrow: "", title: "Circuits", subtitle: "Casamance, Fouta Djallon : en petit groupe, avec un guide.", imageUrl: `${V}/fouta-djallon.webp`, demo: true, href: "/voyages?type=circuit" },
      ],
      reassurance: [
        { icon: "shield", title: "Départs confirmés", text: "Les places et les prix affichés sont ceux de l'agence" },
        { icon: "phone", title: "Un conseiller", text: "Joignable avant, pendant et après le voyage" },
        { icon: "card", title: "Acompte puis solde", text: "Wave, Orange Money, virement ou à l'agence" },
        { icon: "leaf", title: "Dossiers suivis", text: "Passeports, visas, vaccins : chaque pièce vérifiée" },
      ],
    }, owner.id),
  );
  console.info("Démonstration voyage créée : Baobab Voyages (aminata@baobab-voyages.sn / Demo!2026).");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
