import type { Prisma } from "@prisma/client";

/**
 * Journal et quotas des générations IA (création et modification de site, etc.).
 *
 * Règles tenues ici, pour TOUTE génération :
 * - quota mensuel de la formule (`SubscriptionPlan.maxAIGenerationsPerMonth`, surcharge
 *   Super Admin possible via `SubscriptionEntitlement` « ai_generations ») ;
 * - plafond de coût estimé du mois (`aiEstimatedCostCapXOF`) ;
 * - une seule génération de site EN COURS par entreprise (index unique partiel en base,
 *   migration 20261007000000_ai_site_jobs) — une génération bloquée depuis plus de
 *   `STALE_AFTER_MS` est close en échec pour ne jamais verrouiller une entreprise ;
 * - un échec est journalisé (message, jetons déjà facturés) sans compter comme une
 *   génération réussie ; il n'écrit JAMAIS dans le site (les appelants n'écrivent le
 *   brouillon qu'après un `finishAiJob` réussi et une validation humaine).
 */

export type AiJobType = "site_directions" | "site_edit" | "site_improve";

export class AiUsageError extends Error {
  constructor(
    public readonly reason: "not_in_plan" | "quota" | "cost_cap" | "busy",
    message: string,
  ) {
    super(message);
    this.name = "AiUsageError";
  }
}

const STALE_AFTER_MS = 5 * 60 * 1000;

export function aiPeriod(date = new Date()): string {
  return date.toISOString().slice(0, 7);
}

export interface AiLimits {
  /** `null` = illimité. */
  maxGenerations: number | null;
  costCapXOF: number | null;
}

export async function resolveAiLimits(tx: Prisma.TransactionClient, tenantId: string): Promise<AiLimits> {
  const entitlement = await tx.subscriptionEntitlement.findUnique({ where: { tenantId_resourceKey: { tenantId, resourceKey: "ai_generations" } } });
  const subscription = await tx.tenantSubscription.findUnique({ where: { tenantId }, include: { plan: true } });
  const costCapXOF = subscription?.plan.aiEstimatedCostCapXOF ?? null;
  if (entitlement && (!entitlement.expiresAt || entitlement.expiresAt > new Date())) {
    return { maxGenerations: entitlement.limitValue, costCapXOF };
  }
  if (subscription) return { maxGenerations: subscription.plan.maxAIGenerationsPerMonth, costCapXOF };
  const tenant = await tx.tenant.findUnique({ where: { id: tenantId }, select: { billingExemptedAt: true } });
  if (tenant?.billingExemptedAt) return { maxGenerations: null, costCapXOF: null };
  return { maxGenerations: 0, costCapXOF: 0 };
}

export interface AiUsageSummary {
  period: string;
  used: number;
  limit: number | null;
  estimatedCostXOF: number;
  costCapXOF: number | null;
}

export async function getAiUsage(tx: Prisma.TransactionClient, tenantId: string): Promise<AiUsageSummary> {
  const period = aiPeriod();
  const [record, limits] = await Promise.all([
    tx.aIUsageRecord.findUnique({ where: { tenantId_periodMonth: { tenantId, periodMonth: period } } }),
    resolveAiLimits(tx, tenantId),
  ]);
  return { period, used: record?.generationsUsed ?? 0, limit: limits.maxGenerations, estimatedCostXOF: record?.estimatedCostXOF ?? 0, costCapXOF: limits.costCapXOF };
}

/**
 * Ouvre une génération : vérifie formule, quota et plafond de coût SOUS VERROU (ligne
 * d'usage du mois verrouillée — deux demandes simultanées ne dépassent jamais le quota),
 * puis crée le job « processing ». Lève `AiUsageError` sinon.
 */
