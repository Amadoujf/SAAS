import type { OrderStatus, Prisma } from "@prisma/client";
import { transitionOrderStatus, isValidOrderTransition, ORDER_STATUS_TRANSITIONS } from "./order-status";
import { cancelOrder, confirmOrderPaymentSuccess, isManualPaymentMethod } from "./order-registry";
import { normalizeSenegalPhone } from "./senegal-reference";
import { writeAuditLog } from "./audit-log-registry";
import { getCommerceSettings, describeDeliveryZone } from "./commerce-registry";

/**
 * Opérations quotidiennes sur les commandes — parcours e-commerce opérationnel (1er
 * octobre 2026). Tout passe par les moteurs existants : `transitionOrderStatus` (seul
 * code autorisé à modifier `Order.status`), `cancelOrder` (libération/restockage),
 * `confirmOrderPaymentSuccess` (validation d'un paiement, idempotente). Ce fichier
 * n'ajoute que l'orchestration (paiement manuel, livraison, notes, recherche) et les
 * vues en lecture seule du dashboard et du suivi client.
 */

export type OrderActorType = "owner" | "employee" | "system" | "customer";

export interface OrderActor {
  userId: string | null;
  type: OrderActorType;
}

// ---------------------------------------------------------------------------
// Recherche et détail (dashboard)
// ---------------------------------------------------------------------------

export interface ListOrdersFilter {
  status?: OrderStatus | "to_process" | "awaiting_proof";
  paymentStatus?: "UNPAID" | "PAID" | "REFUNDED" | "FAILED" | "PARTIAL";
  search?: string;
  from?: Date;
  to?: Date;
  take?: number;
  skip?: number;
}

/** Statuts qui demandent une action de l'équipe (préparation → expédition). */
export const TO_PROCESS_STATUSES: OrderStatus[] = ["CONFIRMED", "PREPARING", "READY"];

function buildOrderWhere(tenantId: string, filter: ListOrdersFilter): Prisma.OrderWhereInput {
  const where: Prisma.OrderWhereInput = { tenantId };
  if (filter.status === "to_process") where.status = { in: TO_PROCESS_STATUSES };
  else if (filter.status === "awaiting_proof") {
    where.status = "AWAITING_PAYMENT";
    where.payments = { some: { status: "PENDING", proofSubmittedAt: { not: null } } };
  } else if (filter.status) where.status = filter.status;
  if (filter.paymentStatus) where.paymentStatus = filter.paymentStatus;
  if (filter.from || filter.to) {
    where.createdAt = { ...(filter.from ? { gte: filter.from } : {}), ...(filter.to ? { lte: filter.to } : {}) };
  }
  const search = filter.search?.trim();
  if (search) {
    const phone = normalizeSenegalPhone(search);
    where.OR = [
      { orderNumber: { contains: search, mode: "insensitive" } },
      { customer: { firstName: { contains: search, mode: "insensitive" } } },
      { customer: { lastName: { contains: search, mode: "insensitive" } } },
      { customer: { email: { contains: search, mode: "insensitive" } } },
      { customer: { phone: { contains: phone ?? search } } },
    ];
  }
  return where;
}

export async function listOrdersForTenant(tx: Prisma.TransactionClient, tenantId: string, filter: ListOrdersFilter = {}) {
  const where = buildOrderWhere(tenantId, filter);
  const [orders, total] = await Promise.all([
    tx.order.findMany({
      where,
      include: {
        customer: { select: { id: true, firstName: true, lastName: true, phone: true } },
        items: { select: { quantity: true } },
        payments: { select: { status: true, proofSubmittedAt: true, provider: true }, orderBy: { createdAt: "desc" }, take: 1 },
      },
      orderBy: { createdAt: "desc" },
      take: Math.min(filter.take ?? 50, 500),
      skip: filter.skip ?? 0,
    }),
    tx.order.count({ where }),
  ]);
  return { orders, total };
}

