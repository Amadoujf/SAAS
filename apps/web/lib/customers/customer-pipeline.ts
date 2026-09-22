import "server-only";
import {
  withSuperAdminAccess,
  withTenant,
  writeAuditLog,
  type Prisma,
  type CustomerInput,
  type CustomerAddressInput,
  type ListCustomersFilter,
  createCustomer as createCustomerRegistry,
  updateCustomer as updateCustomerRegistry,
  getCustomerForTenant as getCustomerForTenantRegistry,
  listCustomers as listCustomersRegistry,
  addCustomerAddress as addCustomerAddressRegistry,
  updateCustomerAddress as updateCustomerAddressRegistry,
  deleteCustomerAddress as deleteCustomerAddressRegistry,
  listCustomerAddresses as listCustomerAddressesRegistry,
} from "@yamacommerce/database";
import { requireTenantPermission } from "@/lib/tenant-permissions";

/**
 * Couche métier « clients » — même séparation pipeline/registre que
 * `product-pipeline.ts`. `customers` est un module CORE (voir
 * `packages/database/src/seed.ts`, `MODULES` : `sectorKeys: []`) : contrairement au
 * catalogue, AUCUN gate de module ici — `isModuleEnabled(tx, tenantId, "customers")`
 * renverrait toujours `false` pour un module core (aucune ligne `TenantModule`
 * n'est jamais créée pour eux, voir `activateSectorDefaults`), donc seule la
 * permission compte. Pas d'invalidation de cache site public : les données client
 * ne sont jamais rendues sur le storefront.
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

export async function createCustomerAction(tenantId: string, input: CustomerInput) {
  const actor = await requireTenantPermission(tenantId, "customers.edit");
  if (!actor) return null;
  const customer = await withTenant(tenantId, (tx) => createCustomerRegistry(tx, tenantId, input));
  await audit({
    tenantId,
    actorUserId: actor.userId,
    action: "customers.created",
    entityType: "Customer",
    entityId: customer.id,
  });
  return customer;
}

export async function updateCustomerAction(tenantId: string, id: string, input: Partial<CustomerInput>) {
  const actor = await requireTenantPermission(tenantId, "customers.edit");
  if (!actor) return null;
  const customer = await withTenant(tenantId, (tx) => updateCustomerRegistry(tx, tenantId, id, input));
  await audit({
    tenantId,
    actorUserId: actor.userId,
    action: "customers.updated",
    entityType: "Customer",
    entityId: id,
  });
  return customer;
}

export async function getCustomerAction(tenantId: string, id: string) {
  const actor = await requireTenantPermission(tenantId, "customers.view");
  if (!actor) return null;
  return withTenant(tenantId, (tx) => getCustomerForTenantRegistry(tx, tenantId, id));
}

export async function listCustomersAction(tenantId: string, filter?: ListCustomersFilter) {
  const actor = await requireTenantPermission(tenantId, "customers.view");
  if (!actor) return null;
  return withTenant(tenantId, (tx) => listCustomersRegistry(tx, tenantId, filter));
}

// ============================================================================
// ADRESSES
// ============================================================================

export async function addCustomerAddressAction(
  tenantId: string,
  customerId: string,
  input: CustomerAddressInput,
) {
  const actor = await requireTenantPermission(tenantId, "customers.edit");
  if (!actor) return null;
  const address = await withTenant(tenantId, (tx) => addCustomerAddressRegistry(tx, tenantId, customerId, input));
  await audit({
    tenantId,
    actorUserId: actor.userId,
    action: "customers.address_added",
    entityType: "Customer",
    entityId: customerId,
  });
  return address;
}

export async function updateCustomerAddressAction(
  tenantId: string,
  addressId: string,
  input: Partial<CustomerAddressInput>,
) {
  const actor = await requireTenantPermission(tenantId, "customers.edit");
  if (!actor) return null;
  return withTenant(tenantId, (tx) => updateCustomerAddressRegistry(tx, tenantId, addressId, input));
}

export async function deleteCustomerAddressAction(
  tenantId: string,
  addressId: string,
): Promise<{ ok: true } | null> {
  const actor = await requireTenantPermission(tenantId, "customers.edit");
  if (!actor) return null;
  await withTenant(tenantId, (tx) => deleteCustomerAddressRegistry(tx, tenantId, addressId));
  return { ok: true };
}

export async function listCustomerAddressesAction(tenantId: string, customerId: string) {
  const actor = await requireTenantPermission(tenantId, "customers.view");
  if (!actor) return null;
  return withTenant(tenantId, (tx) => listCustomerAddressesRegistry(tx, tenantId, customerId));
}
