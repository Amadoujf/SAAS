import { randomUUID } from "node:crypto";
import type { Order, Prisma } from "@prisma/client";
import { getOrCreateMainShop, InsufficientStockError } from "./catalog-registry";
import { resolveOrCreateCustomer, addCustomerAddress, type CustomerInput, type CustomerAddressInput } from "./customer-registry";
import { nextCounterValue, orderScope, formatOrderNumber } from "./counters";
import { transitionOrderStatus, STOCK_COMMIT_STATUS, OrderStatusConflictError, InvalidOrderTransitionError } from "./order-status";
import { computeZoneShipping, getCommerceSettings } from "./commerce-registry";

/**
 * Persistance des commandes — étape 2 (clients/panier/commandes/livraison, 19
 * septembre 2026). `convertCartToOrder` est la fonction CRITIQUE de cette étape :
 * transaction UNIQUE qui (1) réclame le panier de façon idempotente (protection
 * anti-double-soumission — voir la note ci-dessous), (2) recalcule intégralement les
 * prix/remise/livraison/taxe côté serveur à partir de données réelles (jamais une
 * valeur envoyée par le client), (3) réserve le stock atomiquement, (4) fige un
 * instantané immuable de la commande (voir `OrderItem.productNameSnapshot`).
 *
 * IDEMPOTENCE — ancrée sur la transition d'état du panier lui-même : l'id de la
 * commande est pré-généré, puis `UPDATE "Cart" SET status='converted',
 * "convertedOrderId"=$1 WHERE id=$2 AND status='active'` est la garde. Si `count===0`,
 * le panier a déjà été converti (rejeu / double soumission) : on renvoie la commande
 * déjà créée au lieu d'en créer une seconde. Un échec PLUS LOIN dans la même
 * transaction (ex. stock insuffisant) fait tout rollback, y compris ce flag — un
 * client peut réessayer proprement.
 */

export type DeliveryAddressInput = CustomerAddressInput;

export interface ConvertCartToOrderInput {
  cartId: string;
  customer: CustomerInput;
  deliveryMethod: "delivery" | "pickup";
  deliveryZoneId?: string | null;
  deliveryAddress?: DeliveryAddressInput | null;
  /** `cod` : paiement à la livraison. `online` : prestataire automatique (PSP) du
   *  tenant. `manual_wave` / `manual_orange_money` : transfert manuel vers le
   *  portefeuille marchand du tenant, avec preuve à valider par l'équipe. */
  paymentMethod: OrderPaymentMethod;
  promoCode?: string | null;
  notes?: string | null;
  channel?: string;
}

export const ORDER_PAYMENT_METHODS = ["cod", "online", "manual_wave", "manual_orange_money"] as const;
export type OrderPaymentMethod = (typeof ORDER_PAYMENT_METHODS)[number];

export function isManualPaymentMethod(method: string): method is "manual_wave" | "manual_orange_money" {
  return method === "manual_wave" || method === "manual_orange_money";
}

export interface ConvertCartToOrderResult {
  order: Order;
  alreadyExisted: boolean;
}

/** Fenêtre de réservation pour le paiement en ligne — voir `order-reservation.ts`
 *  (étape 2 suivante, expiration automatique). Une commande COD n'expire jamais
 *  automatiquement : c'est un engagement ferme dès `CONFIRMED`. */
export const RESERVATION_WINDOW_MINUTES = 30;

async function findMainShopInventoryItem(
  tx: Prisma.TransactionClient,
  tenantId: string,
  productVariantId: string,
  shopId: string,
) {
  return tx.inventoryItem.findFirst({ where: { productVariantId, shopId, tenantId } });
}