export async function countOrdersByQueue(tx: Prisma.TransactionClient, tenantId: string) {
  const [toProcess, awaitingProof, awaitingPayment, inDelivery] = await Promise.all([
    tx.order.count({ where: { tenantId, status: { in: TO_PROCESS_STATUSES } } }),
    tx.order.count({
      where: { tenantId, status: "AWAITING_PAYMENT", payments: { some: { status: "PENDING", proofSubmittedAt: { not: null } } } },
    }),
    tx.order.count({ where: { tenantId, status: "AWAITING_PAYMENT" } }),
    tx.order.count({ where: { tenantId, status: { in: ["SHIPPED", "OUT_FOR_DELIVERY"] } } }),
  ]);
  return { toProcess, awaitingProof, awaitingPayment, inDelivery };
}

export async function getOrderDetailForTenant(tx: Prisma.TransactionClient, tenantId: string, orderId: string) {
  const order = await tx.order.findFirst({
    where: { id: orderId, tenantId },
    include: {
      customer: true,
      items: true,
      statusHistory: { orderBy: { createdAt: "asc" } },
      payments: { orderBy: { createdAt: "desc" } },
      delivery: { include: { deliverer: true } },
      invoice: true,
    },
  });
  if (!order) return null;
  const [address, zone] = await Promise.all([
    order.deliveryAddressId ? tx.customerAddress.findFirst({ where: { id: order.deliveryAddressId, tenantId } }) : null,
    order.deliveryZoneId ? tx.deliveryZone.findFirst({ where: { id: order.deliveryZoneId, tenantId } }) : null,
  ]);
  return {
    ...order,
    deliveryAddress: address,
    deliveryZoneLabel: zone ? describeDeliveryZone(zone) : null,
    allowedTransitions: ORDER_STATUS_TRANSITIONS[order.status],
  };
}

// ---------------------------------------------------------------------------
// Transitions pilotées par l'équipe
// ---------------------------------------------------------------------------

/** Transitions que l'équipe peut déclencher MANUELLEMENT depuis le dashboard. Les
 *  arêtes `-> PAID` et `AWAITING_PAYMENT -> ...` passent exclusivement par la
 *  validation de paiement (webhook PSP ou `approveManualPayment`), jamais par un
 *  simple clic « marquer payé ». */
const MANUAL_TARGETS: OrderStatus[] = ["PREPARING", "READY", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED", "CANCELED", "REFUNDED"];

export class OrderOperationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OrderOperationError";
  }
}

