import { hasPermission } from "@yamacommerce/auth";

/**
 * Contrôle d'accès à l'aperçu de BROUILLON de l'éditeur visuel — voir docs/12 §12.2,
 * « aperçu iframe responsive » (21 septembre 2026) : « Rendu du brouillon uniquement
 * pour les utilisateurs autorisés », « Aucun accès public à une version non
 * publiée », « Isolation entre tenants ».
 *
 * Module PUR (aucun accès Prisma/session ici) : l'appelant (la route serveur de
 * l'aperçu, voir app/apercu/[tenantId]/page.tsx) résout d'abord la session (NextAuth,
 * voir lib/auth.ts) et les adhésions `TenantUser` de l'utilisateur, PUIS appelle cette
 * fonction — c'est ce qui la rend testable sans base de données, à l'image de
 * `hasPermission`/`assertPermission` (voir @yamacommerce/auth).
 *
 * Isolation tenant : une adhésion ACTIVE + la permission requise pour le tenant A
 * n'accorde JAMAIS l'accès au brouillon du tenant B — seule une correspondance EXACTE
 * de `tenantId` (ou le statut Super Admin) autorise l'accès.
 */

export interface PreviewAccessMembership {
  tenantId: string;
  status: "INVITED" | "ACTIVE" | "SUSPENDED";
  /** Permissions effectives du rôle de cette adhésion (voir `Role.permissions`). */
  permissions: readonly string[];
}

export interface PreviewAccessSubject {
  userId: string;
  isSuperAdmin: boolean;
  memberships: readonly PreviewAccessMembership[];
}

/** Permission requise pour prévisualiser/éditer le brouillon d'un site — voir
 *  @yamacommerce/auth `PERMISSIONS` (« settings.site_editor »). */
const REQUIRED_PERMISSION = "settings.site_editor" as const;

/**
 * Un Super Admin peut prévisualiser n'importe quel tenant (support/diagnostic — voir
 * `ImpersonationSession` dans le schéma Prisma, le même principe que l'usurpation
 * d'identité déjà prévue). Sinon, il faut une adhésion ACTIVE (pas INVITED/SUSPENDED)
 * pour CE tenant précis, avec la permission `settings.site_editor`.
 */
export function canAccessDraftPreview(subject: PreviewAccessSubject, tenantId: string): boolean {
  if (subject.isSuperAdmin) return true;

  const membership = subject.memberships.find(
    (candidate) => candidate.tenantId === tenantId && candidate.status === "ACTIVE",
  );
  if (!membership) return false;

  return hasPermission(membership.permissions, REQUIRED_PERMISSION);
}
