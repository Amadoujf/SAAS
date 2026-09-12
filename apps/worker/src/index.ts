import { Worker } from "bullmq";
import { redisConnection, QUEUE_NAMES } from "@yamacommerce/queue";
import type {
  AIJobData,
  EmailJobData,
  ImportJobData,
  InvoiceJobData,
  NotificationJobData,
  WebhookPaymentJobData,
} from "@yamacommerce/queue";
import { processPaymentWebhook } from "@yamacommerce/payments";

/**
 * Worker BullMQ — voir docs/03-architecture-technique.md §3.5.
 *
 * Phase 0 : la file `webhooks-payments` est pleinement câblée (c'est elle qui porte les
 * exigences critiques de la Phase 0 — vérification serveur, idempotence, rapprochement).
 * Les autres files sont déclarées et démarrées (preuve que l'infrastructure Redis/BullMQ
 * fonctionne de bout en bout) mais leurs traitements réels (envoi d'email, rendu de PDF,
 * appel IA, parsing d'import) arrivent avec les fonctionnalités correspondantes en
 * Phase 1/2 — voir docs/09-plan-developpement.md.
 */

const concurrency = Number(process.env.WORKER_CONCURRENCY ?? 5);

const webhooksPaymentsWorker = new Worker<WebhookPaymentJobData>(
  QUEUE_NAMES.webhooksPayments,
  async (job) => {
    const { tenantId, provider, headers, rawBody } = job.data;
    const result = await processPaymentWebhook({
      tenantId,
      provider: provider as never,
      input: { headers, rawBody },
    });
    if (result.status === "error") {
      throw new Error(`Échec de traitement du webhook : ${result.reason}`);
    }
    return result;
  },
  { connection: redisConnection, concurrency },
);

const emailsWorker = new Worker<EmailJobData>(
  QUEUE_NAMES.emails,
  async (job) => {
    console.info(`[emails] TODO Phase 1 — envoi via Resend : ${JSON.stringify(job.data)}`);
  },
  { connection: redisConnection, concurrency },
);

const invoicesWorker = new Worker<InvoiceJobData>(
  QUEUE_NAMES.invoices,
  async (job) => {
    console.info(`[invoices] TODO Phase 1 — génération PDF/QR : ${JSON.stringify(job.data)}`);
  },
  { connection: redisConnection, concurrency },
);

const aiJobsWorker = new Worker<AIJobData>(
  QUEUE_NAMES.aiJobs,
  async (job) => {
    console.info(
      `[ai-jobs] TODO Phase 1 — pipeline IA fiche produit : ${JSON.stringify(job.data)}`,
    );
  },
  { connection: redisConnection, concurrency },
);

const importsWorker = new Worker<ImportJobData>(
  QUEUE_NAMES.imports,
  async (job) => {
    console.info(
      `[imports] TODO Phase 1 — parsing CSV/Excel/PDF/URL : ${JSON.stringify(job.data)}`,
    );
  },
  { connection: redisConnection, concurrency },
);

const notificationsWorker = new Worker<NotificationJobData>(
  QUEUE_NAMES.notifications,
  async (job) => {
    console.info(`[notifications] TODO Phase 2 — envoi SMS/WhatsApp : ${JSON.stringify(job.data)}`);
  },
  { connection: redisConnection, concurrency },
);

const workers = [
  webhooksPaymentsWorker,
  emailsWorker,
  invoicesWorker,
  aiJobsWorker,
  importsWorker,
  notificationsWorker,
];

for (const worker of workers) {
  worker.on("failed", (job, error) => {
    console.error(`[${worker.name}] job ${job?.id} en échec :`, error.message);
  });
}

console.info(
  `Worker YamaCommerce AI démarré — files actives : ${workers.map((w) => w.name).join(", ")}`,
);

async function shutdown() {
  console.info("Arrêt du worker en cours…");
  await Promise.all(workers.map((w) => w.close()));
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
