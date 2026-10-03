import "server-only";
import { recordNotification, ORDER_NOTIFICATION_EVENTS, TEST_DRIVE_MODULE, type OrderNotificationEvent, type Prisma } from "@yamacommerce/database";
import { dispatchPlannedNotifications, type PlannedNotification } from "@/lib/orders/notify";

/**
 * Notifications de la concession — MÊME journal et MÊME file que les commandes de la
 * boutique et du restaurant (`NotificationLog` → worker). Lignes `queued` dans la
 * transaction de l'événement, mise en file après le commit ; sans fournisseur
 * WhatsApp / SMS / e-mail configuré, le worker les passe à `not_sent_no_provider` —
 * jamais « envoyé » par défaut.
 */
export type AutoEvent = Extract<OrderNotificationEvent, `test_drive_${string}` | `vehicle_${string}`>;

type Subject = { reservationId?: string; leadId?: string; importId?: string };

async function refOf(tx: Prisma.TransactionClient, tenantId: string, s: Subject) {
  if (s.reservationId) {
    const r = await tx.reservation.findFirst({ where: { id: s.reservationId, tenantId, moduleKey: TEST_DRIVE_MODULE }, include: { customer: { select: { firstName: true, phone: true, email: true } } } });
    return r && { id: r.id, number: r.reference, firstName: r.customer.firstName, phone: r.customer.phone, email: r.customer.email };
  }
  if (s.leadId) {
    const l = await tx.lead.findFirst({ where: { id: s.leadId, tenantId }, include: { customer: { select: { firstName: true, phone: true, email: true } } } });
    return l && { id: l.id, number: "Demande", firstName: l.customer.firstName, phone: l.customer.phone, email: l.customer.email };
  }
  if (s.importId) {
    const i = await tx.vehicleImport.findFirst({ where: { id: s.importId, tenantId }, include: { customer: { select: { firstName: true, phone: true, email: true } } } });
    return i?.customer ? { id: i.id, number: i.reference, firstName: i.customer.firstName, phone: i.customer.phone, email: i.customer.email } : null;
  }
  return null;
}

export async function planAutoNotifications(tx: Prisma.TransactionClient, tenantId: string, subject: Subject, event: AutoEvent): Promise<PlannedNotification[]> {
  const ref = await refOf(tx, tenantId, subject);
  if (!ref) return [];
  const variables = { orderNumber: ref.number, firstName: ref.firstName, title: ORDER_NOTIFICATION_EVENTS[event] };
  const planned: PlannedNotification[] = [];
  // Une nouvelle demande est un signal pour l'ÉQUIPE : le client n'est pas relancé.
  if (event === "vehicle_lead_received") {
    const log = await recordNotification(tx, tenantId, { orderId: ref.id, event, audience: "merchant", channel: "internal", recipient: "équipe" });
    return [{ logId: log.id, channel: "internal", recipient: "équipe", event, variables }];
  }
  for (const { channel, recipient } of [{ channel: "whatsapp" as const, recipient: ref.phone }, { channel: "email" as const, recipient: ref.email }]) {
    if (!recipient) continue;
    const log = await recordNotification(tx, tenantId, { orderId: ref.id, event, audience: "customer", channel, recipient });
    planned.push({ logId: log.id, channel, recipient, event, variables });
  }
  if (event === "test_drive_confirmed") {
    const log = await recordNotification(tx, tenantId, { orderId: ref.id, event, audience: "merchant", channel: "internal", recipient: "équipe" });
    planned.push({ logId: log.id, channel: "internal", recipient: "équipe", event, variables });
  }
  return planned;
}

/** Mise en file APRÈS le commit ; une panne de la file ne fait jamais échouer l'action. */
export async function dispatchAutoNotifications(tenantId: string, planned: PlannedNotification[]) {
  if (!planned.length) return;
  try {
    await dispatchPlannedNotifications(tenantId, planned);
  } catch (error) {
    // Les lignes restent `queued` (visibles comme telles) : rien n'est présenté comme envoyé.
    // eslint-disable-next-line no-console
    console.error("[auto] notifications non mises en file", error);
  }
}