export async function convertCartToOrder(
  tx: Prisma.TransactionClient,
  tenantId: string,
  input: ConvertCartToOrderInput,
): Promise<ConvertCartToOrderResult> {
  const cart = await tx.cart.findFirst({ where: { id: input.cartId, tenantId } });
  if (!cart) throw new Error(`convertCartToOrder : panier "${input.cartId}" introuvable pour ce tenant.`);

  if (cart.status !== "active") {
    if (cart.convertedOrderId) {
      const existing = await tx.order.findFirstOrThrow({ where: { id: cart.convertedOrderId, tenantId } });
      return { order: existing, alreadyExisted: true };
    }
    throw new Error(`convertCartToOrder : panier "${input.cartId}" n'est plus actif (statut : ${cart.status}).`);
  }

  const cartItems = await tx.cartItem.findMany({
    where: { cartId: input.cartId, tenantId },
    include: { variant: { include: { product: true } } },
  });
  if (cartItems.length === 0) throw new Error("convertCartToOrder : le panier est vide.");

  const invalidLine = cartItems.find(
    (item) => item.variant.product.status !== "PUBLISHED" || item.variant.product.deletedAt !== null,
  );
  if (invalidLine) {
    throw new Error(
      `convertCartToOrder : le produit "${invalidLine.variant.product.name}" n'est plus disponible à l'achat — retirez-le du panier.`,
    );
  }

  // Règle "panier mixte" : un seul article non livrable force le retrait en boutique
  // pour TOUTE la commande (pas de livraison scindée dans cette étape).
  const hasNonDeliverable = cartItems.some((item) => !item.variant.product.isDeliverable);
  if (hasNonDeliverable && input.deliveryMethod !== "pickup") {
    throw new Error(
      "convertCartToOrder : au moins un article de ce panier n'est disponible qu'en retrait en boutique.",
    );
  }
  const hasBulky = cartItems.some((item) => item.variant.product.isBulky);

  const lineComputations = cartItems.map((item) => {
    const unitPrice = item.variant.price;
    const lineTotal = unitPrice * item.quantity;
    return { item, unitPrice, lineTotal };
  });
  const subtotal = lineComputations.reduce((sum, l) => sum + l.lineTotal, 0);
  const taxTotal = lineComputations.reduce(
    (sum, l) => sum + Math.round((l.lineTotal * Number(l.item.variant.product.taxRate)) / 100),
    0,
  );

  // Frais de livraison — calculés par `computeZoneShipping` (commerce-registry.ts),
  // la MÊME fonction que celle qui alimente l'affichage du checkout : le montant
  // facturé ne peut jamais diverger de celui présenté au client.
  const settings = await getCommerceSettings(tx, tenantId);
  let shippingTotal = 0;
  if (input.deliveryMethod === "pickup" && !settings.pickupEnabled) {
    throw new Error("Le retrait en boutique n'est pas proposé par cette boutique.");
  }
  if (input.deliveryMethod === "delivery") {
    if (!input.deliveryZoneId) throw new Error("convertCartToOrder : zone de livraison requise pour ce mode.");
    const zone = await tx.deliveryZone.findFirst({ where: { id: input.deliveryZoneId, tenantId } });
    if (!zone) {
      throw new Error(`convertCartToOrder : zone de livraison "${input.deliveryZoneId}" introuvable pour ce tenant.`);
    }
    const shipping = computeZoneShipping(zone, {
      subtotal,
      hasBulky,
      hasNonDeliverable,
      categoryIds: [...new Set(cartItems.map((i) => i.variant.product.categoryId).filter((id): id is string => !!id))],
    });
    if (!shipping.available) {
      throw new Error(
        shipping.reason === "excluded_category"
          ? "Un article de votre panier n'est pas livrable dans cette zone — choisissez une autre zone ou le retrait."
          : "Cette zone de livraison n'est plus disponible — choisissez-en une autre.",
      );
    }
    shippingTotal = shipping.fee;
  }

  let discountTotal = 0;
  let appliedPromoId: string | null = null;
  if (input.promoCode) {
    const promo = await tx.promoCode.findFirst({ where: { tenantId, code: input.promoCode } });
    if (!promo) throw new Error(`convertCartToOrder : code promo "${input.promoCode}" introuvable.`);
    const now = new Date();
    if (promo.startsAt && promo.startsAt > now) throw new Error("Ce code promo n'est pas encore actif.");
    if (promo.endsAt && promo.endsAt < now) throw new Error("Ce code promo a expiré.");
    if (promo.usageLimit !== null && promo.usageCount >= promo.usageLimit) {
      throw new Error("Ce code promo a atteint sa limite d'utilisation.");
    }
    if (promo.minOrderAmount !== null && subtotal < promo.minOrderAmount) {
      throw new Error(`Ce code promo nécessite un montant minimum de ${promo.minOrderAmount}.`);
    }
    if (promo.type === "percentage") discountTotal = Math.round((subtotal * promo.value) / 100);
    else if (promo.type === "fixed") discountTotal = Math.min(promo.value, subtotal);
    else if (promo.type === "free_shipping") shippingTotal = 0;
    appliedPromoId = promo.id;
  }

  const total = subtotal - discountTotal + shippingTotal + taxTotal;

  const customer = await resolveOrCreateCustomer(tx, tenantId, input.customer);

  let deliveryAddressId: string | null = null;
  if (input.deliveryMethod === "delivery") {
    if (!input.deliveryAddress) throw new Error("convertCartToOrder : adresse de livraison requise pour ce mode.");
    const address = await addCustomerAddress(tx, tenantId, customer.id, input.deliveryAddress);
    deliveryAddressId = address.id;
  }

  const orderId = randomUUID();
  const claimed = await tx.cart.updateMany({
    where: { id: input.cartId, tenantId, status: "active" },
    data: { status: "converted", convertedOrderId: orderId, customerId: customer.id },
  });
  if (claimed.count === 0) {
    const raced = await tx.cart.findFirstOrThrow({ where: { id: input.cartId, tenantId } });
    if (raced.convertedOrderId) {
      const existing = await tx.order.findFirstOrThrow({ where: { id: raced.convertedOrderId, tenantId } });
      return { order: existing, alreadyExisted: true };
    }
    throw new Error(`convertCartToOrder : panier "${input.cartId}" n'est plus actif.`);
  }

  const shop = await getOrCreateMainShop(tx, tenantId);
  for (const { item } of lineComputations) {
    const inventoryItem = await findMainShopInventoryItem(tx, tenantId, item.productVariantId, shop.id);
    if (!inventoryItem) {
      throw new Error(`convertCartToOrder : aucun stock enregistré pour la variante "${item.productVariantId}".`);
    }
    const { count } = await tx.inventoryItem.updateMany({
      where: { id: inventoryItem.id, tenantId, availableQuantity: { gte: item.quantity } },
      data: { availableQuantity: { decrement: item.quantity }, reservedQuantity: { increment: item.quantity } },
    });
    if (count === 0) throw new InsufficientStockError(inventoryItem.id, item.quantity);
  }

  const fiscalYear = new Date().getFullYear();
  const orderSeq = await nextCounterValue(tx, tenantId, orderScope(fiscalYear));
  const orderNumber = formatOrderNumber(fiscalYear, orderSeq);

  await tx.order.create({
    data: {
      id: orderId,
      tenantId,
      shopId: shop.id,
      customerId: customer.id,
      orderNumber,
      status: "NEW",
      channel: input.channel ?? "web",
      paymentStatus: "UNPAID",
      subtotal,
      discountTotal,
      shippingTotal,
      taxTotal,
      total,
      currency: cart.currency,
      deliveryMethod: input.deliveryMethod,
      deliveryZoneId: input.deliveryMethod === "delivery" ? input.deliveryZoneId : null,
      deliveryAddressId,
      notes: input.notes ?? null,
      paymentMethod: input.paymentMethod,
      items: {
        create: lineComputations.map(({ item, unitPrice, lineTotal }) => ({
          tenantId,
          productVariantId: item.productVariantId,
          productNameSnapshot: `${item.variant.product.name} — ${item.variant.name}`,
          unitPrice,
          quantity: item.quantity,
          discount: 0,
          taxRate: item.variant.product.taxRate,
          total: lineTotal,
        })),
      },
      statusHistory: {
        create: { tenantId, fromStatus: null, toStatus: "NEW", changedByType: "customer", note: "Commande créée" },
      },
    },
  });

  if (appliedPromoId) {
    await tx.promoCode.update({ where: { id: appliedPromoId }, data: { usageCount: { increment: 1 } } });
  }

  if (input.paymentMethod === "cod") {
    await transitionOrderStatus(tx, tenantId, {
      orderId,
      toStatus: "CONFIRMED",
      changedByType: "system",
      note: "Paiement à la livraison — commande confirmée directement, sans paiement préalable.",
    });
    await commitReservedStock(tx, tenantId, orderId);
  } else {
    // Paiement manuel : le client doit ouvrir son application Wave/Orange Money,
    // transférer, puis déposer une preuve — la fenêtre de réservation est donc celle
    // configurée par le tenant (heures), pas les 30 minutes d'un paiement PSP hébergé.
    const manual = isManualPaymentMethod(input.paymentMethod);
    const windowMs = manual ? settings.manualPaymentWindowHours * 3_600_000 : RESERVATION_WINDOW_MINUTES * 60_000;
    const reservationExpiresAt = new Date(Date.now() + windowMs);
    await tx.order.update({ where: { id: orderId }, data: { reservationExpiresAt } });
    await transitionOrderStatus(tx, tenantId, {
      orderId,
      toStatus: "AWAITING_PAYMENT",
      changedByType: "system",
      note: manual ? "En attente du transfert manuel et de sa preuve." : "En attente de paiement en ligne.",
    });
  }

  const finalOrder = await tx.order.findFirstOrThrow({ where: { id: orderId, tenantId } });
  return { order: finalOrder, alreadyExisted: false };
}