export async function advanceOrderStatus(
  tx: Prisma.TransactionClient,
  tenantId: string,
  orderId: string,
  toStatus: OrderStatus,
  actor: OrderActor,
  note?: string | null,
) {
  if (!MANUAL_TARGETS.includes(toStatus)) {
    throw new OrderOperationError("Ce statut ne peut être atteint que par la validation d'un paiement.");
  }
  // Verrou de ligne : deux membres de l'équipe cliquant en même temps ne peuvent pas
  // appliquer deux effets de bord (livraison, remboursement) pour la même commande.
  await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${orderId} AND "tenantId" = ${tenantId} FOR UPDATE`;
  const order = await tx.order.findFirst({ where: { id: orderId, tenantId } });
  if (!order) throw new OrderOperationError("Commande introuvable.");
  if (order.status === toStatus) return order;
  if (!isValidOrderTransition(order.status, toStatus)) {
    throw new OrderOperationError(`Transition interdite : ${order.status} → ${toStatus}.`);
  }

  const changedByType = actor.type;
  if (toStatus === "CANCELED") {
    return cancelOrder(tx, tenantId, orderId, { changedBy: actor.userId, changedByType, note: note ?? "Annulée par l'équipe." });
  }

  const deliveredCod = toStatus === "DELIVERED" && order.paymentMethod === "cod";
  const updated = await transitionOrderStatus(tx, tenantId, {
    orderId,
    toStatus,
    changedBy: actor.userId,
    changedByType,
    note: note ?? null,
    // Paiement à la livraison : l'encaissement a lieu à la remise du colis.
    ...(deliveredCod ? { paymentStatus: "PAID" as const } : {}),
    ...(toStatus === "REFUNDED" ? { paymentStatus: "REFUNDED" as const } : {}),
  });

  if (toStatus === "SHIPPED" || toStatus === "OUT_FOR_DELIVERY" || toStatus === "DELIVERED") {
    const deliveryStatus = toStatus === "DELIVERED" ? "delivered" : "in_transit";
    await tx.delivery.upsert({
      where: { orderId },
      create: {
        tenantId,
        orderId,
        status: deliveryStatus,
        ...(deliveredCod ? { codAmountCollected: order.total } : {}),
      },
      update: { status: deliveryStatus, ...(deliveredCod ? { codAmountCollected: order.total } : {}) },
    });
  }

  if (toStatus === "REFUNDED") {
    // Le remboursement lui-même (Wave, Orange Money, espèces, PSP) est effectué hors
    // plateforme : on trace la DEMANDE, jamais un remboursement présenté comme exécuté.
    const payment = await tx.payment.findFirst({ where: { orderId, tenantId, status: "SUCCEEDED" }, orderBy: { createdAt: "desc" } });
    if (payment) {
      await tx.refund.create({
        data: { tenantId, orderId, paymentId: payment.id, amount: order.total, reason: note ?? null, status: "pending", processedBy: actor.userId },
      });
    }
  }

  await writeAuditLog(tx, {
    tenantId,
    actorUserId: actor.userId,
    actorType: actor.type === "customer" ? "customer" : actor.type === "system" ? "system" : actor.type,
    action: "order.status_changed",
    entityType: "Order",
    entityId: orderId,
    metadata: { from: order.status, to: toStatus },
  });
  return updated;
}

// ---------------------------------------------------------------------------
// Paiement manuel (Wave / Orange Money direct)
// ---------------------------------------------------------------------------

export const MANUAL_PROVIDER_BY_METHOD = {
  manual_wave: "wave_direct",
  manual_orange_money: "orange_money_direct",
} as const;

export async function getManualPaymentInstructions(tx: Prisma.TransactionClient, tenantId: string) {
  const configs = await tx.paymentProviderConfig.findMany({
    where: { tenantId, isEnabled: true, provider: { in: ["wave_direct", "orange_money_direct"] } },
  });
  return configs
    .filter((c) => c.accountNumber)
    .map((c) => ({
      provider: c.provider as "wave_direct" | "orange_money_direct",
      method: (c.provider === "wave_direct" ? "manual_wave" : "manual_orange_money") as "manual_wave" | "manual_orange_money",
      label: c.label ?? (c.provider === "wave_direct" ? "Wave" : "Orange Money"),
      accountNumber: c.accountNumber!,
      accountHolderName: c.accountHolderName,
      instructions: c.publicInstructions,
    }));
}

export interface SubmitManualProofInput {
  reference: string;
  imageUrl?: string | null;
}

/**
 * Dépôt d'une preuve par le client (accès par `accessToken`). La commande RESTE
 * `AWAITING_PAYMENT` : une preuve n'est qu'une déclaration. L'échéance de
 * réservation est suspendue pendant la vérification (le client a agi à temps ; c'est
 * à l'équipe de trancher) — elle redevient active si la preuve est refusée.
 */
export async function submitManualPaymentProof(
  tx: Prisma.TransactionClient,
  tenantId: string,
  orderId: string,
  accessToken: string,
  input: SubmitManualProofInput,
) {
  const reference = input.reference.trim();
  if (reference.length < 4 || reference.length > 80) {
    throw new OrderOperationError("Indiquez la référence de transaction reçue par SMS (4 à 80 caractères).");
  }
  await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${orderId} AND "tenantId" = ${tenantId} FOR UPDATE`;
  const order = await tx.order.findFirst({ where: { id: orderId, tenantId, accessToken } });
  if (!order) throw new OrderOperationError("Commande introuvable.");
  if (!isManualPaymentMethod(order.paymentMethod)) throw new OrderOperationError("Cette commande n'utilise pas un paiement manuel.");
  if (order.status !== "AWAITING_PAYMENT") {
    throw new OrderOperationError(
      order.status === "CANCELED" ? "Cette commande a expiré ou a été annulée." : "Le paiement de cette commande a déjà été traité.",
    );
  }
  const provider = MANUAL_PROVIDER_BY_METHOD[order.paymentMethod];
  const payment = await tx.payment.findFirst({ where: { orderId, tenantId, provider }, orderBy: { createdAt: "desc" } });
  if (!payment) throw new OrderOperationError("Aucun paiement en attente pour cette commande.");
  if (payment.status === "SUCCEEDED") throw new OrderOperationError("Le paiement de cette commande a déjà été validé.");

  const updated = await tx.payment.update({
    where: { id: payment.id },
    data: {
      status: "PENDING",
      proofReference: reference,
      proofImageUrl: input.imageUrl ?? null,
      proofSubmittedAt: new Date(),
      reviewedAt: null,
      reviewedByUserId: null,
      reviewNote: null,
    },
  });
  await tx.order.update({ where: { id: orderId }, data: { reservationExpiresAt: null } });
  await writeAuditLog(tx, {
    tenantId,
    actorUserId: null,
    actorType: "customer",
    action: "payment.manual_proof_submitted",
    entityType: "Payment",
    entityId: payment.id,
    metadata: { orderId },
  });
  return updated;
}

