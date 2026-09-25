import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../src/client";
import { withSuperAdminAccess, withTenant } from "../src/tenant-context";
import { testOwnerClient } from "./test-owner-client";
import { confirmSubscriptionPaymentSuccess, cancelSubscription } from "../src/subscription-registry";

/**
 * Vérifie la formule de renouvellement UNIQUE (voir subscription-registry.ts) contre
 * PostgreSQL réel : `newPeriodEnd = ajouterJours(max(maintenant, currentPeriodEnd),
 * dureeDuCycle)`. Couvre les exigences explicites du plan approuvé : double clic
 * "Renouveler", renouvellement anticipé (jours prépayés conservés), paiement après
 * expiration, renouvellements concurrents.
 *
 * CORRECTION DE STABILISATION (22 septembre 2026) — trouvé en exécutant réellement
 * cette suite pour la première fois (voir la demande de stabilisation) : chaque test
 * créait un "nouvel" abonnement pour le MÊME tenant partagé, ce qui viole
 * `TenantSubscription.tenantId @unique` dès le second test (P2002). Corrigé en créant
 * un TENANT DÉDIÉ par test (la formule, elle, reste partagée — aucune contrainte
 * d'unicité ne l'en empêche) : chaque scénario est ainsi réellement indépendant,
 * comme il l'aurait toujours dû être vu la contrainte réelle du schéma.
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
      "REQUIRE_DB_TESTS=true mais PostgreSQL est injoignable : la suite confirmSubscriptionPaymentSuccess " +
        `DOIT s'exécuter en CI. Cause : ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  databaseAvailable = false;
  // eslint-disable-next-line no-console
  console.warn("[subscription-registry.test] Base de données injoignable — suite ignorée (skip).");
}

describe.skipIf(!databaseAvailable)("confirmSubscriptionPaymentSuccess (réel, PostgreSQL)", () => {
  const suffix = Date.now();
  const sectorKey = `test-sector-subscription-registry-${suffix}`;
  let planId: string;
  let saleCounter = 0;
  let tenantCounter = 0;
  const createdTenantIds: string[] = [];

  function nextSaleId() {
    saleCounter += 1;
    return `sale_${suffix}_${saleCounter}`;
  }

  /** Un tenant DÉDIÉ par appel — voir la note de tête de fichier : `tenantId` est
   *  `@unique` sur `TenantSubscription`, jamais un état partageable entre tests
   *  voulant chacun "un abonnement fraîchement créé". */
  async function createTestTenant() {
    tenantCounter += 1;
    const tenant = await withSuperAdminAccess((tx) =>
      tx.tenant.create({
        data: {
          slug: `test-sub-registry-${suffix}-${tenantCounter}`,
          name: `Boutique Renouvellement ${tenantCounter}`,
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
    overrides: Partial<{ status: "PENDING" | "ACTIVE" | "SUSPENDED" | "CANCELED" | "EXPIRED"; currentPeriodEnd: Date }> = {},
  ) {
    return withTenant(tenantId, (tx) =>
      tx.tenantSubscription.create({
        data: {
          tenantId,
          planId,
          status: overrides.status ?? "PENDING",
          billingCycle: "MONTHLY",
          currentPeriodStart: new Date(),
          currentPeriodEnd: overrides.currentPeriodEnd ?? new Date(),
        },
      }),
    );
  }

  beforeAll(async () => {
    await withSuperAdminAccess(async (tx) => {
      await tx.sector.create({ data: { key: sectorKey, name: "Secteur de test", defaultModuleKeys: [], isSystem: false } });
      const plan = await tx.subscriptionPlan.create({
        data: {
          name: `Formule Test Renouvellement ${suffix}`,
          status: "PUBLISHED",
          priceMonthly: 15_000,
          priceYearly: 150_000,
          monthlyDurationDays: 30,
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

  it("premier paiement : PENDING -> ACTIVE, période posée à ~30 jours à partir de maintenant", async () => {
    const tenantId = await createTestTenant();
    const subscription = await createSubscription(tenantId, { status: "PENDING", currentPeriodEnd: new Date() });
    const saleId = nextSaleId();

    const result = await withTenant(tenantId, (tx) =>
      confirmSubscriptionPaymentSuccess(tx, tenantId, {
        subscriptionId: subscription.id,
        provider: "manual",
        providerSaleId: saleId,
        planId,
        billingCycle: "MONTHLY",
        amountXOF: 15_000,
        currency: "XOF",
      }),
    );

    expect(result.outcome).toBe("confirmed");
    expect(result.subscription.status).toBe("ACTIVE");
    const daysUntilExpiry = (result.subscription.currentPeriodEnd.getTime() - Date.now()) / 86_400_000;
    expect(daysUntilExpiry).toBeGreaterThan(29);
    expect(daysUntilExpiry).toBeLessThan(31);
    expect(result.payment.status).toBe("SUCCEEDED");
    expect(result.payment.periodExtensionDays).toBe(30);
  });

  it("RENOUVELLEMENT ANTICIPÉ : encore ACTIVE et loin de l'échéance — les jours prépayés ne sont JAMAIS perdus", async () => {
    const tenantId = await createTestTenant();
    const farFutureEnd = new Date(Date.now() + 20 * 86_400_000); // encore 20 jours payés d'avance.
    const subscription = await createSubscription(tenantId, { status: "ACTIVE", currentPeriodEnd: farFutureEnd });

    const result = await withTenant(tenantId, (tx) =>
      confirmSubscriptionPaymentSuccess(tx, tenantId, {
        subscriptionId: subscription.id,
        provider: "manual",
        providerSaleId: nextSaleId(),
        planId,
        billingCycle: "MONTHLY",
        amountXOF: 15_000,
        currency: "XOF",
      }),
    );

    // Base = currentPeriodEnd EXISTANT (dans le futur), jamais "maintenant" : la
    // nouvelle échéance doit être ~20+30 = 50 jours dans le futur, pas seulement 30.
    const daysUntilExpiry = (result.subscription.currentPeriodEnd.getTime() - Date.now()) / 86_400_000;
    expect(daysUntilExpiry).toBeGreaterThan(49);
    expect(daysUntilExpiry).toBeLessThan(51);
  });

  it("PAIEMENT APRÈS EXPIRATION (abonnement SUSPENDU) : réactive, mais ne compte JAMAIS le temps déjà écoulé impayé comme payé", async () => {
    const tenantId = await createTestTenant();
    const longPastEnd = new Date(Date.now() - 60 * 86_400_000); // suspendu depuis longtemps.
    const subscription = await createSubscription(tenantId, { status: "SUSPENDED", currentPeriodEnd: longPastEnd });

    const result = await withTenant(tenantId, (tx) =>
      confirmSubscriptionPaymentSuccess(tx, tenantId, {
        subscriptionId: subscription.id,
        provider: "manual",
        providerSaleId: nextSaleId(),
        planId,
        billingCycle: "MONTHLY",
        amountXOF: 15_000,
        currency: "XOF",
      }),
    );

    expect(result.subscription.status).toBe("ACTIVE");
    expect(result.subscription.suspendedAt).toBeNull();
    // Base = MAINTENANT (l'échéance passée est ignorée), jamais longPastEnd + 30j (ce
    // qui donnerait une échéance ENCORE dans le passé, un bug qui laisserait
    // l'abonnement suspendu malgré un paiement réel).
    const daysUntilExpiry = (result.subscription.currentPeriodEnd.getTime() - Date.now()) / 86_400_000;
    expect(daysUntilExpiry).toBeGreaterThan(29);
    expect(daysUntilExpiry).toBeLessThan(31);
  });

  it("ANNULATION PUIS RÉACTIVATION : un tenant annulé peut toujours se réabonner (TenantSubscription.tenantId est @unique)", async () => {
    const tenantId = await createTestTenant();
    const subscription = await createSubscription(tenantId, { status: "ACTIVE", currentPeriodEnd: new Date(Date.now() + 10 * 86_400_000) });
    await withTenant(tenantId, (tx) => cancelSubscription(tx, tenantId, subscription.id, { actorType: "tenant_owner" }));

    const canceled = await withTenant(tenantId, (tx) => tx.tenantSubscription.findUniqueOrThrow({ where: { id: subscription.id } }));
    expect(canceled.status).toBe("CANCELED");
    expect(canceled.canceledAt).not.toBeNull();

    const result = await withTenant(tenantId, (tx) =>
      confirmSubscriptionPaymentSuccess(tx, tenantId, {
        subscriptionId: subscription.id,
        provider: "manual",
        providerSaleId: nextSaleId(),
        planId,
        billingCycle: "MONTHLY",
        amountXOF: 15_000,
        currency: "XOF",
      }),
    );
    expect(result.subscription.status).toBe("ACTIVE");
    expect(result.subscription.canceledAt).toBeNull();
  });

  it("DOUBLE CLIC (même providerSaleId rejoué) : already_confirmed, jamais une double extension", async () => {
    const tenantId = await createTestTenant();
    const subscription = await createSubscription(tenantId, { status: "PENDING", currentPeriodEnd: new Date() });
    const saleId = nextSaleId();

    const input = {
      subscriptionId: subscription.id,
      provider: "manual",
      providerSaleId: saleId,
      planId,
      billingCycle: "MONTHLY" as const,
      amountXOF: 15_000,
      currency: "XOF",
    };

    const first = await withTenant(tenantId, (tx) => confirmSubscriptionPaymentSuccess(tx, tenantId, input));
    expect(first.outcome).toBe("confirmed");

    const second = await withTenant(tenantId, (tx) => confirmSubscriptionPaymentSuccess(tx, tenantId, input));
    expect(second.outcome).toBe("already_confirmed");
    expect(second.subscription.currentPeriodEnd.getTime()).toBe(first.subscription.currentPeriodEnd.getTime());

    const payments = await withTenant(tenantId, (tx) => tx.subscriptionPayment.count({ where: { subscriptionId: subscription.id } }));
    expect(payments).toBe(1); // jamais un second paiement pour le même rejeu.
  });

  it("PROLONGATION MANUELLE SUPER ADMIN : réutilise la MÊME formule de renouvellement, journalise l'acteur et la justification", async () => {
    // Reproduit exactement l'appel fait par la route Super Admin
    // (apps/web/app/api/admin/billing/subscriptions/[id]/extend/route.ts) — un
    // paiement reçu hors ligne (virement, espèces) suit la MÊME fonction et la MÊME
    // formule qu'un webhook Chariow réel, jamais une seconde branche de calcul.
    const tenantId = await createTestTenant();
    const longPastEnd = new Date(Date.now() - 10 * 86_400_000);
    const subscription = await createSubscription(tenantId, { status: "SUSPENDED", currentPeriodEnd: longPastEnd });

    const result = await withTenant(tenantId, (tx) =>
      confirmSubscriptionPaymentSuccess(tx, tenantId, {
        subscriptionId: subscription.id,
        provider: "manual",
        providerSaleId: nextSaleId(),
        planId,
        billingCycle: "MONTHLY",
        amountXOF: 15_000,
        currency: "XOF",
        actor: {
          actorType: "super_admin",
          actorUserId: "super-admin-test-user",
          justification: "Virement Wave reçu hors ligne le 24/09/2026, confirmé par le service comptable.",
        },
      }),
    );

    expect(result.subscription.status).toBe("ACTIVE");
    expect(result.subscription.suspendedAt).toBeNull();
    const daysUntilExpiry = (result.subscription.currentPeriodEnd.getTime() - Date.now()) / 86_400_000;
    expect(daysUntilExpiry).toBeGreaterThan(29); // base = maintenant (échéance déjà passée), jamais longPastEnd + 30j.
    expect(daysUntilExpiry).toBeLessThan(31);

    const event = await withTenant(tenantId, (tx) =>
      tx.subscriptionEvent.findFirstOrThrow({ where: { subscriptionId: subscription.id, type: "reactivated" } }),
    );
    expect(event.actorType).toBe("super_admin");
    expect(event.actorUserId).toBe("super-admin-test-user");
    expect(event.justification).toContain("Virement Wave");
  });

  it("RENOUVELLEMENTS CONCURRENTS : deux ventes RÉELLES et DISTINCTES arrivant en même temps DOIVENT TOUTES LES DEUX prolonger la période — aucune n'est traitée comme un rejeu de l'autre", async () => {
    const tenantId = await createTestTenant();
    const subscription = await createSubscription(tenantId, { status: "ACTIVE", currentPeriodEnd: new Date(Date.now() + 5 * 86_400_000) });
    const saleA = nextSaleId();
    const saleB = nextSaleId();

    const [resultA, resultB] = await Promise.all([
      withTenant(tenantId, (tx) =>
        confirmSubscriptionPaymentSuccess(tx, tenantId, {
          subscriptionId: subscription.id,
          provider: "manual",
          providerSaleId: saleA,
          planId,
          billingCycle: "MONTHLY",
          amountXOF: 15_000,
          currency: "XOF",
        }),
      ),
      withTenant(tenantId, (tx) =>
        confirmSubscriptionPaymentSuccess(tx, tenantId, {
          subscriptionId: subscription.id,
          provider: "manual",
          providerSaleId: saleB,
          planId,
          billingCycle: "MONTHLY",
          amountXOF: 15_000,
          currency: "XOF",
        }),
      ),
    ]);

    expect(resultA.outcome).toBe("confirmed");
    expect(resultB.outcome).toBe("confirmed");

    // Les DEUX paiements ont réellement prolongé : 5 (restant) + 30 + 30 = 65 jours,
    // jamais seulement 35 (ce qui signifierait qu'un des deux paiements réels a été
    // silencieusement perdu par la course).
    const final = await withTenant(tenantId, (tx) => tx.tenantSubscription.findUniqueOrThrow({ where: { id: subscription.id } }));
    const daysUntilExpiry = (final.currentPeriodEnd.getTime() - Date.now()) / 86_400_000;
    expect(daysUntilExpiry).toBeGreaterThan(64);
    expect(daysUntilExpiry).toBeLessThan(66);

    const payments = await withTenant(tenantId, (tx) => tx.subscriptionPayment.count({ where: { subscriptionId: subscription.id } }));
    expect(payments).toBe(2); // les deux ventes distinctes sont bien deux paiements distincts.
  });
});
