import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../src/client";
import { withSuperAdminAccess, withTenant } from "../src/tenant-context";
import {
  InsufficientStockError,
  addProductImage,
  adjustStock,
  createCategory,
  createProduct,
  createProductVariant,
  deleteCategory,
  listLowStockItems,
  listProducts,
  listStockMovements,
  removeProductImage,
  setProductStatus,
  updateProduct,
  upsertInventoryItem,
} from "../src/catalog-registry";

/**
 * Vérifie le catalogue (catégories/produits/variantes/stock) contre PostgreSQL réel —
 * voir la revue du 18 septembre 2026, « produits réels par entreprise ». Deux
 * exigences explicites de cette revue nécessitent une preuve réelle, pas seulement
 * une lecture de code :
 *
 * - ISOLATION : `ProductVariant`/`InventoryItem`/`StockMovement` n'ont AUCUNE policy
 *   RLS (voir la note de sécurité en tête de catalog-registry.ts) — sans un test réel
 *   contre PostgreSQL, rien ne prouve que le filtrage applicatif fonctionne vraiment.
 * - CONCURRENCE : la protection contre la survente doit être vérifiée avec de VRAIS
 *   appels parallèles, pas un mock qui ne peut par construction jamais représenter
 *   une vraie course entre deux transactions PostgreSQL.
 *
 * Même politique que les autres suites DB : ignorée en local sans PostgreSQL,
 * obligatoire en CI via REQUIRE_DB_TESTS.
 */
