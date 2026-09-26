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
  domainDnsCheck: "domain-dns-check",
  stockReservationExpiry: "stock-reservation-expiry",
  saasBillingWebhooks: "saas-billing-webhooks",
  subscriptionLifecycleSweep: "subscription-lifecycle-sweep",
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
  /** Ligne `NotificationLog` à mettre à jour avec le résultat RÉEL de l'envoi —
   *  présente pour les notifications de commande (voir order-operations). */
  notificationLogId?: string;
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

/**
 * Détection DNS d'un domaine personnalisé — voir docs/13, « DÉTECTION DNS ». Un job
 * par TENTATIVE (jamais un seul job en boucle interne) : `attempt` sert à calculer
 * le délai progressif côté producteur (voir apps/web/lib/domains/dns-check.ts) et à
 * savoir, côté worker, combien de fois ce domaine a déjà été revérifié. Idempotent :
 * le worker relit TOUJOURS l'état réel du domaine avant d'agir (jamais de confiance
 * aveugle dans les champs de ce job).
 */
export interface DomainDnsCheckJobData {
  tenantId: string;
  domainId: string;
  attempt: number;
}

/**
 * Expiration d'une réservation de stock — étape 2 (clients/panier/commandes/
 * livraison, 19 septembre 2026). Un job par COMMANDE, planifié avec `jobId: orderId`
 * (dédoublonnage + poignée d'annulation, voir `checkout-pipeline.ts` et
 * `webhook-processor.ts`) et un `delay` = fenêtre de réservation
 * (`RESERVATION_WINDOW_MINUTES`, voir `@yamacommerce/database` `order-registry.ts`).
 * `orderId: "__sweep__"` est le sentinel du balayage périodique de RÉCUPÉRATION
 * (même convention que `DomainDnsCheckJobData`/`domainId: "__sweep__"`) — retrouve les
 * réservations expirées dont le job individuel aurait été perdu (interruption du
 * worker, purge Redis). Le worker relit TOUJOURS l'état réel en base (heure
 * PostgreSQL faisant foi) avant d'agir — jamais de confiance aveugle dans ce payload.
 */
export interface StockReservationExpiryJobData {
  tenantId: string;
  orderId: string;
}

/**
 * Notification Pulse de facturation SaaS reçue — voir docs/14-facturation-saas-
 * abonnements.md et `packages/billing/src/webhook-processor.ts`. Traitement
 * ASYNCHRONE (même raison que `WebhookPaymentJobData`) : un accusé de réception rapide
 * à Chariow, jamais le temps complet de vérification. Contrairement à
 * `WebhookPaymentJobData`, AUCUN `tenantId` connu à la réception (un seul compte
 * Chariow pour toute la plateforme, jamais un tenant dans l'URL) — le tenant est
 * retrouvé PLUS TARD par `processSaasBillingWebhook` via `internalReference`.
 */
export interface SaasBillingWebhookJobData {
  headers: Record<string, string | string[] | undefined>;
  rawBody: string;
}

/**
 * Balayage périodique de décroissance des abonnements (ACTIVE -> GRACE_PERIOD ->
 * SUSPENDED, voir `@yamacommerce/database` `subscription-lifecycle.ts`) — même
 * principe que `StockReservationExpiryJobData`/`orderId: "__sweep__"` : la base de
 * données reste la SEULE source de vérité (heure PostgreSQL faisant foi), ce job ne
 * fait que déclencher périodiquement une relecture réelle. Sentinel unique, jamais un
 * job par abonnement pour cette première version (voir docs/14, limites restantes) —
 * un futur job individuel planifié exactement à `currentPeriodEnd` ne ferait
 * qu'ACCÉLÉRER la détection, jamais remplacer ce balayage.
 */
export type SubscriptionLifecycleSweepJobData = Record<string, never>;

/** Options par défaut appliquées à tous les jobs : retries avec backoff exponentiel,
 *  conservation limitée de l'historique pour ne pas saturer Redis. */
export const DEFAULT_JOB_OPTIONS = {
  attempts: 5,
  backoff: { type: "exponential", delay: 5_000 },
  removeOnComplete: { age: 60 * 60 * 24 * 7, count: 1_000 },
  removeOnFail: { age: 60 * 60 * 24 * 30 },
} as const;
