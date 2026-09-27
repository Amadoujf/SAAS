import { Worker } from "bullmq";
import {
  redisConnection,
  QUEUE_NAMES,
  domainDnsCheckQueue,
  stockReservationExpiryQueue,
  subscriptionLifecycleSweepQueue,
  notificationsQueue,
  deliverNotification,
} from "@yamacommerce/queue";
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
} from "@yamacommerce/queue";
import { processPaymentWebhook } from "@yamacommerce/payments";
import { processSaasBillingWebhook } from "@yamacommerce/billing";
import {
  releaseExpiredReservation,
  sweepExpiredReservations,
  sweepSubscriptionLifecycle,
  sweepExpiredCheckoutSessions,
  findDueBillingReminders,
  markBillingReminderSentForTenant,
  findDueStatusChangeNotifications,
  markStatusChangeNotificationSent,
  markNotificationOutcome,
  withTenant,
} from "@yamacommerce/database";

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

/**
 * Notifications : livraison RÉELLE (voir `deliverNotification`, @yamacommerce/queue).
 * Pour les notifications de commande (`notificationLogId`), le résultat est écrit
 * dans `NotificationLog` — `sent` seulement après une réponse positive d'un vrai
 * fournisseur, `not_sent_no_provider` si aucun n'est configuré (WhatsApp/SMS à ce
 * jour), `failed` sinon. Les autres notifications (domaines, publication,
 * facturation) suivent le même chemin mais sans journal dédié.
 */
const notificationsWorker = new Worker<NotificationJobData>(
  QUEUE_NAMES.notifications,
  async (job) => {
    const outcome = await deliverNotification(job.data, {
      fetch,
      resendApiKey: process.env.RESEND_API_KEY ?? null,
      emailFrom: process.env.EMAIL_FROM ?? null,
    });
    // Panne transitoire (réseau, 429, 5xx) avec des tentatives restantes : on lève
    // l'erreur pour que BullMQ relance le job (backoff) — la notification reste
    // « en file » ; elle n'est notée « échouée » qu'à la dernière tentative.
    const lastAttempt = job.attemptsMade + 1 >= (job.opts.attempts ?? 1);
    if (outcome.status === "failed" && outcome.retryable && !lastAttempt) {
      throw new Error(`[notifications] échec transitoire, nouvelle tentative : ${outcome.error}`);
    }
    if (job.data.notificationLogId) {
      await withTenant(job.data.tenantId, (tx) =>
        markNotificationOutcome(tx, job.data.tenantId, job.data.notificationLogId!, { status: outcome.status, error: outcome.error ?? null }),
      );
    }
    if (outcome.status === "not_sent_no_provider") {
      console.info(`[notifications] non envoyée (${job.data.channel}) : ${outcome.error}`);
    }
    return outcome;
  },
  { connection: redisConnection, concurrency },
);

/**
 * Promotion des publications PROGRAMMÉES — voir docs/12 §12.3, « PUBLICATION
 * PROGRAMMÉE ». Contrairement aux workers ci-dessus, celui-ci est RÉEL, pas un TODO :
 * c'est le cœur du déclenchement à échéance. N'exécute jamais la logique de
 * publication lui-même (verrou/transaction/RLS/cache Next.js) — il appelle la route
 * interne d'`apps/web`, seule à disposer d'un contexte Next.js pour
 * `revalidateTag` (voir apps/web/app/api/internal/site-publishing/promote/route.ts).
 *
 * Un statut HTTP 409 (verrou déjà détenu, transitoire) fait lever une exception pour
 * déclencher le réessai BullMQ déjà configuré sur cette file (backoff exponentiel,
 * voir @yamacommerce/queue `queues.ts`) ; toute autre réponse (publiée, bloquée,
 * permission révoquée, déjà traitée) est un résultat DÉFINITIF — le job se termine
 * normalement, l'erreur/le blocage final ayant déjà été journalisé et notifié côté
 * route interne.
 */
const webAppInternalUrl = process.env.WEB_APP_INTERNAL_URL ?? "http://localhost:3000";
const internalWorkerSecret = process.env.INTERNAL_WORKER_SECRET ?? "";

