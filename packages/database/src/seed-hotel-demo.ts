/**
 * Démonstration HÔTEL : « Maison Sabar », maison d'hôtes à Somone (Petite-Côte). Script de
 * DÉVELOPPEMENT uniquement — jamais exécuté par la CI ni en production. Tout passe par
 * les VRAIS moteurs (types, chambres, tarifs, séjours sans surréservation, arrivée).
 * Visuels : illustrations ORIGINALES rendues par scripts/demo-visuals/hotel.py, marquées
 * `demo: true`, jamais présentées comme les chambres d'un établissement réel.
 *
 *   pnpm --filter @yamacommerce/database run seed:hotel-demo
 */
import { prisma } from "./client";
import { withSuperAdminAccess, withTenant } from "./tenant-context";
import { assertDemoSeedAllowed } from "./demo-guard";
import { createOwnerAccount, provisionTenantForOwner } from "./tenant-provisioning";
import { setListingStatus } from "./listing-registry";
import { saveStorefrontContent } from "./storefront-registry";
import { recordReservationPayment } from "./travel-registry";
import { addDays, utcToLocal } from "./service-slots";
import { addRoom, bookStay, checkIn, createRoomType, setRate, setRoomHousekeeping, updateHotelSettings, type RoomTypeInput } from "./hotel-registry";

const SLUG = "maison-sabar";
const V = "/demo-templates/hotel";
const img = (name: string, alt: string) => ({ url: `${V}/${name}.webp`, alt, demo: true });
const TZ = "Africa/Dakar";

const TYPES: (RoomTypeInput & { key: string; rooms: string[] })[] = [
  {
    key: "jardin", title: "Chambre Jardin", nightlyPrice: 35_000, maxAdults: 2, maxChildren: 1, bedSummary: "1 grand lit", sizeM2: 24, featured: true,
    amenities: ["wifi", "air_conditioning", "garden_view", "breakfast", "workspace"],
    summary: "Au rez-de-chaussée, ouverte sur le jardin de bougainvilliers : calme et fraîche.",
    description: "Une chambre simple et soignée : lit de 160, climatisation silencieuse, bureau, douche à l'italienne. Le petit déjeuner est servi sous la véranda.\n\nIdéale pour un week-end ou un séjour de travail sur la Petite-Côte.",
    media: [img("chambre-jardin", "Chambre, lit et fenêtre voilée"), img("piscine", "Piscine, transats et bougainvillier")],
    rooms: ["1", "2", "3", "4"],
  },
  {
    key: "ocean", title: "Chambre Océan", nightlyPrice: 55_000, maxAdults: 2, maxChildren: 1, bedSummary: "1 grand lit", sizeM2: 28, featured: true,
    amenities: ["wifi", "air_conditioning", "sea_view", "balcony", "breakfast", "tv"],
    summary: "À l'étage, un balcon face à l'océan pour les couchers de soleil.",
    description: "Lit de 180, balcon privatif, vue sur la mer au-dessus des cocotiers. Petit déjeuner compris.",
    media: [img("terrasse-ocean", "Terrasse face à l'océan au couchant"), img("facade-crepuscule", "Façade à arcades au crépuscule")],
    rooms: ["11", "12", "14"],
  },
  {
    key: "suite", title: "Suite Océan", nightlyPrice: 95_000, maxAdults: 4, maxChildren: 2, bedSummary: "1 lit king-size et 1 canapé-lit", sizeM2: 46, minNights: 2, depositPercent: 30,
    amenities: ["wifi", "air_conditioning", "sea_view", "balcony", "bathtub", "minibar", "breakfast", "tv"],
    summary: "La plus grande : salon, baignoire et fenêtre en arche sur l'océan.",
    description: "Une suite pour les séjours qui comptent : chambre et salon séparés, baignoire, grande fenêtre en arche sur la mer. Deux nuits minimum.",
    media: [img("suite-ocean", "Suite, lit et fenêtre en arche sur l'océan"), img("terrasse-ocean", "Terrasse face à l'océan")],
    rooms: ["21", "22"],
  },
  {
    key: "bungalow", title: "Bungalow Famille", nightlyPrice: 80_000, maxAdults: 4, maxChildren: 3, bedSummary: "1 grand lit et 2 lits simples", sizeM2: 52, depositPercent: 30,
    amenities: ["wifi", "air_conditioning", "kitchenette", "pool", "garden_view", "parking"],
    summary: "Deux chambres, une kitchenette et la piscine à deux pas.",
    description: "Un bungalow indépendant au fond du jardin : deux chambres, coin cuisine équipé, terrasse privée. Accès direct à la piscine.",
    media: [img("piscine", "Piscine, transats et bougainvillier"), img("chambre-jardin", "Chambre, lit et fenêtre voilée")],
    rooms: ["B1", "B2"],
  },
];

