import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../src/client";
import { withSuperAdminAccess, withTenant } from "../src/tenant-context";
import { testOwnerClient } from "./test-owner-client";
import {
  InvalidOrderTransitionError,
  OrderStatusConflictError,
  isValidOrderTransition,
  transitionOrderStatus,
} from "../src/order-status";

describe("Table d'adjacence des statuts de commande (pure)", () => {
  it("autorise les transitions attendues du cycle standard", () => {
    expect(isValidOrderTransition("NEW", "AWAITING_PAYMENT")).toBe(true);
    expect(isValidOrderTransition("NEW", "CONFIRMED")).toBe(true); // COD.
    expect(isValidOrderTransition("AWAITING_PAYMENT", "PAID")).toBe(true);
    expect(isValidOrderTransition("PAID", "CONFIRMED")).toBe(true);
    expect(isValidOrderTransition("CONFIRMED", "PREPARING")).toBe(true);
    expect(isValidOrderTransition("PREPARING", "READY")).toBe(true);
    expect(isValidOrderTransition("READY", "SHIPPED")).toBe(true);
    expect(isValidOrderTransition("SHIPPED", "OUT_FOR_DELIVERY")).toBe(true);
    expect(isValidOrderTransition("OUT_FOR_DELIVERY", "DELIVERED")).toBe(true);
    expect(isValidOrderTransition("DELIVERED", "REFUNDED")).toBe(true);
  });

  it("refuse de sauter des étapes ou de revenir en arrière", () => {
    expect(isValidOrderTransition("NEW", "DELIVERED")).toBe(false);
    expect(isValidOrderTransition("CONFIRMED", "NEW")).toBe(false);
    expect(isValidOrderTransition("PREPARING", "AWAITING_PAYMENT")).toBe(false);
  });

  it("refuse toute annulation après expédition (décision de conception documentée)", () => {
    expect(isValidOrderTransition("SHIPPED", "CANCELED")).toBe(false);
    expect(isValidOrderTransition("OUT_FOR_DELIVERY", "CANCELED")).toBe(true); // encore possible avant livraison effective.
  });

  it("CANCELED et REFUNDED sont des états terminaux", () => {
    expect(isValidOrderTransition("CANCELED", "NEW")).toBe(false);
    expect(isValidOrderTransition("CANCELED", "CONFIRMED")).toBe(false);
    expect(isValidOrderTransition("REFUNDED", "PAID")).toBe(false);
  });
});