/**
 * Décrémente réellement `availableQuantity`... non — décrémente `reservedQuantity`
 * (le stock a déjà quitté `availableQuantity` au moment de la réservation) et écrit
 * l'historique réel. Appelée UNIQUEMENT sur l'arête `-> CONFIRMED` (voir
 * `STOCK_COMMIT_STATUS`), quel que soit le chemin (COD immédiat, ou paiement en ligne
 * confirmé après succès — voir `confirmOrderPaymentSuccess`).
 */
export async function commitReservedStock(tx: Prisma.TransactionClient, tenantId: string, orderId: string) {
  const shop = await getOrCreateMainShop(tx, tenantId);
  const items = await tx.orderItem.findMany({ where: { orderId, tenantId } });
  for (const item of items) {
    const inventoryItem = await findMainShopInventoryItem(tx, tenantId, item.productVariantId, shop.id);
    if (!inventoryItem) continue;
    const { count } = await tx.inventoryItem.updateMany({
      where: { id: inventoryItem.id, tenantId, reservedQuantity: { gte: item.quantity } },
      data: { reservedQuantity: { decrement: item.quantity } },
    });
    if (count === 0) {
      throw new Error(`commitReservedStock : réservation incohérente pour l'article "${item.id}" (commande "${orderId}").`);
    }
    await tx.stockMovement.create({
      data: {
        tenantId,
        inventoryItemId: inventoryItem.id,
        type: "out",
        quantity: item.quantity,
        referenceType: "order",
        referenceId: orderId,
        reason: "Commande confirmée",
      },
    });
  }
}

