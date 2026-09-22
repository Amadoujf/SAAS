import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../src/client";
import { withSuperAdminAccess, withTenant } from "../src/tenant-context";
import { testOwnerClient } from "./test-owner-client";
import {
  InvalidSubscriptionTransitionError,
  SubscriptionStatusConflictError,
  isValidSubscriptionTransition,
  transitionSubscriptionStatus,
} from "../src/subscription-status";

describe("Table d'adjacence des statuts d'abonnement SaaS (pure)", () => {
  it("autorise la progression normale d'un cycle de vie payé", () => {
    expect(isValidSubscriptionTransition("PENDING", "ACTIVE")).toBe(true);
    expect(isValidSubscriptionTransition("TRIALING", "ACTIVE")).toBe(true);
    expect(isValidSubscriptionTransition("ACTIVE", "GRACE_PERIOD")).toBe(true);
    expect(isValidSubscriptionTransition("GRACE_PERIOD", "SUSPENDED")).toBe(true);
    expect(isValidSubscriptionTransition("SUSPENDED", "EXPIRED")).toBe(true);
  });

  it("permet TOUJOURS une réactivation par paiement, même depuis les états les plus dégradés — TenantSubscription.tenantId est @unique, il n'existe aucune autre façon pour ce tenant de se réabonner un jour", () => {
    expect(isValidSubscriptionTransition("GRACE_PERIOD", "ACTIVE")).toBe(true);
    expect(isValidSubscriptionTransition("SUSPENDED", "ACTIVE")).toBe(true);
    expect(isValidSubscriptionTransition("EXPIRED", "ACTIVE")).toBe(true);
    expect(isValidSubscriptionTransition("CANCELED", "ACTIVE")).toBe(true);
  });

  it("refuse de sauter directement de ACTIVE à SUSPENDED sans passer par la grâce", () => {
    expect(isValidSubscriptionTransition("ACTIVE", "SUSPENDED")).toBe(false);
  });

  it("l'annulation explicite est possible depuis n'importe quel état non déjà annulé", () => {
    expect(isValidSubscriptionTransition("ACTIVE", "CANCELED")).toBe(true);
    expect(isValidSubscriptionTransition("GRACE_PERIOD", "CANCELED")).toBe(true);
    expect(isValidSubscriptionTransition("SUSPENDED", "CANCELED")).toBe(true);
  });
});

