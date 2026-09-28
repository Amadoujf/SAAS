import "server-only";
import { recordNotification, ORDER_NOTIFICATION_EVENTS, TABLE_BOOKING_MODULE, type OrderNotificationEvent, type Prisma } from "@yamacommerce/database";
import { dispatchPlannedNotifications, type PlannedNotification } from "@/lib/orders/notify";

/**
 * Notifications du restaurant — MÊME journal et MÊME file que les commandes de la
 * boutique (`NotificationLog` → worker). Deux temps, jamais confondus :
 * 1. dans la transaction de l'événement : lignes `queued` ;
 * 2. après le commit : mise en file. Sans fournisseur WhatsApp/SMS/e-mail configuré, le
 *    worker les passe à `not_sent_no_provider` — jamais « envoyé » par défaut.
 */
export type RestaurantEvent = Extract<OrderNotificationEvent, `restaurant_${string}` | `table_booking_${string}`>;

const MERCHANT: RestaurantEvent[] = ["restaurant_order_received"];

export async function planRestaurantNotifications(tx: Prisma.TransactionClient, tenantId: string, subject: { orderId?: string; reservationId?: string }, event: RestaurantEvent): Promise<PlannedNotification[]> {
  let ref: { id: string; number: string; firstName: string; phone: string | null; email: string | null; total: number | null } | null = null;
  if (subject.orderId) {
    const o = await tx.restaurantOrder.findFirst({ where: { id: subject.orderId, tenantId }, include: { customer: { select: { email: true } } } });
    if (o) ref = { id: o.id, number: o.number, firstName: o.customerName.split(" ")[0] ?? o.customerName, phone: o.customerPhone, email: o.customer?.email ?? null, total: o.total };
  } else if (subject.reservationId) {
    const r = await tx.reservation.findFirst({ where: { id: subject.reservationId, tenantId, moduleKey: TABLE_BOOKING_MODULE }, include: { customer: { select: { firstName: true, phone: true, email: true } } } });
    if (r) ref = { id: r.id, number: r.reference, firstName: r.customer.firstName, phone: r.customer.phone, email: r.customer.email, total: null };
  }
  if (!ref) return [];
  const variables = { orderNumber: ref.number, firstName: ref.firstName, total: ref.total ?? undefined, title: ORDER_NOTIFICATION_EVENTS[event] };
  const planned: PlannedNotification[] = [];
  for (const { channel, recipient } of [{ channel: "whatsapp" as const, recipient: ref.phone }, { channel: "email" as const, recipient: ref.email }]) {
    if (!recipient) continue;
    const log = await recordNotification(tx, tenantId, { orderId: ref.id, event, audience: "customer", channel, recipient });
    planned.push({ logId: log.id, channel, recipient, event, variables });
  }
  if (MERCHANT.includes(event)) {
    const log = await recordNotification(tx, tenantId, { orderId: ref.id, event, audience: "merchant", channel: "internal", recipient: "équipe" });
    planned.push({ logId: log.id, channel: "internal", recipient: "équipe", event, variables });
  }
  return planned;
}

/** Mise en file APRÈS le commit ; une panne de la file ne fait jamais échouer l'action. */
export async function dispatchRestaurantNotifications(tenantId: string, planned: PlannedNotification[]) {
  if (!planned.length) return;
  try {
    await dispatchPlannedNotifications(tenantId, planned);
  } catch (error) {
    // Les lignes restent `queued` (visibles comme telles) : rien n'est présenté comme envoyé.
    // eslint-disable-next-line no-console
    console.error("[restaurant] notifications non mises en file", error);
  }
}
