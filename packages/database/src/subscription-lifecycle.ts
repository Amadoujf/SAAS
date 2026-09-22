import type { Prisma } from "@prisma/client";
import { withSuperAdminAccess, withTenant } from "./tenant-context";
import { suspendSubscription } from "./subscription-registry";
import { SubscriptionStatusConflictError } from "./subscription-status";

/**
 * Décroissance automatique du cycle de vie des abonnements (ACTIVE -> GRACE_PERIOD ->
 * SUSPENDED, jamais au-delà : EXPIRED reste une décision explicite, voir plus bas) —
 * même architecture que `order-reservation.ts` (source de vérité en base, balayage de
 * récupération indépendant de tout job BullMQ individuel perdu). Le câblage du worker
 * périodique (`upsertJobScheduler`, miroir "stock-reservation-sweep") est prévu en M7 ;
 * ce module fournit dès maintenant la logique testable indépendamment de ce câblage.
 *
 * `currentPeriodEnd`/`graceEndsAt` sont `@db.Timestamptz(3)` (voir schema.prisma) :
 * comparaison directe contre `NOW()` PostgreSQL, jamais l'horloge applicative — même
 * leçon que `Order.reservationExpiresAt` (migration `20260927000000_reservation_expiry_timestamptz`).
 */

export type EvaluateLifecycleOutcome =
  | { outcome: "grace_period_started" }
  | { outcome: "suspended" }
  | { outcome: "no_change" };

/** Version "déjà dans une transaction" — réutilisable par un appelant ayant déjà ouvert
 *  son propre `withTenant`. Le balayage préfère UNE TRANSACTION PAR ABONNEMENT (voir
 *  `sweepSubscriptionLifecycle`) : l'échec d'un tenant ne doit jamais faire annuler la
 *  transition déjà réussie d'un autre. */
export async function evaluateSubscriptionLifecycleTx(
  tx: Prisma.TransactionClient,
  tenantId: string,
  subscriptionId: string,
): Promise<EvaluateLifecycleOutcome> {
  const subscription = await tx.tenantSubscription.findFirst({ where: { id: subscriptionId, tenantId } });
  if (!subscription) return { outcome: "no_change" };

  if (subscription.status === "ACTIVE") {
    const plan = await tx.subscriptionPlan.findUniqueOrThrow({ where: { id: subscription.planId } });
    const candidates = await tx.$queryRaw<{ id: string }[]>`
      SELECT "id" FROM "TenantSubscription"
      WHERE "id" = ${subscriptionId} AND "tenantId" = ${tenantId}
        AND "status" = 'ACTIVE' AND "currentPeriodEnd" < NOW()
    `;
    if (candidates.length === 0) return { outcome: "no_change" };

    const graceEndsAt = new Date(subscription.currentPeriodEnd.getTime() + plan.gracePeriodDays * 86_400_000);
    const { count } = await tx.tenantSubscription.updateMany({
      where: { id: subscriptionId, tenantId, status: "ACTIVE", currentPeriodEnd: subscription.currentPeriodEnd },
      data: { status: "GRACE_PERIOD", graceEndsAt },
    });
    if (count === 0) return { outcome: "no_change" }; // un paiement concurrent a gagné la course

    await tx.subscriptionEvent.create({
      data: {
        tenantId,
        subscriptionId,
        type: "grace_period_started",
        actorType: "system",
        payloadSnapshot: { graceEndsAt: graceEndsAt.toISOString() },
      },
    });
    return { outcome: "grace_period_started" };
  }

  if (subscription.status === "GRACE_PERIOD" && subscription.graceEndsAt) {
    const candidates = await tx.$queryRaw<{ id: string }[]>`
      SELECT "id" FROM "TenantSubscription"
      WHERE "id" = ${subscriptionId} AND "tenantId" = ${tenantId}
        AND "status" = 'GRACE_PERIOD' AND "graceEndsAt" < NOW()
    `;
    if (candidates.length === 0) return { outcome: "no_change" };

    try {
      await suspendSubscription(tx, tenantId, subscriptionId, {
        actorType: "system",
        justification: "Fin de la période de grâce sans paiement reçu.",
      });
      return { outcome: "suspended" };
    } catch (error) {
      if (error instanceof SubscriptionStatusConflictError) {
        // Un paiement a été confirmé entre notre lecture et notre tentative de
        // suspension — comportement CORRECT attendu, jamais un échec à journaliser.
        return { outcome: "no_change" };
      }
      throw error;
    }
  }

  return { outcome: "no_change" };
}

