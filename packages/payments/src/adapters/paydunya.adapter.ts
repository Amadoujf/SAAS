import type {
  CreatePaymentInput,
  CreatePaymentResult,
  MerchantCredentials,
  PaymentProviderAdapter,
  RefundInput,
  RefundResult,
  VerifiedWebhookEvent,
  VerifyWebhookInput,
} from "../types";

/**
 * Adaptateur PayDunya (premier prestataire actif, en mode sandbox — voir décisions
 * validées de Phase 0). Implémente `PaymentProviderAdapter` : aucun autre module ne doit
 * connaître les détails de l'API PayDunya en dehors de ce fichier.
 *
 * Point clé de sécurité (adjustement #2) : une notification IPN n'est JAMAIS traitée
 * comme une preuve de paiement en elle-même. `verifyWebhook` extrait uniquement le
 * jeton de facture de la notification, puis interroge activement le serveur PayDunya
 * (`checkout-invoice/confirm/{token}`) pour obtenir le statut faisant foi. Une simple
 * redirection de navigateur n'est jamais utilisée pour valider un paiement.
 */
export interface PayDunyaCredentials extends MerchantCredentials {
  masterKey: string;
  privateKey: string;
  publicKey: string;
  token: string;
}

export interface PayDunyaAdapterOptions {
  credentials: PayDunyaCredentials;
  mode: "sandbox" | "live";
  storeName: string;
}

function baseUrl(mode: "sandbox" | "live"): string {
  return mode === "sandbox"
    ? "https://app.paydunya.com/sandbox-api/v1"
    : "https://app.paydunya.com/api/v1";
}

function checkoutUrl(mode: "sandbox" | "live", token: string): string {
  return mode === "sandbox"
    ? `https://paydunya.com/sandbox-checkout/invoice/${token}`
    : `https://paydunya.com/checkout/invoice/${token}`;
}

interface PayDunyaCreateInvoiceResponse {
  response_code: string;
  response_text: string;
  token?: string;
}

interface PayDunyaConfirmResponse {
  response_code: string;
  response_text: string;
  status?: "completed" | "pending" | "cancelled";
  invoice?: { total_amount?: string; token?: string };
}

export class PayDunyaAdapter implements PaymentProviderAdapter {
  readonly name = "paydunya" as const;

  private readonly credentials: PayDunyaCredentials;
  private readonly mode: "sandbox" | "live";
  private readonly storeName: string;

  constructor(options: PayDunyaAdapterOptions) {
    this.credentials = options.credentials;
    this.mode = options.mode;
    this.storeName = options.storeName;
  }

  private headers(): Record<string, string> {
    return {
      "Content-Type": "application/json",
      "PAYDUNYA-MASTER-KEY": this.credentials.masterKey,
      "PAYDUNYA-PRIVATE-KEY": this.credentials.privateKey,
      "PAYDUNYA-PUBLIC-KEY": this.credentials.publicKey,
      "PAYDUNYA-TOKEN": this.credentials.token,
    };
  }

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    const response = await fetch(`${baseUrl(this.mode)}/checkout-invoice/create`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({
        invoice: {
          total_amount: input.amount,
          description: input.description,
        },
        store: { name: this.storeName },
        actions: {
          cancel_url: input.cancelUrl,
          return_url: input.returnUrl,
          callback_url: input.callbackUrl,
        },
        custom_data: {
          orderId: input.orderId,
          tenantId: input.tenantId,
          idempotencyKey: input.idempotencyKey,
        },
      }),
    });

    const data = (await response.json()) as PayDunyaCreateInvoiceResponse;

    if (data.response_code !== "00" || !data.token) {
      throw new Error(`PayDunya: échec de création de facture — ${data.response_text}`);
    }

    return {
      providerTransactionId: data.token,
      checkoutUrl: checkoutUrl(this.mode, data.token),
      raw: data,
    };
  }

  async verifyWebhook(input: VerifyWebhookInput): Promise<VerifiedWebhookEvent> {
    const token = extractInvoiceToken(input.rawBody);
    if (!token) {
      throw new Error("PayDunya IPN : jeton de facture introuvable dans la notification reçue.");
    }
    // Ne jamais faire confiance au contenu de l'IPN seul : revérification systématique
    // auprès du serveur PayDunya.
    return this.getStatus(token);
  }

  async getStatus(providerTransactionId: string): Promise<VerifiedWebhookEvent> {
    const response = await fetch(
      `${baseUrl(this.mode)}/checkout-invoice/confirm/${providerTransactionId}`,
      { method: "GET", headers: this.headers() },
    );
    const data = (await response.json()) as PayDunyaConfirmResponse;

    if (data.response_code !== "00") {
      throw new Error(`PayDunya: échec de la vérification de transaction — ${data.response_text}`);
    }

    const status: VerifiedWebhookEvent["status"] =
      data.status === "completed"
        ? "succeeded"
        : data.status === "cancelled"
          ? "failed"
          : "pending";

    return {
      eventId: `paydunya:${providerTransactionId}:${data.status ?? "unknown"}`,
      providerTransactionId,
      status,
      amount: Number(data.invoice?.total_amount ?? 0),
      currency: "XOF",
      raw: data,
    };
  }

  async refund(_input: RefundInput): Promise<RefundResult> {
    // PayDunya ne propose pas d'API de remboursement automatisé généralisée : à traiter
    // manuellement (Wave/OM/virement) puis à enregistrer via le modèle `Refund`.
    throw new Error(
      "PayDunya: remboursement non automatisable via l'API — à traiter manuellement puis " +
        "à consigner via le module Refund.",
    );
  }
}

function extractInvoiceToken(rawBody: string): string | null {
  try {
    const json = JSON.parse(rawBody) as {
      data?: { invoice?: { token?: string } };
      token?: string;
    };
    return json.data?.invoice?.token ?? json.token ?? null;
  } catch {
    // PayDunya envoie parfois l'IPN en application/x-www-form-urlencoded.
    const params = new URLSearchParams(rawBody);
    return params.get("data[invoice][token]") ?? params.get("token");
  }
}
