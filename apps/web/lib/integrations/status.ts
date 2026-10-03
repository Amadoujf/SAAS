import "server-only";
import { withTenant } from "@yamacommerce/database";
import { ONLINE_PROVIDERS } from "@yamacommerce/payments";
import { getAiStatus } from "@/lib/ai/provider";
import { platformAiCapXOF } from "@/lib/ai/budget";

/**
 * État EXPLICITE des intégrations — ce qui fonctionne réellement, ce qui ne l'est pas,
 * et ce qu'il faut pour l'activer. Lu à chaque affichage (variables d'environnement de
 * la plateforme + configuration de l'entreprise), jamais supposé :
 * - une notification « en file » n'est pas « envoyée » ;
 * - un encaissement saisi par l'équipe n'est pas un « paiement en ligne » ;
 * - une simulation de l'assistant n'est pas une génération IA.
 * Aucune valeur secrète n'est lue pour l'affichage : seulement sa présence.
 */

export type IntegrationState = "operational" | "simulation" | "not_configured" | "not_available";

export interface Integration {
  key: string;
  group: "ia" | "notifications" | "paiements";
  label: string;
  state: IntegrationState;
  detail: string;
  /** Ce qu'il faut pour l'activer (variables d'environnement, réglage, contrat). */
  howTo?: string;
}

const has = (name: string) => Boolean(process.env[name]?.trim());

/** Intégrations de la PLATEFORME (identiques pour toutes les entreprises). */
export function platformIntegrations(): Integration[] {
  const ai = getAiStatus();
  return [
    {
      key: "ai",
      group: "ia",
      label: "Assistant IA (création et modification du site)",
      state: ai.kind === "anthropic" ? "operational" : ai.kind === "simulated" ? "simulation" : "not_configured",
      detail:
        ai.kind === "anthropic"
          ? `Génération réelle par ${ai.model}. ${platformAiCapXOF() === null ? "Aucun plafond mensuel de plateforme (seuls les plafonds des formules s'appliquent)." : `Plafond mensuel de la plateforme : ${platformAiCapXOF()!.toLocaleString("fr-FR")} FCFA estimés.`}`
          : ai.kind === "simulated"
            ? "Simulation locale par règles (développement uniquement) : chaque proposition est étiquetée « simulation », jamais présentée comme une génération IA."
            : "Aucune clé configurée : l'assistant l'indique et ne propose rien.",
      howTo: ai.kind === "anthropic" ? undefined : "Renseigner AI_PROVIDER_API_KEY (clé Anthropic) dans les variables d'environnement du serveur ; AI_MODEL facultatif (défaut claude-sonnet-5-5) ; AI_PLATFORM_MONTHLY_CAP_XOF recommandé (plafond mensuel global). Jamais dans le code.",
    },
    {
      key: "email",
      group: "notifications",
      label: "E-mails (clients et équipe)",
      state: has("RESEND_API_KEY") && has("EMAIL_FROM") ? "operational" : "not_configured",
      detail: has("RESEND_API_KEY") && has("EMAIL_FROM") ? "Envoyés par Resend ; « envoyé » seulement sur réponse positive du fournisseur." : "Non envoyés : les notifications restent « en file » puis passent à « non envoyée — aucun fournisseur ».",
      howTo: "Renseigner RESEND_API_KEY et EMAIL_FROM (domaine d'envoi vérifié chez Resend).",
    },
    {
      key: "whatsapp",
      group: "notifications",
      label: "WhatsApp",
      state: "not_available",
      detail: "Envoi pas encore branché : aucune notification WhatsApp n'est envoyée ni présentée comme envoyée.",
      howTo: "Compte WhatsApp Business (Meta) par entreprise + WHATSAPP_META_APP_ID / WHATSAPP_META_APP_SECRET, puis branchement de l'envoi (à développer).",
    },
    {
      key: "sms",
      group: "notifications",
      label: "SMS",
      state: "not_available",
      detail: "Envoi pas encore branché : aucun SMS n'est envoyé ni présenté comme envoyé.",
      howTo: "Fournisseur SMS (Twilio ou opérateur local) : TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER, puis branchement de l'envoi (à développer).",
    },
    {
      key: "samirpay",
      group: "paiements",
      label: "SamirPay",
      state: "not_available",
      detail: "Non intégré : à confirmer avec le fournisseur (documentation, conditions, environnement de test).",
    },
    {
      key: "chariow",
      group: "paiements",
      label: "Abonnements Y-COM (Chariow)",
      state: process.env.SAAS_BILLING_PROVIDER === "chariow" && has("CHARIOW_SECRET_KEY") ? "operational" : "not_configured",
      detail: "Réservé aux abonnements des entreprises à Y-COM — jamais aux paiements de leurs clients.",
      howTo: "SAAS_BILLING_PROVIDER=chariow, CHARIOW_SECRET_KEY, CHARIOW_WEBHOOK_SECRET.",
    },
  ];
}

