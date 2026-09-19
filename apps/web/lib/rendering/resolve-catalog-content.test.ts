import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma, withSuperAdminAccess, withTenant } from "@yamacommerce/database";
import type { TemplateManifest } from "@yamacommerce/templates";
import type { ResolvedCategoriesContent, ResolvedProductsContent } from "@/components/sections/content-types";
import { resolveCatalogContentForManifest } from "./resolve-catalog-content";

/**
 * Vérifie contre PostgreSQL réel que les sections catalogue (categories/
 * featured_products/new_arrivals) sont bien résolues à partir de VRAIS produits —
 * voir la revue du 18 septembre 2026, « relié aux sites publiés — aucune donnée de
 * démonstration codée en dur ». Même politique que les autres suites DB : ignorée en
 * local sans PostgreSQL, obligatoire en CI via REQUIRE_DB_TESTS.
 */
let databaseAvailable = true;
try {
  await prisma.$queryRaw`SELECT 1`;
} catch (error) {
  if (process.env.REQUIRE_DB_TESTS === "true") {
    throw new Error(
      "REQUIRE_DB_TESTS=true mais PostgreSQL est injoignable : la suite de résolution " +
        `du contenu catalogue DOIT s'exécuter en CI. Cause : ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  databaseAvailable = false;
  // eslint-disable-next-line no-console
  console.warn("[resolve-catalog-content.test] Base de données injoignable — suite ignorée (skip).");
}

describe.skipIf(!databaseAvailable)("resolveCatalogContentForManifest", () => {
  const suffix = Date.now();
  const sectorKey = `test-sector-catalog-content-${suffix}`;
  let tenantAId: string;
  let tenantBId: string;
  let categoryId: string;
  let publishedProductId: string;

  beforeAll(async () => {
    await withSuperAdminAccess(async (tx) => {
      await tx.sector.create({
        data: { key: sectorKey, name: "Secteur de test", defaultModuleKeys: [], isSystem: false },
      });
      const tenantA = await tx.tenant.create({
        data: {
          slug: `test-catalog-content-a-${suffix}`,
          name: "Boutique contenu A",
          businessType: "ECOMMERCE",
          sectorKey,
          status: "ACTIVE",
        },
      });
      const tenantB = await tx.tenant.create({
        data: {
          slug: `test-catalog-content-b-${suffix}`,
          name: "Boutique contenu B",
          businessType: "ECOMMERCE",
          sectorKey,
          status: "ACTIVE",
        },
      });
      tenantAId = tenantA.id;
      tenantBId = tenantB.id;
    });

    await withTenant(tenantAId, async (tx) => {
      const category = await tx.category.create({
        data: { tenantId: tenantAId, name: "Robes", slug: `robes-${suffix}`, imageUrl: "https://cdn.test/robes.jpg" },
      });
      categoryId = category.id;

      const published = await tx.product.create({
        data: {
          tenantId: tenantAId,
          categoryId,
          name: "Robe publiée",
          slug: `robe-publiee-${suffix}`,
          status: "PUBLISHED",
          basePrice: 20_000,
        },
      });
      publishedProductId = published.id;
      await tx.productImage.create({ data: { productId: published.id, url: "https://cdn.test/robe.jpg", position: 0 } });
      await tx.productVariant.create({
        data: { tenantId: tenantAId, productId: published.id, name: "M", price: 20_000, attributes: { size: "M" } },
      });

      // Produit BROUILLON — ne doit JAMAIS apparaître dans le contenu résolu public.
      await tx.product.create({
        data: { tenantId: tenantAId, name: "Brouillon jamais publié", slug: `brouillon-${suffix}`, status: "DRAFT", basePrice: 5_000 },
      });
    });

    // Produit du tenant B — ne doit JAMAIS apparaître dans le contenu résolu du tenant A.
    await withTenant(tenantBId, (tx) =>
      tx.product.create({
        data: { tenantId: tenantBId, name: "Produit B", slug: `produit-b-${suffix}`, status: "PUBLISHED", basePrice: 9_000 },
      }),
    );
  });

  afterAll(async () => {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.is_super_admin', 'true', true)`;
      await tx.productVariant.deleteMany({ where: { product: { tenantId: { in: [tenantAId, tenantBId] } } } });
      await tx.productImage.deleteMany({ where: { product: { tenantId: { in: [tenantAId, tenantBId] } } } });
      await tx.product.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
      await tx.category.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
      await tx.tenant.deleteMany({ where: { id: { in: [tenantAId, tenantBId] } } });
      await tx.sector.deleteMany({ where: { key: sectorKey } });
    });
  });

  function manifestWith(sections: TemplateManifest["pages"][number]["sections"]): TemplateManifest {
    return { pages: [{ slug: "accueil", title: "Accueil", isHome: true, sections }] };
  }

  it("« categories » : résout UNIQUEMENT les catégories du tenant courant, référencées par id", async () => {
    const manifest = manifestWith([
      {
        id: "cat-1",
        sectionKey: "categories",
        variant: "grid",
        order: 0,
        isEnabled: true,
        animationOverride: "inherit",
        params: { categoryIds: [categoryId], displayCount: 6 },
      },
    ]);

    const resolved = await withTenant(tenantAId, (tx) => resolveCatalogContentForManifest(tx, tenantAId, manifest));
    const content = resolved["cat-1"] as ResolvedCategoriesContent;
    expect(content.categories).toHaveLength(1);
    expect(content.categories[0]?.name).toBe("Robes");
    expect(content.categories[0]?.href).toContain(`robes-${suffix}`);
  });

  it("« featured_products » : ne renvoie JAMAIS un brouillon ni un produit d'un AUTRE tenant", async () => {
    const manifest = manifestWith([
      {
        id: "featured-1",
        sectionKey: "featured_products",
        variant: "grid",
        order: 0,
        isEnabled: true,
        animationOverride: "inherit",
        params: { displayCount: 8 },
      },
    ]);

    const resolved = await withTenant(tenantAId, (tx) => resolveCatalogContentForManifest(tx, tenantAId, manifest));
    const content = resolved["featured-1"] as ResolvedProductsContent;
    expect(content.products).toHaveLength(1);
    expect(content.products[0]?.id).toBe(publishedProductId);
    expect(content.products.some((p) => p.name === "Brouillon jamais publié")).toBe(false);
    expect(content.products.some((p) => p.name === "Produit B")).toBe(false);
  });

  it("« featured_products » avec productIds explicites : respecte la sélection ET l'ordre du commerçant", async () => {
    const manifest = manifestWith([
      {
        id: "featured-2",
        sectionKey: "featured_products",
        variant: "grid",
        order: 0,
        isEnabled: true,
        animationOverride: "inherit",
        params: { productIds: [publishedProductId], displayCount: 8 },
      },
    ]);

    const resolved = await withTenant(tenantAId, (tx) => resolveCatalogContentForManifest(tx, tenantAId, manifest));
    const content = resolved["featured-2"] as ResolvedProductsContent;
    expect(content.products.map((p) => p.id)).toEqual([publishedProductId]);
    expect(content.products[0]?.imageUrl).toBe("https://cdn.test/robe.jpg");
    expect(content.products[0]?.sizes).toEqual(["M"]);
  });

  it("« new_arrivals » : sert les produits PUBLIÉS les plus récents du tenant courant", async () => {
    const manifest = manifestWith([
      {
        id: "arrivals-1",
        sectionKey: "new_arrivals",
        variant: "grid",
        order: 0,
        isEnabled: true,
        animationOverride: "inherit",
        params: { displayCount: 8 },
      },
    ]);

    const resolved = await withTenant(tenantAId, (tx) => resolveCatalogContentForManifest(tx, tenantAId, manifest));
    const content = resolved["arrivals-1"] as ResolvedProductsContent;
    expect(content.products.map((p) => p.id)).toContain(publishedProductId);
  });

  it("un manifeste sans section catalogue ne déclenche AUCUNE requête inutile (objet vide)", async () => {
    const manifest = manifestWith([
      { id: "hero-1", sectionKey: "hero", variant: "split", order: 0, isEnabled: true, animationOverride: "inherit", params: { title: "x" } },
    ]);
    const resolved = await withTenant(tenantAId, (tx) => resolveCatalogContentForManifest(tx, tenantAId, manifest));
    expect(resolved).toEqual({});
  });
});
