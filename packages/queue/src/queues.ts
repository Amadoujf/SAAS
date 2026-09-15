import { Queue } from "bullmq";
import { redisConnection } from "./connection";
import type {
  AIJobData,
  EmailJobData,
  ImportJobData,
  InvoiceJobData,
  NotificationJobData,
  SitePublishingJobData,
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
