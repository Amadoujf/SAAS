import type { Prisma, SubscriptionStatus } from "@prisma/client";

/**
 * Machine à états des abonnements SaaS — voir docs/14-facturation-saas-abonnements.md.
 * Table d'adjacence explicite, même idiome que `order-status.ts` : UN SEUL endroit
 * fait foi, et `transitionSubscriptionStatus` est le SEUL code autorisé à modifier
 * `TenantSubscription.status`.
 *
 * Différence structurelle majeure avec la machine à états des commandes : `Order` est
 * un document jetable (états terminaux réels, `CANCELED`/`REFUNDED` ne repartent
 * jamais), alors que `TenantSubscription.tenantId` est `@unique` — UNE SEULE ligne par
 * tenant pour toute sa vie. Un tenant annulé ou expiré doit donc TOUJOURS pouvoir
 * redevenir `ACTIVE` via un nouveau paiement confirmé (sinon il serait bloqué à jamais,
 * la contrainte d'unicité interdisant une seconde ligne) — c'est pourquoi `CANCELED` et
 * `EXPIRED` ont, contrairement à l'intuition d'une "fin" d'abonnement, une arête sortante
 * vers `ACTIVE`.
 *
 * `PAST_DUE` reste atteignable dans le schéma mais n'est déclenché par AUCUN code de
 * cette étape (aucun événement Chariow "tentative de paiement échouée" n'existe
 * aujourd'hui) — réservé à une future extension ou une action Super Admin manuelle.
 */
export const SUBSCRIPTION_STATUS_TRANSITIONS: Record<SubscriptionStatus, SubscriptionStatus[]> = {
  PENDING: ["ACTIVE", "CANCELED"],
  TRIALING: ["ACTIVE", "GRACE_PERIOD", "CANCELED"],
  ACTIVE: ["GRACE_PERIOD", "CANCELED"],
  GRACE_PERIOD: ["ACTIVE", "SUSPENDED", "CANCELED"],
  PAST_DUE: ["ACTIVE", "SUSPENDED", "CANCELED"],
  SUSPENDED: ["ACTIVE", "EXPIRED", "CANCELED"],
  EXPIRED: ["ACTIVE", "CANCELED"],
  CANCELED: ["ACTIVE"],
};

export function isValidSubscriptionTransition(from: SubscriptionStatus, to: SubscriptionStatus): boolean {
  return SUBSCRIPTION_STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}

export class InvalidSubscriptionTransitionError extends Error {
  constructor(from: SubscriptionStatus, to: SubscriptionStatus) {
    super(`Transition refusée : "${from}" -> "${to}" n'est pas autorisée.`);
    this.name = "InvalidSubscriptionTransitionError";
  }
}

export class SubscriptionStatusConflictError extends Error {
  constructor(subscriptionId: string) {
    super(`L'abonnement "${subscriptionId}" a changé entre la lecture et l'écriture — nouvel essai nécessaire.`);
    this.name = "SubscriptionStatusConflictError";
  }
}

export interface TransitionSubscriptionStatusInput {
  subscriptionId: string;
  toStatus: SubscriptionStatus;
  actorType: "system" | "webhook" | "super_admin" | "tenant_owner";
  actorUserId?: string | null;
  /** Obligatoire en couche APPLICATIVE pour une action Super Admin (voir docs/14) —
   *  pas une contrainte imposée ici, à valider par l'appelant (route Super Admin). */
  justification?: string | null;
  /** Type d'événement journalisé dans `SubscriptionEvent.type` — voir les valeurs
   *  documentées sur le modèle (ex. "suspended", "canceled", "grace_period_started"). */
  eventType: string;
  payloadSnapshot?: Prisma.InputJsonValue | null;
  /** Statut sur lequel l'appelant a fondé sa décision (ex. un balayage qui a constaté
   *  « GRACE_PERIOD »). S'il a changé entre-temps, la transition est refusée
   *  (`SubscriptionStatusConflictError`) au lieu de s'appliquer à un état que
   *  l'appelant n'a jamais vu — même si elle resterait valide depuis ce nouvel état. */
  fromStatus?: SubscriptionStatus;
}

/**
 * Point de passage OBLIGÉ pour toute mutation de `TenantSubscription.status`. Rejette
 * les transitions absentes de `SUBSCRIPTION_STATUS_TRANSITIONS`, traite une
 * auto-transition comme un no-op réussi (jamais une entrée `SubscriptionEvent` pour un
 * statut déjà atteint), garde l'écriture par un `updateMany` conditionné sur le statut
 * LU (même idiome anti-TOCTOU que `transitionOrderStatus`) : si `count === 0`, le
 * statut a changé entre la lecture et l'écriture — lève `SubscriptionStatusConflictError`
 * plutôt que d'écraser silencieusement une décision concurrente.
 *
 * Écrit TOUJOURS une ligne `SubscriptionEvent` (immuable au niveau base — REVOKE
 * UPDATE/DELETE, voir la migration `20260928000000_saas_billing_foundation`).
 */
export async function transitionSubscriptionStatus(
  tx: Prisma.TransactionClient,
  tenantId: string,
  input: TransitionSubscriptionStatusInput,
) {
  const subscription = await tx.tenantSubscription.findFirst({ where: { id: input.subscriptionId, tenantId } });
  if (!subscription) {
    throw new Error(`transitionSubscriptionStatus : abonnement "${input.subscriptionId}" introuvable pour ce tenant.`);
  }

  if (input.fromStatus && subscription.status !== input.fromStatus) {
    throw new SubscriptionStatusConflictError(input.subscriptionId);
  }
  if (subscription.status === input.toStatus) return subscription;
  if (!isValidSubscriptionTransition(subscription.status, input.toStatus)) {
    throw new InvalidSubscriptionTransitionError(subscription.status, input.toStatus);
  }

  const { count } = await tx.tenantSubscription.updateMany({
    where: { id: input.subscriptionId, tenantId, status: subscription.status },
    data: {
      status: input.toStatus,
      ...(input.toStatus === "SUSPENDED" ? { suspendedAt: new Date() } : {}),
      ...(input.toStatus === "CANCELED" ? { canceledAt: new Date() } : {}),
      ...(input.toStatus === "ACTIVE" ? { graceEndsAt: null, suspendedAt: null, canceledAt: null } : {}),
    },
  });
  if (count === 0) throw new SubscriptionStatusConflictError(input.subscriptionId);

  await tx.subscriptionEvent.create({
    data: {
      tenantId,
      subscriptionId: input.subscriptionId,
      type: input.eventType,
      actorType: input.actorType,
      actorUserId: input.actorUserId ?? null,
      justification: input.justification ?? null,
      payloadSnapshot: input.payloadSnapshot ?? undefined,
    },
  });

  return tx.tenantSubscription.findFirstOrThrow({ where: { id: input.subscriptionId, tenantId } });
}
