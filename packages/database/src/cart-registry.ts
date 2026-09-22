import type { Prisma } from "@prisma/client";

/**
 * Persistance du panier — étape 2 (clients/panier/commandes/livraison, 19 septembre
 * 2026). `Cart`/`CartItem` sont RÉELLEMENT protégées par RLS Pattern A dès leur
 * création (voir la migration `20260926000000_orders_cart_delivery_foundation`) —
 * contrairement à `ProductVariant`/`InventoryItem`/`StockMovement` qui ne l'ont reçue
 * qu'après coup. Chaque fonction filtre néanmoins EXPLICITEMENT par `tenantId`,
 * défense en profondeur, même discipline que `catalog-registry.ts`.
 *
 * AUCUNE réservation de stock ici — le panier reste une zone d'intérêt informative :
 * plusieurs visiteurs peuvent mettre en panier le dernier article disponible en même
 * temps, seule la COMMANDE (voir `order-registry.ts`, étape 2 suivante) réserve
 * réellement le stock de façon atomique. `getCartWithTotals` annonce néanmoins la
 * disponibilité en direct (`availableQuantity` sommé) pour que le storefront puisse
 * avertir l'acheteur AVANT le checkout — jamais une garantie, seulement une
 * indication.
 *
 * Prix TOUJOURS recalculés à partir de `ProductVariant.price` en direct — `CartItem`
 * ne stocke volontairement aucun prix : rien ne doit jamais devenir une donnée
 * périmée qu'il faudrait resynchroniser.
 */

export interface AddCartItemInput {
  productVariantId: string;
  quantity: number;
}

export interface CartLineWithDetails {
  id: string;
  productVariantId: string;
  productId: string;
  productName: string;
  variantName: string;
  imageUrl: string | null;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  availableQuantity: number;
}

export interface CartWithTotals {
  id: string;
  status: string;
  currency: string;
  lines: CartLineWithDetails[];
  subtotal: number;
  itemCount: number;
}

/**
 * Récupère le panier ACTIF du visiteur (ou du client) s'il existe, sinon en crée un.
 * Jamais un `upsert` typé : l'unicité « au plus un panier actif par visiteur » est
 * posée par un index PARTIEL (`Cart_tenant_visitor_active_unique`, voir la migration),
 * non déclarable via `@@unique` côté Prisma — `create()` + capture de la violation
 * P2002 + relecture est donc le seul chemin sûr sous concurrence réelle (deux
 * requêtes "premier ajout au panier" du même visiteur, simultanées).
 */
export async function getOrCreateActiveCart(
  tx: Prisma.TransactionClient,
  tenantId: string,
  visitorToken: string,
) {
  const existing = await tx.cart.findFirst({ where: { tenantId, visitorToken, status: "active" } });
  if (existing) return existing;

  try {
    return await tx.cart.create({ data: { tenantId, visitorToken, status: "active", currency: "XOF" } });
  } catch (error) {
    // P2002 : un autre appel concurrent a créé le panier actif entre notre lecture et
    // notre écriture — jamais deux paniers actifs pour le même visiteur, on relit.
    const winner = await tx.cart.findFirst({ where: { tenantId, visitorToken, status: "active" } });
    if (winner) return winner;
    throw error;
  }
}

/**
 * `tenantId` isole entre ENTREPRISES (RLS), mais RIEN n'isole nativement entre deux
 * VISITEURS anonymes d'une même entreprise — `Cart`/`CartItem` n'ont pas de notion de
 * "propriétaire courant" au niveau RLS. Toute mutation qui accepte un identifiant
 * fourni par le client (`cartItemId`, jamais un `cartId` — celui-ci vient TOUJOURS de
 * `getOrCreateActiveCart(visitorToken)`, jamais du client) doit donc vérifier
 * explicitement que le panier appartient bien à CE visiteur, sans quoi un visiteur
 * pourrait deviner/énumérer l'identifiant du panier d'un autre et le modifier.
 */
async function assertActiveCart(
  tx: Prisma.TransactionClient,
  tenantId: string,
  cartId: string,
  visitorToken?: string,
) {
  const cart = await tx.cart.findFirst({ where: { id: cartId, tenantId } });
  if (!cart) throw new Error(`Panier "${cartId}" introuvable pour ce tenant.`);
  if (cart.status !== "active") throw new Error(`Panier "${cartId}" n'est plus actif (statut : ${cart.status}).`);
  if (visitorToken !== undefined && cart.visitorToken !== visitorToken) {
    throw new Error(`Panier "${cartId}" n'appartient pas à ce visiteur.`);
  }
  return cart;
}

/** Valide que la variante existe, appartient à CE tenant, et que son produit est
 *  publiquement achetable (publié, non supprimé) — jamais un produit brouillon/
 *  archivé ajoutable au panier public, même par un id deviné. */
