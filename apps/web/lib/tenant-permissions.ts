import "server-only";
import { withUser } from "@yamacommerce/database";
import { hasPermission, type Permission } from "@yamacommerce/auth";
import { auth } from "@/lib/auth";

/**
 * Garde d'autorisation générique pour les routes/pages « dashboard » (tenant
 * owner/employé) — généralisée depuis `lib/domains/require-domain-permission.ts`
 * (revue du 18 septembre 2026, « catalogue réel ») : même structure exacte, mais
 * réutilisable par n'importe quelle fonctionnalité métier (catalogue, commandes,
 * clients, ...), pas seulement les domaines. Un Super Admin passe TOUJOURS ; un
 * utilisateur normal doit avoir une adhésion ACTIVE au tenant précis ET la
 * permission demandée — jamais l'un sans l'autre.
 */
export interface AuthorizedTenantActor {
  userId: string;
  isSuperAdmin: boolean;
}

export async function requireTenantPermission(
  tenantId: string,
  permission: Permission,
): Promise<AuthorizedTenantActor | null> {
  const session = await auth();
  if (!session?.user) return null;
  if (session.user.isSuperAdmin) return { userId: session.user.id, isSuperAdmin: true };

  const membership = await withUser(session.user.id, (tx) =>
    tx.tenantUser.findFirst({
      where: { tenantId, userId: session.user.id },
      include: { role: true },
    }),
  );
  if (!membership || membership.status !== "ACTIVE") return null;
  if (!hasPermission(membership.role.permissions, permission)) return null;

  return { userId: session.user.id, isSuperAdmin: false };
}
