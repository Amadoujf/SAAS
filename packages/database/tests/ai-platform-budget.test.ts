import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../src/client";
import { withSuperAdminAccess, withTenant } from "../src/tenant-context";
import { testOwnerClient } from "./test-owner-client";
import { AiUsageError, startAiJob } from "../src/ai-usage-registry";
import {
  AI_RESERVATION_STALE_MS,
  getPlatformAiBudget,
  releasePlatformAiBudget,
  reservePlatformAiBudget,
  settlePlatformAiReservation,
  sweepStaleAiReservations,
} from "../src/ai-platform-budget";

/**
 * Budget IA de la plateforme sur PostgreSQL RÉEL : réservations atomiques sous appels
 * simultanés, imputation unique, libération, réservations perdues imputées au maximum,
 * table invisible et non modifiable depuis le contexte d'une entreprise.
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
  console.warn("[ai-platform-budget.test] Base de données injoignable — suite ignorée (skip).");
}

describe.skipIf(!databaseAvailable)("budget IA de la plateforme", () => {
  const suffix = Math.random().toString(36).slice(2, 10);
  // Mois fictifs propres à ce test : jamais le budget réel du mois en cours.
  const period = (name: string) => `test-${suffix}-${name}`;
  const periods: string[] = [];
  const tenantIds: string[] = [];
  let planId = "";
  let tenant = "";

  const reserve = (p: string, capXOF: number | null, amountXOF: number) => {
    periods.push(p);
    return withSuperAdminAccess((tx) => reservePlatformAiBudget(tx, { period: p, capXOF, amountXOF }));
  };
  const budget = (p: string) => withSuperAdminAccess((tx) => getPlatformAiBudget(tx, null, p));
  const jobWithReservation = (p: string, amountXOF: number) =>
    withTenant(tenant, (tx) => startAiJob(tx, tenant, { type: "site_edit", payload: { message: "test" }, createdBy: null, simulated: false, model: "claude-sonnet-5-5", reservation: { period: p, amountXOF } }));
  const closeJob = (id: string) => withTenant(tenant, (tx) => tx.aIGenerationJob.updateMany({ where: { id }, data: { status: "completed" } }));

  beforeAll(async () => {
    await withSuperAdminAccess(async (tx) => {
      const plan = await tx.subscriptionPlan.create({
        data: {
          name: `Formule budget ${suffix}`, status: "PUBLISHED", priceMonthly: 10_000, priceYearly: 100_000, monthlyDurationDays: 30,
          maxProducts: 100, maxEmployees: 5, maxShops: 1, storageMB: 1024,
          maxAIGenerationsPerMonth: 100, maxAIImagesAnalyzedPerMonth: 0, maxAIProductsImportedPerMonth: 0, aiEstimatedCostCapXOF: null,
        },
      });
      planId = plan.id;
      const t = await tx.tenant.create({ data: { slug: `test-budget-${suffix}`, name: "Boutique budget", businessType: "ECOMMERCE", status: "ACTIVE" } });
      tenant = t.id;
      tenantIds.push(t.id);
      await tx.tenantSubscription.create({ data: { tenantId: t.id, planId: plan.id, status: "ACTIVE", billingCycle: "MONTHLY", currentPeriodStart: new Date(), currentPeriodEnd: new Date(Date.now() + 864e5) } });
    });
  });

  afterAll(async () => {
    const o = testOwnerClient();
    await o.aIGenerationJob.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await o.aIUsageRecord.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await o.tenantSubscription.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await o.tenant.deleteMany({ where: { id: { in: tenantIds } } });
    await o.subscriptionPlan.deleteMany({ where: { id: planId } });
    await o.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.is_super_admin', 'true', true)`;
      await tx.aIPlatformBudget.deleteMany({ where: { periodMonth: { in: periods } } });
    });
    await o.$disconnect();
  });

  it("vingt appels simultanés : seuls ceux qui tiennent dans le plafond sont réservés", async () => {
    const p = period("simultanes");
    const results = await Promise.allSettled(Array.from({ length: 20 }, () => reserve(p, 500, 100)));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(5);
    for (const r of results.filter((x) => x.status === "rejected") as PromiseRejectedResult[]) {
      expect(r.reason).toBeInstanceOf(AiUsageError);
      expect((r.reason as AiUsageError).reason).toBe("cost_cap");
    }
    expect(await budget(p)).toMatchObject({ spentXOF: 0, reservedXOF: 500 });
  });

  it("imputation : réservation remplacée par le coût réel, une seule fois ; place libérée", async () => {
    const p = period("imputation");
    await reserve(p, 250, 100);
    await reserve(p, 250, 100);
    await expect(reserve(p, 250, 100)).rejects.toMatchObject({ reason: "cost_cap" });
    const job = await jobWithReservation(p, 100);
    expect(await withSuperAdminAccess((tx) => settlePlatformAiReservation(tx, job.id, 30))).toBe(true);
    // Une seconde imputation (nouvelle tentative de solde, double appel) ne compte rien.
    expect(await withSuperAdminAccess((tx) => settlePlatformAiReservation(tx, job.id, 30))).toBe(false);
    expect(await budget(p)).toMatchObject({ spentXOF: 30, reservedXOF: 100 });
    await reserve(p, 250, 100);
    expect(await budget(p)).toMatchObject({ spentXOF: 30, reservedXOF: 200 });
    await closeJob(job.id);
  });

  it("génération non lancée : la réservation est libérée sans dépense", async () => {
    const p = period("liberation");
    await reserve(p, 100, 100);
    await withSuperAdminAccess((tx) => releasePlatformAiBudget(tx, p, 100));
    expect(await budget(p)).toMatchObject({ spentXOF: 0, reservedXOF: 0 });
    await reserve(p, 100, 100);
  });

  it("réservation perdue (serveur arrêté pendant l'appel) : imputée au maximum, job clos", async () => {
    const p = period("perdue");
    await reserve(p, null, 120);
    const job = await jobWithReservation(p, 120);
    const o = testOwnerClient();
    await o.aIGenerationJob.update({ where: { id: job.id }, data: { createdAt: new Date(Date.now() - AI_RESERVATION_STALE_MS - 60_000) } });
    await o.$disconnect();
    await withSuperAdminAccess((tx) => sweepStaleAiReservations(tx));
    expect(await budget(p)).toMatchObject({ spentXOF: 120, reservedXOF: 0 });
    const closed = await withTenant(tenant, (tx) => tx.aIGenerationJob.findUniqueOrThrow({ where: { id: job.id } }));
    expect(closed).toMatchObject({ status: "failed", reservedXOF: 0, costEstimateXOF: 120 });
  });

  it("sans plafond : réservations acceptées et suivies", async () => {
    const p = period("sans-plafond");
    await reserve(p, null, 1_000_000);
    expect(await budget(p)).toMatchObject({ reservedXOF: 1_000_000 });
  });

  it("contexte d'une entreprise : budget invisible et non modifiable", async () => {
    const p = period("isolation");
    await reserve(p, 1_000, 10);
    expect(await withTenant(tenant, (tx) => tx.aIPlatformBudget.findMany({ where: { periodMonth: p } }))).toHaveLength(0);
    await expect(withTenant(tenant, (tx) => reservePlatformAiBudget(tx, { period: p, capXOF: 1_000, amountXOF: 10 }))).rejects.toThrow();
    expect(await budget(p)).toMatchObject({ reservedXOF: 10 });
  });
});
