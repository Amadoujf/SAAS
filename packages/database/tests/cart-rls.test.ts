import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../src/client";
import { withSuperAdminAccess, withTenant } from "../src/tenant-context";

/**
 * Preuve dédiée que `Cart`/`CartItem` sont RÉELLEMENT protégées par Row-Level
 * Security dès leur création — contrairement à `ProductVariant`/`InventoryItem`/
 * `StockMovement` qui n'ont reçu leur policy qu'après coup (revue du 18 septembre
 * 2026), cette étape (clients/panier/commandes/livraison, 19 septembre 2026) ne
 * reproduit pas l'écart : la policy Pattern A existe dès la migration qui crée ces
 * tables. Même méthode que `catalog-rls.test.ts`.
 *
 * Vérifie aussi la contrainte d'unicité partielle "au plus un panier actif par
 * visiteur" (`Cart_tenant_visitor_active_unique`) sous concurrence RÉELLE.
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
        `panier DOIT s'exécuter en CI. Cause : ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  databaseAvailable = false;
  // eslint-disable-next-line no-console
  console.warn("[cart-rls.test] Base de données injoignable — suite ignorée (skip).");
}

describe.skipIf(!databaseAvailable)("RLS réelle — Cart / CartItem", () => {
  const suffix = Date.now();
  const sectorKey = `test-sector-cart-rls-${suffix}`;
  let tenantAId: string;
  let tenantBId: string;
  let variantAId: string;
  let cartAId: string;
  let cartItemAId: string;

  beforeAll(async () => {
    await withSuperAdminAccess(async (tx) => {
      await tx.sector.create({
        data: { key: sectorKey, name: "Secteur de test", defaultModuleKeys: [], isSystem: false },
      });
      const tenantA = await tx.tenant.create({
        data: {
          slug: `test-cart-rls-a-${suffix}`,
          name: "Boutique Panier A",
          businessType: "ECOMMERCE",
          sectorKey,
          status: "ACTIVE",
        },
      });
      const tenantB = await tx.tenant.create({
        data: {
          slug: `test-cart-rls-b-${suffix}`,
          name: "Boutique Panier B",
          businessType: "ECOMMERCE",
          sectorKey,
          status: "ACTIVE",
        },
      });
      tenantAId = tenantA.id;
      tenantBId = tenantB.id;
    });

    await withTenant(tenantAId, async (tx) => {
      const product = await tx.product.create({
        data: { tenantId: tenantAId, name: "Produit Panier A", slug: `produit-panier-a-${suffix}`, basePrice: 5_000 },
      });
      const variant = await tx.productVariant.create({
        data: { tenantId: tenantAId, productId: product.id, name: "Unique", price: 5_000, attributes: {} },
      });
      variantAId = variant.id;
      const cart = await tx.cart.create({
        data: { tenantId: tenantAId, visitorToken: `visiteur-a-${suffix}`, status: "active" },
      });
      cartAId = cart.id;
      const cartItem = await tx.cartItem.create({
        data: { tenantId: tenantAId, cartId: cart.id, productVariantId: variant.id, quantity: 2 },
      });
      cartItemAId = cartItem.id;
    });
  });

  afterAll(async () => {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.is_super_admin', 'true', true)`;
      await tx.cartItem.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
      await tx.cart.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
      await tx.productVariant.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
      await tx.product.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
      await tx.tenant.deleteMany({ where: { id: { in: [tenantAId, tenantBId] } } });
      await tx.sector.deleteMany({ where: { key: sectorKey } });
    });
  });

  describe("sans aucun contexte tenant (client Prisma nu)", () => {
    it("Cart : ne renvoie rien", async () => {
      const results = await prisma.cart.findMany({ where: { id: cartAId } });
      expect(results).toHaveLength(0);
    });

    it("CartItem : ne renvoie rien", async () => {
      const results = await prisma.cartItem.findMany({ where: { id: cartItemAId } });
      expect(results).toHaveLength(0);
    });
  });

  describe("avec le contexte du MAUVAIS tenant (withTenant(tenantB, ...))", () => {
    it("Cart : LECTURE par id exact échoue", async () => {
      const result = await withTenant(tenantBId, (tx) => tx.cart.findUnique({ where: { id: cartAId } }));
      expect(result).toBeNull();
    });

    it("Cart : MODIFICATION par id exact n'affecte aucune ligne", async () => {
      const result = await withTenant(tenantBId, (tx) =>
        tx.cart.updateMany({ where: { id: cartAId }, data: { status: "abandoned" } }),
      );
      expect(result.count).toBe(0);
      const stillActive = await withTenant(tenantAId, (tx) => tx.cart.findUnique({ where: { id: cartAId } }));
      expect(stillActive?.status).toBe("active");
    });

    it("CartItem : LECTURE par id exact échoue", async () => {
      const result = await withTenant(tenantBId, (tx) => tx.cartItem.findUnique({ where: { id: cartItemAId } }));
      expect(result).toBeNull();
    });

    it("CartItem : SUPPRESSION par id exact n'affecte aucune ligne", async () => {
      const result = await withTenant(tenantBId, (tx) => tx.cartItem.deleteMany({ where: { id: cartItemAId } }));
      expect(result.count).toBe(0);
      const stillExists = await withTenant(tenantAId, (tx) => tx.cartItem.findUnique({ where: { id: cartItemAId } }));
      expect(stillExists).not.toBeNull();
    });
  });

  // Note : la FK `CartItem.productVariantId -> ProductVariant.id` ne vérifie PAS que la
  // variante appartient au même tenant que le panier (comme pour ProductVariant/
  // InventoryItem, aucune contrainte Postgres ne peut exprimer nativement « même
  // tenant que » entre deux tables sans clé composite). Cette validation reste, comme
  // partout ailleurs dans ce projet, une responsabilité APPLICATIVE — voir
  // `cart-registry.ts` (étape 2, M2), qui devra vérifier `variant.tenantId === tenantId`
  // avant toute création de `CartItem`, exactement comme `createProductVariant` le fait
  // déjà pour `Product`.

  it("le tenant A, lui, continue de voir normalement ses propres données (RLS ne bloque pas le bon contexte)", async () => {
    const cart = await withTenant(tenantAId, (tx) => tx.cart.findUnique({ where: { id: cartAId } }));
    const item = await withTenant(tenantAId, (tx) => tx.cartItem.findUnique({ where: { id: cartItemAId } }));
    expect(cart?.id).toBe(cartAId);
    expect(item?.id).toBe(cartItemAId);
  });

  describe("CONCURRENCE RÉELLE — au plus un panier actif par visiteur", () => {
    it("deux créations simultanées du même (tenant, visiteur) actif : une seule réussit", async () => {
      const visitorToken = `visiteur-concurrence-${suffix}`;
      const attempts = await Promise.allSettled(
        Array.from({ length: 5 }, () =>
          withTenant(tenantAId, (tx) =>
            tx.cart.create({ data: { tenantId: tenantAId, visitorToken, status: "active" } }),
          ),
        ),
      );

      const succeeded = attempts.filter((a) => a.status === "fulfilled");
      const failed = attempts.filter((a) => a.status === "rejected");
      expect(succeeded).toHaveLength(1);
      expect(failed).toHaveLength(4);
      for (const failure of failed as PromiseRejectedResult[]) {
        expect(String(failure.reason)).toMatch(/Unique constraint|P2002/i);
      }

      const activeCarts = await withTenant(tenantAId, (tx) =>
        tx.cart.findMany({ where: { visitorToken, status: "active" } }),
      );
      expect(activeCarts).toHaveLength(1);

      await withSuperAdminAccess((tx) => tx.cart.deleteMany({ where: { visitorToken } }));
    });

    it("un même visiteur peut avoir plusieurs paniers dans le temps si les précédents ne sont plus 'active'", async () => {
      const visitorToken = `visiteur-historique-${suffix}`;
      const first = await withTenant(tenantAId, (tx) =>
        tx.cart.create({ data: { tenantId: tenantAId, visitorToken, status: "converted" } }),
      );
      const second = await withTenant(tenantAId, (tx) =>
        tx.cart.create({ data: { tenantId: tenantAId, visitorToken, status: "active" } }),
      );
      expect(first.id).not.toBe(second.id);

      await withSuperAdminAccess((tx) => tx.cart.deleteMany({ where: { visitorToken } }));
    });
  });
});
