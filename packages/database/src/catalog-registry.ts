import type { Prisma, ProductStatus } from "@prisma/client";
import { refreshMediaAssetReferenceCount } from "./media-assets-registry";

/**
 * Persistance du catalogue (catégories, produits, variantes, stock) — voir la revue
 * du 18 septembre 2026, « produits réels par entreprise ». Même convention que
 * `domains-registry.ts`/`media-assets-registry.ts` : chaque fonction reçoit `tx`
 * (déjà scoping-vérifié par `withTenant(tenantId, ...)`) ET `tenantId` explicitement.
 *
 * SÉCURITÉ — LIRE AVANT DE MODIFIER CE FICHIER : `Category` et `Product` ont une
 * policy RLS directe (Pattern A, voir la migration `20260912000001_enable_row_level_
 * security`), mais `ProductVariant`, `InventoryItem` et `StockMovement` n'en ont
 * AUCUNE (limite documentée dans cette même migration, lignes 158-176) — RLS ne
 * protège que `Category`/`Product` elles-mêmes, jamais leurs tables enfants. Une
 * requête sur ces trois tables qui ne filtre QUE par leur id primaire laisserait donc
 * fuiter/modifier les données d'un autre tenant, RLS ou pas. CHAQUE fonction
 * touchant ces tables filtre donc explicitement via une jointure vers `Product`
 * (`variant: { product: { tenantId } }`) — jamais un `findUnique`/`update` par id
 * brut seul. C'est le premier endroit du code qui établit ce pattern ; voir
 * `packages/database/tests/catalog-registry.test.ts`, « ISOLATION », pour la preuve
 * réelle contre PostgreSQL que ce filtrage fonctionne.
 */

// ============================================================================
// CATÉGORIES — RLS directe (Pattern A), rien de spécial à faire.
// ============================================================================

export interface CategoryInput {
  name: string;
  slug: string;
  parentId?: string | null;
  imageUrl?: string | null;
}

export async function createCategory(tx: Prisma.TransactionClient, tenantId: string, input: CategoryInput) {
  return tx.category.create({
    data: {
      tenantId,
      name: input.name,
      slug: input.slug,
      parentId: input.parentId ?? null,
      imageUrl: input.imageUrl ?? null,
    },
  });
}

export async function updateCategory(
  tx: Prisma.TransactionClient,
  tenantId: string,
  id: string,
  input: Partial<CategoryInput>,
) {
  const { count } = await tx.category.updateMany({ where: { id, tenantId }, data: input });
  if (count === 0) throw new Error(`updateCategory : catégorie "${id}" introuvable pour ce tenant.`);
  return tx.category.findFirstOrThrow({ where: { id, tenantId } });
}

/** Refuse de supprimer une catégorie encore utilisée par un produit — jamais un
 *  détachement silencieux des produits qui la référencent. */
export async function deleteCategory(tx: Prisma.TransactionClient, tenantId: string, id: string) {
  const productCount = await tx.product.count({ where: { tenantId, categoryId: id } });
  if (productCount > 0) {
    throw new Error(
      `deleteCategory : la catégorie "${id}" est encore utilisée par ${productCount} produit(s).`,
    );
  }
  const { count } = await tx.category.deleteMany({ where: { id, tenantId } });
  if (count === 0) throw new Error(`deleteCategory : catégorie "${id}" introuvable pour ce tenant.`);
}

export async function listCategories(tx: Prisma.TransactionClient, tenantId: string) {
  return tx.category.findMany({ where: { tenantId }, orderBy: { name: "asc" } });
}

// ============================================================================
// PRODUITS — RLS directe (Pattern A).
// ============================================================================

export interface ProductInput {
  categoryId?: string | null;
  name: string;
  slug: string;
  description?: string | null;
  shortDescription?: string | null;
  sku?: string | null;
  brand?: string | null;
  basePrice: number; // FCFA, entier (voir docs/07 : jamais de décimales pour cette devise).
  compareAtPrice?: number | null;
  costPrice?: number | null;
  taxRate?: number;
  tags?: string[];
  createdBy?: string | null;
}