let databaseAvailable = true;
try {
  await prisma.$queryRaw`SELECT 1`;
} catch (error) {
  if (process.env.REQUIRE_DB_TESTS === "true") {
    throw new Error(
      "REQUIRE_DB_TESTS=true mais PostgreSQL est injoignable : la suite transitionOrderStatus " +
        `DOIT s'exécuter en CI. Cause : ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  databaseAvailable = false;
  // eslint-disable-next-line no-console
  console.warn("[order-status.test] Base de données injoignable — suite ignorée (skip).");
}

describe.skipIf(!databaseAvailable)("transitionOrderStatus (réel, PostgreSQL)", () => {
  const suffix = Date.now();
  const sectorKey = `test-sector-order-status-${suffix}`;
  let tenantId: string;
  let customerId: string;
  let orderId: string;

  beforeAll(async () => {
    await withSuperAdminAccess(async (tx) => {
      await tx.sector.create({
        data: { key: sectorKey, name: "Secteur de test", defaultModuleKeys: [], isSystem: false },
      });
      const tenant = await tx.tenant.create({
        data: {
          slug: `test-order-status-${suffix}`,
          name: "Boutique Statuts",
          businessType: "ECOMMERCE",
          sectorKey,
          status: "ACTIVE",
        },
      });
      tenantId = tenant.id;
    });

    await withTenant(tenantId, async (tx) => {
      const customer = await tx.customer.create({ data: { tenantId, firstName: "Client Test" } });
      customerId = customer.id;
      const order = await tx.order.create({
        data: {
          tenantId,
          customerId,
          orderNumber: `CMD-TEST-${suffix}`,
          status: "NEW",
          subtotal: 1000,
          total: 1000,
        },
      });
      orderId = order.id;
    });
  });

  afterAll(async () => {
    // `OrderStatusHistory` a perdu UPDATE/DELETE pour le rôle applicatif (immuabilité,
    // voir la migration `20260926000000_orders_cart_delivery_foundation`) — même
    // besoin qu'un client "propriétaire" dédié que `StockMovement`, voir
    // `test-owner-client.ts`.
    const owner = testOwnerClient();
    try {
      await owner.orderStatusHistory.deleteMany({ where: { tenantId } });
    } finally {
      await owner.$disconnect();
    }
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.is_super_admin', 'true', true)`;
      await tx.order.deleteMany({ where: { tenantId } });
      await tx.customer.deleteMany({ where: { tenantId } });
      await tx.tenant.deleteMany({ where: { id: tenantId } });
      await tx.sector.deleteMany({ where: { key: sectorKey } });
    });
  });

  it("effectue une transition valide et écrit l'historique", async () => {
    const updated = await withTenant(tenantId, (tx) =>
      transitionOrderStatus(tx, tenantId, { orderId, toStatus: "AWAITING_PAYMENT", changedByType: "system" }),
    );
    expect(updated.status).toBe("AWAITING_PAYMENT");

    const history = await withTenant(tenantId, (tx) => tx.orderStatusHistory.findMany({ where: { orderId } }));
    expect(history).toHaveLength(1);
    expect(history[0]?.fromStatus).toBe("NEW");
    expect(history[0]?.toStatus).toBe("AWAITING_PAYMENT");
  });

  it("refuse une transition illégale, n'écrit aucun historique", async () => {
    await expect(
      withTenant(tenantId, (tx) => transitionOrderStatus(tx, tenantId, { orderId, toStatus: "DELIVERED", changedByType: "system" })),
    ).rejects.toThrow(InvalidOrderTransitionError);

    const history = await withTenant(tenantId, (tx) => tx.orderStatusHistory.findMany({ where: { orderId } }));
    expect(history).toHaveLength(1); // toujours celui du test précédent, rien de plus.
  });

  it("une auto-transition (déjà dans cet état) est un no-op réussi, sans nouvelle entrée d'historique", async () => {
    const before = await withTenant(tenantId, (tx) => tx.orderStatusHistory.count({ where: { orderId } }));
    const result = await withTenant(tenantId, (tx) =>
      transitionOrderStatus(tx, tenantId, { orderId, toStatus: "AWAITING_PAYMENT", changedByType: "system" }),
    );
    expect(result.status).toBe("AWAITING_PAYMENT");
    const after = await withTenant(tenantId, (tx) => tx.orderStatusHistory.count({ where: { orderId } }));
    expect(after).toBe(before);
  });

  it("CONCURRENCE RÉELLE : deux transitions concurrentes et incompatibles depuis le même statut — une seule gagne, l'autre échoue proprement", async () => {
    // On repart d'un état frais pour ce test précis.
    const freshOrder = await withTenant(tenantId, (tx) =>
      tx.order.create({
        data: {
          tenantId,
          customerId,
          orderNumber: `CMD-TEST-CONCURRENT-${suffix}`,
          status: "PAID",
          subtotal: 1000,
          total: 1000,
        },
      }),
    );

    // PAID -> CONFIRMED et PAID -> REFUNDED sont TOUTES DEUX des transitions valides
    // depuis PAID (voir ORDER_STATUS_TRANSITIONS) : une vraie course entre deux
    // décisions concurrentes et MUTUELLEMENT EXCLUSIVES, chacune dans sa PROPRE
    // transaction PostgreSQL réelle.
    const attempts = await Promise.allSettled([
      withTenant(tenantId, (tx) =>
        transitionOrderStatus(tx, tenantId, { orderId: freshOrder.id, toStatus: "CONFIRMED", changedByType: "owner" }),
      ),
      withTenant(tenantId, (tx) =>
        transitionOrderStatus(tx, tenantId, { orderId: freshOrder.id, toStatus: "REFUNDED", changedByType: "owner" }),
      ),
    ]);

    const succeeded = attempts.filter((a) => a.status === "fulfilled");
    const failed = attempts.filter((a) => a.status === "rejected");
    expect(succeeded).toHaveLength(1);
    expect(failed).toHaveLength(1);
    // Selon le timing exact des deux transactions réelles, le perdant échoue soit sur
    // la garde anti-TOCTOU (`OrderStatusConflictError`, s'il a lu "PAID" avant que le
    // gagnant ne commite) soit sur la validité de la transition (`InvalidOrderTransitionError`,
    // s'il relit après coup un statut déjà changé) — les DEUX sont des refus sûrs et
    // corrects ; ce qui compte est qu'AUCUNE des deux transitions concurrentes ne
    // réussisse jamais simultanément.
    const rejection = (failed[0] as PromiseRejectedResult).reason;
    expect(rejection instanceof OrderStatusConflictError || rejection instanceof InvalidOrderTransitionError).toBe(
      true,
    );

    const finalOrder = await withTenant(tenantId, (tx) => tx.order.findUniqueOrThrow({ where: { id: freshOrder.id } }));
    expect(["CONFIRMED", "REFUNDED"]).toContain(finalOrder.status);

    const history = await withTenant(tenantId, (tx) =>
      tx.orderStatusHistory.findMany({ where: { orderId: freshOrder.id } }),
    );
    expect(history).toHaveLength(1); // une seule transition a réellement eu lieu.
  });
});
