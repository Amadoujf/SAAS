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
  /** `retryable` : panne transitoire (réseau, 429, 5xx) — le worker relance le job
   *  (tentatives BullMQ) au lieu de le considérer comme terminé. */
  | { status: "failed"; error: string; retryable: boolean }
  | { status: "not_sent_no_provider"; error: string };

export interface DeliveryDeps {
  fetch: typeof fetch;
  resendApiKey?: string | null;
  emailFrom?: string | null;
}

const fcfa = (n: unknown) => (typeof n === "number" ? `${new Intl.NumberFormat("fr-SN").format(n)} FCFA` : "");
const str = (v: unknown) => (typeof v === "string" ? v : "");

const MILESTONE_TEXT: Record<string, string> = {
  j_7: "arrive à échéance dans 7 jours",
  j_3: "arrive à échéance dans 3 jours",
  j_1: "arrive à échéance demain",
  j0: "arrive à échéance aujourd'hui",
};

const BILLING_STATUS_TEXT: Record<string, { subject: string; body: string }> = {
  grace_period_started: { subject: "Votre abonnement a expiré — période de grâce", body: "Votre abonnement a expiré. Votre site reste en ligne pendant la période de grâce : renouvelez-le depuis votre espace pour éviter sa suspension." },
  suspended: { subject: "Votre site est suspendu", body: "La période de grâce est terminée : votre site public est suspendu. Vos données sont conservées ; renouvelez votre abonnement depuis votre espace pour le remettre en ligne." },
  renewed: { subject: "Abonnement renouvelé", body: "Merci ! Votre abonnement a bien été renouvelé." },
  reactivated: { subject: "Abonnement réactivé", body: "Votre abonnement est de nouveau actif et votre site est en ligne." },
};

const SIMPLE_TEXT: Record<string, { subject: string; body: string }> = {
  site_published: { subject: "Votre site est publié", body: "La version programmée de votre site vient d'être publiée." },
  site_publish_failed: { subject: "Publication programmée non effectuée", body: "La publication programmée de votre site n'a pas pu être effectuée. Ouvrez l'éditeur pour la relancer." },
  domain_verified: { subject: "Votre domaine est vérifié", body: "Votre nom de domaine est bien relié à votre site." },
  https_enabled: { subject: "HTTPS activé sur votre domaine", body: "Le certificat de sécurité de votre domaine est actif." },
  domain_misconfigured: { subject: "Problème de configuration de votre domaine", body: "Votre nom de domaine ne pointe plus correctement vers votre site. Vérifiez sa configuration DNS depuis votre espace." },
};

/** Texte de l'e-mail selon le TYPE de notification — jamais un gabarit de commande
 *  pour un rappel d'abonnement ou une alerte de domaine. */
export function renderText(job: NotificationJobData): { subject: string; text: string } {
  const v = job.variables as Record<string, unknown>;
  const hello = str(v.firstName) ? `Bonjour ${str(v.firstName)},` : "Bonjour,";
  if (job.templateType.startsWith("billing_reminder_")) {
    const when = MILESTONE_TEXT[job.templateType.slice("billing_reminder_".length)] ?? "arrive bientôt à échéance";
    const who = str(v.tenantName) ? ` pour ${str(v.tenantName)}` : "";
    return {
      subject: `Votre abonnement YamaCommerce ${when}`,
      text: `${hello}\n\nVotre abonnement${who} ${when}. Il n'est pas débité automatiquement : renouvelez-le depuis votre espace (Facturation) pour garder votre site en ligne.\n\nL'équipe YamaCommerce`,
    };
  }
  const billing = job.templateType.startsWith("billing_") ? BILLING_STATUS_TEXT[job.templateType.slice("billing_".length)] : undefined;
  const simple = billing ?? SIMPLE_TEXT[job.templateType];
  if (simple) {
    const who = str(v.tenantName) ? ` (${str(v.tenantName)})` : "";
    return { subject: simple.subject, text: `${hello}\n\n${simple.body}${who ? `\n\nEntreprise : ${str(v.tenantName)}` : ""}\n\nL'équipe YamaCommerce` };
  }
  // Notifications de commande (order_received, payment_received…).
  const total = fcfa(v.total);
  return {
    subject: `${str(v.title) || "Votre commande"} — ${str(v.orderNumber)}`.trim().replace(/ —$/, ""),
    text: `${hello}\n\n${str(v.title) || "Mise à jour de votre commande"} : commande ${str(v.orderNumber)}${total ? ` (${total})` : ""}.\n\nMerci pour votre confiance.`,
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
      return { status: "failed", error: `Resend a répondu ${res.status}.`, retryable: res.status === 429 || res.status >= 500 };
    } catch (error) {
      return { status: "failed", error: `Envoi impossible : ${error instanceof Error ? error.message : String(error)}`, retryable: true };
    }
  }
  return {
    status: "not_sent_no_provider",
    error: job.channel === "whatsapp" ? "Envoi WhatsApp pas encore branché (aucun fournisseur configuré)." : "Envoi SMS pas encore branché (aucun fournisseur configuré).",
  };
}
