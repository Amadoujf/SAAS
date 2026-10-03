import "server-only";
import { redirect } from "next/navigation";
import type { Permission } from "@yamacommerce/auth";
import { getCurrentTenantMembership } from "@/lib/current-tenant";
import { requireTenantPermission } from "@/lib/tenant-permissions";
import { getTenantModuleKeys, isSalon } from "@/lib/modules/tenant-modules";

/** Page salon du dashboard : salon (modules actifs) ET permission du membre — sinon
 *  retour à la vue d'ensemble, jamais une page vide ou une erreur. */
export async function requireSalonPage(permission: Permission) {
  const membership = await getCurrentTenantMembership();
  if (!membership) redirect("/dashboard");
  if (!isSalon(await getTenantModuleKeys(membership.tenantId))) redirect("/dashboard");
  if (!(await requireTenantPermission(membership.tenantId, permission))) redirect("/dashboard");
  return membership;
}
