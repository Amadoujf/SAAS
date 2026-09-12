import type {
  CreatePaymentInput,
  CreatePaymentResult,
  PaymentProviderAdapter,
  RefundInput,
  RefundResult,
  VerifiedWebhookEvent,
} from "../types";

/**
 * Adaptateur "paiement à la livraison" (COD). Ne contacte aucun service externe :
 * l'encaissement est confirmé par le livreur à la livraison — voir
 * docs/07-parcours-paiement-facture.md#73-paiement-à-la-livraison-cod — pas par un webhook.
 */
export class CashOnDeliveryAdapter implements PaymentProviderAdapter {
  readonly name = "cod" as const;

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    return {
      providerTransactionId: `cod:${input.orderId}`,
      checkoutUrl: input.returnUrl,
      raw: { mode: "cash_on_delivery" },
    };
  }

  async verifyWebhook(): Promise<VerifiedWebhookEvent> {
    throw new Error("CashOnDeliveryAdapter: aucun webhook attendu pour ce mode de paiement.");
  }

  async getStatus(providerTransactionId: string): Promise<VerifiedWebhookEvent> {
    return {
      eventId: `cod:${providerTransactionId}`,
      providerTransactionId,
      status: "pending",
      amount: 0,
      currency: "XOF",
      raw: null,
    };
  }

  async refund(_input: RefundInput): Promise<RefundResult> {
    throw new Error("CashOnDeliveryAdapter: remboursement à traiter manuellement.");
  }
}
