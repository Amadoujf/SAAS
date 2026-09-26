import type { NotificationJobData } from "./definitions";

/**
 * Livraison RÉELLE d'une notification — décide du statut final sans jamais simuler
 * un succès :
 * - `internal` : notification d'équipe, visible dans le tableau de bord → `sent`.
 * - `email` : envoyé via l'API Resend si `RESEND_API_KEY` est configurée ; `sent`
 *   uniquement sur réponse HTTP 2xx, `failed` sinon (message conservé).
 * - `whatsapp` / `sms` : aucun fournisseur branché à ce jour →
 *   `not_sent_no_provider`, jamais `sent`.
 */
export type DeliveryOutcome =
  | { status: "sent"; error?: null }
  | { status: "failed"; error: string }
  | { status: "not_sent_no_provider"; error: string };

export interface DeliveryDeps {
  fetch: typeof fetch;
  resendApiKey?: string | null;
  emailFrom?: string | null;
}

function renderText(job: NotificationJobData): { subject: string; text: string } {
  const v = job.variables as { title?: string; orderNumber?: string; firstName?: string; total?: number };
  const total = typeof v.total === "number" ? `${new Intl.NumberFormat("fr-SN").format(v.total)} FCFA` : "";
  return {
    subject: `${v.title ?? "Votre commande"} — ${v.orderNumber ?? ""}`.trim(),
    text: `Bonjour ${v.firstName ?? ""},\n\n${v.title ?? "Mise à jour de votre commande"} : commande ${v.orderNumber ?? ""}${total ? ` (${total})` : ""}.\n\nMerci pour votre confiance.`,
  };
}

export async function deliverNotification(job: NotificationJobData, deps: DeliveryDeps): Promise<DeliveryOutcome> {
  if (job.channel === "internal") return { status: "sent" };
  if (job.channel === "email") {
    if (!deps.resendApiKey || !deps.emailFrom) {
      return { status: "not_sent_no_provider", error: "Envoi d'e-mails non configuré (RESEND_API_KEY / EMAIL_FROM absents)." };
    }
    const { subject, text } = renderText(job);
    try {
      const res = await deps.fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { authorization: `Bearer ${deps.resendApiKey}`, "content-type": "application/json" },
        body: JSON.stringify({ from: deps.emailFrom, to: [job.recipient], subject, text }),
      });
      if (res.ok) return { status: "sent" };
      return { status: "failed", error: `Resend a répondu ${res.status}.` };
    } catch (error) {
      return { status: "failed", error: `Envoi impossible : ${error instanceof Error ? error.message : String(error)}` };
    }
  }
  return {
    status: "not_sent_no_provider",
    error: job.channel === "whatsapp" ? "Envoi WhatsApp pas encore branché (aucun fournisseur configuré)." : "Envoi SMS pas encore branché (aucun fournisseur configuré).",
  };
}
