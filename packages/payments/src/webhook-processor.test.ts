import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import {
  prisma,
  withSuperAdminAccess,
  withTenant,
  encryptSecret,
  cancelOrder,
  PrismaClient,
} from "@yamacommerce/database";
import { processPaymentWebhook } from "./webhook-processor";

/** Client Prisma élevé (rôle propriétaire), réservé au nettoyage — `OrderStatusHistory`
 *  a perdu UPDATE/DELETE pour le rôle applicatif (immuabilité, voir la migration
 *  `20260926000000_orders_cart_delivery_foundation`). Copie locale de
 *  `packages/database/tests/test-owner-client.ts` : un fichier de tests ne peut pas
 *  être importé depuis un autre package. */
function testOwnerClient(): PrismaClient {
  return new PrismaClient({ datasources: { db: { url: process.env.MIGRATE_DATABASE_URL } } });
}

/**
 * Comble un vide de test réel : `processPaymentWebhook` (webhook-processor.ts)
 * existait déjà avant l'étape 2 (clients/panier/commandes/livraison, 19 septembre
 * 2026) mais aucune route HTTP ne l'invoquait, et aucun test ne couvrait ses effets
 * de bord sur `Order`/`Payment`/`InventoryItem`/`OrderStatusHistory`. Utilise le VRAI
 * `PayDunyaAdapter` (jamais mocké lui-même) avec un `fetch` global simulé — même
 * méthode que `adapters/paydunya.adapter.test.ts` — pour vérifier que le webhook,
 * une fois vérifié, déclenche réellement `confirmOrderPaymentSuccess`
 * (`@yamacommerce/database`) : enchaînement AWAITING_PAYMENT -> PAID -> CONFIRMED via
 * la machine à états gardée, commit réel du stock réservé, et idempotence sous rejeu.
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
      "REQUIRE_DB_TESTS=true mais PostgreSQL est injoignable : la suite webhook-processor " +
        `DOIT s'exécuter en CI. Cause : ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  databaseAvailable = false;
  // eslint-disable-next-line no-console
  console.warn("[webhook-processor.test] Base de données injoignable — suite ignorée (skip).");
}

describe.skipIf(!databaseAvailable)("processPaymentWebhook (réel, PostgreSQL + PayDunyaAdapter avec fetch simulé)", () => {
  const suffix = Date.now();
  const sectorKey = `test-sector-webhook-processor-${suffix}`;
  const providerToken = `abc123-${suffix}`;
  let tenantId: string;
  let shopId: string;
  let variantId: string;
  let inventoryItemId: string;
  let customerId: string;
  let orderId: string;
  let paymentId: string;

  beforeAll(async () => {
    await withSuperAdminAccess(async (tx) => {
      await tx.sector.create({
        data: { key: sectorKey, name: "Secteur de test", defaultModuleKeys: [], isSystem: false },
      });
      const tenant = await tx.tenant.create({
        data: {
          slug: `test-webhook-processor-${suffix}`,
          name: "Boutique Webhook Processor",
          businessType: "ECOMMERCE",
          sectorKey,
          status: "ACTIVE",
        },
      });
      tenantId = tenant.id;

      const credentials = encryptSecret(
        JSON.stringify({ masterKey: "mk", privateKey: "pk", publicKey: "pubk", token: "tok" }),
      );
      await tx.paymentProviderConfig.create({
        data: {
          tenantId,
          provider: "paydunya",
          isEnabled: true,
          mode: "sandbox",
          credentialsCiphertext: credentials.ciphertext,
          credentialsIv: credentials.iv,
          credentialsAuthTag: credentials.authTag,
        },
      });
    });

    await withTenant(tenantId, async (tx) => {
      const shop = await tx.shop.create({ data: { tenantId, name: "Boutique principale", isMain: true } });
      shopId = shop.id;
      const product = await tx.product.create({
        data: { tenantId, name: "Sac à main", slug: `sac-a-main-${suffix}`, basePrice: 10_000, status: "PUBLISHED" },
      });
      const variant = await tx.productVariant.create({
        data: { tenantId, productId: product.id, name: "Unique", price: 10_000, attributes: {} },
      });
      variantId = variant.id;
      const item = await tx.inventoryItem.create({
        // Simule une commande déjà passée : 2 unités déjà réservées (voir
        // `convertCartToOrder`), en attente de confirmation de paiement.
        data: { tenantId, productVariantId: variant.id, shopId: shop.id, availableQuantity: 8, reservedQuantity: 2 },
      });
      inventoryItemId = item.id;

      const customer = await tx.customer.create({ data: { tenantId, firstName: "Client Webhook" } });
      customerId = customer.id;

      const order = await tx.order.create({
        data: {
          tenantId,
          shopId: shop.id,
          customerId,
          orderNumber: `CMD-WEBHOOK-${suffix}`,
          status: "AWAITING_PAYMENT",
          paymentStatus: "UNPAID",
          subtotal: 20_000,
          total: 20_000,
          reservationExpiresAt: new Date(Date.now() + 30 * 60_000),
          items: {
            create: {
              tenantId,
              productVariantId: variant.id,
              productNameSnapshot: "Sac à main — Unique",
              unitPrice: 10_000,
              quantity: 2,
              total: 20_000,
            },
          },
        },
      });
      orderId = order.id;

      const payment = await tx.payment.create({
        data: {
          tenantId,
          orderId: order.id,
          provider: "paydunya",
          providerTransactionId: providerToken,
          idempotencyKey: `pay_${order.id}_${suffix}`,
          amount: 20_000,
          status: "PENDING",
        },
      });
      paymentId = payment.id;
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  afterAll(async () => {
    // `OrderStatusHistory` ET `StockMovement` ont toutes deux perdu UPDATE/DELETE pour
    // le rôle applicatif (immuabilité) — seul le client "propriétaire" peut les nettoyer.
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
      await tx.customer.deleteMany({ where: { tenantId } });
      await tx.inventoryItem.deleteMany({ where: { tenantId } });
      await tx.productVariant.deleteMany({ where: { tenantId } });
      await tx.product.deleteMany({ where: { tenantId } });
      await tx.paymentWebhookEvent.deleteMany({ where: { tenantId } });
      await tx.paymentProviderConfig.deleteMany({ where: { tenantId } });
      await tx.shop.deleteMany({ where: { tenantId } });
      await tx.tenant.deleteMany({ where: { id: tenantId } });
      await tx.sector.deleteMany({ where: { key: sectorKey } });
    });
  });

  it("SÉCURITÉ : un webhook adressé au tenantId d'une AUTRE boutique ne peut jamais confirmer le paiement d'une commande qui ne lui appartient pas", async () => {
    // Le tenantId de l'URL de callback ne doit JAMAIS, à lui seul, suffire à faire
    // confiance à la requête (voir la revue de l'étape 2) — même avec un `fetch`
    // simulé qui répondrait "complété" pour n'importe quel appelant, la commande
    // réelle appartient à `tenantId`, jamais à `otherTenantId`.
    const otherCreds = encryptSecret(
      JSON.stringify({ masterKey: "mk2", privateKey: "pk2", publicKey: "pubk2", token: "tok2" }),
    );
    const otherTenantId = await withSuperAdminAccess(async (tx) => {
      const otherTenant = await tx.tenant.create({
        data: {
          slug: `test-webhook-other-${suffix}`,
          name: "Autre Boutique",
          businessType: "ECOMMERCE",
          sectorKey,
          status: "ACTIVE",
        },
      });
      await tx.paymentProviderConfig.create({
        data: {
          tenantId: otherTenant.id,
          provider: "paydunya",
          isEnabled: true,
          mode: "sandbox",
          credentialsCiphertext: otherCreds.ciphertext,
          credentialsIv: otherCreds.iv,
          credentialsAuthTag: otherCreds.authTag,
        },
      });
      return otherTenant.id;
    });

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        json: async () => ({
          response_code: "00",
          response_text: "OK",
          status: "completed",
          invoice: { total_amount: "20000", token: providerToken },
        }),
      }),
    );

    const result = await processPaymentWebhook({
      tenantId: otherTenantId, // mauvais tenant dans l'URL, délibérément.
      provider: "paydunya",
      input: { headers: {}, rawBody: JSON.stringify({ data: { invoice: { token: providerToken } } }) },
    });

    expect(result.status).toBe("error");
    expect(result.reason).toBe("payment_not_found"); // jamais trouvé/confirmé sous le mauvais tenant.

    const order = await withTenant(tenantId, (tx) => tx.order.findUniqueOrThrow({ where: { id: orderId } }));
    expect(order.status).toBe("AWAITING_PAYMENT"); // la VRAIE commande reste inchangée.

    await withSuperAdminAccess(async (tx) => {
      // Ce test réutilise DÉLIBÉRÉMENT `providerToken` (le vrai jeton de la commande
      // légitime) pour simuler la tentative la plus réaliste : un appel à l'URL du
      // MAUVAIS tenant avec le jeton d'une VRAIE transaction. `PaymentWebhookEvent`
      // est unique sur `(provider, eventId)` GLOBALEMENT (pas par tenant) — l'événement
      // créé ici sous `otherTenantId` doit donc être nettoyé pour ne pas bloquer le
      // test suivant, qui traite légitimement ce même jeton sous le VRAI tenant.
      await tx.paymentWebhookEvent.deleteMany({ where: { tenantId: otherTenantId } });
      await tx.paymentProviderConfig.deleteMany({ where: { tenantId: otherTenantId } });
      await tx.tenant.deleteMany({ where: { id: otherTenantId } });
    });
  });

  it("paiement vérifié réussi : Payment -> SUCCEEDED, Order AWAITING_PAYMENT -> PAID -> CONFIRMED, stock réellement commis", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        json: async () => ({
          response_code: "00",
          response_text: "OK",
          status: "completed",
          invoice: { total_amount: "20000", token: providerToken },
        }),
      }),
    );

    const result = await processPaymentWebhook({
      tenantId,
      provider: "paydunya",
      input: { headers: {}, rawBody: JSON.stringify({ data: { invoice: { token: providerToken } } }) },
    });
    expect(result.status).toBe("processed");

    const order = await withTenant(tenantId, (tx) => tx.order.findUniqueOrThrow({ where: { id: orderId } }));
    expect(order.status).toBe("CONFIRMED");
    expect(order.paymentStatus).toBe("PAID");
    expect(order.reservationExpiresAt).toBeNull();

    const payment = await withTenant(tenantId, (tx) => tx.payment.findUniqueOrThrow({ where: { id: paymentId } }));
    expect(payment.status).toBe("SUCCEEDED");
    expect(payment.verifiedAt).not.toBeNull();

    const item = await withTenant(tenantId, (tx) => tx.inventoryItem.findUniqueOrThrow({ where: { id: inventoryItemId } }));
    expect(item.reservedQuantity).toBe(0); // 2 réservées -> commises (décrémentées de reservedQuantity).
    expect(item.availableQuantity).toBe(8); // inchangé : déjà décrémenté au moment de la réservation initiale.

    const movements = await withTenant(tenantId, (tx) =>
      tx.stockMovement.findMany({ where: { referenceId: orderId } }),
    );
    expect(movements).toHaveLength(1);
    expect(movements[0]?.type).toBe("out");

    const history = await withTenant(tenantId, (tx) =>
      tx.orderStatusHistory.findMany({ where: { orderId }, orderBy: { createdAt: "asc" } }),
    );
    expect(history.map((h) => h.toStatus)).toEqual(["PAID", "CONFIRMED"]);
    expect(history.every((h) => h.changedByType === "system")).toBe(true);

    const webhookEvent = await withTenant(tenantId, (tx) =>
      tx.paymentWebhookEvent.findFirstOrThrow({ where: { provider: "paydunya" } }),
    );
    expect(webhookEvent.status).toBe("processed");
  });

  it("REJEU (même token/statut, même eventId déterministe) : idempotent, ne recommet jamais deux fois le stock", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        json: async () => ({
          response_code: "00",
          response_text: "OK",
          status: "completed",
          invoice: { total_amount: "20000", token: providerToken },
        }),
      }),
    );

    const result = await processPaymentWebhook({
      tenantId,
      provider: "paydunya",
      input: { headers: {}, rawBody: JSON.stringify({ data: { invoice: { token: providerToken } } }) },
    });
    expect(result.status).toBe("ignored_duplicate");

    const movements = await withTenant(tenantId, (tx) =>
      tx.stockMovement.findMany({ where: { referenceId: orderId } }),
    );
    expect(movements).toHaveLength(1); // toujours un seul — jamais un second décrément pour le rejeu.
  });

  it("COURSE CRITIQUE — l'expiration a déjà gagné : un webhook de paiement arrivant APRÈS reste 'processed' mais signale une réconciliation manuelle, jamais une confirmation automatique sans stock", async () => {
    const lateToken = `late-token-${suffix}`;
    const lateOrderId = await withTenant(tenantId, async (tx) => {
      // Réutilise l'InventoryItem partagé de la suite (unique par variante+boutique) —
      // simule une réservation supplémentaire de 1 unité, exactement ce que
      // `convertCartToOrder` aurait fait atomiquement à la création réelle de cette commande.
      await tx.inventoryItem.updateMany({
        where: { productVariantId: variantId, shopId, tenantId },
        data: { availableQuantity: { decrement: 1 }, reservedQuantity: { increment: 1 } },
      });
      const order = await tx.order.create({
        data: {
          tenantId,
          shopId,
          customerId,
          orderNumber: `CMD-WEBHOOK-LATE-${suffix}`,
          status: "AWAITING_PAYMENT",
          paymentStatus: "UNPAID",
          subtotal: 10_000,
          total: 10_000,
          reservationExpiresAt: new Date(Date.now() + 30 * 60_000),
          items: {
            create: {
              tenantId,
              productVariantId: variantId,
              productNameSnapshot: "Sac à main — Unique",
              unitPrice: 10_000,
              quantity: 1,
              total: 10_000,
            },
          },
        },
      });
      await tx.payment.create({
        data: {
          tenantId,
          orderId: order.id,
          provider: "paydunya",
          providerTransactionId: lateToken,
          idempotencyKey: `pay_${order.id}_${suffix}`,
          amount: 10_000,
          status: "PENDING",
        },
      });
      return order.id;
    });

    // L'expiration (voir order-reservation.ts, M4) gagne la course : la réservation
    // est libérée AVANT que le webhook de paiement n'arrive.
    await withTenant(tenantId, (tx) =>
      cancelOrder(tx, tenantId, lateOrderId, { changedByType: "system", note: "Réservation expirée" }),
    );

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        json: async () => ({
          response_code: "00",
          response_text: "OK",
          status: "completed",
          invoice: { total_amount: "10000", token: lateToken },
        }),
      }),
    );

    const result = await processPaymentWebhook({
      tenantId,
      provider: "paydunya",
      input: { headers: {}, rawBody: JSON.stringify({ data: { invoice: { token: lateToken } } }) },
    });
    // "processed", jamais "error" : c'est un conflit métier définitivement résolu
    // (voir la revue), pas un échec technique que BullMQ devrait réessayer.
    expect(result.status).toBe("processed");
    expect(result.reason).toBe("payment_succeeded_after_reservation_expired_manual_review_required");

    const order = await withTenant(tenantId, (tx) => tx.order.findUniqueOrThrow({ where: { id: lateOrderId } }));
    expect(order.status).toBe("CANCELED"); // jamais ressuscitée automatiquement.

    const payment = await withTenant(tenantId, (tx) =>
      tx.payment.findFirstOrThrow({ where: { orderId: lateOrderId, providerTransactionId: lateToken } }),
    );
    expect(payment.status).toBe("SUCCEEDED"); // l'argent est réellement arrivé, jamais nié.
    expect(payment.reconciliationStatus).toBe("mismatched"); // signalé pour un traitement manuel réel.

    const item = await withTenant(tenantId, (tx) =>
      tx.inventoryItem.findFirstOrThrow({ where: { productVariantId: variantId, shopId } }),
    );
    expect(item.reservedQuantity).toBe(0); // libéré par l'expiration, jamais recommis par ce paiement tardif.
  });
});
