import "server-only";
import {
  withSuperAdminAccess,
  withTenant,
  writeAuditLog,
  type Prisma,
  type CategoryInput,
  type ProductInput,
  type ProductStatus,
  type ProductVariantInput,
  createCategory as createCategoryRegistry,
  updateCategory as updateCategoryRegistry,
  deleteCategory as deleteCategoryRegistry,
  listCategories as listCategoriesRegistry,
  createProduct as createProductRegistry,
  updateProduct as updateProductRegistry,
  setProductStatus as setProductStatusRegistry,
  softDeleteProduct as softDeleteProductRegistry,
  listProducts as listProductsRegistry,
  getProductForTenant as getProductForTenantRegistry,
  addProductImage as addProductImageRegistry,
  removeProductImage as removeProductImageRegistry,
  reorderProductImages as reorderProductImagesRegistry,
  createProductVariant as createProductVariantRegistry,
  updateProductVariant as updateProductVariantRegistry,
  deleteProductVariant as deleteProductVariantRegistry,
  setMediaAssetPublic,
  type ListProductsFilter,
} from "@yamacommerce/database";
import { requireTenantPermission } from "@/lib/tenant-permissions";

/**
 * Couche métier du catalogue — combine permission (voir `requireTenantPermission`),
 * appel au registre de persistance (`@yamacommerce/database` catalog-registry.ts) et
 * journal d'audit, même séparation pipeline/registre que
 * `apps/web/lib/domains/custom-domain-pipeline.ts` vs `domains-registry.ts`. Chaque
 * fonction lève `PermissionDeniedError` (implicite via `null`) plutôt que d'agir
 * silencieusement — voir le type de retour `| null` de chaque action mutante.
 */

async function audit(params: {
  tenantId: string;
  actorUserId: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Prisma.InputJsonValue;
}) {
  await withSuperAdminAccess((tx) =>
    writeAuditLog(tx, {
      tenantId: params.tenantId,
      actorUserId: params.actorUserId,
      actorType: "owner",
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      metadata: params.metadata,
    }),
  );
}

// ============================================================================
// CATÉGORIES
// ============================================================================

export async function createCategoryAction(tenantId: string, input: CategoryInput) {
  const actor = await requireTenantPermission(tenantId, "products.create");
  if (!actor) return null;
  const category = await withTenant(tenantId, (tx) => createCategoryRegistry(tx, tenantId, input));
  await audit({ tenantId, actorUserId: actor.userId, action: "catalog.category_created", entityType: "Category", entityId: category.id });
  return category;
}

export async function updateCategoryAction(tenantId: string, id: string, input: Partial<CategoryInput>) {
  const actor = await requireTenantPermission(tenantId, "products.edit");
  if (!actor) return null;
  const category = await withTenant(tenantId, (tx) => updateCategoryRegistry(tx, tenantId, id, input));
  await audit({ tenantId, actorUserId: actor.userId, action: "catalog.category_updated", entityType: "Category", entityId: id });
  return category;
}

export async function deleteCategoryAction(tenantId: string, id: string): Promise<{ ok: true } | null> {
  const actor = await requireTenantPermission(tenantId, "products.delete");
  if (!actor) return null;
  await withTenant(tenantId, (tx) => deleteCategoryRegistry(tx, tenantId, id));
  await audit({ tenantId, actorUserId: actor.userId, action: "catalog.category_deleted", entityType: "Category", entityId: id });
  return { ok: true };
}

export async function listCategoriesForTenant(tenantId: string) {
  const actor = await requireTenantPermission(tenantId, "products.view");
  if (!actor) return null;
  return withTenant(tenantId, (tx) => listCategoriesRegistry(tx, tenantId));
}

// ============================================================================
// PRODUITS
// ============================================================================

export async function createProductAction(tenantId: string, input: ProductInput) {
  const actor = await requireTenantPermission(tenantId, "products.create");
  if (!actor) return null;
  const product = await withTenant(tenantId, (tx) =>
    createProductRegistry(tx, tenantId, { ...input, createdBy: actor.userId }),
  );
  await audit({ tenantId, actorUserId: actor.userId, action: "catalog.product_created", entityType: "Product", entityId: product.id });
  return product;
}

export async function updateProductAction(tenantId: string, id: string, input: Partial<ProductInput>) {
  const actor = await requireTenantPermission(tenantId, "products.edit");
  if (!actor) return null;
  const product = await withTenant(tenantId, (tx) => updateProductRegistry(tx, tenantId, id, input));
  await audit({ tenantId, actorUserId: actor.userId, action: "catalog.product_updated", entityType: "Product", entityId: id });
  return product;
}

/**
 * DRAFT/ARCHIVED -> PUBLISHED exige `products.publish` — distinct de `products.edit`
 * (voir docs/05 : SALES peut voir un produit sans jamais pouvoir le publier).
 *
 * Promeut aussi les médias liés à `isPublic: true` — même règle que la publication
 * d'un site (voir `setMediaAssetPublic`, docs/12 §12.3, « rendre publics uniquement
 * les médias réellement utilisés par la version publiée ») : un visiteur du site
 * public doit voir les photos produit sans être connecté (voir
 * `app/api/media/[id]/file/route.ts`). Ne DÉMARQUE jamais un média déjà public en
 * repassant en DRAFT/ARCHIVED — même politique que l'éditeur (conserve l'accès pour
 * une éventuelle restauration).
 */