/** Intégrations propres à UNE entreprise (paiements de ses clients). */
export async function tenantIntegrations(tenantId: string): Promise<Integration[]> {
  const configs = await withTenant(tenantId, (tx) => tx.paymentProviderConfig.findMany({ where: { tenantId }, select: { provider: true, isEnabled: true, mode: true, credentialsCiphertext: true } }));
  const online = configs.find((c) => (ONLINE_PROVIDERS as string[]).includes(c.provider) && c.isEnabled);
  const manual = configs.filter((c) => (c.provider === "wave_direct" || c.provider === "orange_money_direct") && c.isEnabled);
  const cod = configs.find((c) => c.provider === "cod" && c.isEnabled);
  const onlineReady = Boolean(online?.credentialsCiphertext);
  return [
    {
      key: "online_payment",
      group: "paiements",
      label: "Paiement en ligne (PayDunya)",
      state: onlineReady ? (online!.mode === "live" ? "operational" : "simulation") : "not_configured",
      detail: onlineReady
        ? online!.mode === "live"
          ? "Actif en production sur la boutique en ligne : une commande n'est « payée » qu'après confirmation du prestataire."
          : "Mode test (sandbox) du prestataire : aucun argent réel."
        : "Non configuré : aucun paiement en ligne n'est proposé à vos clients.",
      howTo: onlineReady ? undefined : "Connecter votre compte marchand PayDunya dans « Moyens de paiement » (clés chiffrées). Disponible aujourd'hui pour la boutique en ligne uniquement.",
    },
    {
      key: "manual_mobile_money",
      group: "paiements",
      label: "Wave / Orange Money (numéros de l'entreprise)",
      state: manual.length ? "operational" : "not_configured",
      detail: manual.length
        ? `Le client transfère vers votre numéro (${manual.map((m) => (m.provider === "wave_direct" ? "Wave" : "Orange Money")).join(", ")}) ; l'équipe vérifie puis enregistre l'encaissement. Ce n'est pas un paiement en ligne.`
        : "Aucun numéro renseigné.",
      howTo: manual.length ? undefined : "Renseigner vos numéros dans « Moyens de paiement ».",
    },
    {
      key: "manual_desk",
      group: "paiements",
      label: "Encaissements au comptoir (espèces, carte sur terminal, virement)",
      state: "operational",
      detail: `Saisis par l'équipe avec reçu numéroté, annulables avec motif.${cod ? " Paiement à la livraison proposé sur la boutique." : ""}`,
    },
  ];
}

export const STATE_LABELS: Record<IntegrationState, { label: string; tone: "success" | "warning" | "neutral" | "danger" }> = {
  operational: { label: "Opérationnel", tone: "success" },
  simulation: { label: "Simulation / test", tone: "warning" },
  not_configured: { label: "Non configuré", tone: "neutral" },
  not_available: { label: "Pas encore disponible", tone: "danger" },
};