export type ManualReviewOutcome = "approved" | "already_approved" | "rejected" | "flagged_for_manual_reconciliation";

/**
 * Validation par l'équipe. Idempotente : la garde `updateMany … status: PENDING`
 * garantit qu'un double clic (ou deux membres de l'équipe) ne valide qu'UNE fois ;
 * la confirmation de commande réutilise `confirmOrderPaymentSuccess`, elle-même
 * idempotente et sûre face à une expiration concurrente.
 */
export async function approveManualPayment(
  tx: Prisma.TransactionClient,
  tenantId: string,
  orderId: string,
  actor: OrderActor,
  note?: string | null,
): Promise<{ outcome: ManualReviewOutcome }> {
  await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${orderId} AND "tenantId" = ${tenantId} FOR UPDATE`;
  const order = await tx.order.findFirst({ where: { id: orderId, tenantId } });
  if (!order) throw new OrderOperationError("Commande introuvable.");
  if (!isManualPaymentMethod(order.paymentMethod)) throw new OrderOperationError("Cette commande n'utilise pas un paiement manuel.");
  const provider = MANUAL_PROVIDER_BY_METHOD[order.paymentMethod];

  const alreadyApproved = await tx.payment.findFirst({ where: { orderId, tenantId, provider, status: "SUCCEEDED" } });
  if (alreadyApproved) return { outcome: "already_approved" };

  const pending = await tx.payment.findFirst({ where: { orderId, tenantId, provider, status: "PENDING" }, orderBy: { createdAt: "desc" } });
  if (!pending || !pending.proofSubmittedAt) {
    throw new OrderOperationError("Aucune preuve de paiement en attente de vérification.");
  }
  const { count } = await tx.payment.updateMany({
    where: { id: pending.id, tenantId, status: "PENDING" },
    data: {
      status: "SUCCEEDED",
      verifiedAt: new Date(),
      reviewedAt: new Date(),
      reviewedByUserId: actor.userId,
      reviewNote: note ?? null,
      reconciliationStatus: "matched",
      reconciledAt: new Date(),
    },
  });
  if (count === 0) return { outcome: "already_approved" };

  const result = await confirmOrderPaymentSuccess(tx, tenantId, orderId, `Paiement manuel validé par l'équipe${note ? ` — ${note}` : ""}.`);
  await writeAuditLog(tx, {
    tenantId,
    actorUserId: actor.userId,
    actorType: actor.type === "customer" ? "customer" : actor.type === "system" ? "system" : actor.type,
    action: "payment.manual_approved",
    entityType: "Payment",
    entityId: pending.id,
    metadata: { orderId, outcome: result.outcome },
  });
  if (result.outcome === "flagged_for_manual_reconciliation") return { outcome: "flagged_for_manual_reconciliation" };
  return { outcome: "approved" };
}

