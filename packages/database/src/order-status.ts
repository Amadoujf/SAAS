import type { OrderStatus, PaymentStatus, Prisma } from "@prisma/client";

/**
 * Machine à états des commandes — étape 2 (clients/panier/commandes/livraison, 19
 * septembre 2026). Table d'adjacence explicite : UN SEUL endroit fait foi de ce qui
 * est permis, et `transitionOrderStatus` est le SEUL code autorisé à modifier
 * `Order.status` dans tout le projet (voir le refactor de
 * `packages/payments/src/webhook-processor.ts`, qui écrivait auparavant `Order`
 * directement, sans aucune garde).
 *
 * Cas COD (paiement à la livraison) : NEW -> CONFIRMED directement, sans paiement
 * préalable — voir `order-registry.ts`, `convertCartToOrder`. Cas paiement en ligne :
 * NEW -> AWAITING_PAYMENT -> PAID (webhook vérifié serveur à serveur) -> CONFIRMED.
 * La conversion réservation -> décrément réel du stock a lieu sur l'arête
 * `-> CONFIRMED` UNIQUEMENT, quel que soit le chemin emprunté pour l'atteindre (voir
 * `order-registry.ts`, `onOrderConfirmed`) — annuler une commande APRÈS `CONFIRMED`
 * doit donc réapprovisionner réellement le stock, alors qu'annuler AVANT ne fait que
 * libérer une réservation qui n'a jamais touché `availableQuantity`.
 *
 * Aucune annulation après `SHIPPED` (marchandise déjà en transit physique) — décision
 * de conception documentée ici, pas une contrainte technique.
 */
export const ORDER_STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  NEW: ["AWAITING_PAYMENT", "CONFIRMED", "CANCELED"],
  AWAITING_PAYMENT: ["PAID", "CANCELED"],
  PAID: ["CONFIRMED", "REFUNDED"],
  CONFIRMED: ["PREPARING", "CANCELED"],
  PREPARING: ["READY", "CANCELED"],
  // READY -> DELIVERED : remise en main propre d'une commande en RETRAIT EN BOUTIQUE
  // (aucune expédition). Réservé aux commandes `deliveryMethod = "pickup"` — voir la
  // garde de `advanceOrderStatus` (order-operations.ts), qui refuse aussi READY ->
  // SHIPPED pour un retrait.
  READY: ["SHIPPED", "DELIVERED", "CANCELED"],
  SHIPPED: ["OUT_FOR_DELIVERY", "DELIVERED"],
  OUT_FOR_DELIVERY: ["DELIVERED", "CANCELED"],
  DELIVERED: ["REFUNDED"],
  CANCELED: [],
  REFUNDED: [],
};

export function isValidOrderTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ORDER_STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}

/** Le statut d'après lequel le stock réservé devient un décrément réel, et à partir
 *  duquel annuler doit réapprovisionner plutôt que simplement libérer — voir
 *  `order-registry.ts`. */
export const STOCK_COMMIT_STATUS: OrderStatus = "CONFIRMED";

export class InvalidOrderTransitionError extends Error {
  constructor(from: OrderStatus, to: OrderStatus) {
    super(`Transition refusée : "${from}" -> "${to}" n'est pas autorisée.`);
    this.name = "InvalidOrderTransitionError";
  }
}

export class OrderStatusConflictError extends Error {
  constructor(orderId: string) {
    super(`La commande "${orderId}" a changé de statut entre la lecture et l'écriture — nouvel essai nécessaire.`);
    this.name = "OrderStatusConflictError";
  }
}

export interface TransitionOrderStatusInput {
  orderId: string;
  toStatus: OrderStatus;
  paymentStatus?: PaymentStatus;
  changedBy?: string | null;
  changedByType: "owner" | "employee" | "system" | "customer";
  note?: string | null;
}

/**
 * Point de passage OBLIGÉ pour toute mutation de `Order.status`. Rejette les
 * transitions absentes de `ORDER_STATUS_TRANSITIONS`, traite une auto-transition
 * (`toStatus === status` courant) comme un no-op réussi (double-clic dashboard —
 * jamais une erreur confuse pour une action déjà effective), garde l'écriture
 * elle-même par un `updateMany` conditionné sur le statut LU (même idiome anti-TOCTOU
 * que `adjustStock`) : si `count === 0`, le statut a changé entre notre lecture et
 * notre écriture (ex. webhook et clic dashboard concurrents) — on lève
 * `OrderStatusConflictError` plutôt que d'écraser silencieusement une décision
 * concurrente, à l'appelant de relire et éventuellement réessayer.
 *
 * Écrit TOUJOURS une ligne `OrderStatusHistory` (immuable au niveau base, voir la
 * migration `20260926000000_orders_cart_delivery_foundation`) — jamais une
 * modification de `status` sans trace.
 */
export async function transitionOrderStatus(
  tx: Prisma.TransactionClient,
  tenantId: string,
  input: TransitionOrderStatusInput,
) {
  const order = await tx.order.findFirst({ where: { id: input.orderId, tenantId } });
  if (!order) throw new Error(`transitionOrderStatus : commande "${input.orderId}" introuvable pour ce tenant.`);

  if (order.status === input.toStatus) return order;
  if (!isValidOrderTransition(order.status, input.toStatus)) {
    throw new InvalidOrderTransitionError(order.status, input.toStatus);
  }

  const { count } = await tx.order.updateMany({
    where: { id: input.orderId, tenantId, status: order.status },
    data: {
      status: input.toStatus,
      ...(input.paymentStatus ? { paymentStatus: input.paymentStatus } : {}),
    },
  });
  if (count === 0) throw new OrderStatusConflictError(input.orderId);

  await tx.orderStatusHistory.create({
    data: {
      tenantId,
      orderId: input.orderId,
      fromStatus: order.status,
      toStatus: input.toStatus,
      changedBy: input.changedBy ?? null,
      changedByType: input.changedByType,
      note: input.note ?? null,
    },
  });

  return tx.order.findFirstOrThrow({ where: { id: input.orderId, tenantId } });
}
