/**
 * Entreprise de DÉMONSTRATION pour la création de site assistée par IA : « Terre &
 * Émail », boutique de céramiques, avec un vrai catalogue de test (six pièces
 * photographiées — rendus originaux, voir scripts/demo-visuals/ceramiques.py — et deux
 * pièces SANS photo, pour vérifier que l'assistant signale ce qui manque sans rien
 * inventer). Aucun site n'est composé ici : c'est le parcours « Mon site » qui le fait.
 *
 *   pnpm --filter @yamacommerce/database run seed:ai-demo
 */
import { prisma } from "./client";
import { withSuperAdminAccess, withTenant } from "./tenant-context";
import { assertDemoSeedAllowed } from "./demo-guard";
import { createOwnerAccount, provisionTenantForOwner } from "./tenant-provisioning";

// AI_SEED=test : entreprise de TEST séparée (banc d'essai IA), jamais la démo.
const TEST = process.env.AI_SEED === "test";
const SLUG = TEST ? "test-ceramique" : "terre-et-email";
const C = "/demo-templates/ceramiques";

const CATEGORIES = [
  { slug: "vases", name: "Vases" },
  { slug: "art-de-la-table", name: "Art de la table" },
  { slug: "decoration", name: "Décoration" },
];

const PRODUCTS = [
  { slug: "jarre-indigo", name: "Jarre Indigo", cat: "vases", price: 38_000, img: "jarre-indigo", desc: "Jarre en grès, émail indigo profond et pied en terre nue. Pièce tournée à la main, 26 cm." },
  { slug: "bouteille-celadon", name: "Bouteille Céladon", cat: "vases", price: 32_000, img: "bouteille-celadon", desc: "Bouteille à col étroit, émail céladon translucide. Pour une tige ou seule, 32 cm." },
  { slug: "vase-terracotta", name: "Vase Terracotta", cat: "vases", price: 29_000, img: "vase-terracotta", desc: "Vase ovoïde, émail mat couleur terre cuite, toucher doux. 28 cm." },
  { slug: "soliflore-nuit", name: "Soliflore Nuit", cat: "decoration", price: 18_000, img: "soliflore-nuit", desc: "Soliflore élancé, émail noir miroir. Une fleur, une branche, 33 cm." },
  { slug: "amphore-ocre", name: "Amphore Ocre", cat: "decoration", price: 45_000, img: "amphore-ocre", desc: "Amphore à épaule haute, émail ocre et coulure foncée au pied. 30 cm." },
  { slug: "coupe-sable", name: "Coupe Sable", cat: "art-de-la-table", price: 24_000, img: "coupe-sable", desc: "Coupe large sur petit pied, émail sable satiné. Fruits, pain ou centre de table." },
  { slug: "carafe-lagune", name: "Carafe Lagune", cat: "art-de-la-table", price: 21_000, img: null, desc: "Carafe d'un litre, émail vert d'eau. Photo à venir." },
  { slug: "bougeoir-baobab", name: "Bougeoir Baobab", cat: "decoration", price: 12_000, img: null, desc: "Bougeoir en grès brut inspiré de l'écorce du baobab. Photo à venir." },
];

async function main() {
  assertDemoSeedAllowed();
  const existing = await withSuperAdminAccess((tx) => tx.tenant.findUnique({ where: { slug: SLUG } }));
  if (existing) return console.info(`« ${SLUG} » existe déjà — rien à faire.`);
  const owner = await createOwnerAccount({ email: TEST ? "fatou@test-ceramique.sn" : "fatou@terre-et-email.sn", fullName: "Fatou Ndiaye", password: "Demo!2026" });
  const { tenantId } = await provisionTenantForOwner({ ownerUserId: owner.id, name: TEST ? "Céramique de test" : "Terre & Émail", subdomain: SLUG, subdomainSuffix: process.env.PLATFORM_SUBDOMAIN_SUFFIX ?? "yamacommerce.ai", sectorKey: "ecommerce", planName: "Business", templatePreference: "sunu-marche" });
  await withSuperAdminAccess((tx) => tx.tenant.update({ where: { id: tenantId }, data: { isDemo: true } }));
  await withTenant(tenantId, async (tx) => {
    const shop = (await tx.shop.findFirst({ where: { tenantId, isMain: true } }))!;
    const cat: Record<string, string> = {};
    for (const c of CATEGORIES) cat[c.slug] = (await tx.category.create({ data: { tenantId, slug: c.slug, name: c.name } })).id;
    for (const [i, p] of PRODUCTS.entries()) {
      const product = await tx.product.create({
        data: {
          tenantId, slug: p.slug, name: p.name, description: `${p.desc}${p.img ? " Visuel de démonstration (rendu)." : ""}`, shortDescription: p.desc.split(".")[0], basePrice: p.price, status: "PUBLISHED", categoryId: cat[p.cat]!,
          // Dates d'ajout échelonnées : « nouveautés en premier » a un sens.
          createdAt: new Date(Date.now() - (PRODUCTS.length - i) * 86_400_000),
          ...(p.img ? { images: { create: [{ url: `${C}/${p.img}.webp`, altText: `${p.name}, céramique émaillée`, position: 0 }] } } : {}),
        },
      });
      const variant = await tx.productVariant.create({ data: { tenantId, productId: product.id, name: "Standard", price: p.price, attributes: {} } });
      await tx.inventoryItem.create({ data: { tenantId, productVariantId: variant.id, shopId: shop.id, availableQuantity: 6, lowStockThreshold: 2 } });
    }
  });
  console.info(`[${SLUG}] Boutique de démonstration « Terre & Émail » créée (fatou@terre-et-email.sn / Demo!2026).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
