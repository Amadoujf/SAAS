import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ChariowBillingAdapter } from "./chariow.adapter";

const WEBHOOK_SECRET = "test-webhook-secret";

function makeAdapter() {
  return new ChariowBillingAdapter({
    secretKey: "test-secret-key",
    apiBaseUrl: "https://api.chariow.test",
    webhookSecret: WEBHOOK_SECRET,
  });
}

function sign(rawBody: string): string {
  return createHmac("sha256", WEBHOOK_SECRET).update(rawBody).digest("hex");
}

/**
 * Tests unitaires avec `fetch` simulé — JAMAIS un vrai appel réseau Chariow (même
 * méthode que `paydunya.adapter.test.ts`). Rappel : cet adaptateur est construit sur
 * une forme d'API RAISONNABLE MAIS NON VÉRIFIÉE (voir l'avertissement en tête de
 * `chariow.adapter.ts` et docs/14) — ces tests prouvent la cohérence INTERNE de
 * l'adaptateur (vérification de signature, cross-check, mapping de statut), pas sa
 * conformité à l'API Chariow réelle.
 */
describe("ChariowBillingAdapter.createCheckoutSession", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("retourne l'URL de paiement quand Chariow répond avec succès", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        json: async () => ({ success: true, data: { id: "checkout_123", checkout_url: "https://chariow.test/pay/checkout_123" } }),
      }),
    );

    const adapter = makeAdapter();
    const result = await adapter.createCheckoutSession({
      internalReference: "sub_checkout_abc",
      tenantId: "tenant-1",
      subscriptionId: "sub-1",
      planId: "plan-1",
      billingCycle: "MONTHLY",
      amountXOF: 15_000,
      currency: "XOF",
      description: "Formule Business — mensuel",
      customer: { name: "Boutique Test" },
      returnUrl: "https://app.test/billing/return",
      cancelUrl: "https://app.test/billing/cancel",
      callbackUrl: "https://app.test/api/webhooks/chariow",
    });

    expect(result.providerCheckoutId).toBe("checkout_123");
    expect(result.checkoutUrl).toBe("https://chariow.test/pay/checkout_123");
  });

  it("lève une erreur explicite si Chariow renvoie un échec", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        json: async () => ({ success: false, message: "Produit introuvable" }),
      }),
    );

    const adapter = makeAdapter();
    await expect(
      adapter.createCheckoutSession({
        internalReference: "sub_checkout_abc",
        tenantId: "tenant-1",
        subscriptionId: "sub-1",
        planId: "plan-1",
        billingCycle: "MONTHLY",
        amountXOF: 15_000,
        currency: "XOF",
        description: "Formule Business — mensuel",
        customer: { name: "Boutique Test" },
        returnUrl: "https://app.test/billing/return",
        cancelUrl: "https://app.test/billing/cancel",
        callbackUrl: "https://app.test/api/webhooks/chariow",
      }),
    ).rejects.toThrow(/Produit introuvable/);
  });
});

describe("ChariowBillingAdapter.verifyWebhook", () => {
  it("accepte un événement correctement signé et mappe le statut", async () => {
    const payload = JSON.stringify({
      event_id: "evt_1",
      data: {
        id: "sale_1",
        status: "completed",
        amount: 15_000,
        currency: "XOF",
        product_id: "prod_monthly",
        custom_metadata: { internal_reference: "sub_checkout_abc" },
      },
    });

    const adapter = makeAdapter();
    const result = await adapter.verifyWebhook({
      headers: { "x-chariow-signature": sign(payload) },
      rawBody: payload,
    });

    expect(result.status).toBe("succeeded");
    expect(result.providerSaleId).toBe("sale_1");
    expect(result.internalReference).toBe("sub_checkout_abc");
    expect(result.amountXOF).toBe(15_000);
  });

  it("rejette un événement dont la signature ne correspond pas au corps", async () => {
    const payload = JSON.stringify({ data: { id: "sale_1", status: "completed", amount: 15_000, currency: "XOF" } });
    const adapter = makeAdapter();

    await expect(
      adapter.verifyWebhook({ headers: { "x-chariow-signature": "0".repeat(64) }, rawBody: payload }),
    ).rejects.toThrow(/signature invalide/);
  });

  it("rejette un événement sans en-tête de signature", async () => {
    const adapter = makeAdapter();
    await expect(adapter.verifyWebhook({ headers: {}, rawBody: "{}" })).rejects.toThrow(/en-tête de signature manquant/);
  });

  it("détecte une tentative de rejeu avec un corps modifié après signature (signature non recalculée)", async () => {
    const originalPayload = JSON.stringify({ data: { id: "sale_1", status: "completed", amount: 15_000, currency: "XOF" } });
    const signature = sign(originalPayload);
    const tamperedPayload = JSON.stringify({ data: { id: "sale_1", status: "completed", amount: 1, currency: "XOF" } });

    const adapter = makeAdapter();
    await expect(
      adapter.verifyWebhook({ headers: { "x-chariow-signature": signature }, rawBody: tamperedPayload }),
    ).rejects.toThrow(/signature invalide/);
  });
});

describe("ChariowBillingAdapter.getStatus", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("interroge activement Chariow et retourne l'état vérifié", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        json: async () => ({
          success: true,
          data: { id: "sale_1", status: "completed", amount: 15_000, currency: "XOF", custom_metadata: { internal_reference: "sub_checkout_abc" } },
        }),
      }),
    );

    const adapter = makeAdapter();
    const result = await adapter.getStatus("sale_1");

    expect(result.status).toBe("succeeded");
    expect(result.internalReference).toBe("sub_checkout_abc");
  });
});
