import { describe, expect, it, vi } from "vitest";
import { deliverNotification } from "./notification-delivery";

const job = (channel: "email" | "whatsapp" | "sms" | "internal") => ({
  tenantId: "t", channel, templateType: "order_received", recipient: channel === "email" ? "a@b.sn" : "+221770000000",
  variables: { title: "Commande reçue", orderNumber: "CMD-2026-000001", firstName: "Awa", total: 25_000 },
});

describe("deliverNotification — jamais un succès simulé", () => {
  it("WhatsApp/SMS sans fournisseur : non envoyée, jamais « sent »", async () => {
    const fetch = vi.fn();
    expect((await deliverNotification(job("whatsapp"), { fetch })).status).toBe("not_sent_no_provider");
    expect((await deliverNotification(job("sms"), { fetch })).status).toBe("not_sent_no_provider");
    expect(fetch).not.toHaveBeenCalled();
  });
  it("e-mail sans clé : non envoyé, aucun appel réseau", async () => {
    const fetch = vi.fn();
    expect((await deliverNotification(job("email"), { fetch, resendApiKey: "", emailFrom: "x@y.sn" })).status).toBe("not_sent_no_provider");
    expect(fetch).not.toHaveBeenCalled();
  });
  it("e-mail : « sent » UNIQUEMENT sur réponse 2xx du fournisseur", async () => {
    const ok = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    expect((await deliverNotification(job("email"), { fetch: ok, resendApiKey: "k", emailFrom: "x@y.sn" })).status).toBe("sent");
    expect(ok.mock.calls[0]![0]).toBe("https://api.resend.com/emails");
    const ko = vi.fn().mockResolvedValue(new Response("{}", { status: 422 }));
    expect(await deliverNotification(job("email"), { fetch: ko, resendApiKey: "k", emailFrom: "x@y.sn" })).toEqual({ status: "failed", error: "Resend a répondu 422." });
    const down = vi.fn().mockRejectedValue(new Error("ECONNRESET"));
    expect((await deliverNotification(job("email"), { fetch: down, resendApiKey: "k", emailFrom: "x@y.sn" })).status).toBe("failed");
  });
  it("interne (équipe) : visible dans le tableau de bord", async () => {
    expect((await deliverNotification(job("internal"), { fetch: vi.fn() })).status).toBe("sent");
  });
});
