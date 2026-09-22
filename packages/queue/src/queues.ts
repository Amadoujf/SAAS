import { Queue } from "bullmq";
import { redisConnection } from "./connection";
import type {
  AIJobData,
  DomainDnsCheckJobData,
  EmailJobData,
  ImportJobData,
  InvoiceJobData,
  NotificationJobData,
  SaasBillingWebhookJobData,
  SitePublishingJobData,
  StockReservationExpiryJobData,
  SubscriptionLifecycleSweepJobData,
  WebhookPaymentJobData,
} from "./definitions";
import { DEFAULT_JOB_OPTIONS, QUEUE_NAMES } from "./definitions";

export const emailsQueue = new Queue<EmailJobData>(QUEUE_NAMES.emails, {
  connection: redisConnection,
  defaultJobOptions: DEFAULT_JOB_OPTIONS,
});

export const invoicesQueue = new Queue<InvoiceJobData>(QUEUE_NAMES.invoices, {
  connection: redisConnection,
  defaultJobOptions: DEFAULT_JOB_OPTIONS,
});

export const aiJobsQueue = new Queue<AIJobData>(QUEUE_NAMES.aiJobs, {
  connection: redisConnection,
  defaultJobOptions: DEFAULT_JOB_OPTIONS,
});

export const importsQueue = new Queue<ImportJobData>(QUEUE_NAMES.imports, {
  connection: redisConnection,
  defaultJobOptions: DEFAULT_JOB_OPTIONS,
});

export const webhooksPaymentsQueue = new Queue<WebhookPaymentJobData>(
  QUEUE_NAMES.webhooksPayments,
  {
    connection: redisConnection,
    // Les webhooks de paiement sont rejoués plus agressivement (relance automatique des
    // traitements échoués — adjustement #3) : plus de tentatives, backoff plus long.
    defaultJobOptions: {
      ...DEFAULT_JOB_OPTIONS,
      attempts: 10,
      backoff: { type: "exponential", delay: 10_000 },
    },
  },
);

export const notificationsQueue = new Queue<NotificationJobData>(QUEUE_NAMES.notifications, {
  connection: redisConnection,
  defaultJobOptions: DEFAULT_JOB_OPTIONS,
});

export const sitePublishingQueue = new Queue<SitePublishingJobData>(QUEUE_NAMES.sitePublishing, {
  connection: redisConnection,
  // Une seule tentative planifiée par version (voir `jobId: versionId` à l'ajout,
  // apps/web/lib/publishing/schedule-pipeline.ts) : BullMQ refuse alors tout doublon
  // avec le même id — c'est la PREMIÈRE ligne de défense contre une double
  // publication programmée, avant même le verrou distribué pris par le worker.
  defaultJobOptions: { ...DEFAULT_JOB_OPTIONS, attempts: 3, backoff: { type: "exponential", delay: 15_000 } },
});

/**
 * Détection DNS d'un domaine personnalisé — voir docs/13, « DÉTECTION DNS » :
 * « Utilise plusieurs tentatives », « Applique un délai progressif ». Chaque
 * tentative est un job SÉPARÉ (voir `DomainDnsCheckJobData.attempt`) que le worker
 * ré-enqueue lui-même avec un délai croissant tant que le domaine n'est ni vérifié
 * ni définitivement abandonné — jamais un simple `attempts` BullMQ automatique, qui
 * réessaierait immédiatement sur ÉCHEC (exception) plutôt que sur "pas encore prêt"
 * (un résultat normal, pas une erreur).
 */
export const domainDnsCheckQueue = new Queue<DomainDnsCheckJobData>(QUEUE_NAMES.domainDnsCheck, {
  connection: redisConnection,
  defaultJobOptions: { ...DEFAULT_JOB_OPTIONS, attempts: 1 },
});

/**
 * Expiration des réservations de stock — voir `StockReservationExpiryJobData`.
 * `attempts` réduit à 3 (pas 5) : un échec transitoire sur UNE commande est de toute
 * façon rattrapé par le balayage périodique (`stock-reservation-sweep`, voir
 * apps/worker) qui la retrouvera au prochain passage — inutile d'épuiser des
 * tentatives sur un job individuel potentiellement déjà obsolète (commande payée
 * entre-temps).
 */
export const stockReservationExpiryQueue = new Queue<StockReservationExpiryJobData>(
  QUEUE_NAMES.stockReservationExpiry,
  {
    connection: redisConnection,
    defaultJobOptions: { ...DEFAULT_JOB_OPTIONS, attempts: 3, backoff: { type: "exponential", delay: 10_000 } },
  },
);

/** Webhooks de facturation SaaS (Chariow Pulse) — voir `SaasBillingWebhookJobData`.
 *  Même politique de relance agressive que `webhooksPaymentsQueue` : de l'argent réel
 *  a changé de main, un échec transitoire de traitement ne doit jamais être abandonné
 *  trop tôt. */
export const saasBillingWebhooksQueue = new Queue<SaasBillingWebhookJobData>(QUEUE_NAMES.saasBillingWebhooks, {
  connection: redisConnection,
  defaultJobOptions: { ...DEFAULT_JOB_OPTIONS, attempts: 10, backoff: { type: "exponential", delay: 10_000 } },
});

/** Balayage périodique de décroissance des abonnements — voir
 *  `SubscriptionLifecycleSweepJobData`. */
export const subscriptionLifecycleSweepQueue = new Queue<SubscriptionLifecycleSweepJobData>(
  QUEUE_NAMES.subscriptionLifecycleSweep,
  { connection: redisConnection, defaultJobOptions: { ...DEFAULT_JOB_OPTIONS, attempts: 3 } },
);
