import type { Prisma } from "@prisma/client";
import { nextCounterValue } from "./counters";

/**
 * Service commun des ENCAISSEMENTS MANUELS (argent réellement reçu et vérifié par
 * l'entreprise : espèces, Wave, Orange Money, virement, terminal de carte…).
 *
 * Deux tables, un seul service :
 * - `ReservationPayment` : encaissements d'une réservation (voyage, séjour, rendez-vous,
 *   dossier de vente automobile, inscription…) ;
 * - `RestaurantPayment` : encaissements d'une commande du restaurant, qui n'est PAS une
 *   réservation (commande de plats, sans date réservée).
 * Chaque table garde une clé étrangère réelle vers son objet (intégrité garantie par la
 * base). Tout le reste est commun : moyens de paiement (même liste, même contrôle en
 * base), numérotation des reçus (une seule série par entreprise et par année),
 * annulation motivée, et journal unifié en lecture (`listTenantPayments`).
 *
 * Aucun de ces encaissements n'est un paiement EN LIGNE : ils sont toujours présentés
 * comme « encaissement enregistré par l'équipe ».
 */

export const MANUAL_PAYMENT_METHODS = ["cash", "wave", "orange_money", "free_money", "bank_transfer", "card_terminal", "other"] as const;
export type ManualPaymentMethod = (typeof MANUAL_PAYMENT_METHODS)[number];

export function formatReceiptNumber(year: number, value: number) {
  return `REC-${year}-${String(value).padStart(6, "0")}`;
}

/** Prochain numéro de reçu de l'entreprise (série unique, tous secteurs confondus). */
export async function nextReceiptNumber(tx: Prisma.TransactionClient, tenantId: string, paidAt: Date = new Date()) {
  const year = paidAt.getFullYear();
  return formatReceiptNumber(year, await nextCounterValue(tx, tenantId, `receipt-${year}`));
}

export interface LedgerEntry {
  id: string;
  /** « reservation » ou « restaurant_order ». */
  source: "reservation" | "restaurant_order";
  subjectId: string;
  subjectReference: string;
  receiptNumber: string;
  amount: number;
  method: string;
  kind: string;
  paidAt: Date;
  voidedAt: Date | null;
  voidReason: string | null;
  /** Toujours « manual » : aucun encaissement de ce journal n'est un paiement en ligne. */
  channel: "manual";
}

/** Journal unifié des encaissements de l'entreprise, du plus récent au plus ancien. */
export async function listTenantPayments(tx: Prisma.TransactionClient, tenantId: string, q: { from?: Date; to?: Date; take?: number } = {}): Promise<LedgerEntry[]> {
  const paidAt = { ...(q.from ? { gte: q.from } : {}), ...(q.to ? { lt: q.to } : {}) };
  const take = Math.min(q.take ?? 200, 1000);
  const [res, resto] = await Promise.all([
    tx.reservationPayment.findMany({ where: { tenantId, ...(q.from || q.to ? { paidAt } : {}) }, include: { reservation: { select: { reference: true } } }, orderBy: { paidAt: "desc" }, take }),
    tx.restaurantPayment.findMany({ where: { tenantId, ...(q.from || q.to ? { paidAt } : {}) }, include: { order: { select: { number: true } } }, orderBy: { paidAt: "desc" }, take }),
  ]);
  return [
    ...res.map((p) => ({ id: p.id, source: "reservation" as const, subjectId: p.reservationId, subjectReference: p.reservation.reference, receiptNumber: p.receiptNumber, amount: p.amount, method: p.method, kind: p.kind, paidAt: p.paidAt, voidedAt: p.voidedAt, voidReason: p.voidReason, channel: "manual" as const })),
    ...resto.map((p) => ({ id: p.id, source: "restaurant_order" as const, subjectId: p.orderId, subjectReference: p.order.number, receiptNumber: p.receiptNumber, amount: p.amount, method: p.method, kind: "other", paidAt: p.paidAt, voidedAt: p.voidedAt, voidReason: p.voidReason, channel: "manual" as const })),
  ]
    .sort((a, b) => b.paidAt.getTime() - a.paidAt.getTime())
    .slice(0, take);
}
