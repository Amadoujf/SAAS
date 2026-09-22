import { Prisma } from "@prisma/client";
import { withSuperAdminAccess, withTenant } from "./tenant-context";

/**
 * Rappels d'échéance — voir docs/14-facturation-saas-abonnements.md, M8. Même
 * architecture que `subscription-lifecycle.ts` : source de vérité en base
 * (`currentPeriodEnd`, `@db.Timestamptz(3)`, comparé à `NOW()` PostgreSQL), un
 * balayage périodique découvre les rappels dus — jamais un job BullMQ différé par
 * rappel (4 jobs à annuler/replanifier à chaque renouvellement anticipé aurait
 * dupliqué une logique que ce simple balayage rend inutile).
 *
 * `packages/database` n'a JAMAIS de dépendance vers `@yamacommerce/queue` (frontière
 * déjà respectée par tout le reste de ce package) — ce module ne fait QUE découvrir
 * les rappels dus et marquer qu'ils l'ont été ; l'appelant (`apps/worker`, qui a
 * accès à la file `notifications`) est seul responsable de l'empilement réel du job,
 * voir la note de tête de `NotificationJobData` : ceci n'affirme JAMAIS qu'un
 * e-mail/WhatsApp a été envoyé, seulement qu'un événement réel a été mis en file.
 */
export type BillingReminderMilestone = "J-7" | "J-3" | "J-1" | "J0";

export interface DueBillingReminder {
  tenantId: string;
  subscriptionId: string;
  milestone: BillingReminderMilestone;
  tenantName: string;
  /** E-mail du PREMIER membre "OWNER" actif trouvé — `null` si aucun (compte
   *  incomplet) ; l'appelant décide alors de ne pas empiler de job plutôt que
   *  d'envoyer un rappel sans destinataire. */
  ownerEmail: string | null;
  ownerPhone: string | null;
}

/**
 * Découverte CROSS-TENANT — nécessite `withSuperAdminAccess`. Un seul rappel PAR
 * PALIER par période (`NOT EXISTS` sur un `SubscriptionEvent` "reminder_sent" déjà
 * écrit APRÈS `currentPeriodStart` pour ce palier précis) : un renouvellement change
 * `currentPeriodStart`, ce qui rend automatiquement de nouveau éligibles les rappels
 * du PROCHAIN cycle — jamais un état à réinitialiser manuellement. Le contact du
 * propriétaire est résolu dans la MÊME requête (jamais N+1) via `LATERAL JOIN` sur le
 * premier `TenantUser` actif dont le rôle est "OWNER".
 */
export async function findDueBillingReminders(batchSize = 200): Promise<DueBillingReminder[]> {
  return withSuperAdminAccess((tx) =>
    tx.$queryRaw<DueBillingReminder[]>`
      SELECT ts."tenantId", ts.id AS "subscriptionId", milestones.milestone, t.name AS "tenantName",
        owner."email" AS "ownerEmail", owner."phone" AS "ownerPhone"
      FROM "TenantSubscription" ts
      JOIN "Tenant" t ON t.id = ts."tenantId"
      CROSS JOIN LATERAL (
        SELECT CASE
          WHEN ts."currentPeriodEnd" <= NOW() THEN 'J0'
          WHEN ts."currentPeriodEnd" <= NOW() + INTERVAL '1 day' THEN 'J-1'
          WHEN ts."currentPeriodEnd" <= NOW() + INTERVAL '3 days' THEN 'J-3'
          ELSE 'J-7'
        END AS milestone
      ) AS milestones
      LEFT JOIN LATERAL (
        SELECT u."email", u."phone"
        FROM "TenantUser" tu
        JOIN "Role" r ON r.id = tu."roleId"
        JOIN "User" u ON u.id = tu."userId"
        WHERE tu."tenantId" = ts."tenantId" AND tu.status = 'ACTIVE' AND r.name = 'OWNER'
        LIMIT 1
      ) AS owner ON true
      WHERE ts.status = 'ACTIVE'
        AND ts."currentPeriodEnd" <= NOW() + INTERVAL '7 days'
        AND NOT EXISTS (
          SELECT 1 FROM "SubscriptionEvent" se
          WHERE se."subscriptionId" = ts.id
            AND se.type = 'reminder_sent'
            AND se."payloadSnapshot"->>'milestone' = milestones.milestone
            AND se."createdAt" > ts."currentPeriodStart"
        )
      LIMIT ${batchSize}
    `,
  );
}

