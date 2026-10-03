/**
 * Libellés et tonalités des statuts de commande — partagés par le dashboard, le suivi
 * client et les e-mails, pour qu'un même statut ne soit jamais formulé de deux façons.
 * Règle stricte : une commande `AWAITING_PAYMENT` n'est JAMAIS présentée comme payée.
 */
export type Tone = "neutral" | "info" | "warning" | "success" | "danger" | "accent";

export const ORDER_STATUS_META: Record<string, { label: string; customerLabel: string; tone: Tone; description: string }> = {
  NEW: { label: "Nouvelle", customerLabel: "Commande reçue", tone: "info", description: "Commande créée." },
  AWAITING_PAYMENT: {
    label: "Paiement en attente",
    customerLabel: "En attente de paiement",
    tone: "warning",
    description: "La commande n'est pas payée. Le stock est réservé temporairement.",
  },
  PAID: { label: "Payée", customerLabel: "Paiement reçu", tone: "success", description: "Paiement vérifié." },
  CONFIRMED: { label: "Confirmée", customerLabel: "Confirmée", tone: "accent", description: "À préparer." },
  PREPARING: { label: "En préparation", customerLabel: "En préparation", tone: "accent", description: "L'équipe prépare le colis." },
  READY: { label: "Prête", customerLabel: "Prête", tone: "accent", description: "Prête à expédier ou à retirer." },
  SHIPPED: { label: "Expédiée", customerLabel: "Expédiée", tone: "info", description: "Remise au transport." },
  OUT_FOR_DELIVERY: { label: "En livraison", customerLabel: "En cours de livraison", tone: "info", description: "Le livreur est en route." },
  DELIVERED: { label: "Livrée", customerLabel: "Livrée", tone: "success", description: "Remise au client." },
  CANCELED: { label: "Annulée", customerLabel: "Annulée", tone: "danger", description: "Commande annulée." },
  REFUNDED: { label: "Remboursée", customerLabel: "Remboursement en cours", tone: "neutral", description: "Remboursement demandé." },
};

export const PAYMENT_STATUS_META: Record<string, { label: string; tone: Tone }> = {
  UNPAID: { label: "Non payée", tone: "warning" },
  PARTIAL: { label: "Partiel", tone: "warning" },
  PAID: { label: "Payée", tone: "success" },
  REFUNDED: { label: "Remboursée", tone: "neutral" },
  FAILED: { label: "Échec", tone: "danger" },
};

export const PAYMENT_METHOD_LABEL: Record<string, string> = {
  cod: "Paiement à la livraison",
  online: "Paiement en ligne",
  manual_wave: "Wave (transfert)",
  manual_orange_money: "Orange Money (transfert)",
};

/** Étapes affichées dans la frise de progression côté client. */
export const CUSTOMER_PROGRESS = ["NEW", "CONFIRMED", "PREPARING", "SHIPPED", "DELIVERED"] as const;

export function progressIndex(status: string, deliveryMethod: string): number {
  const order = ["NEW", "AWAITING_PAYMENT", "PAID", "CONFIRMED", "PREPARING", "READY", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED"];
  const i = order.indexOf(status);
  if (i < 0) return -1;
  if (i <= 2) return 0;
  if (i === 3) return 1;
  if (i <= 5) return 2;
  if (i <= 7) return deliveryMethod === "pickup" ? 2 : 3;
  return 4;
}