let databaseAvailable = true;
try {
  await prisma.$queryRaw`SELECT 1`;
} catch (error) {
  if (process.env.REQUIRE_DB_TESTS === "true") {
    throw new Error(
      "REQUIRE_DB_TESTS=true mais PostgreSQL est injoignable : la suite transitionSubscriptionStatus " +
        `DOIT s'exécuter en CI. Cause : ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  databaseAvailable = false;
  // eslint-disable-next-line no-console
  console.warn("[subscription-status.test] Base de données injoignable — suite ignorée (skip).");
}

describe.skipIf(!databaseAvailable)("transitionSubscriptionStatus (réel, PostgreSQL)", () => {
  const suffix = Date.now();
  const sectorKey = `test-sector-subscription-status-${suffix}`;
  let tenantId: string;
  let planId: string;
  let subscriptionId: string;

  beforeAll(async () => {
    await withSuperAdminAccess(async (tx) => {
      await tx.sector.create({ data: { key: sectorKey, name: "Secteur de test", defaultModuleKeys: [], isSystem: false } });
      const tenant = await tx.tenant.create({
        data: { slug: `test-sub-status-${suffix}`, name: "Boutique Statuts Abonnement", businessType: "ECOMMERCE", sectorKey, status: "ACTIVE" },
      });
      tenantId = tenant.id;
      const plan = await tx.subscriptionPlan.create({
        data: {
          name: `Formule Test Statuts ${suffix}`,
          status: "PUBLISHED",
          priceMonthly: 10_000,
          priceYearly: 100_000,
          maxProducts: 50,
          maxEmployees: 3,
          maxShops: 1,
          storageMB: 512,
          maxAIGenerationsPerMonth: 50,
          maxAIImagesAnalyzedPerMonth: 50,
          maxAIProductsImportedPerMonth: 50,
        },
      });
      planId = plan.id;
    });

    await withTenant(tenantId, async (tx) => {
      const subscription = await tx.tenantSubscription.create({
        data: { tenantId, planId, status: "ACTIVE", billingCycle: "MONTHLY", currentPeriodStart: new Date(), currentPeriodEnd: new Date(Date.now() + 30 * 86_400_000) },
      });
      subscriptionId = subscription.id;
    });
  });

  afterAll(async () => {
    const owner = testOwnerClient();
    try {
      await owner.subscriptionEvent.deleteMany({ where: { tenantId } });
    } finally {
      await owner.$disconnect();
    }
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.is_super_admin', 'true', true)`;
      await tx.tenantSubscription.deleteMany({ where: { tenantId } });
      await tx.subscriptionPlan.deleteMany({ where: { id: planId } });
      await tx.tenant.deleteMany({ where: { id: tenantId } });
      await tx.sector.deleteMany({ where: { key: sectorKey } });
    });
  });

  it("effectue une transition valide et écrit un SubscriptionEvent", async () => {
    const updated = await withTenant(tenantId, (tx) =>
      transitionSubscriptionStatus(tx, tenantId, {
        subscriptionId,
        toStatus: "GRACE_PERIOD",
        actorType: "system",
        eventType: "grace_period_started",
      }),
    );
    expect(updated.status).toBe("GRACE_PERIOD");

    const events = await withTenant(tenantId, (tx) => tx.subscriptionEvent.findMany({ where: { subscriptionId } }));
    expect(events).toHaveLength(1);
    expect(events[0]?.type).toBe("grace_period_started");
    expect(events[0]?.actorType).toBe("system");
  });

  it("refuse une transition illégale, n'écrit aucun événement supplémentaire", async () => {
    await expect(
      withTenant(tenantId, (tx) =>
        transitionSubscriptionStatus(tx, tenantId, { subscriptionId, toStatus: "PAST_DUE", actorType: "system", eventType: "x" }),
      ),
    ).rejects.toThrow(InvalidSubscriptionTransitionError);

    const events = await withTenant(tenantId, (tx) => tx.subscriptionEvent.count({ where: { subscriptionId } }));
    expect(events).toBe(1); // toujours celui du test précédent, rien de plus.
  });

  it("une auto-transition (déjà dans cet état) est un no-op réussi, sans nouvel événement", async () => {
    const before = await withTenant(tenantId, (tx) => tx.subscriptionEvent.count({ where: { subscriptionId } }));
    const result = await withTenant(tenantId, (tx) =>
      transitionSubscriptionStatus(tx, tenantId, { subscriptionId, toStatus: "GRACE_PERIOD", actorType: "system", eventType: "grace_period_started" }),
    );
    expect(result.status).toBe("GRACE_PERIOD");
    const after = await withTenant(tenantId, (tx) => tx.subscriptionEvent.count({ where: { subscriptionId } }));
    expect(after).toBe(before);
  });

  it("justification Super Admin correctement journalisée pour une action manuelle", async () => {
    const updated = await withTenant(tenantId, (tx) =>
      transitionSubscriptionStatus(tx, tenantId, {
        subscriptionId,
        toStatus: "SUSPENDED",
        actorType: "super_admin",
        actorUserId: "user-admin-1",
        justification: "Litige de paiement signalé par le client — suspension conservatoire.",
        eventType: "suspended",
      }),
    );
    expect(updated.status).toBe("SUSPENDED");
    expect(updated.suspendedAt).not.toBeNull();

    const event = await withTenant(tenantId, (tx) =>
      tx.subscriptionEvent.findFirstOrThrow({ where: { subscriptionId, type: "suspended" } }),
    );
    expect(event.actorType).toBe("super_admin");
    expect(event.actorUserId).toBe("user-admin-1");
    expect(event.justification).toContain("Litige de paiement");
  });

  it("CONCURRENCE RÉELLE : deux transitions concurrentes et mutuellement exclusives depuis le même statut — une seule gagne", async () => {
    const fresh = await withTenant(tenantId, (tx) =>
      tx.tenantSubscription.create({
        data: {
          tenantId,
          planId,
          status: "GRACE_PERIOD",
          billingCycle: "MONTHLY",
          currentPeriodStart: new Date(Date.now() - 31 * 86_400_000),
          currentPeriodEnd: new Date(Date.now() - 86_400_000),
          graceEndsAt: new Date(Date.now() + 86_400_000),
        },
      }),
    );

    // GRACE_PERIOD -> ACTIVE (réactivation par paiement) et GRACE_PERIOD -> SUSPENDED
    // (fin de grâce détectée par le balayage) sont TOUTES DEUX valides depuis
    // GRACE_PERIOD : une vraie course entre deux décisions concurrentes.
    const attempts = await Promise.allSettled([
      withTenant(tenantId, (tx) =>
        transitionSubscriptionStatus(tx, tenantId, { subscriptionId: fresh.id, toStatus: "ACTIVE", actorType: "webhook", eventType: "reactivated" }),
      ),
      withTenant(tenantId, (tx) =>
        transitionSubscriptionStatus(tx, tenantId, { subscriptionId: fresh.id, toStatus: "SUSPENDED", actorType: "system", eventType: "suspended" }),
      ),
    ]);

    const succeeded = attempts.filter((a) => a.status === "fulfilled");
    const failed = attempts.filter((a) => a.status === "rejected");
    expect(succeeded).toHaveLength(1);
    expect(failed).toHaveLength(1);
    const rejection = (failed[0] as PromiseRejectedResult).reason;
    expect(rejection instanceof SubscriptionStatusConflictError).toBe(true);

    const final = await withTenant(tenantId, (tx) => tx.tenantSubscription.findUniqueOrThrow({ where: { id: fresh.id } }));
    expect(["ACTIVE", "SUSPENDED"]).toContain(final.status);

    const events = await withTenant(tenantId, (tx) => tx.subscriptionEvent.findMany({ where: { subscriptionId: fresh.id } }));
    expect(events).toHaveLength(1); // une seule transition a réellement eu lieu.
  });
});
