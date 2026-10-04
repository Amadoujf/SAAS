import "server-only";
import { recordNotification, ORDER_NOTIFICATION_EVENTS, type OrderNotificationEvent, type Prisma } from "@yamacommerce/database";
import { dispatchPlannedNotifications, type PlannedNotification } from "@/lib/orders/notify";

/**
 * Notifications de la société de livraison — MÊME journal et MÊME file que les autres
 * secteurs. Lignes `queued` dans la transaction, mise en file après le commit ; sans
 * fournisseur WhatsApp / SMS configuré, elles passent à `not_sent_no_provider` — jamais
 * « envoyé » par défaut. Le destinataire est prévenu de l'arrivée (et reçoit son lien de
 * suivi, qui porte le code de remise) ; l'expéditeur, de l'issue.
 */
export type CourierEvent = Extract<OrderNotificationEvent, `courier_${string}`>;

export async function planCourierNotifications(tx: Prisma.TransactionClient, tenantId: string, jobId: string, event: CourierEvent): Promise<PlannedNotification[]> {
  const j = await tx.courierJob.findFirst({ where: { id: jobId, tenantId }, include: { sender: { select: { firstName: true, phone: true, email: true } } } });
  if (!j) return [];
  const planned: PlannedNotification[] = [];
  const toRecipient = event === "courier_job_created" || event === "courier_job_on_the_way";
  const targets = toRecipient ? [{ phone: j.recipientPhone, email: null, firstName: j.recipientName.split(" ")[0] ?? j.recipientName }] : [{ phone: j.sender.phone, email: j.sender.email, firstName: j.sender.firstName }];
  for (const t of targets) {
    const variables = { orderNumber: j.reference, firstName: t.firstName, title: ORDER_NOTIFICATION_EVENTS[event] };
    for (const { channel, recipient } of [{ channel: "whatsapp" as const, recipient: t.phone }, { channel: "email" as const, recipient: t.email }]) {
      if (!recipient) continue;
      const log = await recordNotification(tx, tenantId, { orderId: j.id, event, audience: "customer", channel, recipient });
      planned.push({ logId: log.id, channel, recipient, event, variables });
    }
  }
  if (event === "courier_job_created" && j.channel === "web") {
    const log = await recordNotification(tx, tenantId, { orderId: j.id, event, audience: "merchant", channel: "internal", recipient: "équipe" });
    planned.push({ logId: log.id, channel: "internal", recipient: "équipe", event, variables: { orderNumber: j.reference, firstName: j.sender.firstName, title: "Nouvelle course en ligne" } });
  }
  return planned;
}

/** Mise en file APRÈS le commit ; une panne de la file ne fait jamais échouer l'action. */
export async function dispatchCourierNotifications(tenantId: string, planned: PlannedNotification[]) {
  if (!planned.length) return;
  try {
    await dispatchPlannedNotifications(tenantId, planned);
  } catch (error) {
    // Les lignes restent `queued` (visibles comme telles) : rien n'est présenté comme envoyé.
    // eslint-disable-next-line no-console
    console.error("[courier] notifications non mises en file", error);
  }
}
