import { confirmSubscriptionPaymentSuccess, withSuperAdminAccess, withTenant } from "@yamacommerce/database";
import { resolveSaasBillingProvider } from "./registry";
import type { VerifyPulseWebhookInput } from "./types";

export interface SaasBillingWebhookResult {
  status: "processed" | "ignored_duplicate" | "error";
  reason?: string;
}

/**
 * Traite une notification Pulse entrante de bout en bout — voir
 * docs/14-facturation-saas-abonnements.md. Point d'entrée unique appelé depuis
 * `apps/web/app/api/webhooks/chariow/route.ts` (M4, pas encore construit).
 *
 * Différence structurelle avec `processPaymentWebhook` (packages/payments) : le tenant
 * n'est PAS connu depuis l'URL (un seul compte Chariow pour toute la plateforme) — il
 * est retrouvé via `internalReference` -> `BillingCheckoutSession.tenantId`, JAMAIS
 * depuis un champ tenant déclaré dans le payload lui-même.
 *
 * Journalisation des événements invalides : deux cas bien distincts (voir docs/14) —
 * (1) signature invalide : le tenant est VRAIMENT inconnaissable à ce stade
 * (`ChariowBillingAdapter.verifyWebhook` rejette avant même de lire le corps), donc
 * IMPOSSIBLE d'écrire un `SubscriptionEvent` (table tenant-scopée par RLS) sans tenant
 * réel — journalisé en `console.error` uniquement, limite documentée dans docs/14 ;
 * (2) signature valide mais montant/devise/produit/session incohérents : le tenant EST
 * connu (retrouvé via la session) — journalisé en base (`SubscriptionEvent`,
 * append-only, non falsifiable) en plus du log serveur.
 */
export async function processSaasBillingWebhook(input: VerifyPulseWebhookInput): Promise<SaasBillingWebhookResult> {
  const provider = resolveSaasBillingProvider();

  let verified;
  try {
    verified = await provider.verifyWebhook(input);
  } catch (error) {
    console.error("[billing] Pulse webhook rejeté : signature invalide.", {
      error: error instanceof Error ? error.message : String(error),
    });
    return { status: "error", reason: "invalid_signature" };
  }

  if (!verified.internalReference) {
    console.error("[billing] Pulse webhook rejeté : aucune référence interne (custom_metadata) dans l'événement.", {
      providerSaleId: verified.providerSaleId,
    });
    return { status: "error", reason: "missing_internal_reference" };
  }

  const session = await withSuperAdminAccess((tx) =>
    tx.billingCheckoutSession.findUnique({ where: { internalReference: verified.internalReference! } }),
  );
  if (!session) {
    console.error("[billing] Pulse webhook rejeté : session de facturation introuvable.", {
      internalReference: verified.internalReference,
    });
    return { status: "error", reason: "session_not_found" };
  }
  if (!session.subscriptionId) {
    console.error("[billing] Pulse webhook rejeté : session sans abonnement cible.", {
      internalReference: session.internalReference,
    });
    return { status: "error", reason: "session_missing_subscription" };
  }

  const tenantId = session.tenantId;
  const subscriptionId = session.subscriptionId;

  if (verified.status !== "succeeded") {
    await withTenant(tenantId, (tx) =>
      tx.subscriptionEvent.create({
        data: {
          tenantId,
          subscriptionId,
          type: verified.status === "failed" ? "payment_failed" : "payment_pending",
          actorType: "webhook",
          payloadSnapshot: (verified.raw as object) ?? undefined,
        },
      }),
    );
    return { status: "processed" };
  }

  // Revérification active montant/devise — jamais une confiance aveugle dans le
  // contenu déclaré d'un Pulse, même signé (voir ChariowBillingAdapter et docs/14).
  if (verified.amountXOF !== session.amountXOF || verified.currency !== session.currency) {
    await withTenant(tenantId, (tx) =>
      tx.subscriptionEvent.create({
        data: {
          tenantId,
          subscriptionId,
          type: "webhook_rejected_amount_mismatch",
          actorType: "webhook",
          payloadSnapshot: {
            expected: { amountXOF: session.amountXOF, currency: session.currency },
            received: { amountXOF: verified.amountXOF, currency: verified.currency },
          },
        },
      }),
    );
    return { status: "error", reason: "amount_or_currency_mismatch" };
  }

  // Cross-check produit (si le prestataire renvoie un identifiant produit) : doit
  // correspondre au produit Chariow attendu pour LA FORMULE+CYCLE de cette session.
  if (verified.providerProductId) {
    const plan = await withSuperAdminAccess((tx) => tx.subscriptionPlan.findUnique({ where: { id: session.planId } }));
    const expectedProductId =
      session.billingCycle === "YEARLY" ? plan?.chariowYearlyProductId : plan?.chariowMonthlyProductId;
    if (expectedProductId && expectedProductId !== verified.providerProductId) {
      await withTenant(tenantId, (tx) =>
        tx.subscriptionEvent.create({
          data: {
            tenantId,
            subscriptionId,
            type: "webhook_rejected_product_mismatch",
            actorType: "webhook",
            payloadSnapshot: { expectedProductId, receivedProductId: verified.providerProductId },
          },
        }),
      );
      return { status: "error", reason: "product_mismatch" };
    }
  }

  const result = await withTenant(tenantId, (tx) =>
    confirmSubscriptionPaymentSuccess(tx, tenantId, {
      subscriptionId,
      checkoutSessionId: session.id,
      provider: provider.name,
      providerSaleId: verified.providerSaleId,
      planId: session.planId,
      billingCycle: session.billingCycle,
      amountXOF: verified.amountXOF,
      currency: verified.currency,
      rawPayload: verified.raw,
    }),
  );

  return { status: result.outcome === "already_confirmed" ? "ignored_duplicate" : "processed" };
}