/**
 * Libère une réservation qui n'a jamais été commise — le stock disponible n'a jamais
 * quitté `availableQuantity` de façon irréversible (contrairement à
 * `restockAfterPostConfirmationCancel`), mais le transfert `reservedQuantity ->
 * availableQuantity` reste un événement à tracer : chaque libération écrit un
 * `StockMovement` (type "adjustment", faute d'un type dédié dans le vocabulaire
 * existant) ET, via `cancelOrder`, une entrée `OrderStatusHistory` — un opérateur
 * doit toujours pouvoir répondre à « pourquoi ce stock a-t-il bougé ? » sans deviner.
 */
export async function releaseReservedStock(
  tx: Prisma.TransactionClient,
  tenantId: string,
  orderId: string,
  reason: string,
) {
  const shop = await getOrCreateMainShop(tx, tenantId);
  const items = await tx.orderItem.findMany({ where: { orderId, tenantId } });
  for (const item of items) {
    const inventoryItem = await findMainShopInventoryItem(tx, tenantId, item.productVariantId, shop.id);
    if (!inventoryItem) continue;
    await tx.inventoryItem.updateMany({
      where: { id: inventoryItem.id, tenantId },
      data: { availableQuantity: { increment: item.quantity }, reservedQuantity: { decrement: item.quantity } },
    });
    await tx.stockMovement.create({
      data: {
        tenantId,
        inventoryItemId: inventoryItem.id,
        type: "adjustment",
        quantity: item.quantity,
        referenceType: "order",
        referenceId: orderId,
        reason,
      },
    });
  }
}

