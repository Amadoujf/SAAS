import type { Prisma, SubscriptionPayment, TenantSubscription } from "@prisma/client";
import { isValidSubscriptionTransition, transitionSubscriptionStatus, InvalidSubscriptionTransitionError, SubscriptionStatusConflictError } from "./subscription-status";

/**
 * Persistance des abonnements SaaS — voir docs/14-facturation-saas-abonnements.md.
 * `confirmSubscriptionPaymentSuccess` est la fonction CRITIQUE : SEUL effet de bord
 * autorisé d'un paiement d'abonnement réussi (webhook Chariow vérifié, ou future
 * confirmation manuelle Super Admin — voir docs/14, « prolongation manuelle avec
 * justification obligatoire », qui doit passer par cette même fonction plutôt que
 * dupliquer sa logique).
 */

/**
 * Récupère l'abonnement du tenant s'il existe, sinon en crée un en `PENDING` — aucun
 * paiement confirmé pour l'instant, c'est le point d'entrée du TOUT PREMIER checkout
 * d'un tenant (l'onboarding ne crée aujourd'hui aucun `TenantSubscription`, voir
 * docs/14). `TenantSubscription.tenantId` est `@unique` mais non déclarable comme
 * garde de concurrence via `@@unique` côté appel : même idiome que
 * `getOrCreateActiveCart` (`cart-registry.ts`) — `create()` + capture de la violation
 * P2002 + relecture, jamais un `upsert` qui masquerait silencieusement une double
 * création concurrente.
 */
export async function getOrCreateSubscription(tx: Prisma.TransactionClient, tenantId: string, planId: string) {
  const existing = await tx.tenantSubscription.findUnique({ where: { tenantId } });
  if (existing) return existing;

  const now = new Date();
  try {
    return await tx.tenantSubscription.create({
      data: { tenantId, planId, status: "PENDING", billingCycle: "MONTHLY", currentPeriodStart: now, currentPeriodEnd: now },
    });
  } catch (error) {
    const winner = await tx.tenantSubscription.findUnique({ where: { tenantId } });
    if (winner) return winner;
    throw error;
  }
}

/** Auteur de la confirmation, journalisé sur le `SubscriptionEvent` "renewed"/
 *  "reactivated" — `"webhook"` par défaut (paiement Chariow vérifié), mais
 *  `"super_admin"` avec `justification` OBLIGATOIRE pour une prolongation manuelle
 *  (voir docs/14, « prolongation manuelle avec justification obligatoire »). */
export interface ConfirmSubscriptionPaymentActor {
  actorType: "webhook" | "super_admin";
  actorUserId?: string | null;
  justification?: string | null;
}

export interface ConfirmSubscriptionPaymentSuccessInput {
  subscriptionId: string;
  /** `BillingCheckoutSession.id` d'origine, si ce paiement provient d'un checkout
   *  hébergé — `null` pour une confirmation manuelle Super Admin sans session. */
  checkoutSessionId?: string | null;
  provider: string; // "chariow" | "manual"
  providerSaleId: string;
  planId: string;
  billingCycle: "MONTHLY" | "YEARLY";
  amountXOF: number;
  currency: string;
  rawPayload?: unknown;
  actor?: ConfirmSubscriptionPaymentActor;
}

export interface ConfirmSubscriptionPaymentSuccessResult {
  subscription: TenantSubscription;
  payment: SubscriptionPayment;
  outcome: "confirmed" | "already_confirmed";
}

/**
 * Idempotente sur `SubscriptionPayment.[provider, providerSaleId]` : un webhook Chariow
 * rejoué (même vente) ne crée jamais un second paiement ni ne prolonge deux fois la
 * période — retourne `already_confirmed`, jamais une erreur (un rejeu de paiement est
 * un cas normal attendu, pas un conflit métier, contrairement à
 * `OrderStatusConflictError`).
 *
 * Applique ensuite LA formule de renouvellement UNIQUE (voir `applyRenewalExtension`),
 * qui couvre à elle seule le renouvellement anticipé, la réactivation après grâce, et
 * la réactivation après suspension/expiration/annulation — jamais une seconde branche
 * de calcul séparée pour ces cas.
 */
