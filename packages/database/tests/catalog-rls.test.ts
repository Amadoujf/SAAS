import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../src/client";
import { withSuperAdminAccess, withTenant } from "../src/tenant-context";
import { testOwnerClient } from "./test-owner-client";

/**
 * Preuve dédiée que `ProductVariant`/`InventoryItem`/`StockMovement` sont
 * RÉELLEMENT protégées par Row-Level Security — pas seulement par le filtrage
 * applicatif explicite de `catalog-registry.ts` — voir la revue du 18 septembre
 * 2026 : « une nouvelle requête mal écrite pourrait contourner cette protection ».
 * Même méthode que `tenant-isolation.test.ts` (la preuve de référence de ce
 * projet), appliquée ici aux trois tables qui n'avaient aucune policy avant la
 * migration `20260925000000_catalog_security_hardening`.
 *
 * Les requêtes ci-dessous utilisent le client Prisma NU ou `withTenant` avec un
 * MAUVAIS tenant — jamais `catalog-registry.ts` — précisément pour vérifier RLS
 * elle-même, indépendamment de toute discipline de filtrage applicatif.
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
      "REQUIRE_DB_TESTS=true mais PostgreSQL est injoignable : la suite RLS du " +
        `catalogue DOIT s'exécuter en CI. Cause : ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  databaseAvailable = false;
  // eslint-disable-next-line no-console
  console.warn("[catalog-rls.test] Base de données injoignable — suite ignorée (skip).");
}

describe.skipIf(!databaseAvailable)("RLS réelle — ProductVariant / InventoryItem / StockMovement", () => {
  const suffix = Date.now();
  const sectorKey = `test-sector-catalog-rls-${suffix}`;
  let tenantAId: string;
  let tenantBId: string;
  let variantAId: string;
  let inventoryItemAId: string;
  let stockMovementAId: string;

  beforeAll(async () => {
    await withSuperAdminAccess(async (tx) => {
      await tx.sector.create({
        data: { key: sectorKey, name: "Secteur de test", defaultModuleKeys: [], isSystem: false },
      });
      const tenantA = await tx.tenant.create({
        data: {
          slug: `test-catalog-rls-a-${suffix}`,
          name: "Boutique RLS A",
          businessType: "ECOMMERCE",
          sectorKey,
          status: "ACTIVE",
        },
      });
      const tenantB = await tx.tenant.create({
        data: {
          slug: `test-catalog-rls-b-${suffix}`,
          name: "Boutique RLS B",
          businessType: "ECOMMERCE",
          sectorKey,
          status: "ACTIVE",
        },
      });
      tenantAId = tenantA.id;
      tenantBId = tenantB.id;
    });

    await withTenant(tenantAId, async (tx) => {
      const shop = await tx.shop.create({ data: { tenantId: tenantAId, name: "Boutique A", isMain: true } });
      const product = await tx.product.create({
        data: { tenantId: tenantAId, name: "Produit RLS A", slug: `produit-rls-a-${suffix}`, basePrice: 10_000 },
      });
      const variant = await tx.productVariant.create({
        data: { tenantId: tenantAId, productId: product.id, name: "Unique", price: 10_000, attributes: {} },
      });
      variantAId = variant.id;
      const item = await tx.inventoryItem.create({
        data: { tenantId: tenantAId, productVariantId: variant.id, shopId: shop.id, quantity: 10 },
      });
      inventoryItemAId = item.id;
      const movement = await tx.stockMovement.create({
        data: { tenantId: tenantAId, inventoryItemId: item.id, type: "in", quantity: 10 },
      });
      stockMovementAId = movement.id;
    });
  });

  afterAll(async () => {
    const owner = testOwnerClient();
    try {
      await owner.stockMovement.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
    } finally {
      await owner.$disconnect();
    }
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.is_super_admin', 'true', true)`;
      await tx.inventoryItem.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
      await tx.productVariant.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
      await tx.product.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
      await tx.shop.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
      await tx.tenant.deleteMany({ where: { id: { in: [tenantAId, tenantBId] } } });
      await tx.sector.deleteMany({ where: { key: sectorKey } });
    });
  });

  describe("sans aucun contexte tenant (client Prisma nu)", () => {
    it("ProductVariant : ne renvoie rien", async () => {
      const results = await prisma.productVariant.findMany({ where: { id: variantAId } });
      expect(results).toHaveLength(0);
    });

    it("InventoryItem : ne renvoie rien", async () => {
      const results = await prisma.inventoryItem.findMany({ where: { id: inventoryItemAId } });
      expect(results).toHaveLength(0);
    });

    it("StockMovement : ne renvoie rien", async () => {
      const results = await prisma.stockMovement.findMany({ where: { id: stockMovementAId } });
      expect(results).toHaveLength(0);
    });
  });

  describe("avec le contexte du MAUVAIS tenant (withTenant(tenantB, ...))", () => {
    it("ProductVariant : LECTURE par id exact échoue", async () => {
      const result = await withTenant(tenantBId, (tx) => tx.productVariant.findUnique({ where: { id: variantAId } }));
      expect(result).toBeNull();
    });

    it("ProductVariant : MODIFICATION par id exact n'affecte aucune ligne", async () => {
      const result = await withTenant(tenantBId, (tx) =>
        tx.productVariant.updateMany({ where: { id: variantAId }, data: { name: "Piraté par B" } }),
      );
      expect(result.count).toBe(0);
      const stillIntact = await withTenant(tenantAId, (tx) => tx.productVariant.findUnique({ where: { id: variantAId } }));
      expect(stillIntact?.name).toBe("Unique");
    });

    it("InventoryItem : LECTURE par id exact échoue", async () => {
      const result = await withTenant(tenantBId, (tx) => tx.inventoryItem.findUnique({ where: { id: inventoryItemAId } }));
      expect(result).toBeNull();
    });

    it("InventoryItem : MODIFICATION (ex. vider le stock) par id exact n'affecte aucune ligne", async () => {
      const result = await withTenant(tenantBId, (tx) =>
        tx.inventoryItem.updateMany({ where: { id: inventoryItemAId }, data: { quantity: 0 } }),
      );
      expect(result.count).toBe(0);
      const stillIntact = await withTenant(tenantAId, (tx) =>
        tx.inventoryItem.findUnique({ where: { id: inventoryItemAId } }),
      );
      expect(stillIntact?.quantity).toBe(10);
    });

    it("InventoryItem : SUPPRESSION par id exact n'affecte aucune ligne", async () => {
      const result = await withTenant(tenantBId, (tx) => tx.inventoryItem.deleteMany({ where: { id: inventoryItemAId } }));
      expect(result.count).toBe(0);
      const stillExists = await withTenant(tenantAId, (tx) =>
        tx.inventoryItem.findUnique({ where: { id: inventoryItemAId } }),
      );
      expect(stillExists).not.toBeNull();
    });

    it("StockMovement : LECTURE par id exact échoue", async () => {
      const result = await withTenant(tenantBId, (tx) => tx.stockMovement.findUnique({ where: { id: stockMovementAId } }));
      expect(result).toBeNull();
    });

    it("StockMovement : LISTE scoping au tenant A ne renvoie rien depuis le contexte B", async () => {
      const results = await withTenant(tenantBId, (tx) =>
        tx.stockMovement.findMany({ where: { inventoryItemId: inventoryItemAId } }),
      );
      expect(results).toHaveLength(0);
    });
  });

  it("le tenant A, lui, continue de voir normalement ses propres données (RLS ne bloque pas le bon contexte)", async () => {
    const variant = await withTenant(tenantAId, (tx) => tx.productVariant.findUnique({ where: { id: variantAId } }));
    const item = await withTenant(tenantAId, (tx) => tx.inventoryItem.findUnique({ where: { id: inventoryItemAId } }));
    const movement = await withTenant(tenantAId, (tx) => tx.stockMovement.findUnique({ where: { id: stockMovementAId } }));
    expect(variant?.id).toBe(variantAId);
    expect(item?.id).toBe(inventoryItemAId);
    expect(movement?.id).toBe(stockMovementAId);
  });

  it("IMMUABILITÉ : le rôle applicatif ne peut ni modifier ni supprimer un StockMovement, même dans le bon tenant", async () => {
    await expect(
      withTenant(tenantAId, (tx) => tx.stockMovement.updateMany({ where: { id: stockMovementAId }, data: { quantity: 999 } })),
    ).rejects.toThrow(/permission denied/i);

    await expect(
      withTenant(tenantAId, (tx) => tx.stockMovement.deleteMany({ where: { id: stockMovementAId } })),
    ).rejects.toThrow(/permission denied/i);
  });
});
