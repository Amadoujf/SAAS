import { describe, expect, it, vi } from "vitest";
import { deliverNotification, renderText } from "./notification-delivery";

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
    expect(await deliverNotification(job("email"), { fetch: ko, resendApiKey: "k", emailFrom: "x@y.sn" })).toEqual({ status: "failed", error: "Resend a répondu 422.", retryable: false });
    const down = vi.fn().mockRejectedValue(new Error("ECONNRESET"));
    expect(await deliverNotification(job("email"), { fetch: down, resendApiKey: "k", emailFrom: "x@y.sn" })).toMatchObject({ status: "failed", retryable: true });
    const busy = vi.fn().mockResolvedValue(new Response("{}", { status: 503 }));
    expect(await deliverNotification(job("email"), { fetch: busy, resendApiKey: "k", emailFrom: "x@y.sn" })).toMatchObject({ status: "failed", retryable: true });
    const limited = vi.fn().mockResolvedValue(new Response("{}", { status: 429 }));
    expect(await deliverNotification(job("email"), { fetch: limited, resendApiKey: "k", emailFrom: "x@y.sn" })).toMatchObject({ status: "failed", retryable: true });
  });
  it("interne (équipe) : visible dans le tableau de bord", async () => {
    expect((await deliverNotification(job("internal"), { fetch: vi.fn() })).status).toBe("sent");
  });

  it("rédige l'e-mail selon le type : jamais un gabarit de commande pour la facturation ou les domaines", () => {
    const reminder = renderText({ tenantId: "t", channel: "email", templateType: "billing_reminder_j_3", recipient: "a@b.sn", variables: { tenantName: "Boutique Aïda", milestone: "J-3" } });
    expect(reminder.subject).toContain("dans 3 jours");
    expect(reminder.text).toContain("Boutique Aïda");
    expect(reminder.text).not.toMatch(/commande/i);
    const suspended = renderText({ tenantId: "t", channel: "email", templateType: "billing_suspended", recipient: "a@b.sn", variables: { tenantName: "X" } });
    expect(suspended.subject).toBe("Votre site est suspendu");
    const order = renderText(job("email"));
    expect(order.subject).toBe("Commande reçue — CMD-2026-000001");
    expect(order.text).toContain("25");
  });
});