export async function createProduct(tx: Prisma.TransactionClient, tenantId: string, input: ProductInput) {
  return tx.product.create({
    data: {
      tenantId,
      categoryId: input.categoryId ?? null,
      name: input.name,
      slug: input.slug,
      description: input.description ?? null,
      shortDescription: input.shortDescription ?? null,
      sku: input.sku ?? null,
      brand: input.brand ?? null,
      status: "DRAFT",
      basePrice: input.basePrice,
      compareAtPrice: input.compareAtPrice ?? null,
      costPrice: input.costPrice ?? null,
      taxRate: input.taxRate ?? 0,
      tags: input.tags ?? [],
      createdBy: input.createdBy ?? null,
    },
  });
}

export async function updateProduct(
  tx: Prisma.TransactionClient,
  tenantId: string,
  id: string,
  input: Partial<ProductInput>,
) {
  const { count } = await tx.product.updateMany({
    where: { id, tenantId, deletedAt: null },
    data: input,
  });
  if (count === 0) throw new Error(`updateProduct : produit "${id}" introuvable pour ce tenant.`);
  return tx.product.findFirstOrThrow({ where: { id, tenantId } });
}

/** DRAFT/ARCHIVED -> PUBLISHED. Refuse un produit sans variante ni prix cohérent
 *  n'est PAS vérifié ici (couche pipeline applicative, voir apps/web/lib/catalog) —
 *  cette fonction reste une couche de persistance pure. */
export async function setProductStatus(
  tx: Prisma.TransactionClient,
  tenantId: string,
  id: string,
  status: ProductStatus,
) {
  const { count } = await tx.product.updateMany({ where: { id, tenantId }, data: { status } });
  if (count === 0) throw new Error(`setProductStatus : produit "${id}" introuvable pour ce tenant.`);
}

/** Suppression LOGIQUE uniquement (`deletedAt`) — jamais un `DELETE` réel : un produit
 *  peut être référencé par des commandes passées (voir OrderItem), qui doivent
 *  conserver un instantané cohérent (voir `productNameSnapshot` sur OrderItem). */
export async function softDeleteProduct(tx: Prisma.TransactionClient, tenantId: string, id: string) {
  const { count } = await tx.product.updateMany({
    where: { id, tenantId, deletedAt: null },
    data: { deletedAt: new Date(), status: "ARCHIVED" },
  });
  if (count === 0) throw new Error(`softDeleteProduct : produit "${id}" introuvable pour ce tenant.`);
}

export interface ListProductsFilter {
  status?: ProductStatus;
  categoryId?: string;
  search?: string;
  cursor?: string;
  limit?: number;
}

export async function listProducts(
  tx: Prisma.TransactionClient,
  tenantId: string,
  filter: ListProductsFilter = {},
) {
  const limit = Math.min(filter.limit ?? 50, 200);
  return tx.product.findMany({
    where: {
      tenantId,
      deletedAt: null,
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.categoryId ? { categoryId: filter.categoryId } : {}),
      ...(filter.search ? { name: { contains: filter.search, mode: "insensitive" } } : {}),
    },
    include: { category: true, images: { orderBy: { position: "asc" } }, variants: true },
    orderBy: { createdAt: "desc" },
    take: limit,
    ...(filter.cursor ? { skip: 1, cursor: { id: filter.cursor } } : {}),
  });
}

export async function getProductForTenant(tx: Prisma.TransactionClient, tenantId: string, id: string) {
  return tx.product.findFirst({
    where: { id, tenantId, deletedAt: null },
    include: {
      category: true,
      images: { orderBy: { position: "asc" } },
      variants: { include: { inventoryItems: { include: { shop: true } } } },
    },
  });
}

/** Voir docs/08 §8.1, `/p/[slug]` (fiche produit publique) — par slug plutôt que par
 *  id, jamais l'id interne exposé dans une URL publique. `status` optionnel : la
 *  fiche publique ne doit voir QUE `PUBLISHED` (voir l'appelant), tandis que le
 *  dashboard (aperçu avant publication) doit pouvoir voir un brouillon. */
export async function getProductBySlugForTenant(
  tx: Prisma.TransactionClient,
  tenantId: string,
  slug: string,
  status?: ProductStatus,
) {
  return tx.product.findFirst({
    where: { slug, tenantId, deletedAt: null, ...(status ? { status } : {}) },
    include: {
      category: true,
      images: { orderBy: { position: "asc" } },
      variants: { include: { inventoryItems: { include: { shop: true } } } },
    },
  });
}

