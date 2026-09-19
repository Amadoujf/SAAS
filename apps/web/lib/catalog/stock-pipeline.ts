import "server-only";
import {
  withSuperAdminAccess,
  withTenant,
  writeAuditLog,
  adjustStock as adjustStockRegistry,
  upsertInventoryItem as upsertInventoryItemRegistry,
  getOrCreateMainShop,
  listStockMovements as listStockMovementsRegistry,
  listLowStockItems as listLowStockItemsRegistry,
  listAllInventoryItems as listAllInventoryItemsRegistry,
  type AdjustStockInput,
  type Prisma,
} from "@yamacommerce/database";
import { requireTenantPermission } from "@/lib/tenant-permissions";
import { type CatalogCacheDeps, defaultCatalogCacheDeps } from "./product-pipeline";

/** Couche métier du stock — même convention que product-pipeline.ts. La permission
 *  `inventory.manage_stock` couvre toute mutation ; `products.view` suffit pour
 *  consulter l'historique/les alertes (voir docs/05 : SALES peut voir le stock sans
 *  pouvoir l'ajuster). `deps.invalidateCache` : voir la note de `CatalogCacheDeps`
 *  dans product-pipeline.ts — un changement de stock affiche/masque
 *  potentiellement un produit comme disponible sur le site public. */

async function audit(params: {
  tenantId: string;
  actorUserId: string;
  action: string;
  entityId: string;
  metadata?: Prisma.InputJsonValue;
}) {
  await withSuperAdminAccess((tx) =>
    writeAuditLog(tx, {
      tenantId: params.tenantId,
      actorUserId: params.actorUserId,
      actorType: "owner",
      action: params.action,
      entityType: "InventoryItem",
      entityId: params.entityId,
      metadata: params.metadata,
    }),
  );
}

/** `shopId` optionnel : par défaut, la boutique "principale" du tenant (créée à la
 *  volée si besoin, voir `getOrCreateMainShop`) — la gestion multi-boutiques n'est
 *  pas encore une page dashboard dédiée (voir docs/08 §8.2). */
export async function upsertInventoryItemAction(
  tenantId: string,
  params: { variantId: string; shopId?: string; initialQuantity?: number; lowStockThreshold?: number },
  deps: CatalogCacheDeps = defaultCatalogCacheDeps,
) {
  const actor = await requireTenantPermission(tenantId, "inventory.manage_stock");
  if (!actor) return null;
  const item = await withTenant(tenantId, async (tx) => {
    const shopId = params.shopId ?? (await getOrCreateMainShop(tx, tenantId)).id;
    return upsertInventoryItemRegistry(tx, tenantId, { ...params, shopId });
  });
  deps.invalidateCache(tenantId);
  return item;
}

export async function adjustStockAction(
  tenantId: string,
  input: AdjustStockInput,
  deps: CatalogCacheDeps = defaultCatalogCacheDeps,
) {
  const actor = await requireTenantPermission(tenantId, "inventory.manage_stock");
  if (!actor) return null;
  const movement = await withTenant(tenantId, (tx) =>
    adjustStockRegistry(tx, tenantId, { ...input, performedBy: actor.userId }),
  );
  await audit({
    tenantId,
    actorUserId: actor.userId,
    action: "catalog.stock_adjusted",
    entityId: input.inventoryItemId,
    metadata: { type: input.type, quantity: input.quantity, reason: input.reason ?? null },
  });
  deps.invalidateCache(tenantId);
  return movement;
}

export async function listAllInventoryItemsAction(tenantId: string) {
  const actor = await requireTenantPermission(tenantId, "products.view");
  if (!actor) return null;
  return withTenant(tenantId, (tx) => listAllInventoryItemsRegistry(tx, tenantId));
}

export async function listStockMovementsAction(tenantId: string, inventoryItemId: string) {
  const actor = await requireTenantPermission(tenantId, "products.view");
  if (!actor) return null;
  return withTenant(tenantId, (tx) => listStockMovementsRegistry(tx, tenantId, inventoryItemId));
}

export async function listLowStockItemsAction(tenantId: string) {
  const actor = await requireTenantPermission(tenantId, "products.view");
  if (!actor) return null;
  return withTenant(tenantId, (tx) => listLowStockItemsRegistry(tx, tenantId));
}