export async function startAiJob(
  tx: Prisma.TransactionClient,
  tenantId: string,
  input: { type: AiJobType; payload: Prisma.InputJsonValue; createdBy: string | null; simulated: boolean; model: string | null },
): Promise<{ id: string }> {
  const period = aiPeriod();
  const limits = await resolveAiLimits(tx, tenantId);
  if (limits.maxGenerations === 0) {
    throw new AiUsageError("not_in_plan", "L'assistant IA n'est pas inclus dans votre formule. Passez à la formule Business pour l'utiliser.");
  }
  // Création idempotente de la ligne du mois : deux premières demandes simultanées ne se
  // heurtent pas sur la contrainte d'unicité (un `upsert` Prisma n'est pas atomique).
  await tx.$executeRaw`
    INSERT INTO "AIUsageRecord" ("id", "tenantId", "periodMonth", "updatedAt")
    VALUES (gen_random_uuid()::text, ${tenantId}, ${period}, now())
    ON CONFLICT ("tenantId", "periodMonth") DO NOTHING`;
  const [usage] = await tx.$queryRaw<{ generationsUsed: number; estimatedCostXOF: number }[]>`
    SELECT "generationsUsed", "estimatedCostXOF" FROM "AIUsageRecord"
    WHERE "tenantId" = ${tenantId} AND "periodMonth" = ${period} FOR UPDATE`;
  if (limits.maxGenerations !== null && (usage?.generationsUsed ?? 0) >= limits.maxGenerations) {
    throw new AiUsageError("quota", `Vous avez utilisé vos ${limits.maxGenerations} générations IA de ce mois. Le compteur repart à zéro le mois prochain.`);
  }
  if (limits.costCapXOF !== null && limits.costCapXOF > 0 && (usage?.estimatedCostXOF ?? 0) >= limits.costCapXOF) {
    throw new AiUsageError("cost_cap", "Le plafond de coût IA de votre formule est atteint pour ce mois.");
  }
  // Une génération restée « en cours » trop longtemps (serveur redémarré…) est close.
  await tx.aIGenerationJob.updateMany({
    where: { tenantId, status: "processing", type: { startsWith: "site_" }, createdAt: { lt: new Date(Date.now() - STALE_AFTER_MS) } },
    data: { status: "failed", errorMessage: "Génération interrompue (délai dépassé).", finishedAt: new Date() },
  });
  if (await tx.aIGenerationJob.count({ where: { tenantId, status: "processing", type: { startsWith: "site_" } } })) {
    throw new AiUsageError("busy", "Une génération est déjà en cours pour votre site. Patientez quelques secondes.");
  }
  try {
    return await tx.aIGenerationJob.create({
      data: { tenantId, type: input.type, status: "processing", inputPayload: input.payload, createdBy: input.createdBy, simulated: input.simulated, model: input.model },
      select: { id: true },
    });
  } catch (error) {
    // Course perdue contre une autre demande : l'index unique partiel tranche.
    if (typeof error === "object" && error && (error as { code?: string }).code === "P2002") {
      throw new AiUsageError("busy", "Une génération est déjà en cours pour votre site. Patientez quelques secondes.");
    }
    throw error;
  }
}

export interface AiJobCost {
  inputTokens: number;
  outputTokens: number;
  costXOF: number;
}

/** Génération réussie : résultat, jetons et coût enregistrés ; le quota est décompté. */
export async function finishAiJob(tx: Prisma.TransactionClient, tenantId: string, jobId: string, output: Prisma.InputJsonValue, cost: AiJobCost): Promise<void> {
  const updated = await tx.aIGenerationJob.updateMany({
    where: { id: jobId, tenantId, status: "processing" },
    data: { status: "completed", outputPayload: output, inputTokens: cost.inputTokens, outputTokens: cost.outputTokens, costEstimateXOF: cost.costXOF, finishedAt: new Date() },
  });
  if (updated.count !== 1) throw new Error("Génération introuvable ou déjà close.");
  await tx.aIUsageRecord.update({
    where: { tenantId_periodMonth: { tenantId, periodMonth: aiPeriod() } },
    data: { generationsUsed: { increment: 1 }, estimatedCostXOF: { increment: cost.costXOF } },
  });
}

/** Échec : journalisé, coût déjà engagé compté, la génération n'est pas décomptée. */
export async function failAiJob(tx: Prisma.TransactionClient, tenantId: string, jobId: string, message: string, cost: AiJobCost = { inputTokens: 0, outputTokens: 0, costXOF: 0 }): Promise<void> {
  await tx.aIGenerationJob.updateMany({
    where: { id: jobId, tenantId, status: "processing" },
    data: { status: "failed", errorMessage: message.slice(0, 500), inputTokens: cost.inputTokens, outputTokens: cost.outputTokens, costEstimateXOF: cost.costXOF, finishedAt: new Date() },
  });
  if (cost.costXOF > 0) {
    await tx.aIUsageRecord.update({
      where: { tenantId_periodMonth: { tenantId, periodMonth: aiPeriod() } },
      data: { estimatedCostXOF: { increment: cost.costXOF } },
    });
  }
}

/**
 * Dépense IA estimée de TOUTE la plateforme pour un mois (somme des lignes d'usage de
 * chaque entreprise) — à lire avec `withSuperAdminAccess`. Sert au plafond global
 * `AI_PLATFORM_MONTHLY_CAP_XOF`, qui s'ajoute aux plafonds de chaque formule.
 */
export async function platformAiSpendXOF(tx: Prisma.TransactionClient, period = aiPeriod()): Promise<number> {
  const total = await tx.aIUsageRecord.aggregate({ where: { periodMonth: period }, _sum: { estimatedCostXOF: true } });
  return total._sum.estimatedCostXOF ?? 0;
}

/** Validation humaine : la proposition a été appliquée au brouillon par un membre. */
export async function markAiJobApproved(tx: Prisma.TransactionClient, tenantId: string, jobId: string, userId: string): Promise<void> {
  await tx.aIGenerationJob.updateMany({ where: { id: jobId, tenantId }, data: { approved: true, reviewedAt: new Date(), reviewedBy: userId } });
}
