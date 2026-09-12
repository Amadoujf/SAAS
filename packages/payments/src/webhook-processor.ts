import { prisma, withSuperAdminAccess, withTenant } from "@yamacommerce/database";
import { resolveProviderForTenant } from "./registry";
import type { PaymentProviderName, VerifyWebhookInput } from "./types";

export interface WebhookProcessingResult {
  status: "processed" | "ignored_duplicate" | "error";
  reason?: string;
}

/**
 * Traite une notification de paiement entrante de bout en bout :
 * 1. Résout l'adaptateur du BON tenant (le tenant est identifié par le chemin de l'URL de
 *    callback, ex. `/api/webhooks/paydunya/{tenantId}` — jamais par le contenu déclaré de
 *    la notification elle-même) puis charge SES identifiants marchand propres.
 * 2. Vérifie l'authenticité auprès du prestataire (jamais la charge utile brute seule).
 * 3. Applique l'idempotence webhook (`PaymentWebhookEvent.eventId` unique) — un rejeu
 *    réseau du même événement est ignoré, jamais retraité.
 * 4. Journalise systématiquement l'événement reçu (traité, ignoré ou en erreur).
 * 5. Programme une relance (backoff exponentiel) en cas d'échec de traitement.
 * 6. Répercute le résultat sur `Payment` et `Order`, dans le contexte RLS du tenant
 *    concerné (jamais une écriture cross-tenant directe).
 *
 * Destiné à être appelé depuis `apps/web/app/api/webhooks/[provider]/[tenantId]/route.ts`
 * (réponse HTTP immédiate) ou rejoué par `apps/worker` pour les relances.
 */
export async function processPaymentWebhook(params: {
  tenantId: string;
  provider: PaymentProviderName;
  input: VerifyWebhookInput;
}): Promise<WebhookProcessingResult> {
  const tenant = await withSuperAdminAccess((tx) =>
    tx.tenant.findUnique({ where: { id: params.tenantId } }),
  );
  if (!tenant) {
    return { status: "error", reason: "tenant_not_found" };
  }

  const adapter = await resolveProviderForTenant(tenant.id, params.provider, tenant.name);
  const input = params.input;

  let verified;
  try {
    verified = await adapter.verifyWebhook(input);
  } catch (error) {
    await prisma.paymentWebhookEvent.create({
      data: {
        provider: adapter.name,
        eventId: `invalid:${Date.now()}:${Math.random().toString(36).slice(2)}`,
        payload: { rawBody: input.rawBody },
        status: "error",
        lastError: error instanceof Error ? error.message : String(error),
      },
    });
    return { status: "error", reason: "signature_or_verification_failed" };
  }

  const existingEvent = await prisma.paymentWebhookEvent.findUnique({
    where: { provider_eventId: { provider: adapter.name, eventId: verified.eventId } },
  });
  if (existingEvent?.status === "processed") {
    return { status: "ignored_duplicate" };
  }

  const webhookEvent = await prisma.paymentWebhookEvent.upsert({
    where: { provider_eventId: { provider: adapter.name, eventId: verified.eventId } },
    create: {
      provider: adapter.name,
      eventId: verified.eventId,
      payload: verified.raw as object,
      status: "received",
    },
    update: { payload: verified.raw as object },
  });

  // Le tenant est déjà connu (résolu depuis l'URL de callback) : la recherche du
  // paiement reste dans son contexte RLS normal, aucun accès élevé nécessaire ici.
  const payment = await withTenant(tenant.id, (tx) =>
    tx.payment.findUnique({ where: { providerTransactionId: verified.providerTransactionId } }),
  );

  if (!payment) {
    await prisma.paymentWebhookEvent.update({
      where: { id: webhookEvent.id },
      data: {
        status: "error",
        lastError: "Aucun paiement local ne correspond à ce providerTransactionId pour ce tenant.",
        retryCount: { increment: 1 },
        nextRetryAt: nextRetryDelay(1),
      },
    });
    return { status: "error", reason: "payment_not_found" };
  }

  await withTenant(tenant.id, async (tx) => {
    await tx.payment.update({
      where: { id: payment.id },
      data: {
        status:
          verified.status === "succeeded"
            ? "SUCCEEDED"
            : verified.status === "failed"
              ? "FAILED"
              : "PENDING",
        verifiedAt: verified.status === "succeeded" ? new Date() : null,
        rawPayload: verified.raw as object,
      },
    });

    if (verified.status === "succeeded") {
      await tx.order.update({
        where: { id: payment.orderId },
        data: { paymentStatus: "PAID", status: "PAID" },
      });
      await tx.orderStatusHistory.create({
        data: {
          orderId: payment.orderId,
          toStatus: "PAID",
          changedByType: "system",
          note: `Paiement confirmé via ${adapter.name} (webhook vérifié serveur à serveur)`,
        },
      });
      // La génération de facture (Counter séquentiel + PDF + QR code) est déclenchée par
      // la file "invoices" à partir de cet événement — voir apps/worker, câblage en Phase 1.
    }
  });

  await prisma.paymentWebhookEvent.update({
    where: { id: webhookEvent.id },
    data: { status: "processed", processedAt: new Date() },
  });

  return { status: "processed" };
}

/** Backoff exponentiel plafonné à 60 minutes — relance automatique des échecs (adjustement #3). */
function nextRetryDelay(attempt: number): Date {
  const minutes = Math.min(60, 2 ** attempt);
  return new Date(Date.now() + minutes * 60 * 1000);
}