/** Réapprovisionne réellement (le stock avait déjà été décrémenté au moment de la
 *  confirmation) — écrit un `StockMovement` type "return", contrairement à
 *  `releaseReservedStock`. */
export async function restockAfterPostConfirmationCancel(
  tx: Prisma.TransactionClient,
  tenantId: string,
  orderId: string,
) {
  const shop = await getOrCreateMainShop(tx, tenantId);
  const items = await tx.orderItem.findMany({ where: { orderId, tenantId } });
  for (const item of items) {
    const inventoryItem = await findMainShopInventoryItem(tx, tenantId, item.productVariantId, shop.id);
    if (!inventoryItem) continue;
    await tx.inventoryItem.updateMany({
      where: { id: inventoryItem.id, tenantId },
      data: { availableQuantity: { increment: item.quantity } },
    });
    await tx.stockMovement.create({
      data: {
        tenantId,
        inventoryItemId: inventoryItem.id,
        type: "return",
        quantity: item.quantity,
        referenceType: "order",
        referenceId: orderId,
        reason: "Commande annulée après confirmation",
      },
    });
  }
}

const STATUSES_BEFORE_STOCK_COMMIT = new Set(["NEW", "AWAITING_PAYMENT", "PAID"]);

export interface CancelOrderActor {
  changedBy?: string | null;
  changedByType: "owner" | "employee" | "system" | "customer";
  note?: string | null;
}

/**
 * Annulation — point de passage UNIQUE, que ce soit un clic dashboard, une
 * expiration automatique de réservation (voir `order-reservation.ts`, étape 2
 * suivante), ou une annulation client. Restocke réellement si la commande avait déjà
 * dépassé `STOCK_COMMIT_STATUS`, sinon libère simplement la réservation.
 */