// ============================================================================
// IMAGES PRODUIT — liées à la médiathèque réelle (jamais une URL en dur).
// ============================================================================

export interface AddProductImageInput {
  productId: string;
  mediaAssetId: string;
  url: string;
  altText?: string | null;
  variantId?: string | null;
}

/**
 * Valide que `mediaAssetId` appartient bien à CE tenant et est `READY` AVANT toute
 * liaison — sinon un produit pourrait afficher (ou pire, laisser deviner l'existence
 * de) un média d'une autre entreprise. Incrémente `MediaAsset.referenceCount` : voir
 * la règle « un média utilisé ne doit jamais être supprimé silencieusement » (même
 * politique que l'éditeur visuel, apps/web/lib/editor/media-references.ts).
 */
export async function addProductImage(tx: Prisma.TransactionClient, tenantId: string, input: AddProductImageInput) {
  const product = await tx.product.findFirst({ where: { id: input.productId, tenantId } });
  if (!product) throw new Error(`addProductImage : produit "${input.productId}" introuvable pour ce tenant.`);

  const asset = await tx.mediaAsset.findFirst({
    where: { id: input.mediaAssetId, tenantId, status: "READY" },
  });
  if (!asset) {
    throw new Error(
      `addProductImage : média "${input.mediaAssetId}" introuvable, non prêt, ou appartenant à un autre tenant.`,
    );
  }

  const position = await tx.productImage.count({ where: { productId: input.productId } });
  const image = await tx.productImage.create({
    data: {
      productId: input.productId,
      variantId: input.variantId ?? null,
      mediaAssetId: input.mediaAssetId,
      url: input.url,
      altText: input.altText ?? null,
      position,
    },
  });

  await refreshMediaAssetReferenceCount(tx, tenantId, input.mediaAssetId, asset.referenceCount + 1);
  return image;
}

/** Vérifie l'appartenance au tenant via une jointure sur `Product` (`ProductImage`
 *  n'a pas de `tenantId` propre, voir la note de sécurité en tête de fichier). */
export async function removeProductImage(tx: Prisma.TransactionClient, tenantId: string, imageId: string) {
  const image = await tx.productImage.findFirst({
    where: { id: imageId, product: { tenantId } },
  });
  if (!image) throw new Error(`removeProductImage : image "${imageId}" introuvable pour ce tenant.`);

  await tx.productImage.delete({ where: { id: imageId } });

  if (image.mediaAssetId) {
    const asset = await tx.mediaAsset.findFirst({ where: { id: image.mediaAssetId, tenantId } });
    if (asset) {
      await refreshMediaAssetReferenceCount(tx, tenantId, image.mediaAssetId, Math.max(0, asset.referenceCount - 1));
    }
  }
}

export async function reorderProductImages(
  tx: Prisma.TransactionClient,
  tenantId: string,
  productId: string,
  orderedImageIds: string[],
) {
  const product = await tx.product.findFirst({ where: { id: productId, tenantId } });
  if (!product) throw new Error(`reorderProductImages : produit "${productId}" introuvable pour ce tenant.`);

  await Promise.all(
    orderedImageIds.map((imageId, position) =>
      tx.productImage.updateMany({ where: { id: imageId, productId }, data: { position } }),
    ),
  );
}

// ============================================================================
// VARIANTES — PAS de RLS directe (voir note de sécurité en tête de fichier) :
// chaque fonction filtre explicitement via `product: { tenantId }`.
// ============================================================================

export interface ProductVariantInput {
  name: string; // ex. "Rouge / M"
  sku?: string | null;
  price: number;
  costPrice?: number | null;
  barcode?: string | null;
  weightGrams?: number | null;
  volumeCm3?: number | null;
  attributes?: Record<string, string>; // { color: "Rouge", size: "M", material: "Coton" }
}

export async function createProductVariant(
  tx: Prisma.TransactionClient,
  tenantId: string,
  productId: string,
  input: ProductVariantInput,
) {
  const product = await tx.product.findFirst({ where: { id: productId, tenantId } });
  if (!product) throw new Error(`createProductVariant : produit "${productId}" introuvable pour ce tenant.`);

  return tx.productVariant.create({
    data: {
      productId,
      name: input.name,
      sku: input.sku ?? null,
      price: input.price,
      costPrice: input.costPrice ?? null,
      barcode: input.barcode ?? null,
      weightGrams: input.weightGrams ?? null,
      volumeCm3: input.volumeCm3 ?? null,
      attributes: input.attributes ?? {},
    },
  });
}

