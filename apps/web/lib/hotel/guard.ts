import "server-only";
import { redirect } from "next/navigation";
import type { Permission } from "@yamacommerce/auth";
import { getCurrentTenantMembership } from "@/lib/current-tenant";
import { requireTenantPermission } from "@/lib/tenant-permissions";
import { getTenantModuleKeys, isHotel } from "@/lib/modules/tenant-modules";

/** Page hôtel du dashboard : établissement (modules actifs) ET permission — sinon vue d'ensemble. */
export async function requireHotelPage(permission: Permission) {
  const membership = await getCurrentTenantMembership();
  if (!membership) redirect("/dashboard");
  if (!isHotel(await getTenantModuleKeys(membership.tenantId))) redirect("/dashboard");
  if (!(await requireTenantPermission(membership.tenantId, permission))) redirect("/dashboard");
  return membership;
}