/** Marque un rappel comme envoyé — écrit un `SubscriptionEvent` (append-only,
 *  immuable) qui rend `findDueBillingReminders` idempotent pour ce palier tant que
 *  `currentPeriodStart` ne change pas. */
export async function markBillingReminderSent(
  tx: Prisma.TransactionClient,
  tenantId: string,
  subscriptionId: string,
  milestone: BillingReminderMilestone,
) {
  await tx.subscriptionEvent.create({
    data: { tenantId, subscriptionId, type: "reminder_sent", actorType: "system", payloadSnapshot: { milestone } },
  });
}

/** Point d'entrée appelé par le worker pour UN rappel précis — ouvre sa PROPRE
 *  transaction `withTenant`. Ne fait QUE marquer l'événement ; l'empilement réel du
 *  job de notification reste à l'appelant AVANT cet appel (voir apps/worker). */
export async function markBillingReminderSentForTenant(
  tenantId: string,
  subscriptionId: string,
  milestone: BillingReminderMilestone,
) {
  return withTenant(tenantId, (tx) => markBillingReminderSent(tx, tenantId, subscriptionId, milestone));
}

/** Événements de CHANGEMENT DE STATUT qui méritent une notification immédiate — voir
 *  docs/14, M8 : « début de grâce/suspension/confirmation de renouvellement ». Ne
 *  couvre PAS "checkout_created"/webhooks rejetés (bruit interne, pas une
 *  notification tenant). */
const NOTIFIABLE_EVENT_TYPES = ["grace_period_started", "suspended", "renewed", "reactivated"] as const;
export type NotifiableSubscriptionEventType = (typeof NOTIFIABLE_EVENT_TYPES)[number];

export interface DueStatusChangeNotification {
  tenantId: string;
  subscriptionId: string;
  eventId: string;
  eventType: NotifiableSubscriptionEventType;
  tenantName: string;
  ownerEmail: string | null;
  ownerPhone: string | null;
}

/**
 * Découverte CROSS-TENANT des événements de statut pas encore notifiés — un
 * `SubscriptionEvent` "notification_sent" avec `payloadSnapshot.sourceEventId`
 * pointant vers l'événement d'origine marque qu'il l'a été (même idiome que
 * `reminder_sent`/`milestone`, jamais un état à réinitialiser).
 */
export async function findDueStatusChangeNotifications(batchSize = 200): Promise<DueStatusChangeNotification[]> {
  return withSuperAdminAccess((tx) =>
    tx.$queryRaw<DueStatusChangeNotification[]>`
      SELECT se."tenantId", se."subscriptionId", se.id AS "eventId", se.type AS "eventType", t.name AS "tenantName",
        owner."email" AS "ownerEmail", owner."phone" AS "ownerPhone"
      FROM "SubscriptionEvent" se
      JOIN "Tenant" t ON t.id = se."tenantId"
      LEFT JOIN LATERAL (
        SELECT u."email", u."phone"
        FROM "TenantUser" tu
        JOIN "Role" r ON r.id = tu."roleId"
        JOIN "User" u ON u.id = tu."userId"
        WHERE tu."tenantId" = se."tenantId" AND tu.status = 'ACTIVE' AND r.name = 'OWNER'
        LIMIT 1
      ) AS owner ON true
      WHERE se.type IN (${Prisma.join(NOTIFIABLE_EVENT_TYPES)})
        AND se."subscriptionId" IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM "SubscriptionEvent" notif
          WHERE notif.type = 'notification_sent' AND notif."payloadSnapshot"->>'sourceEventId' = se.id::text
        )
      ORDER BY se."createdAt" ASC
      LIMIT ${batchSize}
    `,
  );
}

export async function markStatusChangeNotificationSent(tenantId: string, subscriptionId: string, sourceEventId: string) {
  return withTenant(tenantId, (tx) =>
    tx.subscriptionEvent.create({
      data: { tenantId, subscriptionId, type: "notification_sent", actorType: "system", payloadSnapshot: { sourceEventId } },
    }),
  );
}
