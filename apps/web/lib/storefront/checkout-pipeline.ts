import "server-only";
import {
  withTenant,
  getOrCreateActiveCart,
  convertCartToOrder,
  type ConvertCartToOrderInput,
} from "@yamacommerce/database";
import {
  resolveProviderForTenant,
  resolveEnabledOnlineProvider,
  reserveOrReusePendingPayment,
  type PaymentProviderName,
} from "@yamacommerce/payments";
import { stockReservationExpiryQueue, QUEUE_NAMES } from "@yamacommerce/queue";
import { isOrdersModuleEnabled } from "@/lib/catalog/require-orders-module";

/**
 * Couche métier du checkout storefront — étape 2 (clients/panier/commandes/
 * livraison, 19 septembre 2026). PUBLIQUE (aucune permission utilisateur), gardée
 * par le module `"catalog"` comme le reste du panier. `convertCartToOrder`
 * (`@yamacommerce/database`) fait tout le travail de recalcul serveur/réservation/
 * idempotence ; cette couche orchestre en plus l'initiation du paiement, qui
 * implique un VRAI appel réseau au prestataire (PayDunya) — jamais à l'intérieur
 * d'une transaction PostgreSQL (voir `reserveOrReusePendingPayment`, appelé dans sa
 * PROPRE transaction courte, séparée de celle de la commande).
 *
 * Ni simulation ni raccourci : si aucun moyen de paiement en ligne n'est configuré
 * pour ce tenant, le paiement en ligne est simplement REFUSÉ (erreur claire) — jamais
 * un succès fabriqué. Le statut "payé" ne peut venir que d'un webhook vérifié
 * (`processPaymentWebhook`) ou d'une confirmation manuelle admin (voir
 * `confirmOrderPaymentSuccess`, réservée à l'étape dashboard).
 */

export interface CheckoutInput {
  customer: { firstName: string; lastName?: string | null; phone?: string | null; email?: string | null };
  deliveryMethod: "delivery" | "pickup";
  deliveryZoneId?: string | null;
  deliveryAddress?: ConvertCartToOrderInput["deliveryAddress"];
  paymentMethod: "cod" | "online";
  promoCode?: string | null;
  notes?: string | null;
}

export interface CheckoutResult {
  orderId: string;
  orderNumber: string;
  accessToken: string;
  status: string;
  total: number;
  currency: string;
  /** Non nul UNIQUEMENT pour `paymentMethod: "online"` — l'URL hébergée par le
   *  prestataire où rediriger le client. Null pour COD (rien à payer en ligne). */
  checkoutUrl: string | null;
}

export async function checkoutAction(
  tenantId: string,
  tenantName: string,
  visitorToken: string,
  host: string,
  input: CheckoutInput,
): Promise<CheckoutResult | null> {
  if (!(await isOrdersModuleEnabled(tenantId))) return null;

  let provider: PaymentProviderName = "cod";
  if (input.paymentMethod === "online") {
    const enabled = await resolveEnabledOnlineProvider(tenantId);
    if (!enabled) {
      throw new Error("Aucun moyen de paiement en ligne n'est configuré pour cette boutique — choisissez le paiement à la livraison.");
    }
    provider = enabled;
  }

  const { order } = await withTenant(tenantId, async (tx) => {
    const cart = await getOrCreateActiveCart(tx, tenantId, visitorToken);
    return convertCartToOrder(tx, tenantId, {
      cartId: cart.id,
      customer: input.customer,
      deliveryMethod: input.deliveryMethod,
      deliveryZoneId: input.deliveryZoneId ?? null,
      deliveryAddress: input.deliveryAddress ?? null,
      paymentMethod: input.paymentMethod,
      promoCode: input.promoCode ?? null,
      notes: input.notes ?? null,
      channel: "web",
    });
  });

  // Planifie l'expiration automatique de la réservation — étape 2 (M4). `jobId:
  // order.id` dédoublonne nativement (un rejeu idempotent de checkout, ou une
  // relance après échec d'initiation du paiement, ne planifie jamais un second job
  // pour la même commande — voir `schedule-pipeline.ts` pour le même précédent). Le
  // délai vient de `Order.reservationExpiresAt` (déjà posé par `convertCartToOrder`),
  // jamais recalculé ici, pour rester la SEULE source de vérité sur l'échéance.
  if (order.reservationExpiresAt) {
    const delay = Math.max(0, order.reservationExpiresAt.getTime() - Date.now());
    await stockReservationExpiryQueue.add(
      QUEUE_NAMES.stockReservationExpiry,
      { tenantId, orderId: order.id },
      { jobId: order.id, delay },
    );
  }

  const adapter = await resolveProviderForTenant(tenantId, provider, tenantName);
  const { payment } = await withTenant(tenantId, (tx) =>
    reserveOrReusePendingPayment(tx, { tenantId, orderId: order.id, provider: adapter.name, amount: order.total, type: "full" }),
  );

  let checkoutUrl: string;
  if (payment.providerTransactionId) {
    // Rejeu (retry après un rechargement de page, ou un échec réseau précédent) :
    // le paiement a déjà été initié auprès du prestataire — ne JAMAIS recréer une
    // seconde facture/transaction, réutiliser l'URL déjà obtenue.
    const raw = payment.rawPayload as { checkoutUrl?: string } | null;
    checkoutUrl = raw?.checkoutUrl ?? "";
  } else {
    const customerName = [input.customer.firstName, input.customer.lastName].filter(Boolean).join(" ");
    const result = await adapter.createPayment({
      idempotencyKey: payment.idempotencyKey,
      orderId: order.id,
      tenantId,
      amount: order.total,
      currency: "XOF",
      description: `Commande ${order.orderNumber}`,
      customer: { name: customerName, phone: input.customer.phone ?? undefined, email: input.customer.email ?? undefined },
      returnUrl: `https://${host}/commande/${order.id}/confirmation?token=${order.accessToken}`,
      cancelUrl: `https://${host}/panier`,
      callbackUrl: `https://${host}/api/webhooks/${adapter.name}/${tenantId}`,
    });
    await withTenant(tenantId, (tx) =>
      tx.payment.update({
        where: { id: payment.id },
        data: {
          providerTransactionId: result.providerTransactionId,
          rawPayload: { checkoutUrl: result.checkoutUrl, raw: result.raw as object },
        },
      }),
    );
    checkoutUrl = result.checkoutUrl;
  }

  return {
    orderId: order.id,
    orderNumber: order.orderNumber,
    accessToken: order.accessToken,
    status: order.status,
    total: order.total,
    currency: order.currency,
    checkoutUrl: input.paymentMethod === "online" ? checkoutUrl : null,
  };
}
