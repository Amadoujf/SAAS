import { afterEach, describe, expect, it, vi } from "vitest";
import { PayDunyaAdapter } from "./paydunya.adapter";

function makeAdapter(mode: "sandbox" | "live" = "sandbox") {
  return new PayDunyaAdapter({
    mode,
    storeName: "Boutique Test",
    credentials: {
      masterKey: "master-key",
      privateKey: "private-key",
      publicKey: "public-key",
      token: "token",
    },
  });
}

describe("PayDunyaAdapter.createPayment", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("retourne l'URL de paiement sandbox quand PayDunya répond avec succès", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        json: async () => ({ response_code: "00", response_text: "OK", token: "abc123" }),
      }),
    );

    const adapter = makeAdapter("sandbox");
    const result = await adapter.createPayment({
      idempotencyKey: "idem-1",
      orderId: "order-1",
      tenantId: "tenant-1",
      amount: 10_000,
      currency: "XOF",
      description: "Commande test",
      customer: { name: "Client Test" },
      returnUrl: "https://boutique.test/retour",
      cancelUrl: "https://boutique.test/annule",
      callbackUrl: "https://boutique.test/api/webhooks/paydunya",
    });

    expect(result.providerTransactionId).toBe("abc123");
    expect(result.checkoutUrl).toContain("sandbox-checkout");
    expect(result.checkoutUrl).toContain("abc123");
  });

  it("lève une erreur explicite si PayDunya renvoie un code d'échec", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        json: async () => ({ response_code: "01", response_text: "Clés invalides" }),
      }),
    );

    const adapter = makeAdapter();
    await expect(
      adapter.createPayment({
        idempotencyKey: "idem-2",
        orderId: "order-2",
        tenantId: "tenant-1",
        amount: 10_000,
        currency: "XOF",
        description: "Commande test",
        customer: { name: "Client Test" },
        returnUrl: "https://boutique.test/retour",
        cancelUrl: "https://boutique.test/annule",
        callbackUrl: "https://boutique.test/api/webhooks/paydunya",
      }),
    ).rejects.toThrow(/Clés invalides/);
  });
});

describe("PayDunyaAdapter.verifyWebhook", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("ignore le contenu de l'IPN et revérifie toujours auprès du serveur PayDunya", async () => {
    const confirmCall = vi.fn().mockResolvedValue({
      json: async () => ({
        response_code: "00",
        response_text: "OK",
        status: "completed",
        invoice: { total_amount: "10000", token: "abc123" },
      }),
    });
    vi.stubGlobal("fetch", confirmCall);

    const adapter = makeAdapter();
    const result = await adapter.verifyWebhook({
      headers: {},
      rawBody: JSON.stringify({ data: { invoice: { token: "abc123" } } }),
    });

    expect(confirmCall).toHaveBeenCalledWith(
      expect.stringContaining("checkout-invoice/confirm/abc123"),
      expect.any(Object),
    );
    expect(result.status).toBe("succeeded");
    expect(result.amount).toBe(10_000);
  });

  it("rejette si aucun jeton de facture n'est présent dans la notification", async () => {
    const adapter = makeAdapter();
    await expect(adapter.verifyWebhook({ headers: {}, rawBody: "{}" })).rejects.toThrow(
      /jeton de facture introuvable/,
    );
  });
});
