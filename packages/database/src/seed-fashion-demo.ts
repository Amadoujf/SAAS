/**
 * Démonstration MODE ET VÊTEMENTS : « Atelier Naya », maison de prêt-à-porter fictive
 * (secteur `fashion`, habillage « Atelier Naya »). Script de DÉVELOPPEMENT et de
 * prévisualisation uniquement. Catalogue 100 % vêtements, chaussures et accessoires,
 * variantes taille × couleur avec stock propre, guides des tailles modifiables
 * rattachés aux catégories (un produit en remplace un), commandes créées par les VRAIS
 * moteurs (panier → commande → transitions).
 *
 *   pnpm --filter @yamacommerce/database run seed:fashion-demo
 *   FASHION_SEED=test pnpm --filter @yamacommerce/database run seed:fashion-demo   (entreprise de test séparée)
 *
 * Visuels : 5 photographies de démonstration (maquettes fournies par le client,
 * demo-templates/atelier-naya) et 10 illustrations originales dessinées par
 * `scripts/demo-visuals/mode.py` (demo-templates/mode). Jamais présentés comme réels.
 */
import { prisma } from "./client";
import { withSuperAdminAccess, withTenant } from "./tenant-context";
import { assertDemoSeedAllowed } from "./demo-guard";
import { addCartItem, getOrCreateActiveCart } from "./cart-registry";
import { convertCartToOrder, type OrderPaymentMethod } from "./order-registry";
import { createDeliveryZone } from "./commerce-registry";
import { advanceOrderStatus } from "./order-operations";
import { saveStorefrontContent } from "./storefront-registry";
import { createOwnerAccount, provisionTenantForOwner } from "./tenant-provisioning";
import { createSizeGuide, setCategorySizeGuide, setProductSizeGuide } from "./size-guide-registry";

const TEST = process.env.FASHION_SEED === "test";
const SLUG = TEST ? "test-mode" : "atelier-naya";
const NAME = TEST ? "Mode de test" : "Atelier Naya";
const MAIL = TEST ? "test-mode.sn" : "atelier-naya.sn";
const NAYA = "/demo-templates/atelier-naya";
const MODE = "/demo-templates/mode";

const GUIDES = {
  femme: {
    name: "Robes, ensembles et hauts femme",
    columns: ["Taille", "Poitrine (cm)", "Taille (cm)", "Hanches (cm)"],
    rows: [["XS", "80-84", "62-66", "88-92"], ["S", "85-89", "67-71", "93-97"], ["M", "90-94", "72-76", "98-102"], ["L", "95-100", "77-82", "103-108"], ["XL", "101-107", "83-89", "109-115"]],
    note: "Mesures du corps, pas du vêtement. Entre deux tailles, prenez la plus grande : nos coupes sont près du corps.",
  },
  ample: {
    name: "Boubous et caftans (coupe ample)",
    columns: ["Taille", "Tour de poitrine jusqu'à (cm)", "Longueur (cm)"],
    rows: [["S/M", "110", "140"], ["L/XL", "125", "145"], ["XXL", "140", "150"]],
    note: "Coupe volontairement ample : choisissez d'après votre tour de poitrine et la longueur souhaitée.",
  },
  homme: {
    name: "Chemises homme",
    columns: ["Taille", "Tour de cou (cm)", "Poitrine (cm)", "Longueur de manche (cm)"],
    rows: [["S", "37-38", "92-96", "62"], ["M", "39-40", "97-102", "63"], ["L", "41-42", "103-108", "64"], ["XL", "43-44", "109-115", "65"], ["XXL", "45-46", "116-122", "66"]],
    note: null,
  },
  pieds: {
    name: "Chaussures (pointures)",
    columns: ["Pointure", "Longueur du pied (cm)"],
    rows: [["37", "23,5"], ["38", "24,2"], ["39", "24,9"], ["40", "25,5"], ["41", "26,2"], ["42", "26,9"], ["43", "27,5"]],
    note: "Mesurez votre pied le soir, talon contre un mur, jusqu'au bout du plus long orteil.",
  },
} as const;

const CATEGORIES = [
  { slug: "robes", name: "Robes", guide: "femme", img: `${NAYA}/collection-terres.webp` },
  { slug: "ensembles", name: "Ensembles", guide: "femme", img: `${NAYA}/hero-allure.webp` },
  { slug: "boubous-caftans", name: "Boubous et caftans", guide: "ample", img: `${MODE}/boubou-indigo.webp` },
  { slug: "chemises-homme", name: "Chemises homme", guide: "homme", img: `${MODE}/chemise-bogolan.webp` },
  { slug: "chaussures", name: "Chaussures", guide: "pieds", img: `${MODE}/sandales-ngor.webp` },
  { slug: "accessoires", name: "Accessoires", guide: null, img: `${NAYA}/bijoux-martele.webp` },
] as const;

