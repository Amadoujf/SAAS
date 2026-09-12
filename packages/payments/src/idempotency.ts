import { randomUUID } from "node:crypto";
import type { Prisma } from "@yamacommerce/database";

export function generateIdempotencyKey(orderId: string): string {
  return `pay_${orderId}_${randomUUID()}`;
}

/**
 * Garde contre les doubles paiements (adjustement #3). Crée la ligne `Payment`
 * (status = PENDING) AVANT tout appel réseau au prestataire. Si un paiement PENDING ou
 * SUCCEEDED existe déjà pour cette commande et ce prestataire, il est réutilisé plutôt
 * que d'en créer un second — un double clic ou une double soumission du client ne peut
 * jamais produire deux transactions distinctes.
 *
 * Doit être appelé à l'intérieur d'une transaction ouverte via `withTenant` (le
 * paramètre `tx` en est la preuve dans la signature : ce module ne doit jamais
 * accéder à la base hors contexte tenant).
 */
export async function reserveOrReusePendingPayment(
  tx: Prisma.TransactionClient,
  params: {
    tenantId: string;
    orderId: string;
    provider: string;
    amount: number;
    type?: "full" | "partial" | "installment";
  },
) {
  const existing = await tx.payment.findFirst({
    where: {
      orderId: params.orderId,
      provider: params.provider,
      status: { in: ["PENDING", "SUCCEEDED"] },
    },
    orderBy: { createdAt: "desc" },
  });

  if (existing) {
    return { payment: existing, reused: true };
  }

  const payment = await tx.payment.create({
    data: {
      tenantId: params.tenantId,
      orderId: params.orderId,
      provider: params.provider,
      idempotencyKey: generateIdempotencyKey(params.orderId),
      amount: params.amount,
      type: params.type ?? "full",
      status: "PENDING",
    },
  });

  return { payment, reused: false };
}
