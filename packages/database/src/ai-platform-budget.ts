import type { Prisma } from "@prisma/client";
import { AiUsageError, aiPeriod } from "./ai-usage-registry";

/**
 * Budget IA de TOUTE la plateforme (prévisualisation : plafond global mensuel, en FCFA
 * estimés). Toutes les fonctions s'exécutent sous `withSuperAdminAccess` (RLS).
 *
 * Règle : avant chaque appel réel au fournisseur, le coût MAXIMAL de l'appel est réservé
 * par une seule instruction SQL atomique, refusée si `dépensé + réservé + maximum`
 * dépasserait le plafond. Des appels simultanés ne peuvent donc jamais dépasser le
 * plafond ensemble. Après l'appel, la réservation est remplacée par le coût réel —
 * ou par le maximum quand le coût est inconnu (coupure réseau, réponse illisible).
 * Une réservation restée ouverte (serveur redémarré pendant l'appel) est imputée au
 * maximum par `sweepStaleAiReservations`. Chaque nouvelle tentative est un nouvel appel,
 * donc une nouvelle réservation : aucune tentative n'échappe au décompte.
 */

/** Au-delà de ce délai, une réservation encore ouverte est considérée comme perdue. */
export const AI_RESERVATION_STALE_MS = 10 * 60 * 1000;

export interface PlatformAiBudget {
  period: string;
  spentXOF: number;
  reservedXOF: number;
  capXOF: number | null;
}

export async function getPlatformAiBudget(tx: Prisma.TransactionClient, capXOF: number | null, period = aiPeriod()): Promise<PlatformAiBudget> {
  const row = await tx.aIPlatformBudget.findUnique({ where: { periodMonth: period } });
  return { period, spentXOF: row?.spentXOF ?? 0, reservedXOF: row?.reservedXOF ?? 0, capXOF };
}

/** Réserve `amountXOF` sur le mois ; lève `AiUsageError("cost_cap")` si le plafond serait dépassé. */
export async function reservePlatformAiBudget(tx: Prisma.TransactionClient, input: { capXOF: number | null; amountXOF: number; period?: string }): Promise<{ period: string }> {
  const period = input.period ?? aiPeriod();
  const amount = Math.max(0, Math.ceil(input.amountXOF));
  await tx.$executeRaw`INSERT INTO "AIPlatformBudget" ("periodMonth") VALUES (${period}) ON CONFLICT ("periodMonth") DO NOTHING`;
  const reserved = input.capXOF === null
    ? await tx.$executeRaw`UPDATE "AIPlatformBudget" SET "reservedXOF" = "reservedXOF" + ${amount}, "updatedAt" = now() WHERE "periodMonth" = ${period}`
    : await tx.$executeRaw`
        UPDATE "AIPlatformBudget" SET "reservedXOF" = "reservedXOF" + ${amount}, "updatedAt" = now()
        WHERE "periodMonth" = ${period} AND "spentXOF" + "reservedXOF" + ${amount} <= ${input.capXOF}`;
  if (reserved !== 1) {
    throw new AiUsageError("cost_cap", "Le plafond mensuel de dépenses IA de la plateforme est atteint : l'assistant est en pause jusqu'au mois prochain. Votre site n'a pas été modifié.");
  }
  return { period };
}

/** Annule une réservation qui n'a donné lieu à aucun appel (génération refusée avant l'appel). */
export async function releasePlatformAiBudget(tx: Prisma.TransactionClient, period: string, amountXOF: number): Promise<void> {
  await tx.$executeRaw`
    UPDATE "AIPlatformBudget" SET "reservedXOF" = GREATEST("reservedXOF" - ${amountXOF}, 0), "updatedAt" = now()
    WHERE "periodMonth" = ${period}`;
}

/**
 * Remplace la réservation d'une génération par son coût imputé, une seule fois : la
 * réservation du job est remise à 0 dans la même transaction (une seconde imputation
 * ne trouve plus rien à solder). Renvoie false si elle était déjà soldée.
 */
export async function settlePlatformAiReservation(tx: Prisma.TransactionClient, jobId: string, chargedXOF: number): Promise<boolean> {
  const [job] = await tx.$queryRaw<{ reservedXOF: number; budgetPeriod: string | null }[]>`
    SELECT "reservedXOF", "budgetPeriod" FROM "AIGenerationJob" WHERE "id" = ${jobId} FOR UPDATE`;
  if (!job || job.reservedXOF <= 0 || !job.budgetPeriod) return false;
  const charged = Math.max(0, Math.ceil(chargedXOF));
  await tx.$executeRaw`UPDATE "AIGenerationJob" SET "reservedXOF" = 0 WHERE "id" = ${jobId}`;
  await tx.$executeRaw`
    UPDATE "AIPlatformBudget"
    SET "reservedXOF" = GREATEST("reservedXOF" - ${job.reservedXOF}, 0), "spentXOF" = "spentXOF" + ${charged}, "updatedAt" = now()
    WHERE "periodMonth" = ${job.budgetPeriod}`;
  return true;
}

/**
 * Réservations perdues (serveur arrêté pendant un appel) : imputées au MAXIMUM réservé,
 * car l'appel a pu être facturé. Le job encore « en cours » est clos en échec, et le
 * coût est aussi reporté sur l'usage de l'entreprise concernée.
 */
export async function sweepStaleAiReservations(tx: Prisma.TransactionClient, now = new Date()): Promise<number> {
  const stale = await tx.aIGenerationJob.findMany({
    where: { reservedXOF: { gt: 0 }, createdAt: { lt: new Date(now.getTime() - AI_RESERVATION_STALE_MS) } },
    select: { id: true, tenantId: true, reservedXOF: true, budgetPeriod: true, status: true },
  });
  for (const job of stale) {
    if (!(await settlePlatformAiReservation(tx, job.id, job.reservedXOF))) continue;
    await tx.aIGenerationJob.updateMany({
      where: { id: job.id, status: "processing" },
      data: { status: "failed", errorMessage: "Génération interrompue : coût maximal imputé par précaution.", finishedAt: now },
    });
    await tx.aIGenerationJob.update({ where: { id: job.id }, data: { costEstimateXOF: { increment: job.reservedXOF } } });
    await tx.aIUsageRecord.updateMany({
      where: { tenantId: job.tenantId, periodMonth: job.budgetPeriod ?? aiPeriod(now) },
      data: { estimatedCostXOF: { increment: job.reservedXOF } },
    });
  }
  return stale.length;
}
