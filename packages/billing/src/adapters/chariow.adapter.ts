import { createHmac, timingSafeEqual } from "node:crypto";
import type {
  CreateCheckoutSessionInput,
  CreateCheckoutSessionResult,
  SaasBillingProvider,
  VerifiedPulseEvent,
  VerifyPulseWebhookInput,
} from "../types";

/**
 * Adaptateur Chariow (prestataire de FACTURATION SAAS au lancement — voir
 * docs/14-facturation-saas-abonnements.md). Implémente `SaasBillingProvider` : aucun
 * autre module ne doit connaître les détails de l'API Chariow en dehors de ce fichier.
 *
 * ⚠️ AVERTISSEMENT — FORME NON VÉRIFIÉE : cette conception a été écrite SANS accès à
 * la documentation officielle Chariow réelle. L'endpoint exact, la forme du corps de
 * requête/réponse, le nom de l'en-tête de signature et l'algorithme exact (HMAC-SHA256
 * supposé ici, par convention la plus répandue) DOIVENT être confirmés en sandbox ou
 * auprès du support Chariow avant toute mise en production réelle — voir la liste des
 * limites restantes dans docs/14. Ne JAMAIS présenter cet adaptateur comme vérifié.
 *
 * Point clé de sécurité (même principe que PayDunyaAdapter) : la vérification
 * cryptographique de la signature est la PREMIÈRE ligne de défense, mais le montant/
 * la devise/le produit/le tenant sont TOUJOURS revérifiés séparément par
 * `webhook-processor.ts` avant toute confirmation — jamais une confiance aveugle dans
 * le contenu déclaré d'un Pulse, même signé.
 */
export interface ChariowAdapterOptions {
  secretKey: string;
  apiBaseUrl: string;
  webhookSecret: string;
}

interface ChariowCreateCheckoutResponse {
  success: boolean;
  message?: string;
  data?: { id: string; checkout_url: string };
}

interface ChariowSaleStatusResponse {
  success: boolean;
  message?: string;
  data?: {
    id: string;
    status: "completed" | "pending" | "failed" | "cancelled";
    amount: number;
    currency: string;
    product_id?: string;
    custom_metadata?: Record<string, string>;
  };
}

export class ChariowBillingAdapter implements SaasBillingProvider {
  readonly name = "chariow" as const;

  constructor(private readonly options: ChariowAdapterOptions) {}

  private headers(): Record<string, string> {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.options.secretKey}`,
    };
  }

  async createCheckoutSession(input: CreateCheckoutSessionInput): Promise<CreateCheckoutSessionResult> {
    // ⚠️ Endpoint/forme de requête SUPPOSÉS — voir l'avertissement de tête de fichier.
    const response = await fetch(`${this.options.apiBaseUrl}/v1/checkouts`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({
        product_id: input.providerProductId,
        amount: input.amountXOF,
        currency: input.currency,
        description: input.description,
        customer: input.customer,
        success_url: input.returnUrl,
        cancel_url: input.cancelUrl,
        webhook_url: input.callbackUrl,
        // `custom_metadata` : voir docs/14 — corrélation exclusivement via
        // `internal_reference`, jamais un identifiant devinable seul.
        custom_metadata: {
          tenant_id: input.tenantId,
          subscription_id: input.subscriptionId,
          plan_id: input.planId,
          billing_checkout_session_id: input.internalReference,
          internal_reference: input.internalReference,
        },
      }),
    });

    const data = (await response.json()) as ChariowCreateCheckoutResponse;
    if (!data.success || !data.data) {
      throw new Error(`Chariow : échec de création de la session de paiement — ${data.message ?? "réponse inattendue"}`);
    }

    return {
      providerCheckoutId: data.data.id,
      checkoutUrl: data.data.checkout_url,
      raw: data,
    };
  }

  async verifyWebhook(input: VerifyPulseWebhookInput): Promise<VerifiedPulseEvent> {
    // ⚠️ En-tête/algorithme de signature SUPPOSÉS (HMAC-SHA256 sur le corps brut,
    // convention la plus répandue) — À CONFIRMER avec la documentation Chariow réelle
    // avant production (voir l'avertissement de tête de fichier).
    const signatureHeader = input.headers["x-chariow-signature"];
    const signature = Array.isArray(signatureHeader) ? signatureHeader[0] : signatureHeader;
    if (!signature) {
      throw new Error("Chariow Pulse : en-tête de signature manquant.");
    }

    const expected = createHmac("sha256", this.options.webhookSecret).update(input.rawBody).digest("hex");
    const signatureBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expected);
    if (signatureBuffer.length !== expectedBuffer.length || !timingSafeEqual(signatureBuffer, expectedBuffer)) {
      throw new Error("Chariow Pulse : signature invalide.");
    }

    const payload = JSON.parse(input.rawBody) as {
      event_id?: string;
      data?: ChariowSaleStatusResponse["data"];
    };
    const sale = payload.data;
    if (!sale) {
      throw new Error("Chariow Pulse : événement sans données de vente.");
    }

    return {
      eventId: payload.event_id ?? `chariow:${sale.id}:${sale.status}`,
      providerSaleId: sale.id,
      internalReference: sale.custom_metadata?.internal_reference ?? null,
      status: sale.status === "completed" ? "succeeded" : sale.status === "cancelled" ? "failed" : "pending",
      amountXOF: sale.amount,
      currency: sale.currency,
      providerProductId: sale.product_id ?? null,
      raw: payload,
    };
  }

  async getStatus(providerSaleId: string): Promise<VerifiedPulseEvent> {
    // ⚠️ Endpoint SUPPOSÉ — voir l'avertissement de tête de fichier. Revérification
    // active nécessaire pour le balayage de rapprochement (jamais une confiance dans
    // le seul webhook, même signé — même principe que PayDunyaAdapter.getStatus).
    const response = await fetch(`${this.options.apiBaseUrl}/v1/sales/${providerSaleId}`, {
      method: "GET",
      headers: this.headers(),
    });
    const data = (await response.json()) as ChariowSaleStatusResponse;
    if (!data.success || !data.data) {
      throw new Error(`Chariow : échec de la vérification de la vente "${providerSaleId}" — ${data.message ?? "réponse inattendue"}`);
    }

    const sale = data.data;
    return {
      eventId: `chariow:${sale.id}:${sale.status}`,
      providerSaleId: sale.id,
      internalReference: sale.custom_metadata?.internal_reference ?? null,
      status: sale.status === "completed" ? "succeeded" : sale.status === "cancelled" ? "failed" : "pending",
      amountXOF: sale.amount,
      currency: sale.currency,
      providerProductId: sale.product_id ?? null,
      raw: data,
    };
  }
}
