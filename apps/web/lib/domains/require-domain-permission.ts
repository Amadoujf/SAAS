import "server-only";
import { withUser } from "@yamacommerce/database";
import { hasPermission, type Permission } from "@yamacommerce/auth";
import { auth } from "@/lib/auth";

/**
 * Garde d'autorisation partagée par toutes les routes `/api/domains/*` — voir
 * docs/13, « PERMISSIONS ». Un Super Admin passe TOUJOURS (voir
 * `withSuperAdminAccess` ailleurs pour ses propres routes `/api/admin/domains/*`,
 * séparées) ; un utilisateur normal doit avoir une adhésion ACTIVE au tenant précis
 * ET la permission demandée — jamais l'un sans l'autre.
 */
export interface AuthorizedDomainActor {
  userId: string;
  isSuperAdmin: boolean;
}

export async function requireDomainPermission(
  tenantId: string,
  permission: Permission,
): Promise<AuthorizedDomainActor | null> {
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