const sitePublishingWorker = new Worker<SitePublishingJobData>(
  QUEUE_NAMES.sitePublishing,
  async (job) => {
    const response = await fetch(`${webAppInternalUrl}/api/internal/site-publishing/promote`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-internal-secret": internalWorkerSecret },
      body: JSON.stringify(job.data),
    });
    if (response.status === 409) {
      throw new Error(`[site-publishing] verrou déjà détenu pour la version "${job.data.versionId}" — réessai.`);
    }
    if (!response.ok) {
      throw new Error(`[site-publishing] réponse inattendue de la route interne : ${response.status}`);
    }
    const result = (await response.json()) as { outcome: string };
    console.info(`[site-publishing] version "${job.data.versionId}" → ${result.outcome}`);
  },
  { connection: redisConnection, concurrency },
);

/**
 * Détection DNS des domaines personnalisés — voir docs/13, « DÉTECTION DNS ». Même
 * pattern que `sitePublishingWorker` : aucune logique métier ici, seulement l'appel à
 * la route interne d'`apps/web` (qui décide elle-même de reprogrammer la tentative
 * suivante, voir app/api/internal/domains/check/route.ts).
 */
const domainDnsCheckWorker = new Worker<DomainDnsCheckJobData>(
  QUEUE_NAMES.domainDnsCheck,
  async (job) => {
    if (job.data.domainId === "__sweep__") {
      const response = await fetch(`${webAppInternalUrl}/api/internal/domains/sweep`, {
        method: "POST",
        headers: { "x-internal-secret": internalWorkerSecret },
      });
      if (!response.ok) throw new Error(`[domain-dns-sweep] réponse inattendue : ${response.status}`);
      const result = (await response.json()) as { enqueued: number };
      console.info(`[domain-dns-sweep] ${result.enqueued} domaine(s) reprogrammé(s).`);
      return;
    }

    const response = await fetch(`${webAppInternalUrl}/api/internal/domains/check`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-internal-secret": internalWorkerSecret },
      body: JSON.stringify(job.data),
    });
    if (!response.ok) {
      throw new Error(`[domain-dns-check] réponse inattendue de la route interne : ${response.status}`);
    }
    const result = (await response.json()) as { outcome: string };
    console.info(`[domain-dns-check] domaine "${job.data.domainId}" → ${result.outcome}`);
  },
  { connection: redisConnection, concurrency },
);

// Balayage périodique (idempotent : `upsertJobScheduler` remplace un planificateur
// existant portant le même id plutôt que d'en empiler un nouveau à chaque redémarrage
// du worker) — voir app/api/internal/domains/sweep/route.ts.
await domainDnsCheckQueue.upsertJobScheduler(
  "domain-dns-sweep",
  { every: 15 * 60 * 1000 },
  { name: QUEUE_NAMES.domainDnsCheck, data: { tenantId: "*", domainId: "__sweep__", attempt: 0 } },
);

/**
 * Expiration des réservations de stock — étape 2 (clients/panier/commandes/
 * livraison, 19 septembre 2026). Contrairement à `domainDnsCheckWorker`, appelle
 * `releaseExpiredReservation`/`sweepExpiredReservations` (@yamacommerce/database)
 * DIRECTEMENT, même pattern que `webhooksPaymentsWorker` : aucun contexte Next.js
 * (`revalidateTag`) n'est nécessaire ici, contrairement à la publication de site — voir
 * `order-reservation.ts` pour toutes les garanties d'idempotence/traçabilité/course.
 *
 * `orderId === "__sweep__"` (même sentinel que le balayage DNS) déclenche le job de
 * RÉCUPÉRATION : retrouve, indépendamment de tout job individuel, les réservations
 * expirées qui auraient été manquées (interruption du worker, purge Redis) — voir la
 * revue de l'étape 2. Journalise des compteurs structurés (released/skipped/failed) à
 * chaque passage — la seule forme de "métriques" que ce projet expose aujourd'hui
 * (aucune infrastructure Prometheus/statsd existante à brancher ici).
 */
