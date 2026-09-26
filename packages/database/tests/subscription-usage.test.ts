import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../src/client";
import { withSuperAdminAccess, withTenant } from "../src/tenant-context";
import { assertQuotaAvailable, resolveEffectiveLimit, QuotaExceededError } from "../src/subscription-usage";

/**
 * Vérifie l'application RÉELLE des quotas de formule contre PostgreSQL — voir
 * docs/14-facturation-saas-abonnements.md, décision #5. Couvre : comptage direct
 * (jamais un compteur dupliqué), rejet exact à la limite (le (N+1)ᵉ appel échoue),
 * dérogation Super Admin prioritaire sur la formule.
 *
 * CORRECTION DE STABILISATION (22 septembre 2026) : l'absence de `TenantSubscription`
 * BLOQUE désormais par défaut (limite = 0) — « aucune souscription = accès illimité »
 * était un contournement possible de la facturation (supprimer/perdre la ligne
 * d'abonnement). La SEULE échappatoire est `Tenant.billingExemptedAt`, une dérogation
 * Super Admin explicite et tracée pour un tenant antérieur à cette étape.
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
      "REQUIRE_DB_TESTS=true mais PostgreSQL est injoignable : la suite subscription-usage " +
        `DOIT s'exécuter en CI. Cause : ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  databaseAvailable = false;
  // eslint-disable-next-line no-console
  console.warn("[subscription-usage.test] Base de données injoignable — suite ignorée (skip).");
}

describe.skipIf(!databaseAvailable)("Quotas de formule (réel, PostgreSQL)", () => {
  const suffix = Date.now();
  const sectorKey = `test-sector-subscription-usage-${suffix}`;
  let tenantWithPlanId: string;
  let tenantWithoutSubscriptionId: string;
  let planId: string;

  beforeAll(async () => {
    await withSuperAdminAccess(async (tx) => {
      await tx.sector.create({ data: { key: sectorKey, name: "Secteur de test", defaultModuleKeys: [], isSystem: false } });

      const tenantWithPlan = await tx.tenant.create({
        data: { slug: `test-usage-with-plan-${suffix}`, name: "Boutique Avec Formule", businessType: "ECOMMERCE", sectorKey, status: "ACTIVE" },
      });
      tenantWithPlanId = tenantWithPlan.id;

      const tenantWithoutSubscription = await tx.tenant.create({
        data: { slug: `test-usage-no-sub-${suffix}`, name: "Boutique Sans Abonnement", businessType: "ECOMMERCE", sectorKey, status: "ACTIVE" },
      });
      tenantWithoutSubscriptionId = tenantWithoutSubscription.id;

      const plan = await tx.subscriptionPlan.create({
        data: {
          name: `Formule Test Quotas ${suffix}`,
          status: "PUBLISHED",
          priceMonthly: 15_000,
          priceYearly: 150_000,
          maxProducts: 2, // volontairement bas pour tester le rejet facilement.
          maxEmployees: 3,
          maxShops: 1,
          maxCustomDomains: 1,
          storageMB: 1024,
          maxAIGenerationsPerMonth: 100,
          maxAIImagesAnalyzedPerMonth: 100,
          maxAIProductsImportedPerMonth: 100,
        },
      });
      planId = plan.id;
    });

    await withTenant(tenantWithPlanId, (tx) =>
      tx.tenantSubscription.create({
        data: {
          tenantId: tenantWithPlanId,
          planId,
          status: "ACTIVE",
          billingCycle: "MONTHLY",
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 30 * 86_400_000),
        },
      }),
    );
  });

  afterAll(async () => {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.is_super_admin', 'true', true)`;
      await tx.subscriptionEntitlement.deleteMany({ where: { tenantId: { in: [tenantWithPlanId, tenantWithoutSubscriptionId] } } });
      await tx.tenantSubscription.deleteMany({ where: { tenantId: tenantWithPlanId } });
      await tx.product.deleteMany({ where: { tenantId: tenantWithPlanId } });
      await tx.subscriptionPlan.deleteMany({ where: { id: planId } });
      await tx.tenant.deleteMany({ where: { id: { in: [tenantWithPlanId, tenantWithoutSubscriptionId] } } });
      await tx.sector.deleteMany({ where: { key: sectorKey } });
    });
  });

  it("autorise la création jusqu'à la limite, puis refuse le (N+1)ᵉ appel — jamais un simple masquage UI", async () => {
    await withTenant(tenantWithPlanId, async (tx) => {
      await assertQuotaAvailable(tx, tenantWithPlanId, "records"); // 0/2, OK.
      await tx.product.create({ data: { tenantId: tenantWithPlanId, name: "Produit 1", slug: `p1-${suffix}`, basePrice: 1000, status: "PUBLISHED" } });

      await assertQuotaAvailable(tx, tenantWithPlanId, "records"); // 1/2, OK.
      await tx.product.create({ data: { tenantId: tenantWithPlanId, name: "Produit 2", slug: `p2-${suffix}`, basePrice: 1000, status: "PUBLISHED" } });
    });

    await withTenant(tenantWithPlanId, async (tx) => {
      // 2/2 atteint : le TROISIÈME appel doit échouer côté serveur, jamais un succès silencieux.
      await expect(assertQuotaAvailable(tx, tenantWithPlanId, "records")).rejects.toThrow(QuotaExceededError);
    });
  });

  it("une dérogation Super Admin (SubscriptionEntitlement) prévaut TOUJOURS sur la limite de la formule", async () => {
    await withSuperAdminAccess((tx) =>
      tx.subscriptionEntitlement.create({
        data: { tenantId: tenantWithPlanId, resourceKey: "records", limitValue: 10, grantedBy: "super-admin-test" },
      }),
    );

    const limit = await withTenant(tenantWithPlanId, (tx) => resolveEffectiveLimit(tx, tenantWithPlanId, "records"));
    expect(limit).toBe(10); // pas 2 (la formule) : la dérogation gagne.

    // Déjà à 2 produits réels (test précédent) — sous la dérogation (10), un
    // troisième doit maintenant être accepté.
    await withTenant(tenantWithPlanId, (tx) => assertQuotaAvailable(tx, tenantWithPlanId, "records"));

    await withSuperAdminAccess((tx) => tx.subscriptionEntitlement.deleteMany({ where: { tenantId: tenantWithPlanId, resourceKey: "records" } }));
  });

  it("une dérogation EXPIRÉE retombe silencieusement sur la limite de la formule", async () => {
    await withSuperAdminAccess((tx) =>
      tx.subscriptionEntitlement.create({
        data: { tenantId: tenantWithPlanId, resourceKey: "records", limitValue: 10, expiresAt: new Date(Date.now() - 60_000) },
      }),
    );

    const limit = await withTenant(tenantWithPlanId, (tx) => resolveEffectiveLimit(tx, tenantWithPlanId, "records"));
    expect(limit).toBe(2); // dérogation expirée ignorée, formule fait foi.

    await withSuperAdminAccess((tx) => tx.subscriptionEntitlement.deleteMany({ where: { tenantId: tenantWithPlanId, resourceKey: "records" } }));
  });

  it("un tenant SANS TenantSubscription est BLOQUÉ par défaut (limite = 0) — jamais un accès illimité par simple suppression de la ligne d'abonnement", async () => {
    const limit = await withTenant(tenantWithoutSubscriptionId, (tx) => resolveEffectiveLimit(tx, tenantWithoutSubscriptionId, "records"));
    expect(limit).toBe(0);

    await withTenant(tenantWithoutSubscriptionId, async (tx) => {
      await expect(assertQuotaAvailable(tx, tenantWithoutSubscriptionId, "records")).rejects.toThrow(QuotaExceededError);
    });
  });

  it("CONCURRENCE RÉELLE : N créations simultanées près de la limite ne dépassent jamais le quota réel", async () => {
    const tenant = await withSuperAdminAccess((tx) =>
      tx.tenant.create({
        data: { slug: `test-usage-concurrency-${suffix}`, name: "Boutique Concurrence Quota", businessType: "ECOMMERCE", sectorKey, status: "ACTIVE" },
      }),
    );
    try {
      await withTenant(tenant.id, (tx) =>
        tx.tenantSubscription.create({
          data: {
            tenantId: tenant.id,
            planId,
            status: "ACTIVE",
            billingCycle: "MONTHLY",
            currentPeriodStart: new Date(),
            currentPeriodEnd: new Date(Date.now() + 30 * 86_400_000),
          },
        }),
      );

      // La formule autorise 2 produits (voir beforeAll) ; 5 créations simultanées
      // depuis zéro reproduisent exactement `createProductAction` (vérification +
      // création dans LA MÊME transaction, voir product-pipeline.ts) — un contrôle non
      // coordonné ("compter puis comparer" sans verrou) laisserait plusieurs
      // tentatives lire un compte encore sous la limite au même instant et dépasser le
      // quota réel.
      const attempts = await Promise.allSettled(
        Array.from({ length: 5 }, (_, i) =>
          withTenant(tenant.id, async (tx) => {
            await assertQuotaAvailable(tx, tenant.id, "records");
            return tx.product.create({
              data: { tenantId: tenant.id, name: `Concurrent ${i}`, slug: `concurrent-${suffix}-${i}`, basePrice: 1000, status: "PUBLISHED" },
            });
          }),
        ),
      );

      const succeeded = attempts.filter((a) => a.status === "fulfilled");
      const failed = attempts.filter((a) => a.status === "rejected");
      expect(succeeded).toHaveLength(2);
      expect(failed).toHaveLength(3);
      for (const f of failed as PromiseRejectedResult[]) {
        expect(f.reason).toBeInstanceOf(QuotaExceededError);
      }

      const finalCount = await withTenant(tenant.id, (tx) => tx.product.count({ where: { tenantId: tenant.id } }));
      expect(finalCount).toBe(2); // jamais 3, 4 ou 5 : le quota réel n'est jamais dépassé.
    } finally {
      // `finally` — même si une assertion échoue ci-dessus, ce tenant dédié ne doit
      // jamais rester orphelin (il partage `planId` avec le reste de la suite : un
      // reste ici ferait échouer le `subscriptionPlan.deleteMany` du `afterAll` global
      // sur une contrainte de clé étrangère, un vrai bogue de test rencontré une fois).
      await withSuperAdminAccess(async (tx) => {
        await tx.product.deleteMany({ where: { tenantId: tenant.id } });
        await tx.tenantSubscription.deleteMany({ where: { tenantId: tenant.id } });
        await tx.tenant.deleteMany({ where: { id: tenant.id } });
      });
    }
  });

  it("une dérogation Super Admin explicite (billingExemptedAt) restaure un accès illimité MALGRÉ l'absence d'abonnement", async () => {
    await withSuperAdminAccess((tx) =>
      tx.tenant.update({ where: { id: tenantWithoutSubscriptionId }, data: { billingExemptedAt: new Date() } }),
    );

    const limit = await withTenant(tenantWithoutSubscriptionId, (tx) => resolveEffectiveLimit(tx, tenantWithoutSubscriptionId, "records"));
    expect(limit).toBeNull();

    await withTenant(tenantWithoutSubscriptionId, async (tx) => {
      await expect(assertQuotaAvailable(tx, tenantWithoutSubscriptionId, "records", 999)).resolves.toBeUndefined();
    });

    await withSuperAdminAccess((tx) =>
      tx.tenant.update({ where: { id: tenantWithoutSubscriptionId }, data: { billingExemptedAt: null } }),
    );
  });
});
