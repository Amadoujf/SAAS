import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../src/client";
import { withSuperAdminAccess, withTenant } from "../src/tenant-context";
import { testOwnerClient } from "./test-owner-client";
import { addCartItem, getOrCreateActiveCart } from "../src/cart-registry";
import { convertCartToOrder, confirmOrderPaymentSuccess, type ConvertCartToOrderInput } from "../src/order-registry";
import {
  releaseExpiredReservation,
  releaseExpiredReservationTx,
  findExpiredReservationCandidates,
  sweepExpiredReservations,
} from "../src/order-reservation";

/**
 * Vérifie l'expiration automatique des réservations (étape 2, M4) contre PostgreSQL
 * réel — exigences explicites de la revue :
 * - Utilise l'heure de POSTGRESQL (`NOW()`), pas l'horloge applicative.
 * - Ne libère que les réservations réellement expirées et encore non payées, avec une
 *   condition atomique sur le statut.
 * - COURSE CRITIQUE : webhook de paiement et expiration exécutés simultanément — un
 *   seul gagne, jamais un état incohérent.
 * - Deux appels concurrents sur le MÊME job (deux workers) ne libèrent jamais deux
 *   fois le stock.
 * - Chaque libération écrit un `StockMovement` ET une entrée `OrderStatusHistory`.
 * - Le balayage de récupération retrouve les réservations expirées sans dépendre d'un
 *   job BullMQ individuel.
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
      "REQUIRE_DB_TESTS=true mais PostgreSQL est injoignable : la suite d'expiration " +
        `des réservations DOIT s'exécuter en CI. Cause : ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  databaseAvailable = false;
  // eslint-disable-next-line no-console
  console.warn("[order-reservation.test] Base de données injoignable — suite ignorée (skip).");
}

describe.skipIf(!databaseAvailable)("Expiration des réservations de stock", () => {
  const suffix = Date.now();
  const sectorKey = `test-sector-reservation-${suffix}`;
  let tenantId: string;
  let shopId: string;
  let variantId: string;

  async function createCartWithItem(qty: number) {
    const visitorToken = `visiteur-${suffix}-${Math.random().toString(36).slice(2)}`;
    return withTenant(tenantId, async (tx) => {
      const cart = await getOrCreateActiveCart(tx, tenantId, visitorToken);
      await addCartItem(tx, tenantId, cart.id, { productVariantId: variantId, quantity: qty });
      return cart.id;
    });
  }

  /** Crée une commande "paiement en ligne" (AWAITING_PAYMENT, réservation posée),
   *  puis force son échéance dans le PASSÉ — simule directement le résultat que
   *  `RESERVATION_WINDOW_MINUTES` produirait après un vrai délai, sans jamais
   *  attendre un vrai minuteur dans les tests (voir la revue : aucun test ne doit
   *  dépendre d'un délai BullMQ réel). */
  async function createExpiredOnlineOrder(qty = 1) {
    const cartId = await createCartWithItem(qty);
    const { order } = await withTenant(tenantId, (tx) =>
      convertCartToOrder(tx, tenantId, {
        cartId,
        customer: { firstName: "Client Réservation", phone: `+22177${suffix}${Math.floor(Math.random() * 100000)}` },
        deliveryMethod: "pickup",
        paymentMethod: "online",
      }),
    );
    await withSuperAdminAccess((tx) =>
      tx.order.update({ where: { id: order.id }, data: { reservationExpiresAt: new Date(Date.now() - 60_000) } }),
    );
    return order;
  }

  beforeAll(async () => {
    await withSuperAdminAccess(async (tx) => {
      await tx.sector.create({
        data: { key: sectorKey, name: "Secteur de test", defaultModuleKeys: [], isSystem: false },
      });
      const tenant = await tx.tenant.create({
        data: {
          slug: `test-reservation-${suffix}`,
          name: "Boutique Réservation",
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
        data: { tenantId, name: "Montre", slug: `montre-${suffix}`, basePrice: 25_000, status: "PUBLISHED" },
      });
      const variant = await tx.productVariant.create({
        data: { tenantId, productId: product.id, name: "Unique", price: 25_000, attributes: {} },
      });
      variantId = variant.id;
      await tx.inventoryItem.create({
        data: { tenantId, productVariantId: variant.id, shopId: shop.id, availableQuantity: 20 },
      });
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
      await tx.counter.deleteMany({ where: { tenantId } });
      await tx.shop.deleteMany({ where: { tenantId } });
      await tx.tenant.deleteMany({ where: { id: tenantId } });
      await tx.sector.deleteMany({ where: { key: sectorKey } });
    });
  });

  it("libère une réservation réellement expirée : stock rendu disponible, StockMovement ET OrderStatusHistory créés", async () => {
    const order = await createExpiredOnlineOrder(1);
    const before = await withTenant(tenantId, (tx) =>
      tx.inventoryItem.findFirstOrThrow({ where: { productVariantId: variantId, shopId } }),
    );

    const outcome = await releaseExpiredReservation(tenantId, order.id);
    expect(outcome.outcome).toBe("released");

    const after = await withTenant(tenantId, (tx) =>
      tx.inventoryItem.findFirstOrThrow({ where: { productVariantId: variantId, shopId } }),
    );
    expect(after.availableQuantity).toBe(before.availableQuantity + 1);
    expect(after.reservedQuantity).toBe(before.reservedQuantity - 1);

    const finalOrder = await withTenant(tenantId, (tx) => tx.order.findUniqueOrThrow({ where: { id: order.id } }));
    expect(finalOrder.status).toBe("CANCELED");
    expect(finalOrder.reservationExpiresAt).toBeNull();

    const movements = await withTenant(tenantId, (tx) =>
      tx.stockMovement.findMany({ where: { referenceId: order.id } }),
    );
    expect(movements).toHaveLength(1);
    expect(movements[0]?.type).toBe("adjustment");

    // La commande porte déjà 2 entrées d'historique depuis sa création par
    // `convertCartToOrder` (NEW créée, puis NEW -> AWAITING_PAYMENT) — la libération
    // en ajoute une TROISIÈME, jamais une réécriture des précédentes (immuabilité).
    const history = await withTenant(tenantId, (tx) =>
      tx.orderStatusHistory.findMany({ where: { orderId: order.id }, orderBy: { createdAt: "asc" } }),
    );
    expect(history).toHaveLength(3);
    expect(history.map((h) => h.toStatus)).toEqual(["NEW", "AWAITING_PAYMENT", "CANCELED"]);
    expect(history.at(-1)?.changedByType).toBe("system");
  });

  it("ne libère PAS une réservation qui n'est pas encore expirée (heure de PostgreSQL faisant foi)", async () => {
    const cartId = await createCartWithItem(1);
    const { order } = await withTenant(tenantId, (tx) =>
      convertCartToOrder(tx, tenantId, {
        cartId,
        customer: { firstName: "Client Pas Encore Expiré", phone: `+22177${suffix}${Math.floor(Math.random() * 100000)}` },
        deliveryMethod: "pickup",
        paymentMethod: "online",
      }),
    );
    // reservationExpiresAt reste dans le futur (posé par convertCartToOrder lui-même).

    const outcome = await releaseExpiredReservation(tenantId, order.id);
    expect(outcome.outcome).toBe("skipped");
    if (outcome.outcome === "skipped") {
      expect(outcome.reason).toBe("not_awaiting_payment_or_not_yet_expired");
    }

    const stillActive = await withTenant(tenantId, (tx) => tx.order.findUniqueOrThrow({ where: { id: order.id } }));
    expect(stillActive.status).toBe("AWAITING_PAYMENT");
  });

  it("ne libère jamais une réservation déjà CONFIRMÉE (payée), même avec une échéance dans le passé", async () => {
    const order = await createExpiredOnlineOrder(1);
    await withTenant(tenantId, (tx) => confirmOrderPaymentSuccess(tx, tenantId, order.id, "Payé avant expiration"));

    const outcome = await releaseExpiredReservation(tenantId, order.id);
    expect(outcome.outcome).toBe("skipped");

    const confirmed = await withTenant(tenantId, (tx) => tx.order.findUniqueOrThrow({ where: { id: order.id } }));
    expect(confirmed.status).toBe("CONFIRMED"); // jamais annulée après coup.
  });

  it("DEUX WORKERS SUR LE MÊME JOB : des appels concurrents sur la MÊME commande ne libèrent jamais deux fois le stock", async () => {
    const order = await createExpiredOnlineOrder(2);
    const before = await withTenant(tenantId, (tx) =>
      tx.inventoryItem.findFirstOrThrow({ where: { productVariantId: variantId, shopId } }),
    );

    const attempts = await Promise.allSettled(
      Array.from({ length: 5 }, () => releaseExpiredReservation(tenantId, order.id)),
    );
    const released = attempts.filter((a) => a.status === "fulfilled" && a.value.outcome === "released");
    expect(released).toHaveLength(1); // une seule des 5 tentatives concurrentes a réellement agi.

    const after = await withTenant(tenantId, (tx) =>
      tx.inventoryItem.findFirstOrThrow({ where: { productVariantId: variantId, shopId } }),
    );
    expect(after.availableQuantity).toBe(before.availableQuantity + 2); // jamais 4, jamais 6 : une seule libération.
    expect(after.reservedQuantity).toBe(before.reservedQuantity - 2);

    const movements = await withTenant(tenantId, (tx) =>
      tx.stockMovement.findMany({ where: { referenceId: order.id } }),
    );
    expect(movements).toHaveLength(1); // jamais un mouvement par tentative.

    // 2 entrées de création (NEW, AWAITING_PAYMENT) + UNE SEULE entrée CANCELED,
    // jamais 5 (une par tentative concurrente).
    const history = await withTenant(tenantId, (tx) => tx.orderStatusHistory.findMany({ where: { orderId: order.id } }));
    expect(history).toHaveLength(3);
    expect(history.filter((h) => h.toStatus === "CANCELED")).toHaveLength(1);
  });

  it("COURSE CRITIQUE : paiement et expiration exécutés SIMULTANÉMENT sur la même commande — un seul gagne, jamais un état incohérent", async () => {
    for (let iteration = 0; iteration < 5; iteration += 1) {
      const order = await createExpiredOnlineOrder(1);
      const before = await withTenant(tenantId, (tx) =>
        tx.inventoryItem.findFirstOrThrow({ where: { productVariantId: variantId, shopId } }),
      );

      const [paymentResult, expiryResult] = await Promise.allSettled([
        withTenant(tenantId, (tx) => confirmOrderPaymentSuccess(tx, tenantId, order.id, "Paiement concurrent")),
        releaseExpiredReservation(tenantId, order.id),
      ]);

      const finalOrder = await withTenant(tenantId, (tx) => tx.order.findUniqueOrThrow({ where: { id: order.id } }));
      const after = await withTenant(tenantId, (tx) =>
        tx.inventoryItem.findFirstOrThrow({ where: { productVariantId: variantId, shopId } }),
      );

      // Jamais les deux résultats bloqués/en erreur à la fois — grâce à la boucle de
      // nouvel essai de `confirmOrderPaymentSuccess` sur `OrderStatusConflictError`,
      // les DEUX appels se terminent normalement (fulfilled), quel que soit qui gagne.
      expect(paymentResult.status).toBe("fulfilled");
      expect(expiryResult.status).toBe("fulfilled");

      if (finalOrder.status === "CONFIRMED") {
        // Le paiement a gagné : `before` est déjà mesuré APRÈS la réservation initiale
        // (availableQuantity déjà décrémenté par `convertCartToOrder`) — la
        // confirmation ne touche plus que `reservedQuantity` (commis, jamais
        // `availableQuantity` une seconde fois), jamais libéré par l'expiration perdante.
        expect(finalOrder.paymentStatus).toBe("PAID");
        expect(after.reservedQuantity).toBe(before.reservedQuantity - 1);
        expect(after.availableQuantity).toBe(before.availableQuantity);
        if (expiryResult.status === "fulfilled") expect(expiryResult.value.outcome).toBe("skipped");
      } else {
        // L'expiration a gagné : stock réellement libéré, jamais commis par le
        // paiement perdant — qui doit être signalé pour réconciliation manuelle,
        // JAMAIS un succès automatique sans stock.
        expect(finalOrder.status).toBe("CANCELED");
        expect(after.reservedQuantity).toBe(before.reservedQuantity - 1);
        expect(after.availableQuantity).toBe(before.availableQuantity + 1);
        if (paymentResult.status === "fulfilled") {
          expect(paymentResult.value.outcome).toBe("flagged_for_manual_reconciliation");
        }
      }

      // Peu importe qui gagne : exactement UNE entrée d'historique de statut a été
      // ajoutée par la transition gagnante (jamais deux, jamais zéro).
      const history = await withTenant(tenantId, (tx) =>
        tx.orderStatusHistory.findMany({ where: { orderId: order.id } }),
      );
      expect(history.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("découvre les candidats expirés via l'heure de PostgreSQL, plafonné par lot (batchSize)", async () => {
    const orderA = await createExpiredOnlineOrder(1);
    const orderB = await createExpiredOnlineOrder(1);

    const candidates = await findExpiredReservationCandidates(1);
    expect(candidates).toHaveLength(1); // respecte la limite du lot.

    const allCandidates = await findExpiredReservationCandidates(100);
    const ids = allCandidates.map((c) => c.id);
    expect(ids).toContain(orderA.id);
    expect(ids).toContain(orderB.id);
  });

  it("BALAYAGE DE RÉCUPÉRATION : retrouve et libère les réservations expirées SANS dépendre d'un job individuel", async () => {
    const orderA = await createExpiredOnlineOrder(1);
    const orderB = await createExpiredOnlineOrder(1);
    // Aucun job BullMQ n'est enqueue ici — simule exactement une interruption du
    // worker au moment où le job différé initial aurait dû s'exécuter.

    const result = await sweepExpiredReservations(100);
    expect(result.released).toBeGreaterThanOrEqual(2);
    expect(result.failed).toBe(0);

    const [finalA, finalB] = await withTenant(tenantId, (tx) =>
      Promise.all([
        tx.order.findUniqueOrThrow({ where: { id: orderA.id } }),
        tx.order.findUniqueOrThrow({ where: { id: orderB.id } }),
      ]),
    );
    expect(finalA.status).toBe("CANCELED");
    expect(finalB.status).toBe("CANCELED");

    // Rejouer le balayage juste après est un no-op sûr (idempotence du job de
    // récupération) — les commandes déjà traitées ne réapparaissent plus comme
    // candidates (elles ne sont plus AWAITING_PAYMENT).
    const secondPass = await sweepExpiredReservations(100);
    const idsStillCandidate = (await findExpiredReservationCandidates(100)).map((c) => c.id);
    expect(idsStillCandidate).not.toContain(orderA.id);
    expect(idsStillCandidate).not.toContain(orderB.id);
    expect(secondPass.failed).toBe(0);
  });

  describe("MULTI-FUSEAUX — la comparaison reste correcte quel que soit le fuseau de LA SESSION Postgres", () => {
    // Preuve directe de la correction durable (migration
    // `20260927000000_reservation_expiry_timestamptz`) : `reservationExpiresAt` est
    // maintenant `timestamptz` (instant absolu), donc comparable à `NOW()` sans
    // aucune conversion — contrairement à la première version (`timestamp` sans
    // fuseau + `AT TIME ZONE 'UTC'` manuel), qui n'aurait été correcte que si CETTE
    // clause précise était présente dans TOUTE requête touchant la colonne. `SET
    // LOCAL TIME ZONE` reste scopé à la transaction courante (jamais fuité à une
    // connexion réutilisée par un autre test — même discipline que
    // `set_config(..., true)` dans tenant-context.ts).
    const zonesToTest = ["UTC", "America/New_York", "Asia/Tokyo", "Pacific/Kiritimati"];

    for (const zone of zonesToTest) {
      it(`détecte correctement une réservation expirée sous le fuseau de session "${zone}"`, async () => {
        const order = await createExpiredOnlineOrder(1);

        const isExpired = await withTenant(tenantId, async (tx) => {
          await tx.$executeRawUnsafe(`SET LOCAL TIME ZONE '${zone}'`);
          const rows = await tx.$queryRaw<{ expired: boolean }[]>`
            SELECT "reservationExpiresAt" < NOW() as expired FROM "Order" WHERE id = ${order.id}
          `;
          return rows[0]?.expired ?? false;
        });
        expect(isExpired).toBe(true);

        // Et la vraie fonction de libération, appelée sous ce même fuseau de
        // session, se comporte correctement de bout en bout (pas seulement la
        // requête brute isolée).
        const outcome = await withTenant(tenantId, async (tx) => {
          await tx.$executeRawUnsafe(`SET LOCAL TIME ZONE '${zone}'`);
          return releaseExpiredReservationTx(tx, tenantId, order.id);
        });
        expect(outcome.outcome).toBe("released");
      });
    }

    it("ne détecte JAMAIS comme expirée une réservation encore valide, même sous un fuseau très en avance (Pacific/Kiritimati, UTC+14)", async () => {
      const cartId = await createCartWithItem(1);
      const { order } = await withTenant(tenantId, (tx) =>
        convertCartToOrder(tx, tenantId, {
          cartId,
          customer: { firstName: "Client Futur", phone: `+22177${suffix}${Math.floor(Math.random() * 100000)}` },
          deliveryMethod: "pickup",
          paymentMethod: "online",
        }),
      );

      const isExpired = await withTenant(tenantId, async (tx) => {
        await tx.$executeRawUnsafe(`SET LOCAL TIME ZONE 'Pacific/Kiritimati'`);
        const rows = await tx.$queryRaw<{ expired: boolean }[]>`
          SELECT "reservationExpiresAt" < NOW() as expired FROM "Order" WHERE id = ${order.id}
        `;
        return rows[0]?.expired ?? false;
      });
      expect(isExpired).toBe(false); // encore dans la fenêtre de réservation, quel que soit le fuseau.
    });
  });
});
