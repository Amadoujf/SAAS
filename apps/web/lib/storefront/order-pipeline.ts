import "server-only";
import {
  withTenant,
  getOrCreateActiveCart,
  getCommerceSettings,
  quoteDeliveryForCart,
  submitManualPaymentProof,
  cancelOrderByCustomer,
  findOrderForGuest,
  getOrderForCustomer,
  addCartItem,
  getCartWithTotals,
  OrderOperationError,
} from "@yamacommerce/database";
import { RedisRateLimiter, redisConnection } from "@yamacommerce/queue";
import { isOrdersModuleEnabled } from "@/lib/catalog/require-orders-module";
import { planOrderNotifications, dispatchPlannedNotifications, type PlannedNotification } from "@/lib/orders/notify";
import { getAvailablePaymentMethods } from "./checkout-pipeline";

/**
 * Parcours client PUBLIC après le panier : options de checkout, devis de livraison,
 * suivi de commande (jeton), preuve de paiement manuel, annulation, recommande.
 * Aucune donnée d'une commande n'est accessible sans son jeton d'accès — obtenu à la
 * création, ou par le couple numéro + téléphone (limité en fréquence).
 */
const limiter = new RedisRateLimiter(redisConnection);

export async function getCheckoutOptions(tenantId: string, visitorToken: string) {
  if (!(await isOrdersModuleEnabled(tenantId))) return null;
  const [methods, settings, quote] = await Promise.all([
    getAvailablePaymentMethods(tenantId),
    withTenant(tenantId, (tx) => getCommerceSettings(tx, tenantId)),
    withTenant(tenantId, async (tx) => {
      const cart = await getOrCreateActiveCart(tx, tenantId, visitorToken);
      return quoteDeliveryForCart(tx, tenantId, cart.id);
    }),
  ]);
  return { methods, settings: { pickupEnabled: settings.pickupEnabled, pickupAddress: settings.pickupAddress, pickupInstructions: settings.pickupInstructions, deliveryInstructions: settings.deliveryInstructions }, quote };
}

export async function getDeliveryQuote(tenantId: string, visitorToken: string, region: string | null) {
  if (!(await isOrdersModuleEnabled(tenantId))) return null;
  return withTenant(tenantId, async (tx) => {
    const cart = await getOrCreateActiveCart(tx, tenantId, visitorToken);
    return quoteDeliveryForCart(tx, tenantId, cart.id, region);
  });
}

export async function getOrderView(tenantId: string, orderId: string, token: string) {
  return withTenant(tenantId, (tx) => getOrderForCustomer(tx, tenantId, orderId, token));
}

export async function submitProof(tenantId: string, orderId: string, token: string, reference: string) {
  let planned: PlannedNotification[] = [];
  await withTenant(tenantId, async (tx) => {
    await submitManualPaymentProof(tx, tenantId, orderId, token, { reference });
    planned = await planOrderNotifications(tx, tenantId, orderId, "payment_proof_to_review");
  });
  await dispatchPlannedNotifications(tenantId, planned);
}

export async function cancelAsCustomer(tenantId: string, orderId: string, token: string) {
  let planned: PlannedNotification[] = [];
  await withTenant(tenantId, async (tx) => {
    await cancelOrderByCustomer(tx, tenantId, orderId, token);
    planned = await planOrderNotifications(tx, tenantId, orderId, "order_canceled");
  });
  await dispatchPlannedNotifications(tenantId, planned);
}

export async function lookupGuestOrder(tenantId: string, clientKey: string, orderNumber: string, phone: string) {
  const rate = await limiter.consume(`guest-lookup:${tenantId}:${clientKey}`, 8, 15 * 60_000);
  if (!rate.allowed) throw new OrderOperationError("Trop de tentatives. Réessayez dans quelques minutes.");
  return withTenant(tenantId, (tx) => findOrderForGuest(tx, tenantId, orderNumber, phone));
}

/** « Commander à nouveau » : remet dans le panier les articles encore achetables, aux
 *  prix ACTUELS (recalculés au panier), et dit clairement ce qui n'a pas pu l'être. */
export async function reorder(tenantId: string, visitorToken: string, orderId: string, token: string) {
  return withTenant(tenantId, async (tx) => {
    const order = await getOrderForCustomer(tx, tenantId, orderId, token);
    if (!order) throw new OrderOperationError("Commande introuvable.");
    const cart = await getOrCreateActiveCart(tx, tenantId, visitorToken);
    let skipped = 0;
    for (const item of order.items) {
      try {
        await tx.$executeRaw`SAVEPOINT reorder_line`;
        await addCartItem(tx, tenantId, cart.id, { productVariantId: item.productVariantId, quantity: item.quantity });
        await tx.$executeRaw`RELEASE SAVEPOINT reorder_line`;
      } catch {
        await tx.$executeRaw`ROLLBACK TO SAVEPOINT reorder_line`;
        skipped += 1;
      }
    }
    return { cart: await getCartWithTotals(tx, tenantId, cart.id), skipped };
  });
}