export async function cancelOrder(tx: Prisma.TransactionClient, tenantId: string, orderId: string, actor: CancelOrderActor) {
  const order = await tx.order.findFirst({ where: { id: orderId, tenantId } });
  if (!order) throw new Error(`cancelOrder : commande "${orderId}" introuvable pour ce tenant.`);

  if (order.status === "CANCELED") {
    // Déjà annulée — no-op sûr, le stock a déjà été libéré/restocké par la PREMIÈRE
    // annulation réussie. Ne jamais le refaire (voir la course ci-dessous).
    return order;
  }

  const wasCommitted = !STATUSES_BEFORE_STOCK_COMMIT.has(order.status);

  // CORRECTION DE STABILISATION — bogue réel trouvé en exécutant la suite réelle sur
  // GitHub Actions (jamais reproduit localement, révélé par un ordonnancement
  // différent) : `transitionOrderStatus` court-circuite silencieusement (retourne
  // l'ordre SANS lever ni écrire d'historique) quand la commande est DÉJÀ dans l'état
  // cible — un no-op légitime pour un rejeu simple, mais dangereux ici, car plusieurs
  // appels CONCURRENTS de `cancelOrder` (ex. deux workers sur le même job expiré,
  // voir order-reservation.test.ts « DEUX WORKERS ») peuvent chacun lire un statut PAS
  // ENCORE annulé, puis découvrir — seulement au moment de l'appel interne et frais de
  // `transitionOrderStatus` — que l'un d'eux a déjà gagné entre-temps. Sans détecter
  // ce no-op, CHAQUE appelant relâchait/restockait le stock une fois de plus, jamais
  // gardé par aucune contrainte DB (contrairement à `commitReservedStock`), d'où un
  // dépassement réel constaté (3 libérations pour une seule commande annulée une
  // fois). `transitionOrderStatus` n'écrit une ligne `OrderStatusHistory` QUE sur une
  // vraie transition (jamais sur le court-circuit) — compter avant/après dans la MÊME
  // transaction est donc un signal fiable, sans toucher à la signature publique de
  // `transitionOrderStatus` (utilisée par des appelants qui, eux, n'ont pas cette
  // classe de bogue).
  const cancelHistoryBefore = await tx.orderStatusHistory.count({ where: { orderId, tenantId, toStatus: "CANCELED" } });
  await transitionOrderStatus(tx, tenantId, {
    orderId,
    toStatus: "CANCELED",
    changedBy: actor.changedBy,
    changedByType: actor.changedByType,
    note: actor.note,
  });
  const cancelHistoryAfter = await tx.orderStatusHistory.count({ where: { orderId, tenantId, toStatus: "CANCELED" } });

  if (cancelHistoryAfter > cancelHistoryBefore) {
    // CET appel a réellement effectué la transition — lui seul relâche/restocke.
    if (wasCommitted) {
      await restockAfterPostConfirmationCancel(tx, tenantId, orderId);
    } else {
      await releaseReservedStock(tx, tenantId, orderId, actor.note ?? "Réservation libérée (commande annulée avant confirmation)");
    }
  }

  if (order.reservationExpiresAt) {
    await tx.order.update({ where: { id: orderId }, data: { reservationExpiresAt: null } });
  }

  return tx.order.findFirstOrThrow({ where: { id: orderId, tenantId } });
}

export interface ConfirmOrderPaymentSuccessResult {
  order: Order;
  outcome: "confirmed" | "already_confirmed" | "flagged_for_manual_reconciliation";
}

/**
 * Effet de bord UNIQUE d'un paiement en ligne réussi — appelée par
 * `packages/payments` (`webhook-processor.ts`), et réutilisable par une future
 * confirmation manuelle admin d'un paiement (voir exigence « Le statut payé ne pourra
 * être confirmé que par le serveur ou par un administrateur autorisé pour les
 * paiements manuels »).
 *
 * Idempotente à TROIS niveaux, jamais une exception pour un cas déjà résolu (voir la
 * revue de l'étape 2, « la course webhook/expiration ») :
 * - `already_confirmed` : la commande a déjà dépassé `PAID` (rejeu antérieur du même
 *   webhook, ou confirmation manuelle déjà effectuée) — no-op, pas une erreur.
 * - `flagged_for_manual_reconciliation` : la commande est déjà `CANCELED`/`REFUNDED`
 *   (la réservation a expiré — voir `order-reservation.ts` — AVANT l'arrivée tardive
 *   de ce paiement, qui a donc gagné une course qu'il a perdue). L'argent est
 *   réellement arrivé chez le prestataire : on ne le fait JAMAIS disparaître
 *   silencieusement, mais on ne ressuscite JAMAIS non plus une commande annulée ni ne
 *   recommet du stock qui a peut-être déjà été revendu — le(s) `Payment` correspondant
 *   sont marqués `reconciliationStatus: "mismatched"` pour un traitement manuel
 *   (remboursement ou réattribution) par un administrateur. Ce n'est PAS une erreur
 *   technique à rejouer : l'appelant (webhook) doit considérer l'événement traité.
 * - `confirmed` : le cas normal, enchaîne AWAITING_PAYMENT -> PAID -> CONFIRMED et
 *   commet réellement le stock réservé.
 */