type Item = { slug: string; name: string; cat: string; price: number; compare?: number; img: string; alt: string; sizes: string[]; colors: string[]; stock: number[]; desc: string; guide?: keyof typeof GUIDES };
const F = ["XS", "S", "M", "L", "XL"];
const PRODUCTS: Item[] = [
  { slug: "robe-portefeuille-ivoire", name: "Robe portefeuille ivoire", cat: "robes", price: 54_000, img: `${NAYA}/hero-portefeuille.webp`, alt: "Robe portefeuille ivoire portée", sizes: F, colors: ["Ivoire"], stock: [1, 3, 4, 3, 1], desc: "Crêpe de coton, ceinture à nouer, manches amples. Taille marquée, longueur midi." },
  { slug: "robe-drapee-terres", name: "Robe drapée Terres", cat: "robes", price: 72_000, img: `${NAYA}/collection-terres.webp`, alt: "Robe drapée ivoire devant un mur ocre", sizes: ["S", "M", "L"], colors: ["Ivoire"], stock: [2, 3, 0], desc: "Drapé asymétrique, épaule dénudée, boucle en laiton. Collection Terres lumineuses." },
  { slug: "robe-wax-baobab", name: "Robe wax Baobab", cat: "robes", price: 38_000, img: `${MODE}/robe-wax-baobab.webp`, alt: "Illustration : robe en wax vert et ocre, ceinture camel", sizes: F, colors: ["Vert baobab", "Indigo"], stock: [2, 4, 5, 3, 1, 1, 2, 3, 2, 0], desc: "Wax 100 % coton, manches courtes, jupe évasée, ceinture assortie. Doublée." },
  { slug: "robe-lin-terracotta", name: "Robe lin terracotta", cat: "robes", price: 46_000, compare: 52_000, img: `${MODE}/robe-lin-terracotta.webp`, alt: "Illustration : robe longue en lin terracotta", sizes: F, colors: ["Terracotta", "Sable"], stock: [0, 2, 3, 2, 1, 1, 2, 2, 1, 0], desc: "Lin lavé, col V, coupe trapèze. Fraîche pour la saison chaude." },
  { slug: "ensemble-lin-horizons", name: "Ensemble lin Horizons", cat: "ensembles", price: 68_000, img: `${NAYA}/hero-allure.webp`, alt: "Ensemble veste et pantalon en lin ivoire porté", sizes: ["S", "M", "L", "XL"], colors: ["Ivoire"], stock: [3, 5, 2, 1], desc: "Veste croisée et pantalon large en lin lavé. Finitions main, boutons en corne." },
  { slug: "ensemble-sable-horizons", name: "Ensemble Horizons sable", cat: "ensembles", price: 64_000, img: `${NAYA}/collection-horizons.webp`, alt: "Ensemble sable de la collection Horizons", sizes: ["S", "M", "L"], colors: ["Sable"], stock: [2, 2, 2], desc: "Tunique longue et pantalon fluide, coton et lin. Collection Horizons Sénégal." },
  { slug: "grand-boubou-indigo", name: "Grand boubou brodé indigo", cat: "boubous-caftans", price: 85_000, compare: 95_000, img: `${MODE}/boubou-indigo.webp`, alt: "Illustration : grand boubou en bazin indigo, broderie dorée au col", sizes: ["S/M", "L/XL", "XXL"], colors: ["Indigo", "Blanc cassé"], stock: [2, 4, 1, 1, 2, 1], desc: "Bazin riche teint à Thiès, broderie main au col et au plastron. Pièce de cérémonie." },
  { slug: "boubou-blanc-tabaski", name: "Boubou blanc brodé or", cat: "boubous-caftans", price: 78_000, img: `${MODE}/boubou-blanc.webp`, alt: "Illustration : boubou blanc cassé, broderie dorée", sizes: ["S/M", "L/XL", "XXL"], colors: ["Blanc cassé"], stock: [3, 4, 2], desc: "Bazin blanc cassé, broderie fil doré. Livré avec son pantalon." },
  { slug: "caftan-wax-soleil", name: "Caftan wax Soleil", cat: "boubous-caftans", price: 42_000, img: `${MODE}/caftan-wax-soleil.webp`, alt: "Illustration : caftan en wax jaune soleil, motifs bleus et rouges", sizes: ["S/M", "L/XL"], colors: ["Soleil"], stock: [4, 3], desc: "Wax lumineux, encolure soulignée d'un biais crème, poches cachées." },
  { slug: "chemise-bogolan", name: "Chemise bogolan", cat: "chemises-homme", price: 32_000, img: `${MODE}/chemise-bogolan.webp`, alt: "Illustration : chemise en bogolan terre et brun", sizes: ["S", "M", "L", "XL", "XXL"], colors: ["Terre"], stock: [1, 3, 4, 2, 1], desc: "Bogolan teint à la terre par un atelier de Ségou, coton épais, col classique." },
  { slug: "chemise-lin-mao", name: "Chemise lin col mao", cat: "chemises-homme", price: 29_000, img: `${MODE}/chemise-lin-mao.webp`, alt: "Illustration : chemise en lin écru, col mao", sizes: ["S", "M", "L", "XL", "XXL"], colors: ["Écru", "Kaki"], stock: [2, 3, 3, 2, 1, 1, 2, 2, 1, 0], desc: "Lin léger, col mao, boutons nacrés. Se porte ouverte sur un pantalon de lin." },
  { slug: "sandales-cuir-ngor", name: "Sandales cuir Ngor", cat: "chaussures", price: 18_500, img: `${MODE}/sandales-ngor.webp`, alt: "Illustration : paire de sandales en cuir à deux brides", sizes: ["37", "38", "39", "40", "41", "42", "43"], colors: ["Cognac"], stock: [2, 3, 5, 5, 3, 2, 0], desc: "Cuir tanné végétal, semelle cousue main à Soumbédioune." },
  { slug: "mules-brodees", name: "Mules en wax", cat: "chaussures", price: 16_000, img: `${MODE}/mules-brodees.webp`, alt: "Illustration : mules en wax bordeaux et or", sizes: ["37", "38", "39", "40", "41"], colors: ["Bordeaux"], stock: [2, 4, 4, 2, 1], desc: "Dessus en wax, semelle en cuir, intérieur doux. Elles chaussent petit.", guide: "pieds" },
  { slug: "foulard-wax", name: "Foulard de tête en wax", cat: "accessoires", price: 9_500, img: `${MODE}/foulard-wax.webp`, alt: "Illustration : foulard en wax bleu, motifs jaunes et rouges", sizes: ["Unique"], colors: ["Bleu roi"], stock: [14], desc: "Wax 2 m × 0,9 m, ourlé main. Pour un nœud haut ou un turban." },
  { slug: "boucles-martelees", name: "Boucles d'oreilles martelées", cat: "accessoires", price: 19_500, img: `${NAYA}/bijoux-martele.webp`, alt: "Boucles d'oreilles en laiton martelé", sizes: ["Unique"], colors: ["Laiton"], stock: [8], desc: "Laiton doré martelé à la main par un artisan de la Médina." },
];

