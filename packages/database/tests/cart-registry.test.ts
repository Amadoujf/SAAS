import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../src/client";
import { withSuperAdminAccess, withTenant } from "../src/tenant-context";
import {
  addCartItem,
  getCartWithTotals,
  getOrCreateActiveCart,
  removeCartItem,
  updateCartItemQuantity,
} from "../src/cart-registry";

/**
 * Vérifie le registre du panier (étape 2 — clients/panier/commandes/livraison, 19
 * septembre 2026) contre PostgreSQL réel : recalcul des totaux en direct depuis le
 * prix réel des variantes, refus d'ajouter un produit non publié/étranger au tenant,
 * et surtout l'isolation entre DEUX VISITEURS ANONYMES du MÊME tenant — RLS ne
 * protège qu'entre entreprises, jamais entre visiteurs d'une même boutique (voir la
 * note de sécurité dans `cart-registry.ts`).
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
      "REQUIRE_DB_TESTS=true mais PostgreSQL est injoignable : la suite panier " +
        `DOIT s'exécuter en CI. Cause : ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  databaseAvailable = false;
  // eslint-disable-next-line no-console
  console.warn("[cart-registry.test] Base de données injoignable — suite ignorée (skip).");
}

describe.skipIf(!databaseAvailable)("Registre du panier", () => {
  const suffix = Date.now();
  const sectorKey = `test-sector-cart-registry-${suffix}`;
  let tenantAId: string;
  let tenantBId: string;
  let shopAId: string;
  let publishedVariantId: string;
  let draftVariantId: string;

  beforeAll(async () => {
    await withSuperAdminAccess(async (tx) => {
      await tx.sector.create({
        data: { key: sectorKey, name: "Secteur de test", defaultModuleKeys: [], isSystem: false },
      });
      const tenantA = await tx.tenant.create({
        data: {
          slug: `test-cart-reg-a-${suffix}`,
          name: "Boutique Panier Registre A",
          businessType: "ECOMMERCE",
          sectorKey,
          status: "ACTIVE",
        },
      });
      const tenantB = await tx.tenant.create({
        data: {
          slug: `test-cart-reg-b-${suffix}`,
          name: "Boutique Panier Registre B",
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
      shopAId = shop.id;

      const publishedProduct = await tx.product.create({
        data: {
          tenantId: tenantAId,
          name: "Robe Wax",
          slug: `robe-wax-${suffix}`,
          basePrice: 15_000,
          status: "PUBLISHED",
        },
      });
      const publishedVariant = await tx.productVariant.create({
        data: { tenantId: tenantAId, productId: publishedProduct.id, name: "M", price: 15_000, attributes: {} },
      });
      publishedVariantId = publishedVariant.id;
      await tx.inventoryItem.create({
        data: { tenantId: tenantAId, productVariantId: publishedVariant.id, shopId: shop.id, availableQuantity: 3 },
      });

      const draftProduct = await tx.product.create({
        data: {
          tenantId: tenantAId,
          name: "Brouillon non publié",
          slug: `brouillon-${suffix}`,
          basePrice: 9_999,
          status: "DRAFT",
        },
      });
      const draftVariant = await tx.productVariant.create({
        data: { tenantId: tenantAId, productId: draftProduct.id, name: "Unique", price: 9_999, attributes: {} },
      });
      draftVariantId = draftVariant.id;
    });
  });

  afterAll(async () => {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.is_super_admin', 'true', true)`;
      await tx.cartItem.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
      await tx.cart.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
      await tx.inventoryItem.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
      await tx.productVariant.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
      await tx.product.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
      await tx.shop.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
      await tx.tenant.deleteMany({ where: { id: { in: [tenantAId, tenantBId] } } });
      await tx.sector.deleteMany({ where: { key: sectorKey } });
    });
  });

  it("crée un panier actif pour un nouveau visiteur, puis réutilise le même", async () => {
    const visitorToken = `visiteur-${suffix}-1`;
    const first = await withTenant(tenantAId, (tx) => getOrCreateActiveCart(tx, tenantAId, visitorToken));
    const second = await withTenant(tenantAId, (tx) => getOrCreateActiveCart(tx, tenantAId, visitorToken));
    expect(second.id).toBe(first.id);
  });

  it("ajoute un article, recalcule le total EN DIRECT depuis le prix réel de la variante", async () => {
    const visitorToken = `visiteur-${suffix}-2`;
    await withTenant(tenantAId, async (tx) => {
      const cart = await getOrCreateActiveCart(tx, tenantAId, visitorToken);
      await addCartItem(tx, tenantAId, cart.id, { productVariantId: publishedVariantId, quantity: 2 });
      const withTotals = await getCartWithTotals(tx, tenantAId, cart.id);
      expect(withTotals?.subtotal).toBe(30_000);
      expect(withTotals?.itemCount).toBe(2);
      expect(withTotals?.lines[0]?.availableQuantity).toBe(3);
    });
  });

  it("un second ajout de la MÊME variante incrémente la quantité, ne duplique pas la ligne", async () => {
    const visitorToken = `visiteur-${suffix}-3`;
    await withTenant(tenantAId, async (tx) => {
      const cart = await getOrCreateActiveCart(tx, tenantAId, visitorToken);
      await addCartItem(tx, tenantAId, cart.id, { productVariantId: publishedVariantId, quantity: 1 });
      await addCartItem(tx, tenantAId, cart.id, { productVariantId: publishedVariantId, quantity: 2 });
      const withTotals = await getCartWithTotals(tx, tenantAId, cart.id);
      expect(withTotals?.lines).toHaveLength(1);
      expect(withTotals?.lines[0]?.quantity).toBe(3);
    });
  });

  it("refuse d'ajouter une variante non publiée (même appartenant au bon tenant)", async () => {
    const visitorToken = `visiteur-${suffix}-4`;
    await expect(
      withTenant(tenantAId, async (tx) => {
        const cart = await getOrCreateActiveCart(tx, tenantAId, visitorToken);
        return addCartItem(tx, tenantAId, cart.id, { productVariantId: draftVariantId, quantity: 1 });
      }),
    ).rejects.toThrow(/introuvable|non publiée/);
  });

  it("refuse d'ajouter une variante appartenant à un AUTRE tenant", async () => {
    const visitorToken = `visiteur-${suffix}-5`;
    await expect(
      withTenant(tenantBId, async (tx) => {
        const cart = await getOrCreateActiveCart(tx, tenantBId, visitorToken);
        return addCartItem(tx, tenantBId, cart.id, { productVariantId: publishedVariantId, quantity: 1 });
      }),
    ).rejects.toThrow(/introuvable|non publiée/);
  });

  it("met à jour une quantité ; une quantité <= 0 retire la ligne", async () => {
    const visitorToken = `visiteur-${suffix}-6`;
    await withTenant(tenantAId, async (tx) => {
      const cart = await getOrCreateActiveCart(tx, tenantAId, visitorToken);
      const item = await addCartItem(tx, tenantAId, cart.id, { productVariantId: publishedVariantId, quantity: 1 });
      await updateCartItemQuantity(tx, tenantAId, visitorToken, item.id, 5);
      const withFive = await getCartWithTotals(tx, tenantAId, cart.id);
      expect(withFive?.lines[0]?.quantity).toBe(5);

      await updateCartItemQuantity(tx, tenantAId, visitorToken, item.id, 0);
      const emptied = await getCartWithTotals(tx, tenantAId, cart.id);
      expect(emptied?.lines).toHaveLength(0);
    });
  });

  it("ISOLATION ENTRE VISITEURS : un visiteur ne peut pas modifier/supprimer l'article d'un AUTRE visiteur du même tenant", async () => {
    const visitorA = `visiteur-${suffix}-7a`;
    const visitorB = `visiteur-${suffix}-7b`;

    const itemId = await withTenant(tenantAId, async (tx) => {
      const cart = await getOrCreateActiveCart(tx, tenantAId, visitorA);
      const item = await addCartItem(tx, tenantAId, cart.id, { productVariantId: publishedVariantId, quantity: 1 });
      return item.id;
    });

    await expect(
      withTenant(tenantAId, (tx) => updateCartItemQuantity(tx, tenantAId, visitorB, itemId, 9)),
    ).rejects.toThrow(/n'appartient pas à ce visiteur/);

    await expect(withTenant(tenantAId, (tx) => removeCartItem(tx, tenantAId, visitorB, itemId))).rejects.toThrow(
      /n'appartient pas à ce visiteur/,
    );

    // Le propriétaire réel, lui, peut toujours agir sur sa propre ligne.
    await withTenant(tenantAId, (tx) => removeCartItem(tx, tenantAId, visitorA, itemId));
  });

  it("une ligne dont le produit a été dépublié depuis l'ajout est omise du calcul, sans faire échouer l'affichage", async () => {
    const visitorToken = `visiteur-${suffix}-8`;
    const product = await withTenant(tenantAId, (tx) =>
      tx.product.create({
        data: { tenantId: tenantAId, name: "Sera dépublié", slug: `sera-depublie-${suffix}`, basePrice: 2_000, status: "PUBLISHED" },
      }),
    );
    const variant = await withTenant(tenantAId, (tx) =>
      tx.productVariant.create({
        data: { tenantId: tenantAId, productId: product.id, name: "Unique", price: 2_000, attributes: {} },
      }),
    );

    await withTenant(tenantAId, async (tx) => {
      const cart = await getOrCreateActiveCart(tx, tenantAId, visitorToken);
      await addCartItem(tx, tenantAId, cart.id, { productVariantId: variant.id, quantity: 1 });
    });

    await withSuperAdminAccess((tx) => tx.product.update({ where: { id: product.id }, data: { status: "DRAFT" } }));

    await withTenant(tenantAId, async (tx) => {
      const cart = await getOrCreateActiveCart(tx, tenantAId, visitorToken);
      const withTotals = await getCartWithTotals(tx, tenantAId, cart.id);
      expect(withTotals?.lines).toHaveLength(0);
      expect(withTotals?.subtotal).toBe(0);
    });
  });
});
