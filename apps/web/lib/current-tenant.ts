import "server-only";
import { withUser } from "@yamacommerce/database";
import { auth } from "@/lib/auth";

/**
 * Résout l'entreprise "courante" du dashboard pour l'utilisateur connecté — voir
 * `app/dashboard/page.tsx` (placeholder existant) : un utilisateur peut appartenir à
 * plusieurs entreprises (`TenantUser`), mais aucune route `/dashboard/**` de ce
 * projet ne porte de segment `[tenant]` dans son URL (voir docs/08 §8.2). Cette
 * étape simplifie donc délibérément à la PREMIÈRE adhésion ACTIVE (par ordre
 * d'ancienneté) — un vrai sélecteur multi-entreprise reste un raffinement futur, pas
 * un pré-requis du catalogue.
 */
export interface CurrentTenantMembership {
  tenantId: string;
  tenantName: string;
  sectorKey: string | null;
  roleName: string;
  permissions: string[];
  userId: string;
}

export async function getCurrentTenantMembership(): Promise<CurrentTenantMembership | null> {
  const session = await auth();
  if (!session?.user) return null;

  const membership = await withUser(session.user.id, (tx) =>
    tx.tenantUser.findFirst({
      where: { userId: session.user.id, status: "ACTIVE" },
      include: { tenant: true, role: true },
      orderBy: { joinedAt: "asc" },
    }),
  );
  if (!membership) return null;

  return {
    tenantId: membership.tenantId,
    tenantName: membership.tenant.name,
    sectorKey: membership.tenant.sectorKey,
    roleName: membership.role.name,
    permissions: membership.role.permissions,
    userId: session.user.id,
  };
}