export async function confirmSubscriptionPaymentSuccess(
  tx: Prisma.TransactionClient,
  tenantId: string,
  input: ConfirmSubscriptionPaymentSuccessInput,
): Promise<ConfirmSubscriptionPaymentSuccessResult> {
  const existingPayment = await tx.subscriptionPayment.findUnique({
    where: { provider_providerSaleId: { provider: input.provider, providerSaleId: input.providerSaleId } },
  });
  if (existingPayment) {
    const subscription = await tx.tenantSubscription.findFirstOrThrow({ where: { id: input.subscriptionId, tenantId } });
    return { subscription, payment: existingPayment, outcome: "already_confirmed" };
  }

  const plan = await tx.subscriptionPlan.findUniqueOrThrow({ where: { id: input.planId } });
  const durationDays = input.billingCycle === "YEARLY" ? plan.yearlyDurationDays : plan.monthlyDurationDays;

  const payment = await tx.subscriptionPayment.create({
    data: {
      tenantId,
      subscriptionId: input.subscriptionId,
      planId: input.planId,
      checkoutSessionId: input.checkoutSessionId ?? null,
      provider: input.provider,
      providerSaleId: input.providerSaleId,
      amountXOF: input.amountXOF,
      currency: input.currency,
      status: "SUCCEEDED",
      confirmedAt: new Date(),
      periodExtensionDays: durationDays,
      rawPayload: (input.rawPayload as Prisma.InputJsonValue) ?? undefined,
    },
  });

  const subscription = await applyRenewalExtension(
    tx,
    tenantId,
    input.subscriptionId,
    payment,
    durationDays,
    input.planId,
    input.billingCycle,
    input.actor ?? { actorType: "webhook" },
  );

  if (input.checkoutSessionId) {
    // Rien d'autre ne doit jamais activer un abonnement depuis la redirection
    // navigateur (voir docs/14) — cette mise à jour de statut de SESSION est purement
    // informative pour la page de retour, qui lit `BillingCheckoutSession.status`
    // plutôt que de déduire quoi que ce soit de la présence de la redirection elle-même.
    await tx.billingCheckoutSession.updateMany({
      where: { id: input.checkoutSessionId, tenantId, status: "PENDING" },
      data: { status: "CONFIRMED" },
    });
  }

  return { subscription, payment, outcome: "confirmed" };
}

/**
 * Formule de renouvellement UNIQUE (voir le plan approuvé, « une seule règle couvre
 * TOUS les cas ») : `newPeriodEnd = ajouterJours(max(maintenant, currentPeriodEnd),
 * dureeDuCycle)`. Si l'abonnement est encore `ACTIVE` avec une échéance future
 * (renouvellement anticipé), la base reste `currentPeriodEnd` — aucun jour prépayé
 * perdu. Si l'échéance est déjà passée (grâce/suspension/expiration/annulation), la
 * base devient l'instant présent — jamais une réactivation qui compterait le temps déjà
 * écoulé impayé comme payé.
 *
 * Écriture ATOMIQUE gardée sur le COUPLE `(status LU, currentPeriodEnd LU)` — un double
 * clic "Renouveler" ou deux webhooks concurrents (deux ventes Chariow distinctes,
 * `providerSaleId` différents) ne peuvent jamais produire une double extension : le
 * perdant voit `count === 0` et RÉESSAIE avec l'état frais (borné à 5 tentatives) — à la
 * différence de `confirmOrderPaymentSuccess`, on ne traite JAMAIS le perdant comme un
 * cas "déjà traité" : les deux paiements sont de l'argent réel reçu, les DEUX doivent
 * finir par prolonger la période.
 */
