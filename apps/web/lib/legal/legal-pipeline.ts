import "server-only";
import {
  LegalProfileError,
  getLegalProfile,
  saveLegalProfile,
  withTenant,
  writeAuditLog,
  type LegalProfileInput,
  type LegalProfileView,
} from "@yamacommerce/database";
import { getCurrentTenantMembership } from "@/lib/current-tenant";
import { requireTenantPermission } from "@/lib/tenant-permissions";
import { invalidateSiteCache } from "@/lib/publishing/cache";

/**
 * Informations légales de l'entreprise courante. Lecture et écriture réservées à
 * `settings.branding` (propriétaire et gérant) : ces informations s'affichent sur le
 * site public. L'entreprise est toujours celle de la session, jamais un identifiant
 * fourni par le navigateur.
 */
export type LegalResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string };

export async function loadCurrentLegalProfile(): Promise<{ tenantName: string; siteUrl: string | null; profile: LegalProfileView } | null> {
  const membership = await getCurrentTenantMembership();
  if (!membership) return null;
  if (!(await requireTenantPermission(membership.tenantId, "settings.branding"))) return null;
  const { profile, domain } = await withTenant(membership.tenantId, async (tx) => ({
    profile: await getLegalProfile(tx, membership.tenantId),
    // Adresse du site de l'entreprise : les pages légales y sont rendues à son nom.
    domain: await tx.domain.findFirst({
      where: { tenantId: membership.tenantId, lifecycleStatus: "ACTIVE" },
      orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
      select: { domain: true },
    }),
  }));
  return { tenantName: membership.tenantName, siteUrl: domain ? `https://${domain.domain}` : null, profile };
}

export async function saveCurrentLegalProfile(input: LegalProfileInput): Promise<LegalResult<LegalProfileView>> {
  const membership = await getCurrentTenantMembership();
  if (!membership) return { ok: false, status: 403, error: "Non autorisé." };
  const actor = await requireTenantPermission(membership.tenantId, "settings.branding");
  if (!actor) return { ok: false, status: 403, error: "Non autorisé." };
  try {
    // Fiche et journal d'audit dans la MÊME transaction : jamais une modification
    // publique sans sa trace, ni une trace sans modification.
    const profile = await withTenant(membership.tenantId, async (tx) => {
      const saved = await saveLegalProfile(tx, membership.tenantId, input);
      await writeAuditLog(tx, {
        tenantId: membership.tenantId,
        actorUserId: actor.userId,
        actorType: actor.isSuperAdmin ? "super_admin" : membership.roleName === "OWNER" ? "owner" : "employee",
        action: "legal_profile.update",
        entityType: "TenantLegalProfile",
        entityId: membership.tenantId,
      });
      return saved;
    });
    invalidateSiteCache(membership.tenantId);
    return { ok: true, data: profile };
  } catch (error) {
    if (error instanceof LegalProfileError) return { ok: false, status: 400, error: error.message };
    throw error;
  }
}