export async function rejectManualPayment(
  tx: Prisma.TransactionClient,
  tenantId: string,
  orderId: string,
  actor: OrderActor,
  reason: string,
): Promise<{ outcome: "rejected" }> {
  if (reason.trim().length < 3) throw new OrderOperationError("Indiquez le motif du refus pour le client.");
  await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${orderId} AND "tenantId" = ${tenantId} FOR UPDATE`;
  const order = await tx.order.findFirst({ where: { id: orderId, tenantId } });
  if (!order) throw new OrderOperationError("Commande introuvable.");
  if (!isManualPaymentMethod(order.paymentMethod)) throw new OrderOperationError("Cette commande n'utilise pas un paiement manuel.");
  if (order.status !== "AWAITING_PAYMENT") throw new OrderOperationError("Ce paiement n'est plus en attente.");
  const provider = MANUAL_PROVIDER_BY_METHOD[order.paymentMethod];
  const { count } = await tx.payment.updateMany({
    where: { orderId, tenantId, provider, status: "PENDING", proofSubmittedAt: { not: null } },
    data: { status: "FAILED", reviewedAt: new Date(), reviewedByUserId: actor.userId, reviewNote: reason.trim() },
  });
  if (count === 0) throw new OrderOperationError("Aucune preuve de paiement en attente de vérification.");
  // L'échéance de réservation reprend : le client dispose d'une nouvelle fenêtre pour
  // déposer une preuve correcte, sinon le stock est libéré automatiquement.
  const settings = await getCommerceSettings(tx, tenantId);
  await tx.order.update({
    where: { id: orderId },
    data: { reservationExpiresAt: new Date(Date.now() + settings.manualPaymentWindowHours * 3_600_000) },
  });
  await writeAuditLog(tx, {
    tenantId,
    actorUserId: actor.userId,
    actorType: actor.type === "customer" ? "customer" : actor.type === "system" ? "system" : actor.type,
    action: "payment.manual_rejected",
    entityType: "Order",
    entityId: orderId,
    metadata: { reason: reason.trim() },
  });
  return { outcome: "rejected" };
}

// ---------------------------------------------------------------------------
// Livraison : livreurs et affectation
// ---------------------------------------------------------------------------

export async function listDeliverers(tx: Prisma.TransactionClient, tenantId: string) {
  return tx.deliverer.findMany({ where: { tenantId }, orderBy: [{ isActive: "desc" }, { phone: "asc" }] });
}

export async function createDeliverer(
  tx: Prisma.TransactionClient,
  tenantId: string,
  input: { phone: string; vehicleType?: string | null },
) {
  const phone = normalizeSenegalPhone(input.phone);
  if (!phone) throw new OrderOperationError("Numéro de téléphone sénégalais invalide.");
  return tx.deliverer.create({ data: { tenantId, phone, vehicleType: input.vehicleType ?? null } });
}

export async function setDelivererActive(tx: Prisma.TransactionClient, tenantId: string, delivererId: string, isActive: boolean) {
  const { count } = await tx.deliverer.updateMany({ where: { id: delivererId, tenantId }, data: { isActive } });
  if (count === 0) throw new OrderOperationError("Livreur introuvable.");
}

export async function assignDeliverer(
  tx: Prisma.TransactionClient,
  tenantId: string,
  orderId: string,
  delivererId: string | null,
  actor: OrderActor,
) {
  const order = await tx.order.findFirst({ where: { id: orderId, tenantId } });
  if (!order) throw new OrderOperationError("Commande introuvable.");
  if (order.deliveryMethod !== "delivery") throw new OrderOperationError("Cette commande est en retrait en boutique.");
  if (["CANCELED", "REFUNDED", "DELIVERED"].includes(order.status)) {
    throw new OrderOperationError("Cette commande n'est plus à livrer.");
  }
  if (delivererId) {
    const deliverer = await tx.deliverer.findFirst({ where: { id: delivererId, tenantId, isActive: true } });
    if (!deliverer) throw new OrderOperationError("Livreur introuvable ou inactif.");
  }
  const delivery = await tx.delivery.upsert({
    where: { orderId },
    create: { tenantId, orderId, delivererId, status: "assigned" },
    update: { delivererId },
  });
  await writeAuditLog(tx, {
    tenantId,
    actorUserId: actor.userId,
    actorType: actor.type === "customer" ? "customer" : actor.type === "system" ? "system" : actor.type,
    action: "delivery.assigned",
    entityType: "Order",
    entityId: orderId,
    metadata: { delivererId },
  });
  return delivery;
}

export async function setOrderInternalNotes(tx: Prisma.TransactionClient, tenantId: string, orderId: string, notes: string) {
  const { count } = await tx.order.updateMany({ where: { id: orderId, tenantId }, data: { internalNotes: notes.slice(0, 4000) || null } });
  if (count === 0) throw new OrderOperationError("Commande introuvable.");
}

// ---------------------------------------------------------------------------
// Côté client : suivi invité, détail public, annulation
// ---------------------------------------------------------------------------

/** Statuts depuis lesquels le client peut encore annuler lui-même (avant préparation). */
export const CUSTOMER_CANCELLABLE_STATUSES: OrderStatus[] = ["NEW", "AWAITING_PAYMENT", "CONFIRMED"];

/**
 * Accès invité : numéro de commande + téléphone utilisé lors de la commande. Renvoie
 * le jeton d'accès UNIQUEMENT si les deux correspondent — jamais d'indice sur lequel
 * des deux est faux (pas d'énumération des numéros de commande).
 */
export async function findOrderForGuest(
  tx: Prisma.TransactionClient,
  tenantId: string,
  orderNumber: string,
  phone: string,
): Promise<{ orderId: string; accessToken: string } | null> {
  const normalized = normalizeSenegalPhone(phone);
  if (!normalized) return null;
  const order = await tx.order.findFirst({
    where: { tenantId, orderNumber: orderNumber.trim().toUpperCase(), customer: { phone: normalized } },
    select: { id: true, accessToken: true },
  });
  return order ? { orderId: order.id, accessToken: order.accessToken } : null;
}

/** Vue PUBLIQUE d'une commande (jeton requis) — ne contient jamais les notes
 *  internes, l'historique d'audit ni les données d'autres clients. */
export async function getOrderForCustomer(tx: Prisma.TransactionClient, tenantId: string, orderId: string, accessToken: string) {
  const order = await tx.order.findFirst({
    where: { id: orderId, tenantId, accessToken },
    include: {
      customer: { select: { firstName: true, lastName: true, phone: true, email: true } },
      items: { select: { id: true, productNameSnapshot: true, unitPrice: true, quantity: true, total: true, productVariantId: true } },
      statusHistory: { select: { toStatus: true, createdAt: true }, orderBy: { createdAt: "asc" } },
      payments: {
        select: { provider: true, status: true, proofSubmittedAt: true, reviewNote: true, reviewedAt: true },
        orderBy: { createdAt: "desc" },
      },
      delivery: { select: { status: true } },
      invoice: { select: { number: true, finalizedAt: true } },
    },
  });
  if (!order) return null;
  const [address, zone] = await Promise.all([
    order.deliveryAddressId ? tx.customerAddress.findFirst({ where: { id: order.deliveryAddressId, tenantId } }) : null,
    order.deliveryZoneId ? tx.deliveryZone.findFirst({ where: { id: order.deliveryZoneId, tenantId } }) : null,
  ]);
  const { internalNotes: _internal, ...rest } = order;
  return {
    ...rest,
    deliveryAddress: address
      ? { region: address.region, commune: address.commune, neighborhood: address.neighborhood, street: address.street }
      : null,
    deliveryZoneLabel: zone ? describeDeliveryZone(zone) : null,
    estimatedDays: zone?.estimatedDays ?? null,
    customerCanCancel: CUSTOMER_CANCELLABLE_STATUSES.includes(order.status),
  };
}

export async function cancelOrderByCustomer(tx: Prisma.TransactionClient, tenantId: string, orderId: string, accessToken: string) {
  await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${orderId} AND "tenantId" = ${tenantId} FOR UPDATE`;
  const order = await tx.order.findFirst({ where: { id: orderId, tenantId, accessToken } });
  if (!order) throw new OrderOperationError("Commande introuvable.");
  if (!CUSTOMER_CANCELLABLE_STATUSES.includes(order.status)) {
    throw new OrderOperationError("Cette commande est déjà en préparation : contactez la boutique pour l'annuler.");
  }
  if (order.paymentStatus === "PAID") {
    throw new OrderOperationError("Cette commande est déjà payée : contactez la boutique pour un remboursement.");
  }
  return cancelOrder(tx, tenantId, orderId, { changedBy: null, changedByType: "customer", note: "Annulée par le client." });
}

