import "server-only";
import {
  withTenant,
  getOrCreateActiveCart,
  addCartItem as addCartItemRegistry,
  updateCartItemQuantity as updateCartItemQuantityRegistry,
  removeCartItem as removeCartItemRegistry,
  getCartWithTotals as getCartWithTotalsRegistry,
} from "@yamacommerce/database";
import { isOrdersModuleEnabled } from "@/lib/catalog/require-orders-module";

/**
 * Couche métier du panier storefront — PUBLIQUE, jamais de vérification de
 * permission utilisateur (un visiteur anonyme doit pouvoir composer un panier) :
 * seul le module `"catalog"` (voir `require-orders-module.ts`) doit être activé pour
 * ce tenant. Chaque action est gardée par le MÊME contrôle de module, pour qu'aucun
 * chemin ne l'oublie (défense en profondeur, même discipline que
 * `requireTenantPermission` côté dashboard).
 *
 * `cartId` n'est JAMAIS accepté depuis le client ici : il est toujours dérivé du
 * `visitorToken` (cookie httpOnly, voir `visitor-session.ts`) via
 * `getOrCreateActiveCart`. Seul `cartItemId` (identifiant d'une LIGNE) transite
 * depuis le client — `cart-registry.ts` vérifie alors que la ligne appartient bien au
 * panier de CE visiteur avant toute mutation (voir la note de sécurité dans
 * `cart-registry.ts`, `assertActiveCart`).
 */

export async function getCartAction(tenantId: string, visitorToken: string) {
  if (!(await isOrdersModuleEnabled(tenantId))) return null;
  return withTenant(tenantId, async (tx) => {
    const cart = await getOrCreateActiveCart(tx, tenantId, visitorToken);
    return getCartWithTotalsRegistry(tx, tenantId, cart.id);
  });
}

export async function addCartItemAction(
  tenantId: string,
  visitorToken: string,
  input: { productVariantId: string; quantity: number },
) {
  if (!(await isOrdersModuleEnabled(tenantId))) return null;
  return withTenant(tenantId, async (tx) => {
    const cart = await getOrCreateActiveCart(tx, tenantId, visitorToken);
    await addCartItemRegistry(tx, tenantId, cart.id, input);
    return getCartWithTotalsRegistry(tx, tenantId, cart.id);
  });
}

export async function updateCartItemQuantityAction(
  tenantId: string,
  visitorToken: string,
  cartItemId: string,
  quantity: number,
) {
  if (!(await isOrdersModuleEnabled(tenantId))) return null;
  return withTenant(tenantId, async (tx) => {
    await updateCartItemQuantityRegistry(tx, tenantId, visitorToken, cartItemId, quantity);
    const cart = await getOrCreateActiveCart(tx, tenantId, visitorToken);
    return getCartWithTotalsRegistry(tx, tenantId, cart.id);
  });
}

export async function removeCartItemAction(tenantId: string, visitorToken: string, cartItemId: string) {
  if (!(await isOrdersModuleEnabled(tenantId))) return null;
  return withTenant(tenantId, async (tx) => {
    await removeCartItemRegistry(tx, tenantId, visitorToken, cartItemId);
    const cart = await getOrCreateActiveCart(tx, tenantId, visitorToken);
    return getCartWithTotalsRegistry(tx, tenantId, cart.id);
  });
}
