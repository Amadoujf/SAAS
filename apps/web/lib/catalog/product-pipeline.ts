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
  assertQuotaAvailable,
  type ListProductsFilter,
} from "@yamacommerce/database";
import { requireTenantPermission } from "@/lib/tenant-permissions";
import { invalidateSiteCache } from "@/lib/publishing/cache";

/**
 * Couche métier du catalogue — combine permission (voir `requireTenantPermission`),
 * appel au registre de persistance (`@yamacommerce/database` catalog-registry.ts) et
 * journal d'audit, même séparation pipeline/registre que
 * `apps/web/lib/domains/custom-domain-pipeline.ts` vs `domains-registry.ts`. Chaque
 * fonction lève `PermissionDeniedError` (implicite via `null`) plutôt que d'agir
 * silencieusement — voir le type de retour `| null` de chaque action mutante.
 *
 * `deps.invalidateCache` — injecté plutôt qu'appelé directement (`invalidateSiteCache`,
 * voir cache.ts), même pattern que `PublishSiteDeps`/`DnsCheckDeps`/
 * `ResolvePublicSiteDeps` : `revalidateTag` exige un contexte de requête/build
 * Next.js réel, absent d'un test Vitest. Voir la revue du 18 septembre 2026,
 * « ajoute et teste l'invalidation du cache après création, modification,
 * publication, dépublication, changement de prix, image ou stock » — TOUTE mutation
 * catalogue visible côté site public invalide donc le cache de CE seul tenant,
 * jamais un site continuant d'afficher une ancienne version après une modification.
 * Les VRAIS appelants (routes) utilisent toujours `defaultCatalogCacheDeps`.
 */
export interface CatalogCacheDeps {
  invalidateCache: (tenantId: string) => void;
}

export const defaultCatalogCacheDeps: CatalogCacheDeps = { invalidateCache: invalidateSiteCache };

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

export async function createCategoryAction(
  tenantId: string,
  input: CategoryInput,
  deps: CatalogCacheDeps = defaultCatalogCacheDeps,
) {
  const actor = await requireTenantPermission(tenantId, "products.create");
  if (!actor) return null;
  const category = await withTenant(tenantId, (tx) => createCategoryRegistry(tx, tenantId, input));
  await audit({ tenantId, actorUserId: actor.userId, action: "catalog.category_created", entityType: "Category", entityId: category.id });
  deps.invalidateCache(tenantId);
  return category;
}

export async function updateCategoryAction(
  tenantId: string,
  id: string,
  input: Partial<CategoryInput>,
  deps: CatalogCacheDeps = defaultCatalogCacheDeps,
) {
  const actor = await requireTenantPermission(tenantId, "products.edit");
  if (!actor) return null;
  const category = await withTenant(tenantId, (tx) => updateCategoryRegistry(tx, tenantId, id, input));
  await audit({ tenantId, actorUserId: actor.userId, action: "catalog.category_updated", entityType: "Category", entityId: id });
  deps.invalidateCache(tenantId);
  return category;
}