// ---------------------------------------------------------------------------
// Vue d'ensemble du dashboard
// ---------------------------------------------------------------------------

const REVENUE_STATUSES: OrderStatus[] = ["PAID", "CONFIRMED", "PREPARING", "READY", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED"];

export async function getCommerceOverview(tx: Prisma.TransactionClient, tenantId: string, now = new Date()) {
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const since30 = new Date(now.getTime() - 30 * 86_400_000);
  const since14 = new Date(startOfToday.getTime() - 13 * 86_400_000);

  const [todayOrders, revenue30, orders30, queues, lowStock, recent, series, customers] = await Promise.all([
    tx.order.count({ where: { tenantId, createdAt: { gte: startOfToday } } }),
    tx.order.aggregate({ where: { tenantId, createdAt: { gte: since30 }, status: { in: REVENUE_STATUSES } }, _sum: { total: true } }),
    tx.order.count({ where: { tenantId, createdAt: { gte: since30 }, status: { in: REVENUE_STATUSES } } }),
    countOrdersByQueue(tx, tenantId),
    tx.inventoryItem.count({ where: { tenantId, availableQuantity: { lte: tx.inventoryItem.fields.lowStockThreshold } } }),
    tx.order.findMany({
      where: { tenantId },
      include: { customer: { select: { firstName: true, lastName: true } } },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
    tx.order.findMany({
      where: { tenantId, createdAt: { gte: since14 }, status: { in: REVENUE_STATUSES } },
      select: { createdAt: true, total: true },
    }),
    tx.customer.count({ where: { tenantId } }),
  ]);

  const days: { date: string; revenue: number; orders: number }[] = [];
  for (let i = 0; i < 14; i += 1) {
    const d = new Date(since14.getTime() + i * 86_400_000);
    days.push({ date: d.toISOString().slice(0, 10), revenue: 0, orders: 0 });
  }
  for (const o of series) {
    const key = new Date(o.createdAt.getFullYear(), o.createdAt.getMonth(), o.createdAt.getDate()).getTime();
    const index = Math.round((key - since14.getTime()) / 86_400_000);
    const day = days[index];
    if (day) {
      day.revenue += o.total;
      day.orders += 1;
    }
  }

  const revenue = revenue30._sum.total ?? 0;
  return {
    todayOrders,
    revenue30: revenue,
    orders30,
    averageBasket30: orders30 > 0 ? Math.round(revenue / orders30) : 0,
    customers,
    lowStock,
    queues,
    recent,
    series: days,
  };
}
