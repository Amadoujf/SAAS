import { randomUUID } from "node:crypto";
import type { Prisma } from "@yamacommerce/database";

/** Durée de validité d'une session de paiement avant qu'elle ne soit considérée
 *  abandonnée par le balayage de rapprochement (voir M7) — le client a largement le
 *  temps de compléter un paiement Wave/Orange Money/carte sur Chariow. */
export const CHECKOUT_SESSION_TTL_MS = 30 * 60 * 1000;

export function generateInternalReference(): string {
  return `sub_checkout_${randomUUID()}`;
}

/**
 * Garde contre les doubles sessions de paiement (même précédent que
 * `reserveOrReusePendingPayment` dans `packages/payments`) : un double clic sur
 * "Renouveler" ne doit jamais créer deux `BillingCheckoutSession` PENDING distinctes
 * pour le même abonnement+cycle — la session existante et encore valide (non expirée)
 * est réutilisée telle quelle, y compris son `internalReference` déjà transmis à
 * Chariow le cas échéant.
 *
 * Doit être appelée à l'intérieur d'une transaction ouverte via `withTenant` (le
 * paramètre `tx` en est la preuve dans la signature) — ce module ne doit jamais
 * accéder à la base hors contexte tenant.
 */
export async function reserveOrReuseCheckoutSession(
  tx: Prisma.TransactionClient,
  params: {
    tenantId: string;
    subscriptionId: string;
    planId: string;
    billingCycle: "MONTHLY" | "YEARLY";
    provider: string;
    amountXOF: number;
    currency?: string;
  },
) {
  const existing = await tx.billingCheckoutSession.findFirst({
    where: {
      tenantId: params.tenantId,
      subscriptionId: params.subscriptionId,
      planId: params.planId,
      billingCycle: params.billingCycle,
      provider: params.provider,
      status: "PENDING",
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });

  if (existing) {
    return { session: existing, reused: true };
  }

  const session = await tx.billingCheckoutSession.create({
    data: {
      tenantId: params.tenantId,
      subscriptionId: params.subscriptionId,
      planId: params.planId,
      billingCycle: params.billingCycle,
      provider: params.provider,
      internalReference: generateInternalReference(),
      amountXOF: params.amountXOF,
      currency: params.currency ?? "XOF",
      status: "PENDING",
      expiresAt: new Date(Date.now() + CHECKOUT_SESSION_TTL_MS),
    },
  });

  return { session, reused: false };
}
