import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../src/client";
import { withSuperAdminAccess, withTenant } from "../src/tenant-context";
import { testOwnerClient } from "./test-owner-client";
import { addCartItem, getOrCreateActiveCart } from "../src/cart-registry";
import { InsufficientStockError } from "../src/catalog-registry";
import {
  cancelOrder,
  confirmOrderPaymentSuccess,
  convertCartToOrder,
  type ConvertCartToOrderInput,
} from "../src/order-registry";

/**
 * Vérifie `convertCartToOrder` (le cœur de l'étape 2) contre PostgreSQL réel :
 * recalcul serveur intégral, double soumission idempotente, réservation atomique
 * (avec une vraie course sur le dernier article), règle "panier mixte" (article non
 * livrable), code promo, et le cycle réservation -> confirmation/libération via
 * `confirmOrderPaymentSuccess`/`cancelOrder`.
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
      "REQUIRE_DB_TESTS=true mais PostgreSQL est injoignable : la suite commandes " +
        `DOIT s'exécuter en CI. Cause : ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  databaseAvailable = false;
  // eslint-disable-next-line no-console
  console.warn("[order-registry.test] Base de données injoignable — suite ignorée (skip).");
}

describe.skipIf(!databaseAvailable)("Registre des commandes — convertCartToOrder", () => {
  const suffix = Date.now();
  const sectorKey = `test-sector-orders-${suffix}`;
  let tenantId: string;
  let shopId: string;
  let variantId: string;
  let nonDeliverableVariantId: string;
  let zoneId: string;

  async function createCartWithItem(variantId2: string, quantity: number) {
    const visitorToken = `visiteur-${suffix}-${Math.random().toString(36).slice(2)}`;
    return withTenant(tenantId, async (tx) => {
      const cart = await getOrCreateActiveCart(tx, tenantId, visitorToken);
      await addCartItem(tx, tenantId, cart.id, { productVariantId: variantId2, quantity });
      return cart.id;
    });
  }

  beforeAll(async () => {
    await withSuperAdminAccess(async (tx) => {
      await tx.sector.create({
        data: { key: sectorKey, name: "Secteur de test", defaultModuleKeys: [], isSystem: false },
      });
      const tenant = await tx.tenant.create({
        data: {
          slug: `test-orders-${suffix}`,
          name: "Boutique Commandes",
          businessType: "ECOMMERCE",
          sectorKey,
          status: "ACTIVE",
        },
      });
      tenantId = tenant.id;
    });

    await withTenant(tenantId, async (tx) => {
      const shop = await tx.shop.create({ data: { tenantId, name: "Boutique principale", isMain: true } });
      shopId = shop.id;

      const product = await tx.product.create({
        data: { tenantId, name: "Chaussures", slug: `chaussures-${suffix}`, basePrice: 20_000, status: "PUBLISHED" },
      });
      const variant = await tx.productVariant.create({
        data: { tenantId, productId: product.id, name: "42", price: 20_000, attributes: {} },
      });
      variantId = variant.id;
      await tx.inventoryItem.create({
        data: { tenantId, productVariantId: variant.id, shopId: shop.id, availableQuantity: 10 },
      });

      const nonDeliverableProduct = await tx.product.create({
        data: {
          tenantId,
          name: "Matelas (retrait uniquement)",
          slug: `matelas-${suffix}`,
          basePrice: 50_000,
          status: "PUBLISHED",
          isDeliverable: false,
        },
      });
      const nonDeliverableVariant = await tx.productVariant.create({
        data: { tenantId, productId: nonDeliverableProduct.id, name: "Unique", price: 50_000, attributes: {} },
      });
      nonDeliverableVariantId = nonDeliverableVariant.id;
      await tx.inventoryItem.create({
        data: { tenantId, productVariantId: nonDeliverableVariant.id, shopId: shop.id, availableQuantity: 5 },
      });

      const zone = await tx.deliveryZone.create({
        data: { tenantId, region: "Dakar", fee: 1_500, freeThreshold: 100_000 },
      });
      zoneId = zone.id;
    });
  });

  afterAll(async () => {
    const owner = testOwnerClient();
    try {
      await owner.orderStatusHistory.deleteMany({ where: { tenantId } });
      await owner.stockMovement.deleteMany({ where: { tenantId } });
    } finally {
      await owner.$disconnect();
    }
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.is_super_admin', 'true', true)`;
      await tx.payment.deleteMany({ where: { tenantId } });
      await tx.orderItem.deleteMany({ where: { tenantId } });
      await tx.order.deleteMany({ where: { tenantId } });
      await tx.cartItem.deleteMany({ where: { tenantId } });
      await tx.cart.deleteMany({ where: { tenantId } });
      await tx.customerAddress.deleteMany({ where: { tenantId } });
      await tx.customer.deleteMany({ where: { tenantId } });
      await tx.inventoryItem.deleteMany({ where: { tenantId } });
      await tx.productVariant.deleteMany({ where: { tenantId } });
      await tx.product.deleteMany({ where: { tenantId } });
      await tx.deliveryZone.deleteMany({ where: { tenantId } });
      await tx.promoCode.deleteMany({ where: { tenantId } });
      await tx.counter.deleteMany({ where: { tenantId } });
      await tx.shop.deleteMany({ where: { tenantId } });
      await tx.tenant.deleteMany({ where: { id: tenantId } });
      await tx.sector.deleteMany({ where: { key: sectorKey } });
    });
  });

  it("COD : confirme directement la commande et commet le stock réservé immédiatement", async () => {
    const cartId = await createCartWithItem(variantId, 2);
    const input: ConvertCartToOrderInput = {
      cartId,
      customer: { firstName: "Awa", phone: `+22177${suffix}1` },
      deliveryMethod: "delivery",
      deliveryZoneId: zoneId,
      deliveryAddress: { region: "Dakar", commune: "Plateau" },
      paymentMethod: "cod",
    };
    const { order, alreadyExisted } = await withTenant(tenantId, (tx) => convertCartToOrder(tx, tenantId, input));

    expect(alreadyExisted).toBe(false);
    expect(order.status).toBe("CONFIRMED");
    expect(order.paymentStatus).toBe("UNPAID"); // COD : payé seulement à la livraison, jamais présumé ici.
    expect(order.subtotal).toBe(40_000);
    expect(order.shippingTotal).toBe(1_500); // sous le seuil de gratuité (100 000).
    expect(order.total).toBe(41_500);
    expect(order.reservationExpiresAt).toBeNull();

    const item = await withTenant(tenantId, (tx) =>
      tx.inventoryItem.findFirstOrThrow({ where: { productVariantId: variantId, shopId } }),
    );
    expect(item.availableQuantity).toBe(8); // 10 - 2, réellement décrémenté (COD confirme tout de suite).
    expect(item.reservedQuantity).toBe(0); // déjà commis, plus rien en attente.

    const movements = await withTenant(tenantId, (tx) =>
      tx.stockMovement.findMany({ where: { inventoryItemId: item.id, referenceId: order.id } }),
    );
    expect(movements).toHaveLength(1);
    expect(movements[0]?.type).toBe("out");
  });

  it("paiement en ligne : reste en attente de paiement, réserve SANS commettre le stock", async () => {
    const cartId = await createCartWithItem(variantId, 1);
    const input: ConvertCartToOrderInput = {
      cartId,
      customer: { firstName: "Ibrahima", phone: `+22177${suffix}2` },
      deliveryMethod: "pickup",
      paymentMethod: "online",
    };
    const before = await withTenant(tenantId, (tx) =>
      tx.inventoryItem.findFirstOrThrow({ where: { productVariantId: variantId, shopId } }),
    );

    const { order } = await withTenant(tenantId, (tx) => convertCartToOrder(tx, tenantId, input));
    expect(order.status).toBe("AWAITING_PAYMENT");
    expect(order.reservationExpiresAt).not.toBeNull();
    expect(order.shippingTotal).toBe(0); // retrait en boutique.

    const after = await withTenant(tenantId, (tx) =>
      tx.inventoryItem.findFirstOrThrow({ where: { productVariantId: variantId, shopId } }),
    );
    expect(after.availableQuantity).toBe(before.availableQuantity - 1);
    expect(after.reservedQuantity).toBe(before.reservedQuantity + 1);

    const movements = await withTenant(tenantId, (tx) =>
      tx.stockMovement.findMany({ where: { inventoryItemId: after.id, referenceId: order.id } }),
    );
    expect(movements).toHaveLength(0); // rien de physique n'a encore changé, pas de mouvement.

    // Le paiement réussit ensuite : la réservation devient un décrément réel.
    const { order: confirmed, outcome } = await withTenant(tenantId, (tx) =>
      confirmOrderPaymentSuccess(tx, tenantId, order.id, "Test paiement réussi"),
    );
    expect(outcome).toBe("confirmed");
    expect(confirmed.status).toBe("CONFIRMED");
    expect(confirmed.paymentStatus).toBe("PAID");
    expect(confirmed.reservationExpiresAt).toBeNull();

    const committed = await withTenant(tenantId, (tx) =>
      tx.inventoryItem.findFirstOrThrow({ where: { productVariantId: variantId, shopId } }),
    );
    expect(committed.reservedQuantity).toBe(before.reservedQuantity); // réservation retombée à sa valeur de départ (commise, pas libérée).
    const committedMovements = await withTenant(tenantId, (tx) =>
      tx.stockMovement.findMany({ where: { inventoryItemId: committed.id, referenceId: order.id } }),
    );
    expect(committedMovements).toHaveLength(1);
  });

  it("IDEMPOTENCE : une double soumission concurrente du MÊME panier ne crée jamais deux commandes", async () => {
    const cartId = await createCartWithItem(variantId, 1);
    const input: ConvertCartToOrderInput = {
      cartId,
      customer: { firstName: "Double Soumission", phone: `+22177${suffix}3` },
      deliveryMethod: "pickup",
      paymentMethod: "cod",
    };

    const attempts = await Promise.allSettled(
      Array.from({ length: 5 }, () => withTenant(tenantId, (tx) => convertCartToOrder(tx, tenantId, input))),
    );
    const results = attempts.filter((a): a is PromiseFulfilledResult<Awaited<ReturnType<typeof convertCartToOrder>>> => a.status === "fulfilled");
    expect(results.length).toBeGreaterThan(0);

    const orderIds = new Set(results.map((r) => r.value.order.id));
    expect(orderIds.size).toBe(1); // une seule commande réelle, quel que soit le nombre de tentatives.
    expect(results.filter((r) => !r.value.alreadyExisted)).toHaveLength(1); // une seule a réellement créé.

    const ordersInDb = await withTenant(tenantId, (tx) => tx.order.findMany({ where: { tenantId, items: { some: {} } } }));
    // Ne vérifie pas le total global (d'autres tests créent aussi des commandes) —
    // seulement qu'une unique commande référence CE panier précis.
    const forThisCart = await withSuperAdminAccess((tx) => tx.cart.findUniqueOrThrow({ where: { id: cartId } }));
    const matching = ordersInDb.filter((o) => o.id === forThisCart.convertedOrderId);
    expect(matching).toHaveLength(1);
  });

  it("CONCURRENCE RÉELLE : deux commandes simultanées sur le DERNIER article — une seule réussit", async () => {
    const scarceProduct = await withTenant(tenantId, (tx) =>
      tx.product.create({
        data: { tenantId, name: "Édition limitée", slug: `edition-limitee-${suffix}`, basePrice: 5_000, status: "PUBLISHED" },
      }),
    );
    const scarceVariant = await withTenant(tenantId, (tx) =>
      tx.productVariant.create({
        data: { tenantId, productId: scarceProduct.id, name: "Unique", price: 5_000, attributes: {} },
      }),
    );
    await withTenant(tenantId, (tx) =>
      tx.inventoryItem.create({
        data: { tenantId, productVariantId: scarceVariant.id, shopId, availableQuantity: 1 },
      }),
    );

    const cartAId = await createCartWithItem(scarceVariant.id, 1);
    const cartBId = await createCartWithItem(scarceVariant.id, 1);

    const attempts = await Promise.allSettled([
      withTenant(tenantId, (tx) =>
        convertCartToOrder(tx, tenantId, {
          cartId: cartAId,
          customer: { firstName: "Acheteur A", phone: `+22177${suffix}4` },
          deliveryMethod: "pickup",
          paymentMethod: "cod",
        }),
      ),
      withTenant(tenantId, (tx) =>
        convertCartToOrder(tx, tenantId, {
          cartId: cartBId,
          customer: { firstName: "Acheteur B", phone: `+22177${suffix}5` },
          deliveryMethod: "pickup",
          paymentMethod: "cod",
        }),
      ),
    ]);

    const succeeded = attempts.filter((a) => a.status === "fulfilled");
    const failed = attempts.filter((a) => a.status === "rejected");
    expect(succeeded).toHaveLength(1);
    expect(failed).toHaveLength(1);
    expect((failed[0] as PromiseRejectedResult).reason).toBeInstanceOf(InsufficientStockError);

    const finalStock = await withTenant(tenantId, (tx) =>
      tx.inventoryItem.findFirstOrThrow({ where: { productVariantId: scarceVariant.id, shopId } }),
    );
    expect(finalStock.availableQuantity).toBe(0);
    expect(finalStock.reservedQuantity).toBe(0); // commis (CONFIRMED immédiat en COD), jamais négatif.
  });

  it("règle PANIER MIXTE : un article non livrable force le retrait en boutique", async () => {
    const cartId = await createCartWithItem(nonDeliverableVariantId, 1);
    await expect(
      withTenant(tenantId, (tx) =>
        convertCartToOrder(tx, tenantId, {
          cartId,
          customer: { firstName: "Client Mixte", phone: `+22177${suffix}6` },
          deliveryMethod: "delivery",
          deliveryZoneId: zoneId,
          deliveryAddress: { region: "Dakar" },
          paymentMethod: "cod",
        }),
      ),
    ).rejects.toThrow(/retrait en boutique/);
  });

  it("code promo : applique la remise, refuse un code inconnu", async () => {
    const promo = await withTenant(tenantId, (tx) =>
      tx.promoCode.create({ data: { tenantId, code: `PROMO${suffix}`, type: "fixed", value: 5_000 } }),
    );

    const cartId = await createCartWithItem(variantId, 1);
    const { order } = await withTenant(tenantId, (tx) =>
      convertCartToOrder(tx, tenantId, {
        cartId,
        customer: { firstName: "Client Promo", phone: `+22177${suffix}7` },
        deliveryMethod: "pickup",
        paymentMethod: "cod",
        promoCode: promo.code,
      }),
    );
    expect(order.discountTotal).toBe(5_000);
    expect(order.total).toBe(20_000 - 5_000);

    const usage = await withTenant(tenantId, (tx) => tx.promoCode.findUniqueOrThrow({ where: { id: promo.id } }));
    expect(usage.usageCount).toBe(1);

    const cartId2 = await createCartWithItem(variantId, 1);
    await expect(
      withTenant(tenantId, (tx) =>
        convertCartToOrder(tx, tenantId, {
          cartId: cartId2,
          customer: { firstName: "Client Promo 2", phone: `+22177${suffix}8` },
          deliveryMethod: "pickup",
          paymentMethod: "cod",
          promoCode: "INCONNU",
        }),
      ),
    ).rejects.toThrow(/introuvable/);
  });

  it("cancelOrder AVANT confirmation : libère la réservation, aucun mouvement de stock", async () => {
    const cartId = await createCartWithItem(variantId, 1);
    const { order } = await withTenant(tenantId, (tx) =>
      convertCartToOrder(tx, tenantId, {
        cartId,
        customer: { firstName: "Annulation Avant", phone: `+22177${suffix}9` },
        deliveryMethod: "pickup",
        paymentMethod: "online",
      }),
    );
    const before = await withTenant(tenantId, (tx) =>
      tx.inventoryItem.findFirstOrThrow({ where: { productVariantId: variantId, shopId } }),
    );

    await withTenant(tenantId, (tx) => cancelOrder(tx, tenantId, order.id, { changedByType: "system", note: "Test annulation" }));

    const after = await withTenant(tenantId, (tx) =>
      tx.inventoryItem.findFirstOrThrow({ where: { productVariantId: variantId, shopId } }),
    );
    expect(after.availableQuantity).toBe(before.availableQuantity + 1);
    expect(after.reservedQuantity).toBe(before.reservedQuantity - 1);

    // La libération d'une réservation (jamais commise) écrit tout de même un
    // StockMovement ("adjustment") — chaque mouvement de `reservedQuantity` doit
    // rester traçable, même quand `availableQuantity` global n'a jamais bougé côté
    // vente réelle (voir la revue de l'étape 2, exigence de traçabilité complète).
    const movements = await withTenant(tenantId, (tx) =>
      tx.stockMovement.findMany({ where: { inventoryItemId: after.id, referenceId: order.id } }),
    );
    expect(movements).toHaveLength(1);
    expect(movements[0]?.type).toBe("adjustment");

    const cancelled = await withTenant(tenantId, (tx) => tx.order.findUniqueOrThrow({ where: { id: order.id } }));
    expect(cancelled.reservationExpiresAt).toBeNull();
  });

  it("cancelOrder APRÈS confirmation : réapprovisionne réellement (StockMovement 'return')", async () => {
    const cartId = await createCartWithItem(variantId, 1);
    const { order } = await withTenant(tenantId, (tx) =>
      convertCartToOrder(tx, tenantId, {
        cartId,
        customer: { firstName: "Annulation Après", phone: `+22177${suffix}10` },
        deliveryMethod: "pickup",
        paymentMethod: "cod", // CONFIRMED immédiat -> stock déjà commis.
      }),
    );
    const before = await withTenant(tenantId, (tx) =>
      tx.inventoryItem.findFirstOrThrow({ where: { productVariantId: variantId, shopId } }),
    );

    await withTenant(tenantId, (tx) => cancelOrder(tx, tenantId, order.id, { changedByType: "owner", note: "Rupture logistique" }));

    const after = await withTenant(tenantId, (tx) =>
      tx.inventoryItem.findFirstOrThrow({ where: { productVariantId: variantId, shopId } }),
    );
    expect(after.availableQuantity).toBe(before.availableQuantity + 1);

    // Cette commande COD a déjà généré un mouvement "out" à sa création (confirmation
    // immédiate) — l'annulation en ajoute un second, "return" : DEUX mouvements réels
    // au total pour cette commande, jamais une réécriture du premier (immuabilité).
    const movements = await withTenant(tenantId, (tx) =>
      tx.stockMovement.findMany({ where: { inventoryItemId: after.id, referenceId: order.id }, orderBy: { createdAt: "asc" } }),
    );
    expect(movements).toHaveLength(2);
    expect(movements[0]?.type).toBe("out");
    expect(movements[1]?.type).toBe("return");
  });

  it("CONCURRENCE (paiement vs expiration) — commande déjà annulée : le paiement tardif est signalé pour réconciliation manuelle, jamais un succès automatique sans stock", async () => {
    const cartId = await createCartWithItem(variantId, 1);
    const { order } = await withTenant(tenantId, (tx) =>
      convertCartToOrder(tx, tenantId, {
        cartId,
        customer: { firstName: "Paiement Tardif", phone: `+22177${suffix}11` },
        deliveryMethod: "pickup",
        paymentMethod: "online",
      }),
    );
    // Simule le paiement qui a réellement été encaissé chez le prestataire (voir
    // webhook-processor.ts : Payment.status est mis à SUCCEEDED AVANT l'appel à
    // confirmOrderPaymentSuccess) — nécessaire pour vérifier que cette ligne est bien
    // signalée, jamais oubliée.
    await withTenant(tenantId, (tx) =>
      tx.payment.create({
        data: {
          tenantId,
          orderId: order.id,
          provider: "paydunya",
          providerTransactionId: `late-${order.id}`,
          idempotencyKey: `idem-late-${order.id}`,
          amount: order.total,
          status: "SUCCEEDED",
        },
      }),
    );

    // L'expiration gagne la course : la réservation est libérée AVANT l'arrivée du paiement.
    await withTenant(tenantId, (tx) =>
      cancelOrder(tx, tenantId, order.id, { changedByType: "system", note: "Réservation expirée" }),
    );

    const { order: afterLatePayment, outcome } = await withTenant(tenantId, (tx) =>
      confirmOrderPaymentSuccess(tx, tenantId, order.id, "Paiement arrivé trop tard"),
    );
    expect(outcome).toBe("flagged_for_manual_reconciliation");
    expect(afterLatePayment.status).toBe("CANCELED"); // jamais ressuscitée automatiquement.

    const payment = await withTenant(tenantId, (tx) =>
      tx.payment.findFirstOrThrow({ where: { orderId: order.id, providerTransactionId: `late-${order.id}` } }),
    );
    expect(payment.reconciliationStatus).toBe("mismatched"); // signalé pour un traitement manuel réel, pas juste un log.

    // Le stock déjà libéré par l'expiration n'est jamais recommis par ce paiement tardif.
    const item = await withTenant(tenantId, (tx) =>
      tx.inventoryItem.findFirstOrThrow({ where: { productVariantId: variantId, shopId } }),
    );
    expect(item.reservedQuantity).toBe(0);
  });

  it("confirmOrderPaymentSuccess rejouée (webhook dupliqué) : idempotente, ne recommet jamais deux fois le stock", async () => {
    const cartId = await createCartWithItem(variantId, 1);
    const { order } = await withTenant(tenantId, (tx) =>
      convertCartToOrder(tx, tenantId, {
        cartId,
        customer: { firstName: "Webhook Rejoue", phone: `+22177${suffix}12` },
        deliveryMethod: "pickup",
        paymentMethod: "online",
      }),
    );

    const first = await withTenant(tenantId, (tx) => confirmOrderPaymentSuccess(tx, tenantId, order.id, "Premier appel"));
    const second = await withTenant(tenantId, (tx) => confirmOrderPaymentSuccess(tx, tenantId, order.id, "Rejeu du webhook"));
    expect(first.outcome).toBe("confirmed");
    expect(second.outcome).toBe("already_confirmed");
    expect(first.order.status).toBe("CONFIRMED");
    expect(second.order.status).toBe("CONFIRMED");

    const movements = await withTenant(tenantId, (tx) =>
      tx.stockMovement.findMany({ where: { referenceId: order.id } }),
    );
    expect(movements).toHaveLength(1); // jamais un second décrément pour le même événement rejoué.
  });
});
