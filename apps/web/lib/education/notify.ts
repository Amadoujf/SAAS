import "server-only";
import { recordNotification, ORDER_NOTIFICATION_EVENTS, ENROLLMENTS_MODULE, type OrderNotificationEvent, type Prisma } from "@yamacommerce/database";
import { dispatchPlannedNotifications, type PlannedNotification } from "@/lib/orders/notify";

/**
 * Notifications de l'établissement — MÊME journal et MÊME file que les autres secteurs
 * (`NotificationLog` → worker). Lignes `queued` dans la transaction de l'événement, mise
 * en file après le commit ; sans fournisseur configuré, le worker les passe à
 * `not_sent_no_provider` — jamais « envoyé » par défaut.
 */
export type EducationEvent = Extract<OrderNotificationEvent, `enrollment_${string}` | "grades_published">;

async function refOf(tx: Prisma.TransactionClient, tenantId: string, reservationId: string) {
  const r = await tx.reservation.findFirst({ where: { id: reservationId, tenantId, moduleKey: ENROLLMENTS_MODULE }, include: { customer: { select: { firstName: true, phone: true, email: true } } } });
  return r && { id: r.id, number: r.reference, firstName: r.customer.firstName, phone: r.customer.phone, email: r.customer.email };
}

export async function planEducationNotifications(tx: Prisma.TransactionClient, tenantId: string, reservationId: string, event: EducationEvent): Promise<PlannedNotification[]> {
  const ref = await refOf(tx, tenantId, reservationId);
  if (!ref) return [];
  const variables = { orderNumber: ref.number, firstName: ref.firstName, title: ORDER_NOTIFICATION_EVENTS[event] };
  const planned: PlannedNotification[] = [];
  for (const { channel, recipient } of [{ channel: "whatsapp" as const, recipient: ref.phone }, { channel: "email" as const, recipient: ref.email }]) {
    if (!recipient) continue;
    const log = await recordNotification(tx, tenantId, { orderId: ref.id, event, audience: "customer", channel, recipient });
    planned.push({ logId: log.id, channel, recipient, event, variables });
  }
  // Une nouvelle demande d'inscription est aussi un signal pour l'équipe.
  if (event === "enrollment_request_received") {
    const log = await recordNotification(tx, tenantId, { orderId: ref.id, event, audience: "merchant", channel: "internal", recipient: "équipe" });
    planned.push({ logId: log.id, channel: "internal", recipient: "équipe", event, variables });
  }
  return planned;
}

/** Mise en file APRÈS le commit ; une panne de la file ne fait jamais échouer l'action. */
export async function dispatchEducationNotifications(tenantId: string, planned: PlannedNotification[]) {
  if (!planned.length) return;
  try {
    await dispatchPlannedNotifications(tenantId, planned);
  } catch (error) {
    // Les lignes restent `queued` (visibles comme telles) : rien n'est présenté comme envoyé.
    // eslint-disable-next-line no-console
    console.error("[education] notifications non mises en file", error);
  }
}