const stockReservationExpiryWorker = new Worker<StockReservationExpiryJobData>(
  QUEUE_NAMES.stockReservationExpiry,
  async (job) => {
    if (job.data.orderId === "__sweep__") {
      const result = await sweepExpiredReservations(100);
      console.info(
        `[stock-reservation-sweep] libérées=${result.released} ignorées=${result.skipped} échecs=${result.failed}`,
      );
      for (const error of result.errors) {
        console.error(
          `[stock-reservation-sweep] échec commande "${error.orderId}" (tenant "${error.tenantId}") :`,
          error.message,
        );
      }
      return;
    }

    const { tenantId, orderId } = job.data;
    const outcome = await releaseExpiredReservation(tenantId, orderId);
    console.info(`[stock-reservation-expiry] commande "${orderId}" → ${outcome.outcome}`);
  },
  { connection: redisConnection, concurrency },
);

// Balayage de RÉCUPÉRATION périodique — plus fréquent que le balayage DNS (5 min,
// pas 15) : une réservation dure ~30 min (voir `RESERVATION_WINDOW_MINUTES`), il faut
// la retrouver bien avant qu'un job individuel perdu ne laisse un stock immobilisé
// trop longtemps.
await stockReservationExpiryQueue.upsertJobScheduler(
  "stock-reservation-sweep",
  { every: 5 * 60 * 1000 },
  { name: QUEUE_NAMES.stockReservationExpiry, data: { tenantId: "*", orderId: "__sweep__" } },
);

/**
 * Facturation SaaS — voir docs/14-facturation-saas-abonnements.md. Contrairement à
 * `webhooksPaymentsWorker`, aucun `tenantId` connu à la réception (un seul compte
 * Chariow pour toute la plateforme) : `processSaasBillingWebhook` le retrouve lui-même
 * via `internalReference` -> `BillingCheckoutSession`.
 */
const saasBillingWebhooksWorker = new Worker<SaasBillingWebhookJobData>(
  QUEUE_NAMES.saasBillingWebhooks,
  async (job) => {
    const result = await processSaasBillingWebhook({ headers: job.data.headers, rawBody: job.data.rawBody });
    if (result.status === "error") {
      throw new Error(`Échec de traitement du webhook de facturation : ${result.reason}`);
    }
    return result;
  },
  { connection: redisConnection, concurrency },
);

/**
 * Décroissance automatique des abonnements (ACTIVE -> GRACE_PERIOD -> SUSPENDED) —
 * même principe que `stockReservationExpiryWorker` : la base de données (heure
 * PostgreSQL faisant foi dans `subscription-lifecycle.ts`) reste la SEULE source de
 * vérité, ce balayage périodique est le mécanisme de RÉCUPÉRATION, jamais dépendant
 * d'un job individuel qui pourrait être perdu.
 */
