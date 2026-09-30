import type { Prisma } from "@prisma/client";

/**
 * Journal honnête des notifications de commande — voir `NotificationLog`
 * (schema.prisma). Chaque événement métier crée une ligne `queued` DANS la même
 * transaction que l'événement lui-même ; seul le worker, après la réponse réelle
 * d'un fournisseur, peut la faire passer à `sent`. Sans fournisseur configuré, la
 * ligne devient `not_sent_no_provider` — jamais `sent`.
 */

export const ORDER_NOTIFICATION_EVENTS = {
  order_received: "Commande reçue",
  payment_received: "Paiement reçu",
  payment_failed: "Paiement refusé",
  payment_proof_to_review: "Preuve de paiement à vérifier",
  manual_payment_approved: "Paiement manuel validé",
  manual_payment_rejected: "Preuve de paiement refusée",
  order_preparing: "Commande en préparation",
  order_shipped: "Commande expédiée",
  order_out_for_delivery: "Commande en cours de livraison",
  order_delivered: "Commande livrée",
  order_canceled: "Commande annulée",
  order_refunded: "Remboursement enregistré",
  invoice_available: "Facture disponible",
  // Restauration (commandes de la carte et réservations de table).
  restaurant_order_received: "Commande reçue par le restaurant",
  restaurant_order_ready: "Votre commande est prête",
  restaurant_order_canceled: "Commande annulée",
  table_booking_confirmed: "Table réservée",
  table_booking_canceled: "Réservation de table annulée",
  // Automobile (essais, demandes, importations).
  test_drive_confirmed: "Essai réservé",
  test_drive_canceled: "Essai annulé",
  vehicle_lead_received: "Nouvelle demande client",
  vehicle_import_update: "Votre véhicule avance",
  // Éducation (inscriptions, encaissements, notes).
  enrollment_request_received: "Demande d'inscription reçue",
  enrollment_confirmed: "Inscription confirmée",
  enrollment_payment_received: "Paiement de scolarité reçu",
  grades_published: "Nouvelles notes disponibles",
} as const;

export type OrderNotificationEvent = keyof typeof ORDER_NOTIFICATION_EVENTS;

export const NOTIFICATION_STATUSES = ["queued", "sent", "failed", "not_sent_no_provider"] as const;
export type NotificationStatus = (typeof NOTIFICATION_STATUSES)[number];

/** Événement déclenché par une transition de statut vers `status`, s'il y en a un. */
export function notificationEventForStatus(status: string): OrderNotificationEvent | null {
  switch (status) {
    case "PREPARING":
      return "order_preparing";
    case "SHIPPED":
      return "order_shipped";
    case "OUT_FOR_DELIVERY":
      return "order_out_for_delivery";
    case "DELIVERED":
      return "order_delivered";
    case "CANCELED":
      return "order_canceled";
    case "REFUNDED":
      return "order_refunded";
    default:
      return null;
  }
}

export interface RecordNotificationInput {
  orderId: string | null;
  event: OrderNotificationEvent;
  /** `customer` = client final (WhatsApp/SMS/e-mail), `merchant` = équipe (interne). */
  audience: "customer" | "merchant";
  channel: "email" | "sms" | "whatsapp" | "internal";
  recipient: string | null;
}

export async function recordNotification(tx: Prisma.TransactionClient, tenantId: string, input: RecordNotificationInput) {
  return tx.notificationLog.create({
    data: {
      tenantId,
      orderId: input.orderId,
      event: input.event,
      channel: input.channel,
      recipient: input.recipient,
      status: "queued",
    },
  });
}

/** Mise à jour par le worker APRÈS une tentative réelle. */
export async function markNotificationOutcome(
  tx: Prisma.TransactionClient,
  tenantId: string,
  logId: string,
  outcome: { status: Exclude<NotificationStatus, "queued">; error?: string | null },
) {
  return tx.notificationLog.updateMany({
    where: { id: logId, tenantId },
    data: {
      status: outcome.status,
      attempts: { increment: 1 },
      lastError: outcome.error ?? null,
      ...(outcome.status === "sent" ? { sentAt: new Date() } : {}),
    },
  });
}

export async function listNotificationsForOrder(tx: Prisma.TransactionClient, tenantId: string, orderId: string) {
  return tx.notificationLog.findMany({ where: { tenantId, orderId }, orderBy: { createdAt: "asc" } });
}
