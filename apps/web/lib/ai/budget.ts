import "server-only";
import {
  getPlatformAiBudget,
  releasePlatformAiBudget,
  reservePlatformAiBudget,
  settlePlatformAiReservation,
  sweepStaleAiReservations,
  withSuperAdminAccess,
  type PlatformAiBudget,
} from "@yamacommerce/database";
import { worstCaseCostXOF } from "./cost";

/**
 * Plafond de dépenses IA de TOUTE la plateforme, par mois civil, en FCFA estimés
 * (`AI_PLATFORM_MONTHLY_CAP_XOF`). S'ajoute aux quotas et plafonds de chaque formule.
 * Le coût maximal de chaque appel est réservé avant l'appel (atomique : des appels
 * simultanés ne dépassent jamais le plafond ensemble), puis remplacé par le coût réel.
 * Détail des règles : packages/database/src/ai-platform-budget.ts.
 *
 * Estimation calculée par Y-COM : la limite de dépenses réglée dans la console du
 * fournisseur reste le garde-fou définitif.
 */
export function platformAiCapXOF(): number | null {
  const cap = Number(process.env.AI_PLATFORM_MONTHLY_CAP_XOF);
  return Number.isFinite(cap) && cap > 0 ? Math.floor(cap) : null;
}

export interface AiReservation {
  period: string;
  amountXOF: number;
}

/** Réserve le coût maximal d'un appel ; lève `AiUsageError("cost_cap")` si le plafond serait dépassé. */
export async function reserveAiCall(model: string): Promise<AiReservation> {
  const amountXOF = worstCaseCostXOF(model);
  return withSuperAdminAccess(async (tx) => {
    await sweepStaleAiReservations(tx);
    const { period } = await reservePlatformAiBudget(tx, { capXOF: platformAiCapXOF(), amountXOF });
    return { period, amountXOF };
  });
}

/** La génération n'a pas été lancée (quota de la formule, génération déjà en cours…). */
export function releaseAiCall(reservation: AiReservation): Promise<void> {
  return withSuperAdminAccess((tx) => releasePlatformAiBudget(tx, reservation.period, reservation.amountXOF));
}

/** Remplace la réservation du job par le coût imputé (une seule fois). */
export function settleAiCall(jobId: string, chargedXOF: number): Promise<boolean> {
  return withSuperAdminAccess((tx) => settlePlatformAiReservation(tx, jobId, chargedXOF));
}

export function platformAiBudget(): Promise<PlatformAiBudget> {
  return withSuperAdminAccess((tx) => getPlatformAiBudget(tx, platformAiCapXOF()));
}