export async function setProductStatusAction(
  tenantId: string,
  id: string,
  status: ProductStatus,
): Promise<{ ok: true } | null> {
  const permission = status === "PUBLISHED" ? "products.publish" : "products.edit";
  const actor = await requireTenantPermission(tenantId, permission);
  if (!actor) return null;
  await withTenant(tenantId, async (tx) => {
    await setProductStatusRegistry(tx, tenantId, id, status);
    if (status === "PUBLISHED") {
      const images = await tx.productImage.findMany({ where: { productId: id, mediaAssetId: { not: null } } });
      await Promise.all(
        images.map((image) => setMediaAssetPublic(tx, tenantId, image.mediaAssetId!, true)),
      );
    }
  });
  await audit({
    tenantId,
    actorUserId: actor.userId,
    action: "catalog.product_status_changed",
    entityType: "Product",
    entityId: id,
    metadata: { status },
  });
  return { ok: true };
}

export async function deleteProductAction(tenantId: string, id: string): Promise<{ ok: true } | null> {
  const actor = await requireTenantPermission(tenantId, "products.delete");
  if (!actor) return null;
  await withTenant(tenantId, (tx) => softDeleteProductRegistry(tx, tenantId, id));
  await audit({ tenantId, actorUserId: actor.userId, action: "catalog.product_deleted", entityType: "Product", entityId: id });
  return { ok: true };
}

export async function listProductsForTenant(tenantId: string, filter?: ListProductsFilter) {
  const actor = await requireTenantPermission(tenantId, "products.view");
  if (!actor) return null;
  return withTenant(tenantId, (tx) => listProductsRegistry(tx, tenantId, filter));
}

export async function getProductAction(tenantId: string, id: string) {
  const actor = await requireTenantPermission(tenantId, "products.view");
  if (!actor) return null;
  return withTenant(tenantId, (tx) => getProductForTenantRegistry(tx, tenantId, id));
}

// ============================================================================
// IMAGES
// ============================================================================

export async function addProductImageAction(
  tenantId: string,
  params: { productId: string; mediaAssetId: string; url: string; altText?: string | null; variantId?: string | null },
) {
  const actor = await requireTenantPermission(tenantId, "products.edit");
  if (!actor) return null;
  const image = await withTenant(tenantId, (tx) => addProductImageRegistry(tx, tenantId, params));
  await audit({
    tenantId,
    actorUserId: actor.userId,
    action: "catalog.product_image_added",
    entityType: "Product",
    entityId: params.productId,
  });
  return image;
}

export async function removeProductImageAction(tenantId: string, imageId: string): Promise<{ ok: true } | null> {
  const actor = await requireTenantPermission(tenantId, "products.edit");
  if (!actor) return null;
  await withTenant(tenantId, (tx) => removeProductImageRegistry(tx, tenantId, imageId));
  await audit({ tenantId, actorUserId: actor.userId, action: "catalog.product_image_removed", entityType: "ProductImage", entityId: imageId });
  return { ok: true };
}

export async function reorderProductImagesAction(
  tenantId: string,
  productId: string,
  orderedImageIds: string[],
): Promise<{ ok: true } | null> {
  const actor = await requireTenantPermission(tenantId, "products.edit");
  if (!actor) return null;
  await withTenant(tenantId, (tx) => reorderProductImagesRegistry(tx, tenantId, productId, orderedImageIds));
  return { ok: true };
}

// ============================================================================
// VARIANTES
// ============================================================================

export async function createVariantAction(tenantId: string, productId: string, input: ProductVariantInput) {
  const actor = await requireTenantPermission(tenantId, "products.edit");
  if (!actor) return null;
  const variant = await withTenant(tenantId, (tx) => createProductVariantRegistry(tx, tenantId, productId, input));
  await audit({ tenantId, actorUserId: actor.userId, action: "catalog.variant_created", entityType: "ProductVariant", entityId: variant.id });
  return variant;
}

export async function updateVariantAction(tenantId: string, variantId: string, input: Partial<ProductVariantInput>) {
  const actor = await requireTenantPermission(tenantId, "products.edit");
  if (!actor) return null;
  const variant = await withTenant(tenantId, (tx) => updateProductVariantRegistry(tx, tenantId, variantId, input));
  await audit({ tenantId, actorUserId: actor.userId, action: "catalog.variant_updated", entityType: "ProductVariant", entityId: variantId });
  return variant;
}

export async function deleteVariantAction(tenantId: string, variantId: string): Promise<{ ok: true } | null> {
  const actor = await requireTenantPermission(tenantId, "products.edit");
  if (!actor) return null;
  await withTenant(tenantId, (tx) => deleteProductVariantRegistry(tx, tenantId, variantId));
  await audit({ tenantId, actorUserId: actor.userId, action: "catalog.variant_deleted", entityType: "ProductVariant", entityId: variantId });
  return { ok: true };
}