async function applyRenewalExtension(
  tx: Prisma.TransactionClient,
  tenantId: string,
  subscriptionId: string,
  payment: SubscriptionPayment,
  durationDays: number,
  planId: string,
  billingCycle: "MONTHLY" | "YEARLY",
  actor: ConfirmSubscriptionPaymentActor,
  attempt = 1,
): Promise<TenantSubscription> {
  const subscription = await tx.tenantSubscription.findFirstOrThrow({ where: { id: subscriptionId, tenantId } });

  if (subscription.status !== "ACTIVE" && !isValidSubscriptionTransition(subscription.status, "ACTIVE")) {
    throw new InvalidSubscriptionTransitionError(subscription.status, "ACTIVE");
  }

  const now = new Date();
  const base = subscription.currentPeriodEnd > now ? subscription.currentPeriodEnd : now;
  const newPeriodEnd = new Date(base.getTime() + durationDays * 86_400_000);
  const wasAlreadyActive = subscription.status === "ACTIVE";

  const { count } = await tx.tenantSubscription.updateMany({
    where: { id: subscriptionId, tenantId, status: subscription.status, currentPeriodEnd: subscription.currentPeriodEnd },
    data: {
      status: "ACTIVE",
      // Un changement de formule (voir docs/14, décision « sans proration ») prend
      // effet exactement ICI, au moment du paiement confirmé — jamais un recalcul
      // immédiat au moment de la demande de changement elle-même.
      planId,
      billingCycle,
      currentPeriodStart: base,
      currentPeriodEnd: newPeriodEnd,
      graceEndsAt: null,
      suspendedAt: null,
      canceledAt: null,
      lastPaymentId: payment.id,
    },
  });

  if (count === 0) {
    if (attempt >= 5) throw new SubscriptionStatusConflictError(subscriptionId);
    return applyRenewalExtension(tx, tenantId, subscriptionId, payment, durationDays, planId, billingCycle, actor, attempt + 1);
  }

  await tx.subscriptionEvent.create({
    data: {
      tenantId,
      subscriptionId,
      type: wasAlreadyActive ? "renewed" : "reactivated",
      actorType: actor.actorType,
      actorUserId: actor.actorUserId ?? null,
      justification: actor.justification ?? null,
      payloadSnapshot: { paymentId: payment.id, newPeriodEnd: newPeriodEnd.toISOString() },
    },
  });

  return tx.tenantSubscription.findFirstOrThrow({ where: { id: subscriptionId, tenantId } });
}

export interface CancelSubscriptionActor {
  actorType: "tenant_owner" | "super_admin" | "system";
  actorUserId?: string | null;
  justification?: string | null;
}

/** Annulation explicite (tenant ou Super Admin) — reste réactivable (voir
 *  `subscription-status.ts`, `CANCELED -> ACTIVE`) : `tenantId` étant `@unique` sur
 *  `TenantSubscription`, il n'existe aucune autre façon pour ce tenant de se
 *  réabonner un jour que de faire progresser CETTE MÊME ligne. */
export async function cancelSubscription(
  tx: Prisma.TransactionClient,
  tenantId: string,
  subscriptionId: string,
  actor: CancelSubscriptionActor,
) {
  return transitionSubscriptionStatus(tx, tenantId, {
    subscriptionId,
    toStatus: "CANCELED",
    actorType: actor.actorType,
    actorUserId: actor.actorUserId,
    justification: actor.justification,
    eventType: "canceled",
  });
}

export interface SuspendSubscriptionActor {
  actorType: "system" | "super_admin";
  actorUserId?: string | null;
  justification?: string | null;
}

/** Suspension — déclenchée automatiquement par `subscription-lifecycle.ts` (fin de
 *  grâce sans paiement) ou manuellement par un Super Admin. Ne supprime JAMAIS aucune
 *  donnée (voir docs/14) — seule la disponibilité du site public et les opérations
 *  payantes sont affectées, jamais le contenu du tenant. */
export async function suspendSubscription(
  tx: Prisma.TransactionClient,
  tenantId: string,
  subscriptionId: string,
  actor: SuspendSubscriptionActor,
) {
  return transitionSubscriptionStatus(tx, tenantId, {
    subscriptionId,
    toStatus: "SUSPENDED",
    actorType: actor.actorType,
    actorUserId: actor.actorUserId,
    justification: actor.justification,
    eventType: "suspended",
  });
}

/**
 * Réactivation Super Admin SANS paiement (ex. suspension prononcée par erreur, litige
 * résolu à l'amiable) — pure transition de statut, ne prolonge JAMAIS la période
 * (contrairement à `confirmSubscriptionPaymentSuccess`, qui reste le SEUL chemin pour
 * une prolongation manuelle avec argent réellement reçu, voir docs/14). Justification
 * OBLIGATOIRE en couche applicative (route Super Admin), comme toute action manuelle.
 */
export async function reactivateSubscriptionWithoutPayment(
  tx: Prisma.TransactionClient,
  tenantId: string,
  subscriptionId: string,
  actor: { actorUserId?: string | null; justification: string },
) {
  return transitionSubscriptionStatus(tx, tenantId, {
    subscriptionId,
    toStatus: "ACTIVE",
    actorType: "super_admin",
    actorUserId: actor.actorUserId,
    justification: actor.justification,
    eventType: "reactivated_without_payment",
  });
}