/** Point d'entrée appelé directement par le worker pour UN abonnement précis — ouvre
 *  sa PROPRE transaction `withTenant`. */
export async function evaluateSubscriptionLifecycle(
  tenantId: string,
  subscriptionId: string,
): Promise<EvaluateLifecycleOutcome> {
  return withTenant(tenantId, (tx) => evaluateSubscriptionLifecycleTx(tx, tenantId, subscriptionId));
}

export interface LifecycleCandidate {
  id: string;
  tenantId: string;
}

/** Découverte CROSS-TENANT des candidats — nécessite `withSuperAdminAccess` (RLS
 *  scoperait sinon à un seul tenant). Couvre les deux décroissances (ACTIVE échu,
 *  GRACE_PERIOD échue) en une seule requête. */
export async function findLifecycleCandidates(batchSize: number): Promise<LifecycleCandidate[]> {
  return withSuperAdminAccess((tx) =>
    tx.$queryRaw<LifecycleCandidate[]>`
      SELECT "id", "tenantId" FROM "TenantSubscription"
      WHERE ("status" = 'ACTIVE' AND "currentPeriodEnd" < NOW())
         OR ("status" = 'GRACE_PERIOD' AND "graceEndsAt" < NOW())
      ORDER BY "currentPeriodEnd" ASC
      LIMIT ${batchSize}
    `,
  );
}

export interface SweepSubscriptionLifecycleResult {
  gracePeriodStarted: number;
  suspended: number;
  noChange: number;
  failed: number;
  errors: { tenantId: string; subscriptionId: string; message: string }[];
}

/** Job de RÉCUPÉRATION périodique — voir la note de tête de fichier. */
export async function sweepSubscriptionLifecycle(batchSize = 100): Promise<SweepSubscriptionLifecycleResult> {
  const candidates = await findLifecycleCandidates(batchSize);
  const result: SweepSubscriptionLifecycleResult = { gracePeriodStarted: 0, suspended: 0, noChange: 0, failed: 0, errors: [] };

  for (const candidate of candidates) {
    try {
      const outcome = await evaluateSubscriptionLifecycle(candidate.tenantId, candidate.id);
      if (outcome.outcome === "grace_period_started") result.gracePeriodStarted += 1;
      else if (outcome.outcome === "suspended") result.suspended += 1;
      else result.noChange += 1;
    } catch (error) {
      result.failed += 1;
      result.errors.push({
        tenantId: candidate.tenantId,
        subscriptionId: candidate.id,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return result;
}

/**
 * Balayage de rapprochement des sessions de checkout — voir le commentaire de
 * `BillingCheckoutSession.expiresAt` dans schema.prisma. Marque `EXPIRED` toute
 * session restée `PENDING` au-delà de son échéance — un client qui abandonne la page
 * de paiement Chariow sans jamais revenir ne doit jamais laisser une session PENDING
 * éternelle. `expiresAt` est `@db.Timestamptz(3)` : comparaison directe contre
 * `NOW()`, même précédent que les autres balayages de ce fichier.
 *
 * Limite documentée (voir docs/14) : ne revérifie PAS activement auprès de Chariow
 * (l'API réelle — endpoint, forme exacte — reste à confirmer en sandbox, voir
 * ChariowBillingAdapter) ; si un paiement a RÉELLEMENT réussi chez Chariow pendant
 * que la session expirait ici sans qu'aucun webhook ne soit jamais arrivé (panne
 * prestataire), ce cas nécessite aujourd'hui une intervention manuelle Super Admin
 * (`/extend`), pas une correction automatique.
 */
export async function sweepExpiredCheckoutSessions(batchSize = 100): Promise<number> {
  return withSuperAdminAccess((tx) =>
    tx.$executeRaw`
      UPDATE "BillingCheckoutSession" SET "status" = 'EXPIRED'
      WHERE "id" IN (
        SELECT "id" FROM "BillingCheckoutSession"
        WHERE "status" = 'PENDING' AND "expiresAt" < NOW()
        LIMIT ${batchSize}
      )
    `,
  );
}