const CUSTOMERS = [["Ndèye", "Sarr"], ["Mame", "Diouf"], ["Abdou", "Ndiaye"], ["Coumba", "Ba"], ["Ousmane", "Sy"], ["Aïssatou", "Diallo"], ["Fatou", "Kane"], ["Moustapha", "Gueye"]] as const;

async function main() {
  assertDemoSeedAllowed();
  if (await withSuperAdminAccess((tx) => tx.tenant.findUnique({ where: { slug: SLUG } }))) {
    console.info(`${NAME} déjà présent — rien à faire.`);
    return;
  }
  const owner = await createOwnerAccount({ email: `naya@${MAIL}`, fullName: "Naya Faye", password: "Demo!2026" });
  const { tenantId } = await provisionTenantForOwner({ ownerUserId: owner.id, name: NAME, subdomain: SLUG, subdomainSuffix: process.env.PLATFORM_SUBDOMAIN_SUFFIX ?? "yamacommerce.ai", sectorKey: "fashion", planName: "Business", templatePreference: "atelier-naya" });
  await withSuperAdminAccess(async (tx) => {
    const t = await tx.tenant.findUniqueOrThrow({ where: { id: tenantId } });
    await tx.tenant.update({ where: { id: tenantId }, data: { isDemo: true, timezone: "Africa/Dakar", branding: { ...(t.branding as object), templatePreference: "atelier-naya", contactPhone: "+221 33 869 27 40", contactWhatsapp: "+221778692740", contactEmail: `bonjour@${MAIL}`, contactAddress: "Rue Carnot, Plateau, Dakar" } } });
  });

  const variantIds: Record<string, string[]> = {};
  const ids: Record<string, string> = {};
  const catIds: Record<string, string> = {};
  await withTenant(tenantId, async (tx) => {
    const shop = (await tx.shop.findFirst({ where: { tenantId, isMain: true } }))!;
    const guideIds: Record<string, string> = {};
    for (const [key, g] of Object.entries(GUIDES)) {
      guideIds[key] = (await createSizeGuide(tx, tenantId, { name: g.name, columns: [...g.columns], rows: g.rows.map((r) => [...r]), note: g.note })).id;
    }
    for (const c of CATEGORIES) {
      const cat = await tx.category.create({ data: { tenantId, slug: c.slug, name: c.name, imageUrl: c.img } });
      catIds[c.slug] = cat.id;
      if (c.guide) await setCategorySizeGuide(tx, tenantId, cat.id, guideIds[c.guide]!);
    }
    for (const p of PRODUCTS) {
      const product = await tx.product.create({
        data: {
          tenantId, slug: p.slug, name: p.name, description: p.desc, shortDescription: p.desc.split(".")[0], basePrice: p.price, compareAtPrice: p.compare ?? null,
          status: "PUBLISHED", categoryId: catIds[p.cat]!, tags: ["mode", ...p.colors.map((c) => c.toLowerCase())],
          images: { create: [{ url: p.img, altText: p.alt, position: 0 }] },
        },
      });
      ids[p.slug] = product.id;
      if (p.guide) await setProductSizeGuide(tx, tenantId, product.id, guideIds[p.guide]!);
      variantIds[p.slug] = [];
      let k = 0;
      for (const color of p.colors) {
        for (const size of p.sizes) {
          const name = p.colors.length > 1 ? `${size} · ${color}` : p.sizes.length > 1 ? size : color;
          const variant = await tx.productVariant.create({ data: { tenantId, productId: product.id, name, price: p.price, attributes: { size, color } } });
          await tx.inventoryItem.create({ data: { tenantId, productVariantId: variant.id, shopId: shop.id, availableQuantity: p.stock[k] ?? 0, lowStockThreshold: 1 } });
          variantIds[p.slug]!.push(variant.id);
          k += 1;
        }
      }
    }
    await createDeliveryZone(tx, tenantId, { name: "Dakar — livraison en 24 h", region: "Dakar", commune: "Dakar", fee: 1_500, freeThreshold: 60_000, estimatedDays: 1 });
    await createDeliveryZone(tx, tenantId, { name: "Thiès, Mbour, Saly", region: "Thiès", fee: 3_000, estimatedDays: 2 });
    await createDeliveryZone(tx, tenantId, { name: "Saint-Louis, Touba, Kaolack", region: "Saint-Louis", fee: 4_500, estimatedDays: 3 });
    await tx.paymentProviderConfig.upsert({
      where: { tenantId_provider: { tenantId, provider: "wave_direct" } },
      update: {},
      create: { tenantId, provider: "wave_direct", isEnabled: true, mode: "live", label: "Wave", accountNumber: "+221778692740", accountHolderName: NAME, publicInstructions: "Envoyez le montant exact puis indiquez la référence reçue par SMS." },
    });
  });

  // Quelques commandes réelles (moteurs du panier et des commandes), à des stades variés.
  const zones = await withTenant(tenantId, (tx) => tx.deliveryZone.findMany({ where: { tenantId }, orderBy: { fee: "asc" } }));
  const actor = { userId: null, type: "owner" as const };
  const scenarios: { daysAgo: number; lines: [string, number, number][]; method: OrderPaymentMethod; path: string[] }[] = [
    { daysAgo: 0, lines: [["robe-wax-baobab", 2, 1]], method: "cod", path: [] },
    { daysAgo: 0, lines: [["grand-boubou-indigo", 1, 1]], method: "manual_wave", path: [] },
    { daysAgo: 1, lines: [["chemise-bogolan", 2, 1], ["sandales-cuir-ngor", 4, 1]], method: "cod", path: ["PREPARING"] },
    { daysAgo: 2, lines: [["ensemble-lin-horizons", 1, 1]], method: "cod", path: ["PREPARING", "READY", "SHIPPED"] },
    { daysAgo: 4, lines: [["foulard-wax", 0, 2], ["boucles-martelees", 0, 1]], method: "cod", path: ["PREPARING", "READY", "SHIPPED", "DELIVERED"] },
    { daysAgo: 6, lines: [["caftan-wax-soleil", 0, 1]], method: "cod", path: ["PREPARING", "READY", "SHIPPED", "DELIVERED"] },
    { daysAgo: 9, lines: [["robe-portefeuille-ivoire", 2, 1]], method: "cod", path: ["CANCELED"] },
  ];
  for (const [i, s] of scenarios.entries()) {
    const [firstName, lastName] = CUSTOMERS[i % CUSTOMERS.length]!;
    const zone = zones[i % zones.length]!;
    const { order } = await withTenant(tenantId, async (tx) => {
      const cart = await getOrCreateActiveCart(tx, tenantId, `demo-mode-${i}-${Date.now()}`);
      for (const [slug, variantIndex, qty] of s.lines) await addCartItem(tx, tenantId, cart.id, { productVariantId: variantIds[slug]![variantIndex]!, quantity: qty });
      return convertCartToOrder(tx, tenantId, {
        cartId: cart.id,
        customer: { firstName, lastName, phone: `+2217${[7, 6, 8, 0][i % 4]}${String(5_300_000 + i * 211).padStart(7, "0")}`, email: null },
        deliveryMethod: "delivery",
        deliveryZoneId: zone.id,
        deliveryAddress: { region: zone.region, commune: zone.commune, neighborhood: ["Point E", "Mermoz", "Ouakam", "Plateau"][i % 4], street: `Villa ${40 + i}` },
        paymentMethod: s.method,
      });
    });
    for (const status of s.path) await withTenant(tenantId, (tx) => advanceOrderStatus(tx, tenantId, order.id, status as never, actor));
    await withSuperAdminAccess((tx) => tx.order.update({ where: { id: order.id }, data: { createdAt: new Date(Date.now() - s.daysAgo * 86_400_000 - i * 3_600_000) } }));
  }

  // Accueil : photos de démonstration en ouverture, collections, sélection mise en avant.
  await withTenant(tenantId, (tx) =>
    saveStorefrontContent(tx, tenantId, {
      announcement: { text: "Livraison offerte à Dakar dès 60 000 FCFA · Retouches offertes", href: "/catalogue" },
      hero: {
        autoplaySeconds: 7,
        slides: [
          { id: "allure", imageUrl: `${NAYA}/hero-allure.webp`, mobileImageUrl: null, imageAlt: "Ensemble de lin ivoire, lumière de fin de journée", demo: true, productId: ids["ensemble-lin-horizons"]!, eyebrow: "Prêt-à-porter · Dakar", title: "L'allure en héritage.", subtitle: "Des coupes contemporaines, des tissus d'ici : bazin, wax, bogolan et lin.", ctaLabel: "Découvrir la collection", ctaHref: "/catalogue", theme: "dark" },
          { id: "terres", imageUrl: `${NAYA}/collection-terres.webp`, mobileImageUrl: null, imageAlt: "Robe drapée ivoire devant un mur ocre", demo: true, productId: ids["robe-drapee-terres"]!, eyebrow: "Collection Terres lumineuses", title: "Des lignes pures.", subtitle: "Robes et ensembles à porter du bureau à la cérémonie.", ctaLabel: "Voir les robes", ctaHref: "/catalogue?categorie=robes", theme: "dark" },
        ],
      },
      featuredCategoryIds: ["robes", "boubous-caftans", "chemises-homme", "chaussures"].map((s) => catIds[s]!),
      featuredProductIds: ["robe-wax-baobab", "grand-boubou-indigo", "ensemble-lin-horizons", "chemise-bogolan", "sandales-cuir-ngor", "caftan-wax-soleil"].map((s) => ids[s]!),
      collections: [
        { id: "horizons", eyebrow: "Collection", title: "Horizons Sénégal", subtitle: "Lin et coton, couleurs de sable et d'océan.", imageUrl: `${NAYA}/collection-horizons.webp`, demo: true, href: "/catalogue?categorie=ensembles" },
        { id: "ceremonie", eyebrow: "Cérémonies", title: "Bazin et broderies", subtitle: "Grands boubous et caftans, brodés à la main.", imageUrl: `${MODE}/boubou-indigo.webp`, demo: true, href: "/catalogue?categorie=boubous-caftans" },
      ],
      reassurance: [
        { icon: "truck", title: "Livraison au Sénégal", text: "Dakar en 24 h" },
        { icon: "leaf", title: "Confectionné à Dakar", text: "Ateliers partenaires" },
        { icon: "card", title: "Wave ou à la livraison", text: "Paiement simple" },
        { icon: "phone", title: "Conseil taille", text: "Par téléphone ou WhatsApp" },
      ],
    }, null),
  );
  console.info(`Démonstration mode créée : ${NAME} (naya@${MAIL} / Demo!2026), ${PRODUCTS.length} produits, ${Object.keys(GUIDES).length} guides des tailles, ${scenarios.length} commandes.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
