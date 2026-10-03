import "server-only";
import { redirect } from "next/navigation";
import { hasPermission, type Permission } from "@yamacommerce/auth";
import type { AcademicScope } from "@yamacommerce/database";
import { getCurrentTenantMembership } from "@/lib/current-tenant";
import { requireTenantPermission } from "@/lib/tenant-permissions";
import { getTenantModuleKeys, isEducation } from "@/lib/modules/tenant-modules";

/** Page établissement du dashboard : secteur éducation (modules actifs) ET permission — sinon vue d'ensemble. */
export async function requireEducationPage(permission: Permission) {
  const membership = await getCurrentTenantMembership();
  if (!membership) redirect("/dashboard");
  if (!isEducation(await getTenantModuleKeys(membership.tenantId))) redirect("/dashboard");
  const actor = await requireTenantPermission(membership.tenantId, permission);
  if (!actor) redirect("/dashboard");
  return { ...membership, userId: actor.userId, scope: scopeOf(membership.permissions, actor) };
}

/** Portée académique : toutes les classes (gestion) ou seulement celles de l'enseignant. */
export function scopeOf(permissions: string[], actor: { userId: string; isSuperAdmin: boolean }): AcademicScope {
  return { userId: actor.userId, all: actor.isSuperAdmin || hasPermission(permissions, "academics.manage") };
}