export async function updateProductVariant(
  tx: Prisma.TransactionClient,
  tenantId: string,
  variantId: string,
  input: Partial<ProductVariantInput>,
) {
  const { count } = await tx.productVariant.updateMany({
    where: { id: variantId, product: { tenantId } },
    data: input,
  });
  if (count === 0) throw new Error(`updateProductVariant : variante "${variantId}" introuvable pour ce tenant.`);
  return tx.productVariant.findFirstOrThrow({ where: { id: variantId } });
}

export async function deleteProductVariant(tx: Prisma.TransactionClient, tenantId: string, variantId: string) {
  const { count } = await tx.productVariant.deleteMany({
    where: { id: variantId, product: { tenantId } },
  });
  if (count === 0) throw new Error(`deleteProductVariant : variante "${variantId}" introuvable pour ce tenant.`);
}

// ============================================================================
// STOCK — PAS de RLS directe : chaque fonction filtre explicitement via
// `variant: { product: { tenantId } }`.
// ============================================================================

/**
 * `Shop` a une RLS directe (Pattern A) — pas de garde applicative additionnelle
 * nécessaire ici. La gestion multi-boutiques (plusieurs entrepôts/points de vente)
 * n'est pas encore une page dashboard dédiée (voir docs/08 §8.2, aucune page
 * "boutiques" listée) : cette fonction fournit une boutique "principale" par défaut,
 * créée à la volée si aucune n'existe encore pour ce tenant, pour que le stock ait
 * toujours un emplacement où exister sans exiger cette gestion en préalable.
 */
export async function getOrCreateMainShop(tx: Prisma.TransactionClient, tenantId: string) {
  const existing = await tx.shop.findFirst({ where: { tenantId, isMain: true } });
  if (existing) return existing;
  return tx.shop.create({ data: { tenantId, name: "Boutique principale", isMain: true } });
}

export async function upsertInventoryItem(
  tx: Prisma.TransactionClient,
  tenantId: string,
  params: { variantId: string; shopId: string; initialQuantity?: number; lowStockThreshold?: number },
) {
  const variant = await tx.productVariant.findFirst({
    where: { id: params.variantId, product: { tenantId } },
  });
  if (!variant) throw new Error(`upsertInventoryItem : variante "${params.variantId}" introuvable pour ce tenant.`);
  const shop = await tx.shop.findFirst({ where: { id: params.shopId, tenantId } });
  if (!shop) throw new Error(`upsertInventoryItem : boutique "${params.shopId}" introuvable pour ce tenant.`);

  return tx.inventoryItem.upsert({
    where: { productVariantId_shopId: { productVariantId: params.variantId, shopId: params.shopId } },
    create: {
      productVariantId: params.variantId,
      shopId: params.shopId,
      quantity: params.initialQuantity ?? 0,
      lowStockThreshold: params.lowStockThreshold ?? 5,
    },
    update: {
      ...(params.lowStockThreshold !== undefined ? { lowStockThreshold: params.lowStockThreshold } : {}),
    },
  });
}

export type StockMovementType = "in" | "out" | "adjustment" | "transfer" | "return";

export class InsufficientStockError extends Error {
  constructor(inventoryItemId: string, requested: number) {
    super(`Stock insuffisant pour l'item "${inventoryItemId}" (quantité demandée : ${requested}).`);
    this.name = "InsufficientStockError";
  }
}

export interface AdjustStockInput {
  inventoryItemId: string;
  type: StockMovementType;
  /** Toujours positif : seul `type: "out"` décrémente `quantity` ; `in`/`return`/
   *  `adjustment`/`transfer` l'incrémentent tous. Une transformation vers/depuis une
   *  autre boutique se modélise donc comme un "out" sur la source PUIS un "in" sur la
   *  destination (deux appels, deux lignes d'historique) — jamais une seule opération
   *  ambiguë sur le signe. */
  quantity: number;
  reason?: string | null;
  referenceType?: string | null;
  referenceId?: string | null;
  performedBy?: string | null;
}

