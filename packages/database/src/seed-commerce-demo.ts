/**
 * Données de démonstration COMMERCE pour la boutique « Boutique Aïda » (seed de
 * base requis : `pnpm db:seed`). Script de DÉVELOPPEMENT uniquement — jamais
 * exécuté par la CI ni en production. Toutes les commandes sont créées par les
 * VRAIS moteurs (panier → convertCartToOrder → transitions → paiement manuel), puis
 * seules leurs dates sont réparties sur 14 jours pour un tableau de bord réaliste.
 *
 *   pnpm --filter @yamacommerce/database run seed:commerce-demo
 */
import { prisma } from "./client";
import { withSuperAdminAccess, withTenant } from "./tenant-context";
import { addCartItem, getOrCreateActiveCart } from "./cart-registry";
import { convertCartToOrder, type OrderPaymentMethod } from "./order-registry";
import { createDeliveryZone, updateCommerceSettings } from "./commerce-registry";
import { advanceOrderStatus, approveManualPayment, createDeliverer, submitManualPaymentProof } from "./order-operations";
import { saveStorefrontContent } from "./storefront-registry";
import { createOwnerAccount, provisionTenantForOwner } from "./tenant-provisioning";

const SLUG = "boutique-aida";

const CATEGORIES = [
  { slug: "mode", name: "Mode" },
  { slug: "accessoires", name: "Accessoires" },
  { slug: "maison", name: "Maison" },
  { slug: "beaute", name: "Beauté" },
];

// Visuels photographiques de démonstration (recadrages provisoires des maquettes, voir
// apps/web/public/demo-templates/MANIFEST.json) — jamais présentés comme réels.
const NAYA = "/demo-templates/atelier-naya";
const PRODUCTS: { slug: string; name: string; cat: string; price: number; compare?: number; img?: string; photo?: string; variants: string[]; stock: number[]; desc: string; bulky?: boolean }[] = [
  { slug: "ensemble-lin-horizons", name: "Ensemble lin Horizons", cat: "mode", price: 68_000, photo: `${NAYA}/hero-allure.webp`, variants: ["S", "M", "L"], stock: [3, 5, 2], desc: "Veste croisée et pantalon large en lin lavé, teinte ivoire. Coupe fluide, finitions main." },
  { slug: "robe-portefeuille-ivoire", name: "Robe portefeuille ivoire", cat: "mode", price: 54_000, photo: `${NAYA}/hero-portefeuille.webp`, variants: ["S", "M", "L"], stock: [4, 4, 3], desc: "Robe portefeuille en crêpe de coton, ceinture à nouer, manches amples." },
  { slug: "robe-drapee-terres", name: "Robe drapée Terres", cat: "mode", price: 72_000, photo: `${NAYA}/collection-terres.webp`, variants: ["S", "M", "L"], stock: [2, 3, 2], desc: "Robe asymétrique drapée, épaule dénudée, ceinture laiton. Collection Terres lumineuses." },
  { slug: "boucles-martelees", name: "Boucles d'oreilles martelées", cat: "accessoires", price: 19_500, photo: `${NAYA}/bijoux-martele.webp`, variants: ["Unique"], stock: [8], desc: "Laiton doré martelé à la main par un artisan de la Médina. Légères et lumineuses." },
  { slug: "boubou-brode-indigo", name: "Grand boubou brodé indigo", cat: "mode", price: 45_000, compare: 52_000, img: "boubou", variants: ["S", "M", "L", "XL"], stock: [4, 8, 6, 1], desc: "Bazin riche teint à la main à Thiès, broderie ton sur ton au col. Coupe ample, tombé fluide." },
  { slug: "sandales-cuir-ngor", name: "Sandales cuir Ngor", cat: "accessoires", price: 18_500, img: "sandales", variants: ["38", "39", "40", "41", "42"], stock: [3, 5, 5, 2, 0], desc: "Cuir tanné végétal, semelle cousue main par un artisan de Soumbédioune." },
  { slug: "sac-wax-teranga", name: "Sac cabas wax Teranga", cat: "accessoires", price: 22_000, img: "sac-wax", variants: ["Unique"], stock: [12], desc: "Toile wax doublée, anses en cuir, poche intérieure zippée." },
  { slug: "bracelet-laiton-sahel", name: "Bracelet laiton Sahel", cat: "accessoires", price: 9_500, img: "bracelet", variants: ["Unique"], stock: [25], desc: "Laiton martelé à la main, fini vieilli, ajustable." },
  { slug: "panier-tresse-kaolack", name: "Panier tressé Kaolack", cat: "maison", price: 15_000, img: "panier", variants: ["Moyen", "Grand"], stock: [7, 3], desc: "Paille et plastique recyclé tressés à Kaolack. Parfait pour le marché ou la décoration.", bulky: true },
  { slug: "huile-karite-baobab", name: "Huile karité & baobab", cat: "beaute", price: 7_500, img: "huile", variants: ["50 ml", "100 ml"], stock: [30, 14], desc: "Pressée à froid, sans parfum ajouté. Nourrit peau et cheveux." },
  { slug: "chapeau-paille-joal", name: "Chapeau de paille Joal", cat: "accessoires", price: 12_000, img: "chapeau", variants: ["Unique"], stock: [2], desc: "Tressage serré, bord large, ruban wax interchangeable." },
  { slug: "coupon-wax-6-yards", name: "Coupon wax 6 yards", cat: "mode", price: 16_000, img: "tissu", variants: ["Bleu marine", "Ocre"], stock: [9, 6], desc: "Coton imprimé double face, 6 yards — idéal pour un ensemble complet." },
];

