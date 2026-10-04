import "server-only";
import { redirect } from "next/navigation";
import type { Permission } from "@yamacommerce/auth";
import { getCurrentTenantMembership } from "@/lib/current-tenant";
import { requireTenantPermission } from "@/lib/tenant-permissions";
import { getTenantModuleKeys, isCourier } from "@/lib/modules/tenant-modules";

/** Page société de livraison du dashboard : secteur livraison (modules actifs) ET permission — sinon vue d'ensemble. */
export async function requireCourierPage(permission: Permission) {
  const membership = await getCurrentTenantMembership();
  if (!membership) redirect("/dashboard");
  if (!isCourier(await getTenantModuleKeys(membership.tenantId))) redirect("/dashboard");
  const actor = await requireTenantPermission(membership.tenantId, permission);
  if (!actor) redirect("/dashboard");
  return { ...membership, userId: actor.userId };
}
