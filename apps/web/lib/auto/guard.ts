import "server-only";
import { redirect } from "next/navigation";
import type { Permission } from "@yamacommerce/auth";
import { getCurrentTenantMembership } from "@/lib/current-tenant";
import { requireTenantPermission } from "@/lib/tenant-permissions";
import { getTenantModuleKeys, isAutomobile } from "@/lib/modules/tenant-modules";

/** Page concession du dashboard : secteur automobile (modules actifs) ET permission — sinon vue d'ensemble. */
export async function requireAutoPage(permission: Permission) {
  const membership = await getCurrentTenantMembership();
  if (!membership) redirect("/dashboard");
  if (!isAutomobile(await getTenantModuleKeys(membership.tenantId))) redirect("/dashboard");
  if (!(await requireTenantPermission(membership.tenantId, permission))) redirect("/dashboard");
  return membership;
}