export async function deleteCategoryAction(
  tenantId: string,
  id: string,
  deps: CatalogCacheDeps = defaultCatalogCacheDeps,
): Promise<{ ok: true } | null> {
  const actor = await requireTenantPermission(tenantId, "products.delete");
  if (!actor) return null;
  await withTenant(tenantId, (tx) => deleteCategoryRegistry(tx, tenantId, id));
  await audit({ tenantId, actorUserId: actor.userId, action: "catalog.category_deleted", entityType: "Category", entityId: id });
  deps.invalidateCache(tenantId);
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

export async function createProductAction(
  tenantId: string,
  input: ProductInput,
  deps: CatalogCacheDeps = defaultCatalogCacheDeps,
) {
  const actor = await requireTenantPermission(tenantId, "products.create");
  if (!actor) return null;
  // Quota SERVEUR — voir docs/14-facturation-saas-abonnements.md, décision #5 : un
  // appel direct à cette action sans passer par l'UI doit échouer tout autant que
  // l'UI elle-même le refuserait. Vérifié dans la MÊME transaction que la création
  // pour rester le plus proche possible d'une garde atomique (best-effort — voir
  // `subscription-usage.ts` pour la limite documentée sous concurrence extrême).
  const product = await withTenant(tenantId, async (tx) => {
    await assertQuotaAvailable(tx, tenantId, "records");
    return createProductRegistry(tx, tenantId, { ...input, createdBy: actor.userId });
  });
  await audit({ tenantId, actorUserId: actor.userId, action: "catalog.product_created", entityType: "Product", entityId: product.id });
  deps.invalidateCache(tenantId);
  return product;
}

export async function updateProductAction(
  tenantId: string,
  id: string,
  input: Partial<ProductInput>,
  deps: CatalogCacheDeps = defaultCatalogCacheDeps,
) {
  const actor = await requireTenantPermission(tenantId, "products.edit");
  if (!actor) return null;
  const product = await withTenant(tenantId, (tx) => updateProductRegistry(tx, tenantId, id, input));
  await audit({ tenantId, actorUserId: actor.userId, action: "catalog.product_updated", entityType: "Product", entityId: id });
  deps.invalidateCache(tenantId);
  return product;
}

/**
 * DRAFT/ARCHIVED -> PUBLISHED exige `products.publish` — distinct de `products.edit`
 * (voir docs/05 : SALES peut voir un produit sans jamais pouvoir le publier).
 *
 * N'écrit PLUS `MediaAsset.isPublic` (revue du 18 septembre 2026, « publier un
 * produit ne doit pas rendre public un fichier privé complet utilisé ailleurs ») :
 * la première version posait `isPublic: true` sur le média ENTIER (fichier original
 * ET toutes ses variantes) dès qu'un produit passait PUBLISHED, sans jamais revenir
 * en arrière à la dépublication — deux problèmes à la fois. L'accès public est
 * désormais calculé À LA VOLÉE par `app/api/media/[id]/file/route.ts`, qui vérifie
 * "ce média est-il utilisé par un produit PUBLIÉ de ce même tenant, et seulement une
 * variante redimensionnée est-elle demandée (jamais l'original)" — jamais un drapeau
 * statique à garder synchronisé. Dépublier un produit (ou lui retirer sa dernière
 * image) retire donc l'accès public AUTOMATIQUEMENT, sans code dédié — voir
 * `packages/database/tests/catalog-registry.test.ts`, « MÉDIATHÈQUE — accès public
 * dynamique », pour la preuve réelle.
 */
export async function setProductStatusAction(
  tenantId: string,
  id: string,
  status: ProductStatus,
  deps: CatalogCacheDeps = defaultCatalogCacheDeps,
): Promise<{ ok: true } | null> {
  const permission = status === "PUBLISHED" ? "products.publish" : "products.edit";
  const actor = await requireTenantPermission(tenantId, permission);
  if (!actor) return null;
  await withTenant(tenantId, (tx) => setProductStatusRegistry(tx, tenantId, id, status));
  await audit({
    tenantId,
    actorUserId: actor.userId,
    action: "catalog.product_status_changed",
    entityType: "Product",
    entityId: id,
    metadata: { status },
  });
  deps.invalidateCache(tenantId);
  return { ok: true };
}

export async function deleteProductAction(
  tenantId: string,
  id: string,
  deps: CatalogCacheDeps = defaultCatalogCacheDeps,
): Promise<{ ok: true } | null> {
  const actor = await requireTenantPermission(tenantId, "products.delete");
  if (!actor) return null;
  await withTenant(tenantId, (tx) => softDeleteProductRegistry(tx, tenantId, id));
  await audit({ tenantId, actorUserId: actor.userId, action: "catalog.product_deleted", entityType: "Product", entityId: id });
  deps.invalidateCache(tenantId);
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
  params: { productId: string; mediaAssetId: string; altText?: string | null; variantId?: string | null },
  deps: CatalogCacheDeps = defaultCatalogCacheDeps,
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
  deps.invalidateCache(tenantId);
  return image;
}

export async function removeProductImageAction(
  tenantId: string,
  imageId: string,
  deps: CatalogCacheDeps = defaultCatalogCacheDeps,
): Promise<{ ok: true } | null> {
  const actor = await requireTenantPermission(tenantId, "products.edit");
  if (!actor) return null;
  await withTenant(tenantId, (tx) => removeProductImageRegistry(tx, tenantId, imageId));
  await audit({ tenantId, actorUserId: actor.userId, action: "catalog.product_image_removed", entityType: "ProductImage", entityId: imageId });
  deps.invalidateCache(tenantId);
  return { ok: true };
}

export async function reorderProductImagesAction(
  tenantId: string,
  productId: string,
  orderedImageIds: string[],
  deps: CatalogCacheDeps = defaultCatalogCacheDeps,
): Promise<{ ok: true } | null> {
  const actor = await requireTenantPermission(tenantId, "products.edit");
  if (!actor) return null;
  await withTenant(tenantId, (tx) => reorderProductImagesRegistry(tx, tenantId, productId, orderedImageIds));
  deps.invalidateCache(tenantId);
  return { ok: true };
}

// ============================================================================
// VARIANTES
// ============================================================================

export async function createVariantAction(
  tenantId: string,
  productId: string,
  input: ProductVariantInput,
  deps: CatalogCacheDeps = defaultCatalogCacheDeps,
) {
  const actor = await requireTenantPermission(tenantId, "products.edit");
  if (!actor) return null;
  const variant = await withTenant(tenantId, (tx) => createProductVariantRegistry(tx, tenantId, productId, input));
  await audit({ tenantId, actorUserId: actor.userId, action: "catalog.variant_created", entityType: "ProductVariant", entityId: variant.id });
  deps.invalidateCache(tenantId);
  return variant;
}

export async function updateVariantAction(
  tenantId: string,
  variantId: string,
  input: Partial<ProductVariantInput>,
  deps: CatalogCacheDeps = defaultCatalogCacheDeps,
) {
  const actor = await requireTenantPermission(tenantId, "products.edit");
  if (!actor) return null;
  const variant = await withTenant(tenantId, (tx) => updateProductVariantRegistry(tx, tenantId, variantId, input));
  await audit({ tenantId, actorUserId: actor.userId, action: "catalog.variant_updated", entityType: "ProductVariant", entityId: variantId });
  deps.invalidateCache(tenantId);
  return variant;
}

export async function deleteVariantAction(
  tenantId: string,
  variantId: string,
  deps: CatalogCacheDeps = defaultCatalogCacheDeps,
): Promise<{ ok: true } | null> {
  const actor = await requireTenantPermission(tenantId, "products.edit");
  if (!actor) return null;
  await withTenant(tenantId, (tx) => deleteProductVariantRegistry(tx, tenantId, variantId));
  await audit({ tenantId, actorUserId: actor.userId, action: "catalog.variant_deleted", entityType: "ProductVariant", entityId: variantId });
  deps.invalidateCache(tenantId);
  return { ok: true };
}
