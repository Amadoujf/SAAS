import "server-only";
import { recordNotification, type OrderNotificationEvent, ORDER_NOTIFICATION_EVENTS, type Prisma } from "@yamacommerce/database";
import { notificationsQueue, QUEUE_NAMES } from "@yamacommerce/queue";

/**
 * Notifications de commande : deux temps, jamais confondus.
 * 1. `planOrderNotifications` — DANS la transaction de l'événement : crée les lignes
 *    `NotificationLog` au statut `queued` (l'événement existe, rien n'est envoyé).
 * 2. `dispatchPlannedNotifications` — APRÈS le commit : met les jobs en file. Seul
 *    le worker, après la réponse d'un fournisseur réel, peut passer une ligne à
 *    `sent` ; sans fournisseur configuré elle devient `not_sent_no_provider`.
 */
export interface PlannedNotification {
  logId: string;
  channel: "email" | "sms" | "whatsapp" | "internal";
  recipient: string;
  event: OrderNotificationEvent;
  variables: Record<string, unknown>;
}

const MERCHANT_EVENTS: OrderNotificationEvent[] = ["order_received", "payment_proof_to_review", "payment_received"];

export async function planOrderNotifications(
  tx: Prisma.TransactionClient,
  tenantId: string,
  orderId: string,
  event: OrderNotificationEvent,
): Promise<PlannedNotification[]> {
  const order = await tx.order.findFirst({
    where: { id: orderId, tenantId },
    include: { customer: { select: { firstName: true, phone: true, email: true } } },
  });
  if (!order) return [];
  const variables = {
    orderNumber: order.orderNumber,
    firstName: order.customer.firstName,
    total: order.total,
    status: order.status,
    title: ORDER_NOTIFICATION_EVENTS[event],
  };
  const planned: PlannedNotification[] = [];
  const customerChannels: { channel: PlannedNotification["channel"]; recipient: string | null }[] = [
    { channel: "whatsapp", recipient: order.customer.phone },
    { channel: "email", recipient: order.customer.email },
  ];
  if (event !== "payment_proof_to_review") {
    for (const { channel, recipient } of customerChannels) {
      if (!recipient) continue;
      const log = await recordNotification(tx, tenantId, { orderId, event, audience: "customer", channel, recipient });
      planned.push({ logId: log.id, channel, recipient, event, variables });
    }
  }
  if (MERCHANT_EVENTS.includes(event)) {
    const log = await recordNotification(tx, tenantId, { orderId, event, audience: "merchant", channel: "internal", recipient: "équipe" });
    planned.push({ logId: log.id, channel: "internal", recipient: "équipe", event, variables });
  }
  return planned;
}

export async function dispatchPlannedNotifications(tenantId: string, planned: PlannedNotification[]) {
  for (const n of planned) {
    await notificationsQueue.add(
      QUEUE_NAMES.notifications,
      { tenantId, channel: n.channel, templateType: n.event, recipient: n.recipient, variables: n.variables, notificationLogId: n.logId },
      { jobId: n.logId },
    );
  }
}
