/**
 * Démonstration MODE ET VÊTEMENTS : « Atelier Naya », maison de prêt-à-porter fictive
 * (secteur `fashion`, habillage « Atelier Naya »). Script de DÉVELOPPEMENT et de
 * prévisualisation uniquement. Catalogue prêt-à-porter, sacs et accessoires,
 * variantes taille × couleur avec stock propre, guides des tailles modifiables
 * rattachés aux catégories (un produit en remplace un), commandes créées par les VRAIS
 * moteurs (panier → commande → transitions).
 *
 *   pnpm --filter @yamacommerce/database run seed:fashion-demo
 *   FASHION_SEED=test pnpm --filter @yamacommerce/database run seed:fashion-demo   (entreprise de test séparée)
 *
 * Visuels : uniquement des PHOTOGRAPHIES de démonstration (recadrages provisoires des
 * maquettes fournies par le client, demo-templates/atelier-naya, voir MANIFEST.json) :
 * un catalogue visuellement cohérent pour comparer les directions. Jamais présentés
 * comme réels ; à remplacer par des photographies sous licence.
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
// Entreprise de test : identité fictive soignée (même maison que les photos), toujours
// signalée « démonstration » dans l'interface.
const NAME = TEST ? "Maison Naya" : "Atelier Naya";
const MAIL = TEST ? "test-mode.sn" : "atelier-naya.sn";
const NAYA = "/demo-templates/atelier-naya";

const GUIDES = {
  femme: {
    name: "Robes, ensembles et hauts femme",
    columns: ["Taille", "Poitrine (cm)", "Taille (cm)", "Hanches (cm)"],
    rows: [["XS", "80-84", "62-66", "88-92"], ["S", "85-89", "67-71", "93-97"], ["M", "90-94", "72-76", "98-102"], ["L", "95-100", "77-82", "103-108"], ["XL", "101-107", "83-89", "109-115"]],
    note: "Mesures du corps, pas du vêtement. Entre deux tailles, prenez la plus grande : nos coupes sont près du corps.",
  },
  sacs: {
    name: "Sacs (dimensions)",
    columns: ["Format", "Largeur (cm)", "Hauteur (cm)", "Profondeur (cm)"],
    rows: [["Moyen", "32", "24", "12"], ["Grand", "40", "30", "15"]],
    note: "Le format Moyen accueille un téléphone, un portefeuille et un carnet A5 ; le Grand, un ordinateur 13 pouces.",
  },
} as const;

const CATEGORIES = [
  { slug: "pret-a-porter", name: "Prêt-à-porter", guide: "femme", img: `${NAYA}/hero-allure.webp` },
  { slug: "sacs", name: "Sacs", guide: "sacs", img: `${NAYA}/sac-cognac-porte.webp` },
  { slug: "accessoires", name: "Accessoires", guide: null, img: `${NAYA}/lunettes-ecaille.webp` },
] as const;

type Item = { slug: string; name: string; cat: string; price: number; compare?: number; img: string; alt: string; more?: { img: string; alt: string }[]; sizes: string[]; colors: string[]; stock: number[]; desc: string; guide?: keyof typeof GUIDES };
const F = ["XS", "S", "M", "L", "XL"];
const PRODUCTS: Item[] = [
  { slug: "sac-kora-cognac", name: "Sac Kora cognac", cat: "sacs", price: 128_000, img: `${NAYA}/sac-cognac-socle.webp`, alt: "Sac en cuir cognac posé sur un socle bleu, voile de lin", more: [{ img: `${NAYA}/sac-cognac-porte.webp`, alt: "Le sac Kora porté à l'épaule avec une tunique de lin" }], sizes: ["Moyen", "Grand"], colors: ["Cognac"], stock: [4, 2], desc: "Cuir pleine fleur tanné végétal, anse réglable, fermeture aimantée. Sa forme en croissant se porte à l'épaule ou à la main." },
  { slug: "sac-ndar-ivoire", name: "Sac Ndar ivoire", cat: "sacs", price: 96_000, img: `${NAYA}/sac-ivoire.webp`, alt: "Sac ivoire posé sur un socle de pierre", sizes: ["Moyen", "Grand"], colors: ["Ivoire"], stock: [3, 1], desc: "Cuir grainé ivoire, doublure en coton, poche intérieure zippée. Une ligne sobre qui accompagne les tenues de cérémonie." },
  { slug: "lunettes-corniche", name: "Lunettes Corniche", cat: "accessoires", price: 42_000, img: `${NAYA}/lunettes-ecaille.webp`, alt: "Lunettes de soleil en écaille sur une pierre au soleil", sizes: ["Unique"], colors: ["Écaille"], stock: [9], desc: "Monture en acétate écaille, verres teintés ambre. Livrées avec leur étui en cuir." },
  { slug: "boucles-martelees", name: "Boucles d'oreilles martelées", cat: "accessoires", price: 19_500, img: `${NAYA}/bijoux-martele.webp`, alt: "Boucles d'oreilles en laiton martelé", sizes: ["Unique"], colors: ["Laiton"], stock: [8], desc: "Laiton doré martelé à la main par un artisan de la Médina." },
  { slug: "ensemble-lin-horizons", name: "Ensemble lin Horizons", cat: "pret-a-porter", price: 68_000, img: `${NAYA}/hero-allure.webp`, alt: "Ensemble veste et pantalon en lin ivoire porté", sizes: ["S", "M", "L", "XL"], colors: ["Ivoire"], stock: [3, 5, 2, 1], desc: "Veste croisée et pantalon large en lin lavé. Finitions main, boutons en corne." },
  { slug: "robe-portefeuille-ivoire", name: "Robe portefeuille ivoire", cat: "pret-a-porter", price: 54_000, img: `${NAYA}/hero-portefeuille.webp`, alt: "Robe portefeuille ivoire portée", sizes: F, colors: ["Ivoire"], stock: [1, 3, 4, 3, 1], desc: "Crêpe de coton, ceinture à nouer, manches amples. Taille marquée, longueur midi." },
  { slug: "robe-drapee-terres", name: "Robe drapée Terres", cat: "pret-a-porter", price: 72_000, img: `${NAYA}/collection-terres.webp`, alt: "Robe drapée ivoire devant un mur ocre", sizes: ["S", "M", "L"], colors: ["Ivoire"], stock: [2, 3, 0], desc: "Drapé asymétrique, épaule dénudée, boucle en laiton. Collection Terres lumineuses." },
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
          images: { create: [{ url: p.img, altText: p.alt, position: 0 }, ...(p.more ?? []).map((m, k) => ({ url: m.img, altText: m.alt, position: k + 1 }))] },
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

  // Démonstration uniquement : la direction « Sculptural » s'ouvre sur le sac Kora cognac
  // (maquette validée). Lu seulement pour une entreprise de démonstration (isDemo).
  await withSuperAdminAccess(async (tx) => {
    const t = await tx.tenant.findUniqueOrThrow({ where: { id: tenantId } });
    await tx.tenant.update({ where: { id: tenantId }, data: { branding: { ...(t.branding as object), demoHeroProducts: { sculptural: ids["sac-kora-cognac"]! } } } });
  });

  // Quelques commandes réelles (moteurs du panier et des commandes), à des stades variés.
  const zones = await withTenant(tenantId, (tx) => tx.deliveryZone.findMany({ where: { tenantId }, orderBy: { fee: "asc" } }));
  const actor = { userId: null, type: "owner" as const };
  const scenarios: { daysAgo: number; lines: [string, number, number][]; method: OrderPaymentMethod; path: string[] }[] = [
    { daysAgo: 0, lines: [["sac-kora-cognac", 0, 1]], method: "cod", path: [] },
    { daysAgo: 0, lines: [["robe-portefeuille-ivoire", 2, 1]], method: "manual_wave", path: [] },
    { daysAgo: 1, lines: [["lunettes-corniche", 0, 1], ["boucles-martelees", 0, 1]], method: "cod", path: ["PREPARING"] },
    { daysAgo: 2, lines: [["ensemble-lin-horizons", 1, 1]], method: "cod", path: ["PREPARING", "READY", "SHIPPED"] },
    { daysAgo: 4, lines: [["sac-ndar-ivoire", 0, 1]], method: "cod", path: ["PREPARING", "READY", "SHIPPED", "DELIVERED"] },
    { daysAgo: 9, lines: [["robe-drapee-terres", 1, 1]], method: "cod", path: ["CANCELED"] },
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
          { id: "kora", imageUrl: `${NAYA}/sac-cognac-socle.webp`, mobileImageUrl: null, imageAlt: "Sac en cuir cognac posé sur un socle bleu", demo: true, productId: ids["sac-kora-cognac"]!, eyebrow: "Collection signature — Dakar", title: "L'allure, naturellement.", subtitle: "Cuir, lin et laiton : des pièces dessinées à Dakar, faites pour durer.", ctaLabel: "Découvrir la collection", ctaHref: "/catalogue", theme: "dark" },
          { id: "allure", imageUrl: `${NAYA}/hero-allure.webp`, mobileImageUrl: null, imageAlt: "Ensemble de lin ivoire, lumière de fin de journée", demo: true, productId: ids["ensemble-lin-horizons"]!, eyebrow: "Prêt-à-porter", title: "Le lin, en lumière.", subtitle: "Des coupes amples et des matières nobles, confectionnées à Dakar.", ctaLabel: "Voir le prêt-à-porter", ctaHref: "/catalogue?categorie=pret-a-porter", theme: "dark" },
        ],
      },
      featuredCategoryIds: ["pret-a-porter", "sacs", "accessoires"].map((s) => catIds[s]!),
      featuredProductIds: ["sac-kora-cognac", "ensemble-lin-horizons", "sac-ndar-ivoire", "robe-drapee-terres", "lunettes-corniche", "robe-portefeuille-ivoire"].map((s) => ids[s]!),
      collections: [
        { id: "horizons", eyebrow: "Collection", title: "Horizons", subtitle: "Lin et coton, couleurs de sable et d'océan.", imageUrl: `${NAYA}/collection-horizons.webp`, demo: true, href: "/catalogue?categorie=pret-a-porter" },
        { id: "sacs", eyebrow: "Maroquinerie", title: "Les sacs", subtitle: "Cuir tanné végétal, lignes en croissant.", imageUrl: `${NAYA}/sac-cognac-porte.webp`, demo: true, href: "/catalogue?categorie=sacs" },
      ],
      reassurance: [
        { icon: "truck", title: "Livraison au Sénégal", text: "Dakar en 24 h" },
        { icon: "leaf", title: "Confectionné à Dakar", text: "Ateliers partenaires" },
        { icon: "card", title: "Wave ou à la livraison", text: "Paiement simple" },
        { icon: "phone", title: "Conseil personnalisé", text: "Par téléphone ou WhatsApp" },
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
