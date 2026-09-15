import { hasAnyPermission } from "@yamacommerce/auth";

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

/** L'une OU l'autre suffit à voir le brouillon — voir @yamacommerce/auth
 *  `PERMISSIONS` (22 septembre 2026, remplace l'ancienne "settings.site_editor"
 *  unique) : un éditeur (`site.edit`) peut forcément voir ce qu'il édite, et un
 *  simple relecteur (`site.preview`, ex. un rôle métier ne devant jamais modifier le
 *  site) peut être habilité à le voir sans l'éditer. */
const REQUIRED_PERMISSIONS = ["site.edit", "site.preview"] as const;

/**
 * Un Super Admin peut prévisualiser n'importe quel tenant (support/diagnostic — voir
 * `ImpersonationSession` dans le schéma Prisma, le même principe que l'usurpation
 * d'identité déjà prévue). Sinon, il faut une adhésion ACTIVE (pas INVITED/SUSPENDED)
 * pour CE tenant précis, avec au moins une des permissions requises.
 */
export function canAccessDraftPreview(subject: PreviewAccessSubject, tenantId: string): boolean {
  if (subject.isSuperAdmin) return true;

  const membership = subject.memberships.find(
    (candidate) => candidate.tenantId === tenantId && candidate.status === "ACTIVE",
  );
  if (!membership) return false;

  return hasAnyPermission(membership.permissions, [...REQUIRED_PERMISSIONS]);
}
