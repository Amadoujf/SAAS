import { randomUUID } from "node:crypto";
import type {
  CreateCheckoutSessionInput,
  CreateCheckoutSessionResult,
  SaasBillingProvider,
  VerifiedPulseEvent,
  VerifyPulseWebhookInput,
} from "../types";

/**
 * Adaptateur "manuel" — AUCUN appel réseau, jamais de vérification cryptographique.
 * Deux usages légitimes uniquement :
 * 1. Tests réels (voir webhook-processor.test.ts) : `verifyWebhook` lit directement
 *    le JSON du corps comme un `VerifiedPulseEvent` déjà construit par le test — pas
 *    de simulation de signature, ce n'est pas un vrai prestataire à imiter.
 * 2. Intervention Super Admin manuelle (paiement reçu hors ligne, ex. virement) —
 *    voir docs/14, « prolongation manuelle avec justification obligatoire » : dans ce
 *    cas, l'appelant (subscription-registry.ts, action Super Admin) construit
 *    lui-même l'événement à partir du formulaire rempli, jamais depuis un webhook
 *    entrant réel.
 */
export class ManualBillingAdapter implements SaasBillingProvider {
  readonly name = "manual" as const;

  async createCheckoutSession(input: CreateCheckoutSessionInput): Promise<CreateCheckoutSessionResult> {
    return {
      providerCheckoutId: `manual:${input.internalReference}`,
      checkoutUrl: input.returnUrl,
      raw: { mode: "manual" },
    };
  }

  async verifyWebhook(input: VerifyPulseWebhookInput): Promise<VerifiedPulseEvent> {
    const parsed = JSON.parse(input.rawBody) as Partial<VerifiedPulseEvent>;
    if (!parsed.providerSaleId || !parsed.status) {
      throw new Error("ManualBillingAdapter : événement invalide, `providerSaleId`/`status` requis.");
    }
    return {
      eventId: parsed.eventId ?? `manual:${randomUUID()}`,
      providerSaleId: parsed.providerSaleId,
      internalReference: parsed.internalReference ?? null,
      status: parsed.status,
      amountXOF: parsed.amountXOF ?? 0,
      currency: parsed.currency ?? "XOF",
      providerProductId: parsed.providerProductId ?? null,
      raw: parsed,
    };
  }

  async getStatus(providerSaleId: string): Promise<VerifiedPulseEvent> {
    return {
      eventId: `manual:${providerSaleId}`,
      providerSaleId,
      internalReference: null,
      status: "pending",
      amountXOF: 0,
      currency: "XOF",
      providerProductId: null,
      raw: null,
    };
  }
}