async function assertPurchasableVariant(tx: Prisma.TransactionClient, tenantId: string, productVariantId: string) {
  const variant = await tx.productVariant.findFirst({
    where: { id: productVariantId, tenantId, product: { status: "PUBLISHED", deletedAt: null } },
  });
  if (!variant) {
    throw new Error(`Variante "${productVariantId}" introuvable, non publiée, ou n'appartenant pas à ce tenant.`);
  }
  return variant;
}

export async function addCartItem(
  tx: Prisma.TransactionClient,
  tenantId: string,
  cartId: string,
  input: AddCartItemInput,
) {
  if (input.quantity <= 0) throw new Error("addCartItem : la quantité doit être strictement positive.");
  await assertActiveCart(tx, tenantId, cartId);
  await assertPurchasableVariant(tx, tenantId, input.productVariantId);

  return tx.cartItem.upsert({
    where: { cartId_productVariantId: { cartId, productVariantId: input.productVariantId } },
    create: { tenantId, cartId, productVariantId: input.productVariantId, quantity: input.quantity },
    update: { quantity: { increment: input.quantity } },
  });
}

/** Fixe une quantité ABSOLUE (curseur du panier) — une quantité <= 0 retire la ligne,
 *  jamais une ligne fantôme à quantité nulle. `visitorToken` : voir la note de
 *  `assertActiveCart` — un `cartItemId` est fourni par le client, donc non fiable
 *  seul, sans vérification que ce panier appartient bien à CE visiteur. */
export async function updateCartItemQuantity(
  tx: Prisma.TransactionClient,
  tenantId: string,
  visitorToken: string,
  cartItemId: string,
  quantity: number,
) {
  const item = await tx.cartItem.findFirst({ where: { id: cartItemId, tenantId } });
  if (!item) throw new Error(`updateCartItemQuantity : article "${cartItemId}" introuvable pour ce tenant.`);
  await assertActiveCart(tx, tenantId, item.cartId, visitorToken);

  if (quantity <= 0) {
    await tx.cartItem.deleteMany({ where: { id: cartItemId, tenantId } });
    return null;
  }
  return tx.cartItem.update({ where: { id: cartItemId }, data: { quantity } });
}

export async function removeCartItem(
  tx: Prisma.TransactionClient,
  tenantId: string,
  visitorToken: string,
  cartItemId: string,
) {
  const item = await tx.cartItem.findFirst({ where: { id: cartItemId, tenantId } });
  if (!item) throw new Error(`removeCartItem : article "${cartItemId}" introuvable pour ce tenant.`);
  await assertActiveCart(tx, tenantId, item.cartId, visitorToken);
  await tx.cartItem.deleteMany({ where: { id: cartItemId, tenantId } });
}

/**
 * Panier avec totaux recalculés EN DIRECT — jamais une valeur mise en cache ou
 * stockée. Une ligne dont la variante a été dépubliée/supprimée depuis l'ajout est
 * silencieusement omise du calcul (elle reste en base, visible seulement si le
 * produit redevient publié) plutôt que de faire échouer tout l'affichage du panier.
 */
export async function getCartWithTotals(
  tx: Prisma.TransactionClient,
  tenantId: string,
  cartId: string,
): Promise<CartWithTotals | null> {
  const cart = await tx.cart.findFirst({
    where: { id: cartId, tenantId },
    include: {
      items: {
        include: {
          variant: {
            include: {
              product: { include: { images: { orderBy: { position: "asc" }, take: 1 } } },
              inventoryItems: { select: { availableQuantity: true } },
            },
          },
        },
      },
    },
  });
  if (!cart) return null;

  const lines: CartLineWithDetails[] = cart.items
    .filter((item) => item.variant.product.status === "PUBLISHED" && !item.variant.product.deletedAt)
    .map((item) => {
      const unitPrice = item.variant.price;
      const availableQuantity = item.variant.inventoryItems.reduce((sum, i) => sum + i.availableQuantity, 0);
      return {
        id: item.id,
        productVariantId: item.productVariantId,
        productId: item.variant.product.id,
        productName: item.variant.product.name,
        variantName: item.variant.name,
        imageUrl: item.variant.product.images[0]?.url ?? null,
        unitPrice,
        quantity: item.quantity,
        lineTotal: unitPrice * item.quantity,
        availableQuantity,
      };
    });

  const subtotal = lines.reduce((sum, line) => sum + line.lineTotal, 0);
  const itemCount = lines.reduce((sum, line) => sum + line.quantity, 0);

  return { id: cart.id, status: cart.status, currency: cart.currency, lines, subtotal, itemCount };
}
