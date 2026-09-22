import { confirmOrderPaymentSuccess, withSuperAdminAccess, withTenant } from "@yamacommerce/database";
import { stockReservationExpiryQueue } from "@yamacommerce/queue";
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
    await withTenant(tenant.id, (tx) =>
      tx.paymentWebhookEvent.create({
        data: {
          tenantId: tenant.id,
          provider: adapter.name,
          eventId: `invalid:${Date.now()}:${Math.random().toString(36).slice(2)}`,
          payload: { rawBody: input.rawBody },
          status: "error",
          lastError: error instanceof Error ? error.message : String(error),
        },
      }),
    );
    return { status: "error", reason: "signature_or_verification_failed" };
  }

  const existingEvent = await withTenant(tenant.id, (tx) =>
    tx.paymentWebhookEvent.findUnique({
      where: { provider_eventId: { provider: adapter.name, eventId: verified.eventId } },
    }),
  );
  if (existingEvent?.status === "processed") {
    return { status: "ignored_duplicate" };
  }

  const webhookEvent = await withTenant(tenant.id, (tx) =>
    tx.paymentWebhookEvent.upsert({
      where: { provider_eventId: { provider: adapter.name, eventId: verified.eventId } },
      create: {
        tenantId: tenant.id,
        provider: adapter.name,
        eventId: verified.eventId,
        payload: verified.raw as object,
        status: "received",
      },
      update: { payload: verified.raw as object },
    }),
  );

  // Le tenant est déjà connu (résolu depuis l'URL de callback) : la recherche du
  // paiement reste dans son contexte RLS normal, aucun accès élevé nécessaire ici.
  const payment = await withTenant(tenant.id, (tx) =>
    tx.payment.findUnique({ where: { providerTransactionId: verified.providerTransactionId } }),
  );

  if (!payment) {
    await withTenant(tenant.id, (tx) =>
      tx.paymentWebhookEvent.update({
        where: { id: webhookEvent.id },
        data: {
          status: "error",
          lastError: "Aucun paiement local ne correspond à ce providerTransactionId pour ce tenant.",
          retryCount: { increment: 1 },
          nextRetryAt: nextRetryDelay(1),
        },
      }),
    );
    return { status: "error", reason: "payment_not_found" };
  }

  // Défense en profondeur : `params.tenantId` (URL de callback) ne doit JAMAIS, à lui
  // seul, suffire à faire confiance à la requête — voir la revue de l'étape 2. La
  // chaîne réelle de confiance est : (1) le prestataire est résolu avec les
  // identifiants PROPRES de CE tenant (`resolveProviderForTenant`), (2)
  // `verifyWebhook` revérifie activement AUPRÈS DU PRESTATATAIRE avec ces mêmes
  // identifiants (jamais le contenu déclaré de la notification seule), (3) le
  // `Payment` retrouvé est déjà scoping-vérifié par RLS via `withTenant(tenant.id)` —
  // cette assertion explicite documente et verrouille l'invariant plutôt que de
  // dépendre implicitement de la RLS seule.
  if (payment.tenantId !== tenant.id) {
    await withTenant(tenant.id, (tx) =>
      tx.paymentWebhookEvent.update({
        where: { id: webhookEvent.id },
        data: { status: "error", lastError: "Incohérence tenant : paiement retrouvé n'appartenant pas à ce tenant." },
      }),
    );
    return { status: "error", reason: "tenant_mismatch" };
  }

  let confirmationOutcome: "confirmed" | "already_confirmed" | "flagged_for_manual_reconciliation" | null = null;

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
      // `confirmOrderPaymentSuccess` (packages/database, order-registry.ts) est le SEUL
      // effet de bord autorisé d'un paiement réussi : passe par la machine à états
      // gardée (`transitionOrderStatus`, jamais un `tx.order.update` direct comme
      // avant l'étape 2), enchaîne AWAITING_PAYMENT -> PAID -> CONFIRMED, commet
      // réellement le stock réservé. TROIS issues possibles, TOUTES définitives (donc
      // TOUJOURS "processed", jamais "error" — voir la revue : un conflit métier gagné
      // par une expiration concurrente n'est pas un échec technique à rejouer) :
      // rejeu (`already_confirmed`), confirmation normale (`confirmed`), ou paiement
      // arrivé après l'expiration de la réservation (`flagged_for_manual_reconciliation`
      // — jamais un succès automatique sans stock réel, voir `Payment.reconciliationStatus`).
      const result = await confirmOrderPaymentSuccess(
        tx,
        tenant.id,
        payment.orderId,
        `Paiement confirmé via ${adapter.name} (webhook vérifié serveur à serveur)`,
      );
      confirmationOutcome = result.outcome;
      // La génération de facture (Counter séquentiel + PDF + QR code) est déclenchée par
      // la file "invoices" à partir de cet événement — voir apps/worker, câblage en Phase 1.
    }
  });

  if (confirmationOutcome === "confirmed" || confirmationOutcome === "already_confirmed") {
    // La commande a atteint CONFIRMED (ou l'avait déjà atteint) : le job d'expiration
    // de réservation planifié à l'achat (voir checkout-pipeline.ts, `jobId:
    // order.id`) n'a plus lieu d'être — annulé hors transaction, comme toute
    // opération de file d'attente (voir `withTenant`, jamais de Redis à l'intérieur
    // d'une transaction PostgreSQL). Silencieux si déjà absent (job déjà exécuté,
    // déjà annulé, ou jamais planifié — commande COD par exemple).
    const job = await stockReservationExpiryQueue.getJob(payment.orderId);
    await job?.remove();
  }

  await withTenant(tenant.id, (tx) =>
    tx.paymentWebhookEvent.update({
      where: { id: webhookEvent.id },
      data: { status: "processed", processedAt: new Date() },
    }),
  );

  return {
    status: "processed",
    ...(confirmationOutcome === "flagged_for_manual_reconciliation"
      ? { reason: "payment_succeeded_after_reservation_expired_manual_review_required" }
      : {}),
  };
}

/** Backoff exponentiel plafonné à 60 minutes — relance automatique des échecs (adjustement #3). */
function nextRetryDelay(attempt: number): Date {
  const minutes = Math.min(60, 2 ** attempt);
  return new Date(Date.now() + minutes * 60 * 1000);
}
