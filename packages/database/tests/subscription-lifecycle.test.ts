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
 * CORRECTION DE STABILISATION (22 septembre 2026) — trouvé en exécutant réellement
 * cette suite pour la première fois : chaque test créait un "nouvel" abonnement pour
 * le MÊME tenant partagé, violant `TenantSubscription.tenantId @unique` dès le second
 * test (P2002). Corrigé en créant un TENANT DÉDIÉ par test (et DEUX tenants distincts
 * pour le test de balayage, qui a réellement besoin de deux abonnements simultanés).
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
  let planId: string;
  let saleCounter = 0;
  let tenantCounter = 0;
  const createdTenantIds: string[] = [];

  function nextSaleId() {
    saleCounter += 1;
    return `sale_lifecycle_${suffix}_${saleCounter}`;
  }

  async function createTestTenant() {
    tenantCounter += 1;
    const tenant = await withSuperAdminAccess((tx) =>
      tx.tenant.create({
        data: {
          slug: `test-sub-lifecycle-${suffix}-${tenantCounter}`,
          name: `Boutique Cycle de Vie ${tenantCounter}`,
          businessType: "ECOMMERCE",
          sectorKey,
          status: "ACTIVE",
        },
      }),
    );
    createdTenantIds.push(tenant.id);
    return tenant.id;
  }

  async function createSubscription(
    tenantId: string,
    overrides: { status: "ACTIVE" | "GRACE_PERIOD"; currentPeriodEnd: Date; graceEndsAt?: Date | null },
  ) {
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
      await owner.subscriptionEvent.deleteMany({ where: { tenantId: { in: createdTenantIds } } });
    } finally {
      await owner.$disconnect();
    }
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.is_super_admin', 'true', true)`;
      await tx.subscriptionPayment.deleteMany({ where: { tenantId: { in: createdTenantIds } } });
      await tx.tenantSubscription.deleteMany({ where: { tenantId: { in: createdTenantIds } } });
      await tx.tenant.deleteMany({ where: { id: { in: createdTenantIds } } });
      await tx.subscriptionPlan.deleteMany({ where: { id: planId } });
      await tx.sector.deleteMany({ where: { key: sectorKey } });
    });
  });

  it("ACTIVE avec échéance dépassée -> GRACE_PERIOD, graceEndsAt posé à partir de la formule (gracePeriodDays)", async () => {
    const tenantId = await createTestTenant();
    const pastEnd = new Date(Date.now() - 60_000); // dépassée d'une minute.
    const subscription = await createSubscription(tenantId, { status: "ACTIVE", currentPeriodEnd: pastEnd });

    const outcome = await evaluateSubscriptionLifecycle(tenantId, subscription.id);
    expect(outcome.outcome).toBe("grace_period_started");

    const updated = await withTenant(tenantId, (tx) => tx.tenantSubscription.findUniqueOrThrow({ where: { id: subscription.id } }));
    expect(updated.status).toBe("GRACE_PERIOD");
    expect(updated.graceEndsAt).not.toBeNull();
    const graceDays = (updated.graceEndsAt!.getTime() - pastEnd.getTime()) / 86_400_000;
    expect(graceDays).toBeCloseTo(3, 1); // gracePeriodDays de la formule.
  });

  it("ne touche PAS un abonnement ACTIVE dont l'échéance est encore dans le futur", async () => {
    const tenantId = await createTestTenant();
    const futureEnd = new Date(Date.now() + 10 * 86_400_000);
    const subscription = await createSubscription(tenantId, { status: "ACTIVE", currentPeriodEnd: futureEnd });

    const outcome = await evaluateSubscriptionLifecycle(tenantId, subscription.id);
    expect(outcome.outcome).toBe("no_change");

    const unchanged = await withTenant(tenantId, (tx) => tx.tenantSubscription.findUniqueOrThrow({ where: { id: subscription.id } }));
    expect(unchanged.status).toBe("ACTIVE");
  });

  it("GRACE_PERIOD dont la grâce est dépassée -> SUSPENDED", async () => {
    const tenantId = await createTestTenant();
    const subscription = await createSubscription(tenantId, {
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
    const tenantId = await createTestTenant();
    const subscription = await createSubscription(tenantId, {
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
    const tenantId = await createTestTenant();
    const subscription = await createSubscription(tenantId, {
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
    // la garde anti-TOCTOU rend l'un des deux un no-op sûr, jamais une exception. Un
    // paiement réel ne doit JAMAIS rester sans effet : `applyRenewalExtension` retente
    // jusqu'à 5 fois avec un état frais (voir subscription-registry.ts), ce qui
    // garantit `final.status === "ACTIVE"` dans TOUS les cas, y compris si le balayage
    // a transitoirement gagné (voir le commentaire ci-dessous).
    expect(paymentResult.status).toBe("fulfilled");
    expect(lifecycleResult.status).toBe("fulfilled");

    const final = await withTenant(tenantId, (tx) => tx.tenantSubscription.findUniqueOrThrow({ where: { id: subscription.id } }));
    expect(final.status).toBe("ACTIVE");
    expect(final.suspendedAt).toBeNull();

    // CORRECTION DE STABILISATION (bogue réel trouvé en exécutant ce test pour de vrai
    // contre PostgreSQL — jamais détecté avant faute d'exécution) : le balayage prend
    // désormais un verrou `FOR UPDATE NOWAIT` avant de suspendre et cède immédiatement
    // ("no_change") si la ligne est déjà tenue par une confirmation de paiement en
    // cours (voir subscription-lifecycle.ts et le test déterministe suivant, qui
    // prouve ce mécanisme sans dépendre du hasard de l'ordonnancement réel). Il
    // subsiste un cas limite IRRÉDUCTIBLE sans verrou distribué plus lourd : si le
    // balayage gagne la course d'ACQUISITION du verrou d'une fraction de milliseconde
    // — avant même que le paiement n'ait pu émettre sa propre demande de verrou — il
    // suspend légitimement, puis le paiement réactive immédiatement avec un état
    // frais. Le résultat final reste TOUJOURS correct (voir les deux assertions
    // ci-dessus) ; seule la trace d'audit contient alors une paire suspendu/réactivé
    // véridique. D'où le test tolérant les deux issues ici, complété par le test
    // déterministe suivant pour verrouiller le mécanisme lui-même.
    if (lifecycleResult.status === "fulfilled") {
      expect(["no_change", "suspended"]).toContain(lifecycleResult.value.outcome);
    }
  });

  it("COURSE CRITIQUE (déterministe) : le balayage cède immédiatement — jamais de suspension — si une confirmation de paiement tient déjà le verrou de la ligne", async () => {
    const tenantId = await createTestTenant();
    const subscription = await createSubscription(tenantId, {
      status: "GRACE_PERIOD",
      currentPeriodEnd: new Date(Date.now() - 5 * 86_400_000),
      graceEndsAt: new Date(Date.now() - 60_000),
    });

    // Reproduit, sans dépendre du hasard de l'ordonnancement réel (voir le test
    // précédent), le verrou `FOR UPDATE` que tient réellement `applyRenewalExtension`
    // pendant toute la durée de sa transaction — on le garde ouvert explicitement via
    // une porte contrôlée par le test, ce qui garantit que le balayage rencontre à
    // coup sûr la ligne verrouillée.
    let releaseLock: () => void = () => {};
    let lockTransactionDone: Promise<unknown> = Promise.resolve();
    const lockAcquired = new Promise<void>((resolveAcquired) => {
      lockTransactionDone = withTenant(tenantId, async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "TenantSubscription" WHERE "id" = ${subscription.id} FOR UPDATE`;
        resolveAcquired();
        await new Promise<void>((resolveRelease) => {
          releaseLock = resolveRelease;
        });
      });
    });
    await lockAcquired;

    const outcome = await evaluateSubscriptionLifecycle(tenantId, subscription.id);
    expect(outcome.outcome).toBe("no_change");

    const duringLock = await withTenant(tenantId, (tx) => tx.tenantSubscription.findUniqueOrThrow({ where: { id: subscription.id } }));
    expect(duringLock.status).toBe("GRACE_PERIOD");
    expect(duringLock.suspendedAt).toBeNull();

    releaseLock();
    await lockTransactionDone;
  });

  it("BALAYAGE : découvre les candidats cross-tenant et traite chaque abonnement dans sa propre transaction", async () => {
    const tenantAId = await createTestTenant();
    const tenantBId = await createTestTenant();
    const subA = await createSubscription(tenantAId, { status: "ACTIVE", currentPeriodEnd: new Date(Date.now() - 60_000) });
    const subB = await createSubscription(tenantBId, {
      status: "GRACE_PERIOD",
      currentPeriodEnd: new Date(Date.now() - 5 * 86_400_000),
      graceEndsAt: new Date(Date.now() - 60_000),
    });

    const candidates = await findLifecycleCandidates(100);
    const ids = candidates.map((c) => c.id);
    expect(ids).toContain(subA.id);
    expect(ids).toContain(subB.id);

    const result = await sweepSubscriptionLifecycle(100);
    expect(result.failed).toBe(0);
    expect(result.gracePeriodStarted).toBeGreaterThanOrEqual(1);
    expect(result.suspended).toBeGreaterThanOrEqual(1);

    const finalA = await withTenant(tenantAId, (tx) => tx.tenantSubscription.findUniqueOrThrow({ where: { id: subA.id } }));
    const finalB = await withTenant(tenantBId, (tx) => tx.tenantSubscription.findUniqueOrThrow({ where: { id: subB.id } }));
    expect(finalA.status).toBe("GRACE_PERIOD");
    expect(finalB.status).toBe("SUSPENDED");

    // Rejouer le balayage est un no-op sûr — ces deux abonnements ne réapparaissent
    // plus comme candidats immédiats (GRACE_PERIOD vient d'être posé avec une échéance
    // future, SUSPENDED n'est plus scruté par ce balayage).
    const idsStillCandidate = (await findLifecycleCandidates(100)).map((c) => c.id);
    expect(idsStillCandidate).not.toContain(subB.id);
  });
});
