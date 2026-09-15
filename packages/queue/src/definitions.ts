/**
 * Files d'attente de la plateforme — voir docs/03-architecture-technique.md §3.5.
 * Un seul endroit définit les noms de file et la forme des jobs : `apps/web` (producteur)
 * et `apps/worker` (consommateur) importent tous deux depuis ce module.
 */
export const QUEUE_NAMES = {
  emails: "emails",
  invoices: "invoices",
  aiJobs: "ai-jobs",
  imports: "imports",
  webhooksPayments: "webhooks-payments",
  notifications: "notifications",
  sitePublishing: "site-publishing",
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

export interface EmailJobData {
  tenantId: string;
  to: string;
  templateType: string;
  locale: "fr" | "en" | "wo";
  variables: Record<string, unknown>;
}

export interface InvoiceJobData {
  tenantId: string;
  orderId: string;
  reason: "payment_confirmed" | "cod_delivery_confirmed";
}

export interface AIJobData {
  tenantId: string;
  jobId: string; // référence AIGenerationJob.id
  type: "product_from_photo" | "product_from_text" | "bulk_import" | "translation" | "chat_query";
}

export interface ImportJobData {
  tenantId: string;
  importJobId: string; // référence ImportJob.id
}

export interface WebhookPaymentJobData {
  tenantId: string;
  provider: string;
  headers: Record<string, string | string[] | undefined>;
  rawBody: string;
}

export interface NotificationJobData {
  tenantId: string;
  channel: "email" | "sms" | "whatsapp" | "internal";
  templateType: string;
  recipient: string;
  variables: Record<string, unknown>;
}

/**
 * Publication programmée d'un site — voir docs/12 §12.3, « publication définitive »
 * (22 septembre 2026). Un job est mis en file avec un `delay` calculé au moment de
 * `scheduleVersionPublish()` (voir @yamacommerce/database) pour arriver exactement à
 * `scheduledAtIso` ; `versionId` est la source de vérité au moment de l'exécution
 * (le worker relit TOUJOURS l'état réel en base plutôt que de faire confiance aux
 * autres champs, qui ne sont là que pour le diagnostic/les journaux — voir « Réessayer
 * en cas d'erreur temporaire », « Éviter les doubles publications »).
 */
export interface SitePublishingJobData {
  tenantId: string;
  tenantSiteId: string;
  versionId: string;
  scheduledAtIso: string;
  requestedByUserId: string;
}

/** Options par défaut appliquées à tous les jobs : retries avec backoff exponentiel,
 *  conservation limitée de l'historique pour ne pas saturer Redis. */
export const DEFAULT_JOB_OPTIONS = {
  attempts: 5,
  backoff: { type: "exponential", delay: 5_000 },
  removeOnComplete: { age: 60 * 60 * 24 * 7, count: 1_000 },
  removeOnFail: { age: 60 * 60 * 24 * 30 },
} as const;