const subscriptionLifecycleSweepWorker = new Worker<SubscriptionLifecycleSweepJobData>(
  QUEUE_NAMES.subscriptionLifecycleSweep,
  async () => {
    const result = await sweepSubscriptionLifecycle(100);
    console.info(
      `[subscription-lifecycle-sweep] grâce=${result.gracePeriodStarted} suspendus=${result.suspended} inchangés=${result.noChange} échecs=${result.failed}`,
    );
    for (const error of result.errors) {
      console.error(
        `[subscription-lifecycle-sweep] échec abonnement "${error.subscriptionId}" (tenant "${error.tenantId}") :`,
        error.message,
      );
    }

    // Même passage périodique, même cadence : sessions de checkout PENDING
    // abandonnées au-delà de leur échéance — voir `sweepExpiredCheckoutSessions`.
    const expiredSessions = await sweepExpiredCheckoutSessions(100);
    if (expiredSessions > 0) console.info(`[subscription-lifecycle-sweep] sessions de checkout expirées=${expiredSessions}`);

    // Rappels d'échéance J-7/J-3/J-1/jour J — voir docs/14, M8. `packages/database`
    // ne fait QUE découvrir les rappels dus (aucune dépendance vers la file) ; c'est
    // ICI, côté worker, que le job réel est empilé sur `notifications` — cette étape
    // n'affirme JAMAIS qu'un e-mail/WhatsApp a été envoyé, seulement qu'un événement
    // réel a été mis en file (le worker `notifications` reste un TODO Phase 2).
    const dueReminders = await findDueBillingReminders(200);
    for (const reminder of dueReminders) {
      if (!reminder.ownerEmail && !reminder.ownerPhone) {
        console.error(
          `[billing-reminders] tenant "${reminder.tenantId}" sans propriétaire actif contactable — rappel "${reminder.milestone}" ignoré.`,
        );
        continue;
      }
      await notificationsQueue.add(QUEUE_NAMES.notifications, {
        tenantId: reminder.tenantId,
        channel: reminder.ownerEmail ? "email" : "whatsapp",
        templateType: `billing_reminder_${reminder.milestone.toLowerCase().replace("-", "_")}`,
        recipient: reminder.ownerEmail ?? reminder.ownerPhone ?? "",
        variables: { tenantName: reminder.tenantName, milestone: reminder.milestone, subscriptionId: reminder.subscriptionId },
      });
      await markBillingReminderSentForTenant(reminder.tenantId, reminder.subscriptionId, reminder.milestone);
    }
    if (dueReminders.length > 0) console.info(`[billing-reminders] ${dueReminders.length} rappel(s) mis en file.`);

    // Confirmations immédiates (début de grâce/suspension/renouvellement) — voir
    // docs/14, M8. Même garde destinataire, même politique "jamais prétendre qu'un
    // envoi a eu lieu" que ci-dessus.
    const dueStatusNotifications = await findDueStatusChangeNotifications(200);
    for (const notification of dueStatusNotifications) {
      if (!notification.ownerEmail && !notification.ownerPhone) {
        console.error(
          `[billing-status-notifications] tenant "${notification.tenantId}" sans propriétaire actif contactable — notification "${notification.eventType}" ignorée.`,
        );
        continue;
      }
      await notificationsQueue.add(QUEUE_NAMES.notifications, {
        tenantId: notification.tenantId,
        channel: notification.ownerEmail ? "email" : "whatsapp",
        templateType: `billing_${notification.eventType}`,
        recipient: notification.ownerEmail ?? notification.ownerPhone ?? "",
        variables: { tenantName: notification.tenantName, subscriptionId: notification.subscriptionId },
      });
      await markStatusChangeNotificationSent(notification.tenantId, notification.subscriptionId, notification.eventId);
    }
    if (dueStatusNotifications.length > 0) {
      console.info(`[billing-status-notifications] ${dueStatusNotifications.length} confirmation(s) mise(s) en file.`);
    }
  },
  { connection: redisConnection, concurrency },
);

// Même fréquence que le balayage de réservation de stock (5 min) — voir docs/14 :
// aucun tenant ne doit rester en GRACE_PERIOD/ACTIVE expiré plus de quelques minutes
// au-delà de l'échéance réelle avant que le statut affiché ne reflète la réalité.
await subscriptionLifecycleSweepQueue.upsertJobScheduler(
  "subscription-lifecycle-sweep",
  { every: 5 * 60 * 1000 },
  { name: QUEUE_NAMES.subscriptionLifecycleSweep, data: {} },
);

const workers = [
  webhooksPaymentsWorker,
  emailsWorker,
  invoicesWorker,
  aiJobsWorker,
  importsWorker,
  notificationsWorker,
  sitePublishingWorker,
  domainDnsCheckWorker,
  stockReservationExpiryWorker,
  saasBillingWebhooksWorker,
  subscriptionLifecycleSweepWorker,
];

for (const worker of workers) {
  worker.on("failed", (job, error) => {
    console.error(`[${worker.name}] job ${job?.id} en échec :`, error.message);
  });
}

console.info(
  `Worker Y-COM démarré — files actives : ${workers.map((w) => w.name).join(", ")}`,
);

async function shutdown() {
  console.info("Arrêt du worker en cours…");
  await Promise.all(workers.map((w) => w.close()));
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