let databaseAvailable = true;
try {
  await prisma.$queryRaw`SELECT 1`;
} catch (error) {
  if (process.env.REQUIRE_DB_TESTS === "true") {
    throw new Error(
      "REQUIRE_DB_TESTS=true mais PostgreSQL est injoignable : la suite du catalogue " +
        `DOIT s'exécuter en CI. Cause : ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  databaseAvailable = false;
  // eslint-disable-next-line no-console
  console.warn("[catalog-registry.test] Base de données injoignable — suite ignorée (skip).");
}

describe.skipIf(!databaseAvailable)("Registre du catalogue", () => {
  const suffix = Date.now();
  const sectorKey = `test-sector-catalog-${suffix}`;
  let tenantAId: string;
  let tenantBId: string;
  let shopAId: string;
  let shopBId: string;
  let ownerUserId: string;
  let mediaAssetAId: string;

  beforeAll(async () => {
    await withSuperAdminAccess(async (tx) => {
      await tx.sector.create({
        data: { key: sectorKey, name: "Secteur de test", defaultModuleKeys: [], isSystem: false },
      });
      const tenantA = await tx.tenant.create({
        data: {
          slug: `test-catalog-a-${suffix}`,
          name: "Boutique catalogue A",
          businessType: "ECOMMERCE",
          sectorKey,
          status: "ACTIVE",
        },
      });
      const tenantB = await tx.tenant.create({
        data: {
          slug: `test-catalog-b-${suffix}`,
          name: "Boutique catalogue B",
          businessType: "ECOMMERCE",
          sectorKey,
          status: "ACTIVE",
        },
      });
      tenantAId = tenantA.id;
      tenantBId = tenantB.id;

      const shopA = await tx.shop.create({ data: { tenantId: tenantAId, name: "Boutique A", isMain: true } });
      const shopB = await tx.shop.create({ data: { tenantId: tenantBId, name: "Boutique B", isMain: true } });
      shopAId = shopA.id;
      shopBId = shopB.id;

      const owner = await tx.user.create({
        data: { email: `owner-catalog-${suffix}@test.local`, passwordHash: "x", fullName: "Owner Test" },
      });
      ownerUserId = owner.id;

      const mediaAssetA = await tx.mediaAsset.create({
        data: {
          tenantId: tenantAId,
          ownerId: ownerUserId,
          originalName: "produit.jpg",
          storageKey: `test/${suffix}/produit.jpg`,
          type: "IMAGE",
          mimeType: "image/jpeg",
          sizeBytes: 1024,
          status: "READY",
          checksumSha256: "deadbeef",
        },
      });
      mediaAssetAId = mediaAssetA.id;
    });
  });

  afterAll(async () => {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.is_super_admin', 'true', true)`;
      await tx.stockMovement.deleteMany({
        where: { inventoryItem: { variant: { product: { tenantId: { in: [tenantAId, tenantBId] } } } } },
      });
      await tx.inventoryItem.deleteMany({
        where: { variant: { product: { tenantId: { in: [tenantAId, tenantBId] } } } },
      });
      await tx.productVariant.deleteMany({ where: { product: { tenantId: { in: [tenantAId, tenantBId] } } } });
      await tx.productImage.deleteMany({ where: { product: { tenantId: { in: [tenantAId, tenantBId] } } } });
      await tx.product.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
      await tx.category.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
      await tx.mediaAsset.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
      await tx.shop.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
      await tx.user.deleteMany({ where: { id: ownerUserId } });
      await tx.tenant.deleteMany({ where: { id: { in: [tenantAId, tenantBId] } } });
      await tx.sector.deleteMany({ where: { key: sectorKey } });
    });
  });

  it("CRUD catégorie/produit : brouillon -> publié -> archivé, prix en FCFA entiers", async () => {
    const category = await withTenant(tenantAId, (tx) =>
      createCategory(tx, tenantAId, { name: "Chaussures", slug: "chaussures" }),
    );

    const product = await withTenant(tenantAId, (tx) =>
      createProduct(tx, tenantAId, {
        categoryId: category.id,
        name: "Sneakers en cuir",
        slug: "sneakers-cuir",
        basePrice: 45_000,
      }),
    );
    expect(product.status).toBe("DRAFT");
    expect(product.basePrice).toBe(45_000);

    await withTenant(tenantAId, (tx) => setProductStatus(tx, tenantAId, product.id, "PUBLISHED"));
    const [published] = await withTenant(tenantAId, (tx) => listProducts(tx, tenantAId, { status: "PUBLISHED" }));
    expect(published?.id).toBe(product.id);

    await withTenant(tenantAId, (tx) => setProductStatus(tx, tenantAId, product.id, "ARCHIVED"));
    const archived = await withTenant(tenantAId, (tx) => listProducts(tx, tenantAId, { status: "ARCHIVED" }));
    expect(archived.some((p) => p.id === product.id)).toBe(true);
  });

  it("refuse de supprimer une catégorie encore utilisée par un produit", async () => {
    const category = await withTenant(tenantAId, (tx) =>
      createCategory(tx, tenantAId, { name: "Sacs", slug: "sacs" }),
    );
    await withTenant(tenantAId, (tx) =>
      createProduct(tx, tenantAId, { categoryId: category.id, name: "Sac à main", slug: "sac-a-main", basePrice: 20_000 }),
    );

    await expect(withTenant(tenantAId, (tx) => deleteCategory(tx, tenantAId, category.id))).rejects.toThrow(
      /encore utilisée/,
    );
  });

  it("IMAGES : lie un produit à un VRAI média de la médiathèque et tient le compteur de références à jour", async () => {
    const product = await withTenant(tenantAId, (tx) =>
      createProduct(tx, tenantAId, { name: "T-shirt imprimé", slug: "t-shirt-imprime", basePrice: 8_000 }),
    );

    const image = await withTenant(tenantAId, (tx) =>
      addProductImage(tx, tenantAId, {
        productId: product.id,
        mediaAssetId: mediaAssetAId,
        url: "https://cdn.test/produit.jpg",
      }),
    );
    expect(image.mediaAssetId).toBe(mediaAssetAId);

    const afterAdd = await withSuperAdminAccess((tx) => tx.mediaAsset.findUniqueOrThrow({ where: { id: mediaAssetAId } }));
    expect(afterAdd.referenceCount).toBe(1);

    await withTenant(tenantAId, (tx) => removeProductImage(tx, tenantAId, image.id));
    const afterRemove = await withSuperAdminAccess((tx) =>
      tx.mediaAsset.findUniqueOrThrow({ where: { id: mediaAssetAId } }),
    );
    expect(afterRemove.referenceCount).toBe(0);
  });

  it("IMAGES : refuse de lier un média appartenant à un AUTRE tenant", async () => {
    const productB = await withTenant(tenantBId, (tx) =>
      createProduct(tx, tenantBId, { name: "Produit B", slug: "produit-b", basePrice: 5_000 }),
    );

    await expect(
      withTenant(tenantBId, (tx) =>
        addProductImage(tx, tenantBId, {
          productId: productB.id,
          mediaAssetId: mediaAssetAId, // appartient au tenant A.
          url: "https://cdn.test/vole.jpg",
        }),
      ),
    ).rejects.toThrow(/introuvable/);
  });

  describe("Variantes et stock", () => {
    let productId: string;
    let variantId: string;
    let inventoryItemId: string;

    beforeAll(async () => {
      const product = await withTenant(tenantAId, (tx) =>
        createProduct(tx, tenantAId, { name: "Robe wax", slug: `robe-wax-${suffix}`, basePrice: 15_000 }),
      );
      productId = product.id;

      const variant = await withTenant(tenantAId, (tx) =>
        createProductVariant(tx, tenantAId, productId, {
          name: "Rouge / M",
          sku: `ROBE-WAX-R-M-${suffix}`,
          price: 15_000,
          attributes: { color: "Rouge", size: "M", material: "Wax" },
        }),
      );
      variantId = variant.id;
      expect(variant.attributes).toEqual({ color: "Rouge", size: "M", material: "Wax" });

      const item = await withTenant(tenantAId, (tx) =>
        upsertInventoryItem(tx, tenantAId, { variantId, shopId: shopAId, initialQuantity: 10, lowStockThreshold: 3 }),
      );
      inventoryItemId = item.id;
    });

    it("ISOLATION : le tenant B ne peut ni lire ni modifier la variante/le stock du tenant A, même par id direct", async () => {
      const variantFromB = await withTenant(tenantBId, (tx) =>
        tx.productVariant.findFirst({ where: { id: variantId, product: { tenantId: tenantBId } } }),
      );
      expect(variantFromB).toBeNull();

      await expect(
        withTenant(tenantBId, (tx) =>
          adjustStock(tx, tenantBId, { inventoryItemId, type: "in", quantity: 5 }),
        ),
      ).rejects.toThrow(/introuvable/);

      await expect(
        withTenant(tenantBId, (tx) => listStockMovements(tx, tenantBId, inventoryItemId)),
      ).rejects.toThrow(/introuvable/);

      // Confirme que le tenant A, lui, voit toujours bien SON propre item — la garde
      // ci-dessus filtre vraiment par tenant, elle ne casse pas juste tout accès.
      const stillThere = await withTenant(tenantAId, (tx) => listStockMovements(tx, tenantAId, inventoryItemId));
      expect(stillThere).toEqual([]);
    });

    it("ajuste le stock (entrée/sortie) et écrit un historique de mouvements", async () => {
      await withTenant(tenantAId, (tx) =>
        adjustStock(tx, tenantAId, { inventoryItemId, type: "in", quantity: 5, reason: "Réassort" }),
      );
      await withTenant(tenantAId, (tx) =>
        adjustStock(tx, tenantAId, { inventoryItemId, type: "out", quantity: 3, referenceType: "order" }),
      );

      const item = await withSuperAdminAccess((tx) => tx.inventoryItem.findUniqueOrThrow({ where: { id: inventoryItemId } }));
      expect(item.quantity).toBe(12); // 10 + 5 - 3.

      const movements = await withTenant(tenantAId, (tx) => listStockMovements(tx, tenantAId, inventoryItemId));
      expect(movements).toHaveLength(2);
      expect(movements[0]?.type).toBe("out"); // le plus récent en premier.
    });

    it("refuse une sortie qui dépasserait le stock disponible", async () => {
      await expect(
        withTenant(tenantAId, (tx) =>
          adjustStock(tx, tenantAId, { inventoryItemId, type: "out", quantity: 999 }),
        ),
      ).rejects.toThrow(InsufficientStockError);

      const item = await withSuperAdminAccess((tx) => tx.inventoryItem.findUniqueOrThrow({ where: { id: inventoryItemId } }));
      expect(item.quantity).toBe(12); // inchangé — jamais de décrément partiel.
    });

    it(
      "CONCURRENCE RÉELLE : des sorties simultanées ne peuvent jamais survendre le stock disponible",
      async () => {
        // Stock initial connu : 12 (issu du test précédent, même item, même suite —
        // décrit explicitement pour que ce test reste lisible seul).
        const before = await withSuperAdminAccess((tx) =>
          tx.inventoryItem.findUniqueOrThrow({ where: { id: inventoryItemId } }),
        );
        expect(before.quantity).toBe(12);

        // 5 tentatives réelles et concurrentes de sortir 5 unités chacune (25 au total)
        // pour un stock de 12 : au plus 2 doivent réussir (10 unités), le reste doit
        // échouer proprement — jamais une survente. Chaque appel ouvre sa PROPRE
        // transaction PostgreSQL réelle via `withTenant` (voir tenant-context.ts) :
        // une vraie course, pas une simulation.
        const attempts = await Promise.allSettled(
          Array.from({ length: 5 }, () =>
            withTenant(tenantAId, (tx) => adjustStock(tx, tenantAId, { inventoryItemId, type: "out", quantity: 5 })),
          ),
        );

        const succeeded = attempts.filter((a) => a.status === "fulfilled").length;
        const failed = attempts.filter((a) => a.status === "rejected").length;
        expect(succeeded).toBe(2);
        expect(failed).toBe(3);

        const after = await withSuperAdminAccess((tx) =>
          tx.inventoryItem.findUniqueOrThrow({ where: { id: inventoryItemId } }),
        );
        expect(after.quantity).toBe(2); // 12 - (2 * 5) — jamais négatif, jamais < 0.
        expect(after.quantity).toBeGreaterThanOrEqual(0);
      },
    );

    it("ALERTES : un item sous son seuil apparaît dans listLowStockItems", async () => {
      // Après le test de concurrence ci-dessus, quantity=2 <= lowStockThreshold=3.
      const lowStock = await withTenant(tenantAId, (tx) => listLowStockItems(tx, tenantAId));
      expect(lowStock.some((item) => item.id === inventoryItemId)).toBe(true);

      // Le tenant B ne voit jamais les alertes de stock du tenant A.
      const lowStockForB = await withTenant(tenantBId, (tx) => listLowStockItems(tx, tenantBId));
      expect(lowStockForB.some((item) => item.id === inventoryItemId)).toBe(false);
    });
  });

  it("updateProduct : ignore un produit archivé/supprimé logiquement d'un autre tenant", async () => {
    const productB = await withTenant(tenantBId, (tx) =>
      createProduct(tx, tenantBId, { name: "Produit B2", slug: "produit-b2", basePrice: 3_000 }),
    );

    await expect(
      withTenant(tenantAId, (tx) => updateProduct(tx, tenantAId, productB.id, { name: "Piraté" })),
    ).rejects.toThrow(/introuvable/);
  });
});