export async function confirmOrderPaymentSuccess(
  tx: Prisma.TransactionClient,
  tenantId: string,
  orderId: string,
  note: string,
  attempt = 1,
): Promise<ConfirmOrderPaymentSuccessResult> {
  const order = await tx.order.findFirst({ where: { id: orderId, tenantId } });
  if (!order) throw new Error(`confirmOrderPaymentSuccess : commande "${orderId}" introuvable pour ce tenant.`);

  if (order.status === "CANCELED" || order.status === "REFUNDED") {
    await tx.payment.updateMany({
      where: { tenantId, orderId, status: "SUCCEEDED" },
      data: { reconciliationStatus: "mismatched" },
    });
    return { order, outcome: "flagged_for_manual_reconciliation" };
  }

  // Déjà confirmée (ou au-delà) par un rejeu antérieur du même webhook, ou une
  // confirmation manuelle déjà effectuée entre-temps — idempotent, pas une erreur.
  if (order.status !== "NEW" && order.status !== "AWAITING_PAYMENT" && order.status !== "PAID") {
    return { order, outcome: "already_confirmed" };
  }

  // COURSE CRITIQUE (webhook de paiement vs expiration de réservation, voir la revue
  // de l'étape 2) : entre notre lecture ci-dessus et notre tentative d'écriture,
  // `releaseExpiredReservation` (order-reservation.ts) a pu annuler CETTE MÊME
  // commande dans une transaction concurrente. `transitionOrderStatus` lève alors
  // `OrderStatusConflictError` (garde anti-TOCTOU). Plutôt que de laisser
  // l'exception remonter (ce qui ferait échouer tout le webhook et gaspillerait un
  // essai BullMQ pour un cas déjà parfaitement gérable ici), on relit l'état FRAIS et
  // on redécide — l'annulation concurrente aura déjà fait passer `order.status` à
  // `CANCELED`, donc le prochain appel tombera proprement dans la branche
  // `flagged_for_manual_reconciliation` ci-dessus. Borné à 3 essais : une vraie
  // boucle infinie n'est possible que si quelque chose d'autre est cassé.
  try {
    if (order.status !== "PAID") {
      await transitionOrderStatus(tx, tenantId, { orderId, toStatus: "PAID", paymentStatus: "PAID", changedByType: "system", note });
    }
    await transitionOrderStatus(tx, tenantId, {
      orderId,
      toStatus: STOCK_COMMIT_STATUS,
      changedByType: "system",
      note: "Confirmation automatique après paiement reçu.",
    });
  } catch (error) {
    // CORRECTION DE STABILISATION — bogue réel trouvé sur GitHub Actions : la garde
    // anti-TOCTOU de `transitionOrderStatus` ne lève pas TOUJOURS
    // `OrderStatusConflictError` en cas de course perdue. Si l'annulation concurrente
    // (`releaseExpiredReservation`) a DÉJÀ commis avant que cette fonction ne relise
    // l'état frais, la commande est maintenant `CANCELED` — une cible `PAID`/
    // `CONFIRMED` depuis `CANCELED` n'est pas seulement "en conflit", elle est
    // INVALIDE (voir `isValidOrderTransition`), donc `InvalidOrderTransitionError` est
    // levée à la place. Le commentaire ci-dessus annonçait déjà l'intention ("on relit
    // l'état FRAIS et on redécide") : il manquait seulement ce second type d'erreur
    // dans la condition qui déclenche cette relecture.
    if ((error instanceof OrderStatusConflictError || error instanceof InvalidOrderTransitionError) && attempt < 3) {
      return confirmOrderPaymentSuccess(tx, tenantId, orderId, note, attempt + 1);
    }
    throw error;
  }

  await commitReservedStock(tx, tenantId, orderId);
  await tx.order.update({ where: { id: orderId }, data: { reservationExpiresAt: null } });

  const finalOrder = await tx.order.findFirstOrThrow({ where: { id: orderId, tenantId } });
  return { order: finalOrder, outcome: "confirmed" };
}
