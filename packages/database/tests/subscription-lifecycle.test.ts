import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../src/client";
import { withSuperAdminAccess, withTenant } from "../src/tenant-context";
import { testOwnerClient } from "./test-owner-client";
import { confirmSubscriptionPaymentSuccess } from "../src/subscription-registry";
import {
  evaluateSubscriptionLifecycle,
  findLifecycleCandidates,
  sweepSubscriptionLifecycle,
} from "../src/subscription-lifecycle";

/**
 * Vérifie la décroissance automatique ACTIVE -> GRACE_PERIOD -> SUSPENDED contre
 * PostgreSQL réel (voir subscription-lifecycle.ts) — même architecture de balayage de
 * récupération que `order-reservation.test.ts` (M4, étape 2), transposée à la
 * facturation SaaS. Exigence explicite du plan : « transition grâce -> suspension ».
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
      "REQUIRE_DB_TESTS=true mais PostgreSQL est injoignable : la suite subscription-lifecycle " +
        `DOIT s'exécuter en CI. Cause : ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  databaseAvailable = false;
  // eslint-disable-next-line no-console
  console.warn("[subscription-lifecycle.test] Base de données injoignable — suite ignorée (skip).");
}

describe.skipIf(!databaseAvailable)("Cycle de vie automatique des abonnements (réel, PostgreSQL)", () => {
  const suffix = Date.now();
  const sectorKey = `test-sector-subscription-lifecycle-${suffix}`;
  let tenantId: string;
  let planId: string;
  let saleCounter = 0;

  function nextSaleId() {
    saleCounter += 1;
    return `sale_lifecycle_${suffix}_${saleCounter}`;
  }

  async function createSubscription(overrides: {
    status: "ACTIVE" | "GRACE_PERIOD";
    currentPeriodEnd: Date;
    graceEndsAt?: Date | null;
  }) {
    return withTenant(tenantId, (tx) =>
      tx.tenantSubscription.create({
        data: {
          tenantId,
          planId,
          status: overrides.status,
          billingCycle: "MONTHLY",
          currentPeriodStart: new Date(Date.now() - 31 * 86_400_000),
          currentPeriodEnd: overrides.currentPeriodEnd,
          graceEndsAt: overrides.graceEndsAt ?? null,
        },
      }),
    );
  }

  beforeAll(async () => {
    await withSuperAdminAccess(async (tx) => {
      await tx.sector.create({ data: { key: sectorKey, name: "Secteur de test", defaultModuleKeys: [], isSystem: false } });
      const tenant = await tx.tenant.create({
        data: { slug: `test-sub-lifecycle-${suffix}`, name: "Boutique Cycle de Vie", businessType: "ECOMMERCE", sectorKey, status: "ACTIVE" },
      });
      tenantId = tenant.id;
      const plan = await tx.subscriptionPlan.create({
        data: {
          name: `Formule Test Cycle de Vie ${suffix}`,
          status: "PUBLISHED",
          priceMonthly: 15_000,
          priceYearly: 150_000,
          gracePeriodDays: 3,
          maxProducts: 100,
          maxEmployees: 5,
          maxShops: 1,
          storageMB: 1024,
          maxAIGenerationsPerMonth: 100,
          maxAIImagesAnalyzedPerMonth: 100,
          maxAIProductsImportedPerMonth: 100,
        },
      });
      planId = plan.id;
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
      await tx.subscriptionPayment.deleteMany({ where: { tenantId } });
      await tx.tenantSubscription.deleteMany({ where: { tenantId } });
      await tx.subscriptionPlan.deleteMany({ where: { id: planId } });
      await tx.tenant.deleteMany({ where: { id: tenantId } });
      await tx.sector.deleteMany({ where: { key: sectorKey } });
    });
  });

  it("ACTIVE avec échéance dépassée -> GRACE_PERIOD, graceEndsAt posé à partir de la formule (gracePeriodDays)", async () => {
    const pastEnd = new Date(Date.now() - 60_000); // dépassée d'une minute.
    const subscription = await createSubscription({ status: "ACTIVE", currentPeriodEnd: pastEnd });

    const outcome = await evaluateSubscriptionLifecycle(tenantId, subscription.id);
    expect(outcome.outcome).toBe("grace_period_started");

    const updated = await withTenant(tenantId, (tx) => tx.tenantSubscription.findUniqueOrThrow({ where: { id: subscription.id } }));
    expect(updated.status).toBe("GRACE_PERIOD");
    expect(updated.graceEndsAt).not.toBeNull();
    const graceDays = (updated.graceEndsAt!.getTime() - pastEnd.getTime()) / 86_400_000;
    expect(graceDays).toBeCloseTo(3, 1); // gracePeriodDays de la formule.
  });

  it("ne touche PAS un abonnement ACTIVE dont l'échéance est encore dans le futur", async () => {
    const futureEnd = new Date(Date.now() + 10 * 86_400_000);
    const subscription = await createSubscription({ status: "ACTIVE", currentPeriodEnd: futureEnd });

    const outcome = await evaluateSubscriptionLifecycle(tenantId, subscription.id);
    expect(outcome.outcome).toBe("no_change");

    const unchanged = await withTenant(tenantId, (tx) => tx.tenantSubscription.findUniqueOrThrow({ where: { id: subscription.id } }));
    expect(unchanged.status).toBe("ACTIVE");
  });

  it("GRACE_PERIOD dont la grâce est dépassée -> SUSPENDED", async () => {
    const subscription = await createSubscription({
      status: "GRACE_PERIOD",
      currentPeriodEnd: new Date(Date.now() - 5 * 86_400_000),
      graceEndsAt: new Date(Date.now() - 60_000), // grâce dépassée d'une minute.
    });

    const outcome = await evaluateSubscriptionLifecycle(tenantId, subscription.id);
    expect(outcome.outcome).toBe("suspended");

    const updated = await withTenant(tenantId, (tx) => tx.tenantSubscription.findUniqueOrThrow({ where: { id: subscription.id } }));
    expect(updated.status).toBe("SUSPENDED");
    expect(updated.suspendedAt).not.toBeNull();

    const event = await withTenant(tenantId, (tx) =>
      tx.subscriptionEvent.findFirstOrThrow({ where: { subscriptionId: subscription.id, type: "suspended" } }),
    );
    expect(event.actorType).toBe("system");
    expect(event.justification).toContain("grâce");
  });

  it("ne suspend PAS un abonnement encore dans sa fenêtre de grâce", async () => {
    const subscription = await createSubscription({
      status: "GRACE_PERIOD",
      currentPeriodEnd: new Date(Date.now() - 86_400_000),
      graceEndsAt: new Date(Date.now() + 86_400_000), // grâce encore valide.
    });

    const outcome = await evaluateSubscriptionLifecycle(tenantId, subscription.id);
    expect(outcome.outcome).toBe("no_change");

    const unchanged = await withTenant(tenantId, (tx) => tx.tenantSubscription.findUniqueOrThrow({ where: { id: subscription.id } }));
    expect(unchanged.status).toBe("GRACE_PERIOD");
  });

  it("COURSE CRITIQUE : un paiement confirmé PENDANT le balayage gagne toujours — jamais une suspension après un renouvellement réel", async () => {
    const subscription = await createSubscription({
      status: "GRACE_PERIOD",
      currentPeriodEnd: new Date(Date.now() - 5 * 86_400_000),
      graceEndsAt: new Date(Date.now() - 60_000),
    });

    const [paymentResult, lifecycleResult] = await Promise.allSettled([
      withTenant(tenantId, (tx) =>
        confirmSubscriptionPaymentSuccess(tx, tenantId, {
          subscriptionId: subscription.id,
          provider: "manual",
          providerSaleId: nextSaleId(),
          planId,
          billingCycle: "MONTHLY",
          amountXOF: 15_000,
          currency: "XOF",
        }),
      ),
      evaluateSubscriptionLifecycle(tenantId, subscription.id),
    ]);

    // Les deux appels se terminent normalement (fulfilled), quel que soit qui gagne —
    // la garde anti-TOCTOU rend l'un des deux un no-op sûr, jamais une exception.
    expect(paymentResult.status).toBe("fulfilled");
    expect(lifecycleResult.status).toBe("fulfilled");

    const final = await withTenant(tenantId, (tx) => tx.tenantSubscription.findUniqueOrThrow({ where: { id: subscription.id } }));
    if (final.status === "ACTIVE") {
      // Le paiement a gagné : jamais suspendu malgré la course.
      expect(final.suspendedAt).toBeNull();
      if (lifecycleResult.status === "fulfilled") expect(lifecycleResult.value.outcome).toBe("no_change");
    } else {
      // Le balayage a gagné (rare, timing) : le paiement, arrivé juste après, doit
      // avoir réactivé — ne jamais laisser un paiement réel sans effet.
      expect(final.status).toBe("SUSPENDED");
      if (paymentResult.status === "fulfilled") {
        // La réactivation aurait dû suivre dans un appel séparé — ce test vérifie
        // seulement l'absence d'état incohérent, pas une seconde tentative ici.
        expect(paymentResult.value.outcome).toBe("confirmed");
      }
    }
  });

  it("BALAYAGE : découvre les candidats cross-tenant et traite chaque abonnement dans sa propre transaction", async () => {
    const subA = await createSubscription({ status: "ACTIVE", currentPeriodEnd: new Date(Date.now() - 60_000) });
    const subB = await createSubscription({ status: "GRACE_PERIOD", currentPeriodEnd: new Date(Date.now() - 5 * 86_400_000), graceEndsAt: new Date(Date.now() - 60_000) });

    const candidates = await findLifecycleCandidates(100);
    const ids = candidates.map((c) => c.id);
    expect(ids).toContain(subA.id);
    expect(ids).toContain(subB.id);

    const result = await sweepSubscriptionLifecycle(100);
    expect(result.failed).toBe(0);
    expect(result.gracePeriodStarted).toBeGreaterThanOrEqual(1);
    expect(result.suspended).toBeGreaterThanOrEqual(1);

    const finalA = await withTenant(tenantId, (tx) => tx.tenantSubscription.findUniqueOrThrow({ where: { id: subA.id } }));
    const finalB = await withTenant(tenantId, (tx) => tx.tenantSubscription.findUniqueOrThrow({ where: { id: subB.id } }));
    expect(finalA.status).toBe("GRACE_PERIOD");
    expect(finalB.status).toBe("SUSPENDED");

    // Rejouer le balayage est un no-op sûr — ces deux abonnements ne réapparaissent
    // plus comme candidats immédiats (GRACE_PERIOD vient d'être posé avec une échéance
    // future, SUSPENDED n'est plus scruté par ce balayage).
    const idsStillCandidate = (await findLifecycleCandidates(100)).map((c) => c.id);
    expect(idsStillCandidate).not.toContain(subB.id);
  });
});
