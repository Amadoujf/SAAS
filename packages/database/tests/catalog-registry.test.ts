import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../src/client";
import { withSuperAdminAccess, withTenant } from "../src/tenant-context";
import { testOwnerClient } from "./test-owner-client";
import {
  InsufficientStockError,
  addProductImage,
  adjustStock,
  createCategory,
  createProduct,
  createProductVariant,
  deleteCategory,
  isMediaAssetPubliclyUsedByProduct,
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
 * - ISOLATION : `ProductVariant`/`InventoryItem`/`StockMovement` ont désormais une
 *   VRAIE policy RLS (voir la note de sécurité en tête de catalog-registry.ts et la
 *   migration `20260925000000_catalog_security_hardening`) EN PLUS du filtrage
 *   applicatif explicite — sans un test réel contre PostgreSQL, rien ne prouve que ni
 *   l'une ni l'autre couche ne fonctionne vraiment. Voir aussi
 *   `catalog-rls.test.ts` pour la preuve dédiée à la policy RLS elle-même (requête
 *   sans contexte, mauvais tenant, accès direct par id).
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
      await tx.shop.create({ data: { tenantId: tenantBId, name: "Boutique B", isMain: true } });
      shopAId = shopA.id;

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
    // `StockMovement` a perdu UPDATE/DELETE pour le rôle applicatif (immutabilité de
    // l'historique, voir la migration `20260925000000_catalog_security_hardening`) :
    // sa suppression exige donc le client de test élevé (rôle propriétaire), jamais
    // le client habituel même en mode `withSuperAdminAccess` (qui ne lève que la RLS,
    // pas les droits du rôle Postgres).
    const owner = testOwnerClient();
    try {
      await owner.stockMovement.deleteMany({
        where: { inventoryItem: { variant: { product: { tenantId: { in: [tenantAId, tenantBId] } } } } },
      });
    } finally {
      await owner.$disconnect();
    }

    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.is_super_admin', 'true', true)`;
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
      }),
    );
    expect(image.mediaAssetId).toBe(mediaAssetAId);
    // L'URL est dérivée côté serveur (jamais fournie par l'appelant) — voir la revue
    // du 18 septembre 2026. Ce média de test n'a aucune variante générée, d'où le
    // repli sur l'original (voir le test dédié ci-dessous pour la sélection de
    // variante quand des tailles existent réellement).
    expect(image.url).toBe(`/api/media/${mediaAssetAId}/file`);

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
        }),
      ),
    ).rejects.toThrow(/introuvable/);
  });

  it("IMAGES : l'URL dérivée choisit la plus grande variante disponible, jamais l'original", async () => {
    const productWithVariants = await withTenant(tenantAId, (tx) =>
      createProduct(tx, tenantAId, { name: "Sac à variantes", slug: `sac-variantes-${suffix}`, basePrice: 12_000 }),
    );
    const assetWithVariants = await withSuperAdminAccess((tx) =>
      tx.mediaAsset.create({
        data: {
          tenantId: tenantAId,
          ownerId: ownerUserId,
          originalName: "sac.jpg",
          storageKey: `test/${suffix}/sac-variants.jpg`,
          type: "IMAGE",
          mimeType: "image/jpeg",
          sizeBytes: 2048,
          status: "READY",
          checksumSha256: "cafef00d",
          variants: [
            { key: "thumbnail", format: "webp", storageKey: "x", width: 200, height: 200, sizeBytes: 10 },
            { key: "medium", format: "webp", storageKey: "y", width: 960, height: 960, sizeBytes: 100 },
          ],
        },
      }),
    );

    const image = await withTenant(tenantAId, (tx) =>
      addProductImage(tx, tenantAId, { productId: productWithVariants.id, mediaAssetId: assetWithVariants.id }),
    );
    // "medium" est la plus grande variante DISPONIBLE ici ("large" n'existe pas pour
    // ce média) — jamais l'original malgré sa disponibilité.
    expect(image.url).toBe(`/api/media/${assetWithVariants.id}/file?variant=medium`);
  });

  describe("MÉDIATHÈQUE — accès public dynamique (isMediaAssetPubliclyUsedByProduct)", () => {
    it("faux pour un produit BROUILLON, vrai une fois PUBLIÉ, faux à nouveau après dépublication", async () => {
      const product = await withTenant(tenantAId, (tx) =>
        createProduct(tx, tenantAId, { name: "Robe dynamique", slug: `robe-dynamique-${suffix}`, basePrice: 18_000 }),
      );
      const image = await withTenant(tenantAId, (tx) =>
        addProductImage(tx, tenantAId, { productId: product.id, mediaAssetId: mediaAssetAId }),
      );

      const whileDraft = await withTenant(tenantAId, (tx) =>
        isMediaAssetPubliclyUsedByProduct(tx, tenantAId, mediaAssetAId),
      );
      expect(whileDraft).toBe(false);

      await withTenant(tenantAId, (tx) => setProductStatus(tx, tenantAId, product.id, "PUBLISHED"));
      const whilePublished = await withTenant(tenantAId, (tx) =>
        isMediaAssetPubliclyUsedByProduct(tx, tenantAId, mediaAssetAId),
      );
      expect(whilePublished).toBe(true);

      await withTenant(tenantAId, (tx) => setProductStatus(tx, tenantAId, product.id, "ARCHIVED"));
      const afterUnpublish = await withTenant(tenantAId, (tx) =>
        isMediaAssetPubliclyUsedByProduct(tx, tenantAId, mediaAssetAId),
      );
      expect(afterUnpublish).toBe(false);

      // Nettoyage : retire l'image pour ne pas fausser le compteur de références
      // vérifié par un autre test de cette suite.
      await withTenant(tenantAId, (tx) => removeProductImage(tx, tenantAId, image.id));
    });

    it("faux une fois republié SANS l'image (dernière utilisation publique retirée)", async () => {
      const product = await withTenant(tenantAId, (tx) =>
        createProduct(tx, tenantAId, { name: "Robe sans image", slug: `robe-sans-image-${suffix}`, basePrice: 18_000 }),
      );
      const image = await withTenant(tenantAId, (tx) =>
        addProductImage(tx, tenantAId, { productId: product.id, mediaAssetId: mediaAssetAId }),
      );
      await withTenant(tenantAId, (tx) => setProductStatus(tx, tenantAId, product.id, "PUBLISHED"));
      expect(await withTenant(tenantAId, (tx) => isMediaAssetPubliclyUsedByProduct(tx, tenantAId, mediaAssetAId))).toBe(
        true,
      );

      await withTenant(tenantAId, (tx) => removeProductImage(tx, tenantAId, image.id));
      expect(await withTenant(tenantAId, (tx) => isMediaAssetPubliclyUsedByProduct(tx, tenantAId, mediaAssetAId))).toBe(
        false,
      );
    });
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
      expect(item.availableQuantity).toBe(12); // 10 + 5 - 3.

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
      expect(item.availableQuantity).toBe(12); // inchangé — jamais de décrément partiel.
    });

    it(
      "CONCURRENCE RÉELLE : des sorties simultanées ne peuvent jamais survendre le stock disponible",
      async () => {
        // Stock initial connu : 12 (issu du test précédent, même item, même suite —
        // décrit explicitement pour que ce test reste lisible seul).
        const before = await withSuperAdminAccess((tx) =>
          tx.inventoryItem.findUniqueOrThrow({ where: { id: inventoryItemId } }),
        );
        expect(before.availableQuantity).toBe(12);

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
        expect(after.availableQuantity).toBe(2); // 12 - (2 * 5) — jamais négatif, jamais < 0.
        expect(after.availableQuantity).toBeGreaterThanOrEqual(0);
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

  describe("CONTRAINTES — voir la revue du 18 septembre 2026", () => {
    it("SKU : unique PAR TENANT (Product ET ProductVariant), mais réutilisable d'un tenant à l'autre", async () => {
      const sku = `SKU-UNIQUE-${suffix}`;
      await withTenant(tenantAId, (tx) =>
        createProduct(tx, tenantAId, { name: "Premier", slug: `premier-sku-${suffix}`, basePrice: 1_000, sku }),
      );

      await expect(
        withTenant(tenantAId, (tx) =>
          createProduct(tx, tenantAId, { name: "Doublon", slug: `doublon-sku-${suffix}`, basePrice: 1_000, sku }),
        ),
      ).rejects.toThrow();

      // Le MÊME sku reste utilisable par un AUTRE tenant — l'unicité est scoping,
      // jamais globale.
      await expect(
        withTenant(tenantBId, (tx) =>
          createProduct(tx, tenantBId, { name: "Chez B", slug: `chez-b-sku-${suffix}`, basePrice: 1_000, sku }),
        ),
      ).resolves.toMatchObject({ sku });

      const variantSku = `VARIANT-SKU-${suffix}`;
      const product = await withTenant(tenantAId, (tx) =>
        createProduct(tx, tenantAId, { name: "Porteur de variantes", slug: `porteur-${suffix}`, basePrice: 2_000 }),
      );
      const otherProduct = await withTenant(tenantAId, (tx) =>
        createProduct(tx, tenantAId, { name: "Autre porteur", slug: `autre-porteur-${suffix}`, basePrice: 2_000 }),
      );
      await withTenant(tenantAId, (tx) =>
        createProductVariant(tx, tenantAId, product.id, { name: "V1", sku: variantSku, price: 2_000 }),
      );
      await expect(
        withTenant(tenantAId, (tx) =>
          createProductVariant(tx, tenantAId, otherProduct.id, { name: "V2", sku: variantSku, price: 2_000 }),
        ),
      ).rejects.toThrow();
    });

    it("SKU absent (NULL) : jamais en conflit, même en répétition — plusieurs produits sans SKU coexistent", async () => {
      const first = await withTenant(tenantAId, (tx) =>
        createProduct(tx, tenantAId, { name: "Sans SKU 1", slug: `sans-sku-1-${suffix}`, basePrice: 1_000 }),
      );
      const second = await withTenant(tenantAId, (tx) =>
        createProduct(tx, tenantAId, { name: "Sans SKU 2", slug: `sans-sku-2-${suffix}`, basePrice: 1_000 }),
      );
      expect(first.sku).toBeNull();
      expect(second.sku).toBeNull();
    });

    it("STOCK NÉGATIF : structurellement impossible même en contournant adjustStock (CHECK contraint réel)", async () => {
      const product = await withTenant(tenantAId, (tx) =>
        createProduct(tx, tenantAId, { name: "Produit CHECK", slug: `produit-check-${suffix}`, basePrice: 1_000 }),
      );
      const variant = await withTenant(tenantAId, (tx) =>
        createProductVariant(tx, tenantAId, product.id, { name: "Unique", price: 1_000 }),
      );
      const item = await withTenant(tenantAId, (tx) =>
        upsertInventoryItem(tx, tenantAId, { variantId: variant.id, shopId: shopAId, initialQuantity: 5 }),
      );

      // Contourne délibérément `adjustStock` — un `update` direct, comme le ferait un
      // futur bug applicatif — pour prouver que c'est la CONTRAINTE elle-même, pas
      // seulement la discipline du code, qui empêche un stock négatif.
      await expect(
        withTenant(tenantAId, (tx) => tx.inventoryItem.update({ where: { id: item.id }, data: { availableQuantity: -1 } })),
      ).rejects.toThrow(/constraint|check/i);
    });
  });
});
