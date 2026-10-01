import "server-only";
import {
  SizeGuideError,
  createSizeGuide,
  deleteSizeGuide,
  listCategories,
  listSizeGuides,
  setCategorySizeGuide,
  setProductSizeGuide,
  updateSizeGuide,
  withSuperAdminAccess,
  withTenant,
  writeAuditLog,
  type SizeGuideInput,
} from "@yamacommerce/database";
import { requireTenantPermission } from "@/lib/tenant-permissions";
import { invalidateSiteCache } from "@/lib/publishing/cache";

/**
 * Guides des tailles : permission (lecture `products.view`, écriture `products.edit`),
 * registre, journal d'audit, puis invalidation du cache du site de CETTE entreprise
 * (le guide s'affiche sur les fiches produits publiques).
 */
export type SizeGuideResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string };

const deny = { ok: false as const, status: 403, error: "Non autorisé." };

async function audit(tenantId: string, actorUserId: string, action: string, entityType: string, entityId: string) {
  await withSuperAdminAccess((tx) => writeAuditLog(tx, { tenantId, actorUserId, actorType: "owner", action, entityType, entityId }));
}

async function guarded<T>(work: () => Promise<T>): Promise<SizeGuideResult<T>> {
  try {
    return { ok: true, data: await work() };
  } catch (error) {
    if (error instanceof SizeGuideError) return { ok: false, status: 400, error: error.message };
    throw error;
  }
}

export async function loadSizeGuides(tenantId: string) {
  if (!(await requireTenantPermission(tenantId, "products.view"))) return null;
  return withTenant(tenantId, async (tx) => ({
    guides: await listSizeGuides(tx, tenantId),
    categories: (await listCategories(tx, tenantId)).map((c) => ({ id: c.id, name: c.name, sizeGuideId: c.sizeGuideId })),
  }));
}

export async function saveSizeGuide(tenantId: string, id: string | null, input: SizeGuideInput) {
  const actor = await requireTenantPermission(tenantId, "products.edit");
  if (!actor) return deny;
  const result = await guarded(() => withTenant(tenantId, (tx) => (id ? updateSizeGuide(tx, tenantId, id, input) : createSizeGuide(tx, tenantId, input))));
  if (result.ok) {
    await audit(tenantId, actor.userId, id ? "catalog.size_guide_updated" : "catalog.size_guide_created", "SizeGuide", result.data.id);
    invalidateSiteCache(tenantId);
  }
  return result;
}

export async function removeSizeGuide(tenantId: string, id: string) {
  const actor = await requireTenantPermission(tenantId, "products.edit");
  if (!actor) return deny;
  const result = await guarded(() => withTenant(tenantId, (tx) => deleteSizeGuide(tx, tenantId, id)));
  if (result.ok) {
    await audit(tenantId, actor.userId, "catalog.size_guide_deleted", "SizeGuide", id);
    invalidateSiteCache(tenantId);
  }
  return result;
}

export async function assignSizeGuide(tenantId: string, target: { kind: "category" | "product"; id: string }, sizeGuideId: string | null) {
  const actor = await requireTenantPermission(tenantId, "products.edit");
  if (!actor) return deny;
  const result = await guarded(() =>
    withTenant(tenantId, (tx) => (target.kind === "category" ? setCategorySizeGuide(tx, tenantId, target.id, sizeGuideId) : setProductSizeGuide(tx, tenantId, target.id, sizeGuideId))),
  );
  if (result.ok) {
    await audit(tenantId, actor.userId, "catalog.size_guide_assigned", target.kind === "category" ? "Category" : "Product", target.id);
    invalidateSiteCache(tenantId);
  }
  return result;
}
