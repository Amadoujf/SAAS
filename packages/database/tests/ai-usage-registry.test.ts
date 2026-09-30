import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../src/client";
import { withSuperAdminAccess, withTenant } from "../src/tenant-context";
import { testOwnerClient } from "./test-owner-client";
import { AiUsageError, failAiJob, finishAiJob, getAiUsage, platformAiSpendXOF, startAiJob } from "../src/ai-usage-registry";

/**
 * Quotas et journal IA sur PostgreSQL RÉEL : quota de la formule, plafond de coût, une
 * seule génération de site en cours par entreprise (même en concurrence), échec sans
 * décompte, isolation entre entreprises.
 */
let databaseAvailable = true;
try {
  await prisma.$queryRaw`SELECT 1`;
} catch (error) {
  if (process.env.REQUIRE_DB_TESTS === "true") {
    throw new Error(`REQUIRE_DB_TESTS=true mais PostgreSQL est injoignable : ${error instanceof Error ? error.message : String(error)}`);
  }
  databaseAvailable = false;
  // eslint-disable-next-line no-console
  console.warn("[ai-usage-registry.test] Base de données injoignable — suite ignorée (skip).");
}

describe.skipIf(!databaseAvailable)("journal et quotas IA", () => {
  const suffix = Math.random().toString(36).slice(2, 10);
  const planIds: string[] = [];
  const tenantIds: string[] = [];

  async function tenantWithPlan(maxAIGenerationsPerMonth: number, aiEstimatedCostCapXOF: number | null) {
    return withSuperAdminAccess(async (tx) => {
      const plan = await tx.subscriptionPlan.create({
        data: {
          name: `Formule IA ${suffix}-${planIds.length}`, status: "PUBLISHED", priceMonthly: 10_000, priceYearly: 100_000, monthlyDurationDays: 30,
          maxProducts: 100, maxEmployees: 5, maxShops: 1, storageMB: 1024,
          maxAIGenerationsPerMonth, maxAIImagesAnalyzedPerMonth: 0, maxAIProductsImportedPerMonth: 0, aiEstimatedCostCapXOF,
        },
      });
      planIds.push(plan.id);
      const tenant = await tx.tenant.create({ data: { slug: `test-ia-${suffix}-${tenantIds.length}`, name: "Boutique IA", businessType: "ECOMMERCE", status: "ACTIVE" } });
      tenantIds.push(tenant.id);
      await tx.tenantSubscription.create({ data: { tenantId: tenant.id, planId: plan.id, status: "ACTIVE", billingCycle: "MONTHLY", currentPeriodStart: new Date(), currentPeriodEnd: new Date(Date.now() + 864e5) } });
      return tenant.id;
    });
  }
  const start = (tenantId: string) => withTenant(tenantId, (tx) => startAiJob(tx, tenantId, { type: "site_edit", payload: { message: "test" }, createdBy: null, simulated: true, model: null }));

  afterAll(async () => {
    const o = testOwnerClient();
    await o.aIGenerationJob.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await o.aIUsageRecord.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await o.tenantSubscription.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await o.tenant.deleteMany({ where: { id: { in: tenantIds } } });
    await o.subscriptionPlan.deleteMany({ where: { id: { in: planIds } } });
    await o.$disconnect();
  });

  let a: string;
  let b: string;
  beforeAll(async () => {
    a = await tenantWithPlan(2, 100);
    b = await tenantWithPlan(0, 0);
  });

  it("formule sans IA : refus explicite, rien n'est créé", async () => {
    await expect(start(b)).rejects.toMatchObject({ reason: "not_in_plan" });
    expect(await withTenant(b, (tx) => tx.aIGenerationJob.count({ where: { tenantId: b } }))).toBe(0);
  });

  it("une seule génération en cours, même lancée deux fois en même temps", async () => {
    const results = await Promise.allSettled([start(a), start(a)]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
    expect(rejected.reason).toBeInstanceOf(AiUsageError);
    expect((rejected.reason as AiUsageError).reason).toBe("busy");
    const job = (results.find((r) => r.status === "fulfilled") as PromiseFulfilledResult<{ id: string }>).value;
    // Échec : journalisé, coût compté, génération NON décomptée.
    await withTenant(a, (tx) => failAiJob(tx, a, job.id, "Fournisseur indisponible", { inputTokens: 1000, outputTokens: 0, costXOF: 3 }));
    const usage = await withTenant(a, (tx) => getAiUsage(tx, a));
    expect(usage.used).toBe(0);
    expect(usage.estimatedCostXOF).toBe(3);
  });

  it("quota mensuel puis plafond de coût appliqués ; isolation entre entreprises", async () => {
    for (let i = 0; i < 2; i++) {
      const job = await start(a);
      await withTenant(a, (tx) => finishAiJob(tx, a, job.id, { ok: true }, { inputTokens: 10, outputTokens: 10, costXOF: 1 }));
    }
    await expect(start(a)).rejects.toMatchObject({ reason: "quota" });
    const usage = await withTenant(a, (tx) => getAiUsage(tx, a));
    expect(usage).toMatchObject({ used: 2, limit: 2, estimatedCostXOF: 5 });
    // Une autre entreprise ne voit pas ce journal.
    expect(await withTenant(b, (tx) => tx.aIGenerationJob.count({ where: { tenantId: a } }))).toBe(0);
  });

  it("dépense de la plateforme : somme de toutes les entreprises, lisible seulement en super-admin", async () => {
    const before = await withSuperAdminAccess((tx) => platformAiSpendXOF(tx));
    const c = await tenantWithPlan(5, null);
    const job = await start(c);
    await withTenant(c, (tx) => finishAiJob(tx, c, job.id, { ok: true }, { inputTokens: 10, outputTokens: 10, costXOF: 7 }));
    expect(await withSuperAdminAccess((tx) => platformAiSpendXOF(tx))).toBe(before + 7);
    // Dans le contexte d'une entreprise, la somme ne couvre que ses propres lignes.
    expect(await withTenant(c, (tx) => platformAiSpendXOF(tx))).toBe(7);
  });
});