async function main() {
  assertDemoSeedAllowed();
  const existing = await withSuperAdminAccess((tx) => tx.tenant.findUnique({ where: { slug: SLUG } }));
  if (existing) {
    console.info("Démonstration hôtel déjà présente — rien à faire.");
    return;
  }
  const owner = await createOwnerAccount({ email: "khady@maison-sabar.sn", fullName: "Khady Diouf", password: "Demo!2026" });
  const { tenantId } = await provisionTenantForOwner({
    ownerUserId: owner.id,
    name: "Maison Sabar",
    subdomain: SLUG,
    subdomainSuffix: process.env.PLATFORM_SUBDOMAIN_SUFFIX ?? "yamacommerce.ai",
    sectorKey: "hospitality",
    planName: "Business",
    templatePreference: "palmeraie",
  });
  await withSuperAdminAccess(async (tx) => {
    const t = await tx.tenant.findUniqueOrThrow({ where: { id: tenantId } });
    await tx.tenant.update({
      where: { id: tenantId },
      data: { isDemo: true, timezone: TZ, branding: { ...(t.branding as object), contactPhone: "+221 33 957 20 20", contactWhatsapp: "+221775572020", contactEmail: "bonjour@maison-sabar.sn", contactAddress: "Route de la lagune, Somone" } },
    });
  });
  await withTenant(tenantId, async (tx) => {
    await tx.paymentProviderConfig.createMany({
      data: [
        { tenantId, provider: "wave_direct", isEnabled: true, mode: "live", label: "Wave", accountNumber: "77 557 20 20", accountHolderName: "Maison Sabar", publicInstructions: null },
        { tenantId, provider: "orange_money_direct", isEnabled: true, mode: "live", label: "Orange Money", accountNumber: "78 557 20 20", accountHolderName: "Maison Sabar", publicInstructions: null },
      ],
    });
    await updateHotelSettings(tx, tenantId, { autoConfirm: true, cancelFreeHours: 48, maxAdvanceDays: 365, maxNights: 30 });
  });

  const today = utcToLocal(new Date(), TZ).date;
  const types: Record<string, string> = {};
  const rooms: Record<string, string> = {};
  await withTenant(tenantId, async (tx) => {
    for (const [i, { key, rooms: numbers, ...input }] of TYPES.entries()) {
      const t = await createRoomType(tx, tenantId, { ...input, position: i }, owner.id);
      types[key] = t.id;
      for (const n of numbers) rooms[n] = (await addRoom(tx, tenantId, { listingId: t.id, number: n, floor: /^1/.test(n) ? "1er étage" : /^2/.test(n) ? "2e étage" : /^B/.test(n) ? "Jardin" : "Rez-de-chaussée" })).id;
      await setListingStatus(tx, tenantId, t.id, "published", owner.id);
    }
    // Période de fête dans 3 semaines : tarifs majorés sur l'océan.
    await setRate(tx, tenantId, { listingId: types.ocean!, startDate: addDays(today, 21), endDate: addDays(today, 25), nightlyPrice: 70_000, label: "Week-end prolongé" });
    await setRate(tx, tenantId, { listingId: types.suite!, startDate: addDays(today, 21), endDate: addDays(today, 25), nightlyPrice: 120_000, label: "Week-end prolongé" });
  });

  const guests = [
    ["Aminata", "Faye", "77 610 20 30"], ["Pierre", "Mendy", "76 205 44 18"], ["Coumba", "Ndiaye", "78 340 12 90"], ["Ibou", "Sarr", "77 812 36 54"],
    ["Awa", "Gueye", "70 455 71 02"], ["Moustapha", "Diallo", "77 221 09 87"], ["Claire", "Dupont", "77 903 64 21"], ["Oumar", "Ba", "76 118 52 40"],
  ] as const;
  const plan: [number, number, string, number, number, "web" | "phone"][] = [
    // [arrivée J+N, nuits, type, adultes, enfants, canal]
    [0, 3, "ocean", 2, 0, "phone"], [0, 2, "jardin", 2, 0, "web"], [1, 2, "suite", 2, 1, "web"], [2, 4, "jardin", 1, 0, "web"],
    [3, 2, "ocean", 2, 0, "web"], [5, 3, "bungalow", 2, 2, "web"], [7, 2, "ocean", 2, 0, "phone"], [9, 5, "jardin", 2, 0, "web"],
    [21, 3, "suite", 3, 0, "web"], [22, 2, "ocean", 2, 1, "web"],
  ];
  const booked: string[] = [];
  for (const [i, [arrive, nights, type, adults, children, channel]] of plan.entries()) {
    const [firstName, lastName, phone] = guests[i % guests.length]!;
    const s = await withTenant(tenantId, (tx) =>
      bookStay(tx, tenantId, {
        listingId: types[type]!,
        arrival: addDays(today, arrive),
        departure: addDays(today, arrive + nights),
        adults,
        children,
        customer: { firstName, lastName, phone },
        channel: arrive === 0 ? "dashboard" : channel,
        actor: arrive === 0 || channel === "phone" ? { userId: owner.id, type: "owner" } : { userId: null, type: "customer" },
      }),
    );
    booked.push(s!.id);
  }
  await withTenant(tenantId, async (tx) => {
    // Le premier client est arrivé ce matin ; acompte versé pour la suite.
    await checkIn(tx, tenantId, booked[0]!, { userId: owner.id, type: "owner" });
    await recordReservationPayment(tx, tenantId, { reservationId: booked[0]!, amount: 55_000, method: "wave", kind: "deposit", reference: "WV-10293", actorUserId: owner.id });
    const suite = await tx.reservation.findUniqueOrThrow({ where: { id: booked[2]! } });
    await recordReservationPayment(tx, tenantId, { reservationId: booked[2]!, amount: Math.ceil((suite.totalAmount ?? 0) * 0.3), method: "orange_money", kind: "deposit", reference: "OM-55812", actorUserId: owner.id });
    // Ménage : deux chambres libérées ce matin, une en travaux.
    await setRoomHousekeeping(tx, tenantId, rooms["3"]!, "dirty");
    await setRoomHousekeeping(tx, tenantId, rooms["12"]!, "dirty");
    await setRoomHousekeeping(tx, tenantId, rooms["B2"]!, "out_of_service", "Climatisation en réparation");
  });

  await withTenant(tenantId, (tx) =>
    saveStorefrontContent(tx, tenantId, {
      announcement: null,
      hero: {
        autoplaySeconds: 7,
        slides: [
          { id: "sabar", imageUrl: `${V}/facade-crepuscule.webp`, mobileImageUrl: `${V}/facade-crepuscule-mobile.webp`, imageAlt: "Façade à arcades au crépuscule, palmiers", demo: true, productId: null, eyebrow: "Maison d'hôtes · Somone, Petite-Côte", title: "Entre lagune et océan, prenez le temps.", subtitle: "Onze chambres, une piscine, la plage à pied. Réservez en direct : la chambre vous est attribuée dès la confirmation.", ctaLabel: "Voir les chambres", ctaHref: "/chambres", theme: "dark" },
        ],
      },
      featuredCategoryIds: [],
      featuredProductIds: [],
      collections: [],
      reassurance: [],
    }, owner.id),
  );
  console.info(`Démonstration hôtel créée : Maison Sabar (khady@maison-sabar.sn / Demo!2026), ${booked.length} séjours.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