/**
 * Fonction CRITIQUE — seul point d'entrée pour modifier `InventoryItem.quantity`.
 * Atomique et sûre sous concurrence par construction : la condition de stock
 * suffisant (`quantity: { gte: amount }` pour une sortie) fait partie de la MÊME
 * clause `WHERE` que le `UPDATE` qui décrémente, dans une seule instruction SQL —
 * exactement le pattern déjà établi par `nextCounterValue` (counters.ts), jamais un
 * verrou distribué ni un `SELECT ... FOR UPDATE` séparé (inutile : PostgreSQL
 * sérialise déjà les `UPDATE` concurrents sur la même ligne). Si `updateMany` ne
 * touche aucune ligne, c'est que la condition n'était plus vraie au moment de
 * l'exécution — jamais un état intermédiaire observable entre la vérification et
 * l'écriture. Voir `packages/database/tests/catalog-registry.test.ts`, « CONCURRENCE »,
 * pour la preuve réelle (appels parallèles contre PostgreSQL).
 *
 * Écrit TOUJOURS une ligne `StockMovement` (historique), y compris pour un
 * ajustement manuel — jamais une modification de `quantity` sans trace.
 */
export async function adjustStock(tx: Prisma.TransactionClient, tenantId: string, input: AdjustStockInput) {
  const item = await tx.inventoryItem.findFirst({
    where: { id: input.inventoryItemId, variant: { product: { tenantId } } },
  });
  if (!item) {
    throw new Error(`adjustStock : item de stock "${input.inventoryItemId}" introuvable pour ce tenant.`);
  }

  if (input.type === "out") {
    const { count } = await tx.inventoryItem.updateMany({
      where: {
        id: input.inventoryItemId,
        variant: { product: { tenantId } },
        quantity: { gte: input.quantity },
      },
      data: { quantity: { decrement: input.quantity } },
    });
    if (count === 0) throw new InsufficientStockError(input.inventoryItemId, input.quantity);
  } else {
    await tx.inventoryItem.updateMany({
      where: { id: input.inventoryItemId, variant: { product: { tenantId } } },
      data: { quantity: { increment: input.quantity } },
    });
  }

  return tx.stockMovement.create({
    data: {
      inventoryItemId: input.inventoryItemId,
      type: input.type,
      quantity: input.quantity,
      reason: input.reason ?? null,
      referenceType: input.referenceType ?? null,
      referenceId: input.referenceId ?? null,
      performedBy: input.performedBy ?? null,
    },
  });
}

export async function listStockMovements(
  tx: Prisma.TransactionClient,
  tenantId: string,
  inventoryItemId: string,
  limit = 50,
) {
  const item = await tx.inventoryItem.findFirst({
    where: { id: inventoryItemId, variant: { product: { tenantId } } },
  });
  if (!item) throw new Error(`listStockMovements : item de stock "${inventoryItemId}" introuvable pour ce tenant.`);

  return tx.stockMovement.findMany({
    where: { inventoryItemId },
    orderBy: { createdAt: "desc" },
    take: Math.min(limit, 200),
  });
}

/** Tous les items de stock du tenant — voir docs/08 §8.2, `/dashboard/stocks` (vue
 *  d'ensemble, pas seulement les alertes). */
export async function listAllInventoryItems(tx: Prisma.TransactionClient, tenantId: string) {
  return tx.inventoryItem.findMany({
    where: { variant: { product: { tenantId } } },
    include: { variant: { include: { product: true } }, shop: true },
    orderBy: { quantity: "asc" },
  });
}

/** Alertes de stock bas — calculées à la volée (pas de modèle "Alert" séparé : la
 *  vérité est toujours `quantity <= lowStockThreshold`, jamais un état à resynchroniser).
 *  Filtre en mémoire plutôt qu'en SQL : Prisma ne permet pas de comparer deux colonnes
 *  entre elles dans un `where` sans SQL brut, qu'on préfère éviter ici (aucun autre
 *  fichier de ce projet n'en utilise) — acceptable tant que le catalogue d'un tenant
 *  reste de taille raisonnable (des milliers d'items, pas des millions). */
export async function listLowStockItems(tx: Prisma.TransactionClient, tenantId: string) {
  const items = await listAllInventoryItems(tx, tenantId);
  return items.filter((item) => item.quantity <= item.lowStockThreshold);
}