const CUSTOMERS = [
  ["Fatou", "Ndiaye"], ["Mariama", "Ba"], ["Aminata", "Sow"], ["Ousmane", "Diallo"], ["Khady", "Fall"],
  ["Ibrahima", "Sy"], ["Awa", "Gueye"], ["Cheikh", "Mbaye"], ["Ndèye", "Faye"], ["Moussa", "Kane"],
  ["Coumba", "Thiam"], ["Pape", "Seck"],
];

async function main() {
  const tenant = await withSuperAdminAccess((tx) => tx.tenant.findUnique({ where: { slug: SLUG } }));
  if (!tenant) throw new Error(`Tenant "${SLUG}" introuvable — lancez d'abord \`pnpm db:seed\`.`);
  const tenantId = tenant.id;

  const existing = await withTenant(tenantId, (tx) => tx.product.count({ where: { tenantId, slug: { in: PRODUCTS.map((p) => p.slug) } } }));
  if (existing > 0) {
    console.info("Données commerce de démonstration déjà présentes — rien à faire.");
    return;
  }

  // Style de boutique choisi (comme à l'onboarding) : Atelier. `demoData` affiche le
  // bandeau « Données de démonstration » dans le dashboard : jamais présenté comme réel.
  await withSuperAdminAccess((tx) => tx.tenant.update({ where: { id: tenantId }, data: { branding: { ...Object.fromEntries(Object.entries(tenant.branding as Record<string, unknown>).filter(([k]) => k !== "primaryColor" && k !== "secondaryColor")), templatePreference: "atelier-naya", demoData: true } } }));
  // La démonstration montre les fonctions de la formule Business (factures, statistiques).
  await withSuperAdminAccess(async (tx) => {
    const business = await tx.subscriptionPlan.findUniqueOrThrow({ where: { name: "Business" } });
    await tx.tenantSubscription.updateMany({ where: { tenantId }, data: { planId: business.id } });
  });

  const variantIds: Record<string, string[]> = {};
  await withTenant(tenantId, async (tx) => {
    const shop = (await tx.shop.findFirst({ where: { tenantId, isMain: true } })) ?? (await tx.shop.create({ data: { tenantId, name: "Boutique principale", isMain: true } }));
    const cats: Record<string, string> = {};
    for (const c of CATEGORIES) {
      const cat = await tx.category.upsert({
        where: { tenantId_slug: { tenantId, slug: c.slug } },
        update: {},
        create: { tenantId, slug: c.slug, name: c.name },
      });
      cats[c.slug] = cat.id;
    }
    for (const p of PRODUCTS) {
      const product = await tx.product.create({
        data: {
          tenantId, slug: p.slug, name: p.name, description: p.desc, shortDescription: p.desc.split(".")[0],
          basePrice: p.price, compareAtPrice: p.compare ?? null, status: "PUBLISHED", categoryId: cats[p.cat]!, isBulky: p.bulky ?? false,
          images: { create: [{ url: p.photo ?? `/demo-commerce/${p.img}.svg`, altText: p.name, position: 0 }] },
        },
      });
      variantIds[p.slug] = [];
      for (const [i, v] of p.variants.entries()) {
        const variant = await tx.productVariant.create({ data: { tenantId, productId: product.id, name: v, price: p.price, attributes: {} } });
        await tx.inventoryItem.create({ data: { tenantId, productVariantId: variant.id, shopId: shop.id, availableQuantity: (p.stock[i] ?? 5) + 6, lowStockThreshold: 3 } });
        variantIds[p.slug]!.push(variant.id);
      }
    }

    await updateCommerceSettings(tx, tenantId, {
      pickupEnabled: true,
      pickupAddress: "Rue Carnot x Salva, Dakar Plateau",
      pickupInstructions: "Du lundi au samedi, 10 h – 19 h. Présentez votre numéro de commande.",
      deliveryInstructions: "Le livreur vous appelle 30 minutes avant son arrivée.",
    });
    await createDeliveryZone(tx, tenantId, { name: "Dakar Plateau & Almadies — express", region: "Dakar", commune: "Dakar", fee: 1_500, freeThreshold: 60_000, bulkySurcharge: 1_000, estimatedDays: 1 });
    await createDeliveryZone(tx, tenantId, { name: "Pikine, Guédiawaye, Rufisque", region: "Dakar", commune: "Pikine", fee: 2_500, freeThreshold: 80_000, bulkySurcharge: 1_500, estimatedDays: 2 });
    await createDeliveryZone(tx, tenantId, { name: "Thiès", region: "Thiès", fee: 3_500, bulkySurcharge: 2_000, estimatedDays: 3 });
    await createDeliveryZone(tx, tenantId, { name: "Saint-Louis", region: "Saint-Louis", fee: 5_000, estimatedDays: 4, excludedCategoryIds: [cats.maison!] });

    for (const [provider, label, number, holder] of [
      ["wave_direct", "Wave", "+221771112233", "Boutique Aïda"],
      ["orange_money_direct", "Orange Money", "+221781112233", "Aïda Diop"],
    ] as const) {
      await tx.paymentProviderConfig.upsert({
        where: { tenantId_provider: { tenantId, provider } },
        update: { isEnabled: true, label, accountNumber: number, accountHolderName: holder },
        create: { tenantId, provider, isEnabled: true, mode: "live", label, accountNumber: number, accountHolderName: holder, publicInstructions: "Envoyez le montant exact puis indiquez la référence reçue par SMS." },
      });
    }
    await createDeliverer(tx, tenantId, { phone: "+221776543210", vehicleType: "Moto — Modou" });
    await createDeliverer(tx, tenantId, { phone: "+221705559988", vehicleType: "Tricycle — Babacar" });
  });

  const zones = await withTenant(tenantId, (tx) => tx.deliveryZone.findMany({ where: { tenantId }, orderBy: { fee: "asc" } }));
  const actor = { userId: null, type: "owner" as const };
  const scenarios: { daysAgo: number; lines: [string, number, number][]; method: OrderPaymentMethod; pickup?: boolean; path: string[]; proof?: "pending" | "approved" }[] = [
    { daysAgo: 0, lines: [["boubou-brode-indigo", 1, 1]], method: "manual_wave", path: [], proof: "pending" },
    { daysAgo: 0, lines: [["sac-wax-teranga", 0, 1], ["bracelet-laiton-sahel", 0, 2]], method: "cod", path: [] },
    { daysAgo: 0, lines: [["huile-karite-baobab", 1, 2]], method: "manual_orange_money", path: [] },
    { daysAgo: 1, lines: [["sandales-cuir-ngor", 2, 1]], method: "cod", path: ["PREPARING"] },
    { daysAgo: 1, lines: [["coupon-wax-6-yards", 0, 2]], method: "manual_wave", path: ["PREPARING", "READY"], proof: "approved" },
    { daysAgo: 2, lines: [["panier-tresse-kaolack", 1, 1]], method: "cod", path: ["PREPARING", "READY", "SHIPPED"] },
    { daysAgo: 2, lines: [["boubou-brode-indigo", 2, 1], ["chapeau-paille-joal", 0, 1]], method: "manual_wave", path: ["PREPARING", "READY", "SHIPPED", "OUT_FOR_DELIVERY"], proof: "approved" },
    { daysAgo: 3, lines: [["bracelet-laiton-sahel", 0, 3]], method: "cod", pickup: true, path: ["PREPARING", "READY", "DELIVERED"] },
    { daysAgo: 4, lines: [["sac-wax-teranga", 0, 1]], method: "cod", path: ["PREPARING", "READY", "SHIPPED", "DELIVERED"] },
    { daysAgo: 5, lines: [["huile-karite-baobab", 0, 4]], method: "manual_orange_money", path: ["PREPARING", "READY", "SHIPPED", "DELIVERED"], proof: "approved" },
    { daysAgo: 6, lines: [["boubou-brode-indigo", 1, 1]], method: "cod", path: ["CANCELED"] },
    { daysAgo: 7, lines: [["coupon-wax-6-yards", 1, 1], ["sandales-cuir-ngor", 1, 1]], method: "cod", path: ["PREPARING", "READY", "SHIPPED", "DELIVERED"] },
    { daysAgo: 8, lines: [["sac-wax-teranga", 0, 2]], method: "manual_wave", path: ["PREPARING", "READY", "SHIPPED", "DELIVERED"], proof: "approved" },
    { daysAgo: 9, lines: [["panier-tresse-kaolack", 0, 1]], method: "cod", path: ["PREPARING", "READY", "SHIPPED", "DELIVERED"] },
    { daysAgo: 10, lines: [["boubou-brode-indigo", 0, 1]], method: "cod", path: ["PREPARING", "READY", "SHIPPED", "DELIVERED"] },
    { daysAgo: 11, lines: [["huile-karite-baobab", 0, 2], ["bracelet-laiton-sahel", 0, 1]], method: "cod", path: ["PREPARING", "READY", "SHIPPED", "DELIVERED"] },
    { daysAgo: 12, lines: [["sandales-cuir-ngor", 3, 1]], method: "manual_wave", path: ["PREPARING", "READY", "SHIPPED", "DELIVERED"], proof: "approved" },
    { daysAgo: 13, lines: [["coupon-wax-6-yards", 0, 3]], method: "cod", path: ["PREPARING", "READY", "SHIPPED", "DELIVERED"] },
  ];
  // Deux mois d'historique livré (J-15 à J-60) : une courbe de ventes lisible et une
  // période précédente réelle pour les tendances du dashboard.
  const HISTORY_LINES: [string, number, number][] = [["bracelet-laiton-sahel", 0, 1], ["huile-karite-baobab", 0, 1], ["sac-wax-teranga", 0, 1], ["huile-karite-baobab", 1, 1]];
  const HISTORY_METHODS: OrderPaymentMethod[] = ["cod", "manual_wave", "cod", "manual_orange_money"];
  for (let k = 0; k < 26; k += 1) {
    const method = HISTORY_METHODS[k % 4]!;
    scenarios.push({
      daysAgo: 15 + Math.round(k * 1.75),
      lines: [HISTORY_LINES[k % 10 < 4 ? k % 4 : k % 2]!],
      method,
      path: ["PREPARING", "READY", "SHIPPED", "DELIVERED"],
      ...(method === "cod" ? {} : { proof: "approved" as const }),
    });
  }

  for (const [i, s] of scenarios.entries()) {
    const [firstName, lastName] = CUSTOMERS[i % CUSTOMERS.length]!;
    const phone = `+2217${[7, 6, 8, 0][i % 4]}${String(4_200_000 + i * 137).padStart(7, "0")}`;
    const visitorToken = `demo-${i}-${Date.now()}`;
    const zone = zones[i % 3]!;
    const { order } = await withTenant(tenantId, async (tx) => {
      const cart = await getOrCreateActiveCart(tx, tenantId, visitorToken);
      for (const [slug, variantIndex, qty] of s.lines) {
        await addCartItem(tx, tenantId, cart.id, { productVariantId: variantIds[slug]![variantIndex]!, quantity: qty });
      }
      return convertCartToOrder(tx, tenantId, {
        cartId: cart.id,
        customer: { firstName: firstName!, lastName, phone, email: `${firstName!.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "")}@exemple.sn` },
        deliveryMethod: s.pickup ? "pickup" : "delivery",
        deliveryZoneId: s.pickup ? null : zone.id,
        deliveryAddress: s.pickup ? null : { region: zone.region, commune: zone.commune, neighborhood: ["Sacré-Cœur", "Mermoz", "Ouakam", "Médina"][i % 4], street: `Villa ${120 + i}` },
        paymentMethod: s.method,
      });
    });
    if (s.method === "manual_wave" || s.method === "manual_orange_money") {
      await withTenant(tenantId, (tx) =>
        tx.payment.create({
          data: { tenantId, orderId: order.id, provider: s.method === "manual_wave" ? "wave_direct" : "orange_money_direct", idempotencyKey: `demo_${order.id}`, amount: order.total, status: "PENDING" },
        }),
      );
      if (s.proof) {
        await withTenant(tenantId, (tx) => submitManualPaymentProof(tx, tenantId, order.id, order.accessToken, { reference: `${s.method === "manual_wave" ? "WV" : "OM"}${String(880000 + i * 31)}` }));
      }
      if (s.proof === "approved") await withTenant(tenantId, (tx) => approveManualPayment(tx, tenantId, order.id, actor));
    }
    for (const status of s.path) {
      await withTenant(tenantId, (tx) => advanceOrderStatus(tx, tenantId, order.id, status as never, actor));
    }
    const createdAt = new Date(Date.now() - s.daysAgo * 86_400_000 - (i % 5) * 3_600_000);
    await withSuperAdminAccess(async (tx) => {
      await tx.order.update({ where: { id: order.id }, data: { createdAt } });
      await tx.$executeRaw`SELECT 1`;
    });
  }
  // Accueil « Atelier Naya » : contenus mis en avant (visuels de DÉMONSTRATION marqués).
  await withTenant(tenantId, async (tx) => {
    const featured = await tx.product.findMany({ where: { tenantId, slug: { in: ["ensemble-lin-horizons", "robe-portefeuille-ivoire", "robe-drapee-terres", "boucles-martelees"] } }, select: { id: true, slug: true } });
    const order = ["robe-drapee-terres", "ensemble-lin-horizons", "boucles-martelees", "robe-portefeuille-ivoire"];
    const idOf = (slug: string) => featured.find((f) => f.slug === slug)?.id ?? null;
    await saveStorefrontContent(tx, tenantId, {
      announcement: { text: "Livraison offerte à Dakar dès 60 000 FCFA", href: "/catalogue" },
      hero: {
        autoplaySeconds: 7,
        slides: [
          { id: "allure", imageUrl: `${NAYA}/hero-allure.webp`, mobileImageUrl: null, imageAlt: "Femme en ensemble de lin ivoire, lumière de fin de journée", demo: true, productId: idOf("ensemble-lin-horizons"), eyebrow: "Mode · Culture · Héritage", title: "L'allure en héritage.", subtitle: "Une mode contemporaine inspirée de nos racines, pensée pour aujourd'hui et demain.", ctaLabel: "Découvrir la collection", ctaHref: "/catalogue", theme: "dark" },
          { id: "portefeuille", imageUrl: `${NAYA}/hero-portefeuille.webp`, mobileImageUrl: null, imageAlt: "Robe portefeuille ivoire", demo: true, productId: idOf("robe-portefeuille-ivoire"), eyebrow: "Nouveautés femmes", title: "Le lin, naturellement.", subtitle: "Des coupes amples et des matières nobles, confectionnées à Dakar.", ctaLabel: "Voir les nouveautés", ctaHref: "/catalogue?categorie=mode", theme: "dark" },
          { id: "terres", imageUrl: `${NAYA}/collection-terres.webp`, mobileImageUrl: null, imageAlt: "Robe drapée ivoire devant un mur ocre", demo: true, productId: idOf("robe-drapee-terres"), eyebrow: "Collection Terres lumineuses", title: "Des lignes pures.", subtitle: "Matières nobles et détails précieux, pour une élégance sans frontières.", ctaLabel: "Explorer", ctaHref: "/catalogue", theme: "dark" },
        ],
      },
      featuredCategoryIds: [],
      featuredProductIds: order.map((slug) => featured.find((f) => f.slug === slug)?.id).filter((id): id is string => !!id),
      collections: [
        { id: "horizons", eyebrow: "Collection Horizons Sénégal", title: "Horizons", subtitle: "", imageUrl: `${NAYA}/collection-horizons.webp`, demo: true, href: "/catalogue" },
        { id: "terres", eyebrow: "Nouvelle collection", title: "Terres Lumineuses", subtitle: "Des pièces aux lignes pures, matières nobles et détails précieux, pour une élégance sans frontières.", imageUrl: `${NAYA}/collection-terres.webp`, demo: true, href: "/catalogue" },
      ],
      reassurance: [
        { icon: "truck", title: "Livraison au Sénégal", text: "Dakar en 24 h" },
        { icon: "leaf", title: "Fait main à Dakar", text: "Ateliers partenaires" },
        { icon: "card", title: "Wave, Orange Money", text: "ou paiement à la livraison" },
        { icon: "phone", title: "Conseil personnalisé", text: "Par téléphone ou WhatsApp" },
      ],
    }, null);
  });
  await seedSunuMarche();
  console.info(`Données commerce de démonstration créées : ${PRODUCTS.length} produits, ${scenarios.length} commandes.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

/** Deuxième boutique de démonstration, template « Sunu Marché » (maison, déco, high-tech). */
async function seedSunuMarche() {
  const existing = await withSuperAdminAccess((tx) => tx.tenant.findUnique({ where: { slug: "sunu-marche" } }));
  if (existing) return;
  const owner = await createOwnerAccount({ email: "awa@sunu-marche.sn", fullName: "Awa Ndiaye", password: "Demo!2026" });
  const { tenantId } = await provisionTenantForOwner({ ownerUserId: owner.id, name: "Sunu Marché", subdomain: "sunu-marche", subdomainSuffix: process.env.PLATFORM_SUBDOMAIN_SUFFIX ?? "yamacommerce.ai", sectorKey: "ecommerce", planName: "Business", templatePreference: "sunu-marche" });
  await withSuperAdminAccess(async (tx) => {
    const t = await tx.tenant.findUniqueOrThrow({ where: { id: tenantId } });
    await tx.tenant.update({ where: { id: tenantId }, data: { branding: { ...(t.branding as object), demoData: true } } });
  });
  const SM = "/demo-templates/sunu-marche";
  const cats = [
    { slug: "maison", name: "Maison", img: "univers-maison" },
    { slug: "decoration", name: "Décoration", img: "univers-decoration" },
    { slug: "high-tech", name: "High-Tech", img: "univers-high-tech" },
    { slug: "sacs-accessoires", name: "Sacs & Accessoires", img: "univers-sacs" },
    { slug: "art-de-la-table", name: "Art de la table", img: "univers-art-de-la-table" },
  ];
  const products = [
    { slug: "lampe-aura", name: "Lampe Aura", cat: "decoration", price: 45_000, img: "produit-lampe-aura", desc: "Lampe champignon en céramique émaillée, lumière chaude et douce. Éclairage d'ambiance." },
    { slug: "casque-sonar-pro", name: "Casque Sonar Pro", cat: "high-tech", price: 120_000, compare: 135_000, img: "produit-casque-sonar", desc: "Casque sans fil à réduction de bruit, 30 h d'autonomie, son haute définition." },
    { slug: "sac-elena", name: "Sac Éléna", cat: "sacs-accessoires", price: 85_000, img: "produit-sac-elena", desc: "Sac à main en cuir véritable, fermoir doré, bandoulière amovible." },
    { slug: "vase-terre-bleue", name: "Vase Terre Bleue", cat: "decoration", price: 28_000, img: "produit-vase-terre-bleue", desc: "Céramique artisanale émaillée bleu profond, tournée à la main." },
    { slug: "plaid-nofi", name: "Plaid Nofi", cat: "maison", price: 32_000, img: "produit-plaid-nofi", desc: "Plaid en coton tissé main, franges nouées, 130 × 170 cm." },
  ];
  const ids: string[] = [];
  const catIds: string[] = [];
  await withTenant(tenantId, async (tx) => {
    const shop = (await tx.shop.findFirst({ where: { tenantId, isMain: true } }))!;
    const byslug: Record<string, string> = {};
    for (const c of cats) {
      const cat = await tx.category.create({ data: { tenantId, slug: c.slug, name: c.name, imageUrl: `${SM}/${c.img}.webp` } });
      byslug[c.slug] = cat.id;
      catIds.push(cat.id);
    }
    for (const p of products) {
      const product = await tx.product.create({
        data: { tenantId, slug: p.slug, name: p.name, description: p.desc, shortDescription: p.desc.split(".")[0], basePrice: p.price, compareAtPrice: p.compare ?? null, status: "PUBLISHED", categoryId: byslug[p.cat]!, images: { create: [{ url: `${SM}/${p.img}.webp`, altText: p.name, position: 0 }] } },
      });
      ids.push(product.id);
      const variant = await tx.productVariant.create({ data: { tenantId, productId: product.id, name: "Standard", price: p.price, attributes: {} } });
      await tx.inventoryItem.create({ data: { tenantId, productVariantId: variant.id, shopId: shop.id, availableQuantity: 12, lowStockThreshold: 3 } });
    }
    await createDeliveryZone(tx, tenantId, { name: "Dakar", region: "Dakar", commune: "Dakar", fee: 2_000, freeThreshold: 100_000, estimatedDays: 1 });
    await createDeliveryZone(tx, tenantId, { name: "Thiès et environs", region: "Thiès", fee: 3_500, estimatedDays: 2 });
    await tx.paymentProviderConfig.upsert({
      where: { tenantId_provider: { tenantId, provider: "wave_direct" } },
      update: {},
      create: { tenantId, provider: "wave_direct", isEnabled: true, mode: "live", label: "Wave", accountNumber: "+221770001122", accountHolderName: "Sunu Marché", publicInstructions: "Envoyez le montant exact puis indiquez la référence reçue par SMS." },
    });
    await saveStorefrontContent(tx, tenantId, {
      announcement: null,
      hero: {
        autoplaySeconds: 6,
        slides: [
          { id: "objets", imageUrl: `${SM}/hero-objets.webp`, mobileImageUrl: `${SM}/hero-objets-mobile.webp`, imageAlt: "Lampe, casque, sac en cuir et vase bleu sur un socle de pierre", demo: true, productId: ids[0]!, eyebrow: "Objets · Maisons · Idées · Durables", title: "Les belles choses du quotidien.", subtitle: "Une sélection d'objets pour la maison, la table et les journées bien remplies.", ctaLabel: "Découvrir la collection", ctaHref: "/catalogue", theme: "dark" },
          { id: "quotidien", imageUrl: `${SM}/hero-quotidien.webp`, mobileImageUrl: `${SM}/hero-quotidien-mobile.webp`, imageAlt: "Casque audio posé sur une table en bois près d'une plante", demo: true, productId: ids[1]!, eyebrow: "High-Tech", title: "Tout pour votre quotidien.", subtitle: "Son, maison, décoration : des produits choisis, livrés partout au Sénégal.", ctaLabel: "Voir la sélection", ctaHref: "/catalogue?categorie=high-tech", theme: "dark" },
        ],
      },
      featuredCategoryIds: catIds,
      featuredProductIds: ids,
      collections: [],
      reassurance: [
        { icon: "truck", title: "Livraison partout au Sénégal", text: "Rapide et fiable" },
        { icon: "box", title: "Produits sélectionnés", text: "Qualité et authenticité" },
        { icon: "card", title: "Paiement sécurisé", text: "Wave, Orange Money, à la livraison" },
        { icon: "leaf", title: "Consommation responsable", text: "Des objets durables" },
      ],
    }, null);
  });
  console.info("Boutique de démonstration « Sunu Marché » créée (awa@sunu-marche.sn).");
}
