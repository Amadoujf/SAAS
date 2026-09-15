import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { withUser } from "@yamacommerce/database";
import { auth } from "@/lib/auth";
import { resolveTenantSiteForRendering } from "@/lib/rendering/resolve-tenant-site";
import { canAccessDraftPreview, type PreviewAccessMembership } from "@/lib/editor/preview-access";
import { PreviewFrameApp } from "@/components/editor/preview-frame-app";
import type { PageForPreview } from "@/lib/editor/preview-protocol";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/**
 * Document RÉEL chargé dans l'iframe de l'éditeur visuel pour un tenant authentique —
 * voir docs/12 §12.2, « aperçu iframe responsive » (21 septembre 2026), « Rendu du
 * brouillon uniquement pour les utilisateurs autorisés », « Aucun accès public à une
 * version non publiée », « Isolation entre tenants ».
 *
 * Contrairement à `app/demo/editeur-visuel/apercu/page.tsx` (démonstration publique,
 * sans tenant réel), cette route est un Server Component qui :
 *  1. Exige une session (sinon redirection vers `/connexion`, jamais de rendu partiel) ;
 *  2. Résout les adhésions `TenantUser` de CET utilisateur via `withUser()` — la même
 *     protection RLS que le tableau de bord (voir `app/dashboard/page.tsx`), qui ne
 *     peut de toute façon renvoyer que des lignes où cet utilisateur est membre ;
 *  3. Vérifie `canAccessDraftPreview()` (voir lib/editor/preview-access.ts) — une
 *     adhésion ACTIVE avec la permission `site.edit` OU `site.preview` POUR CE TENANT
 *     PRÉCIS, ou le statut Super Admin ; sinon `notFound()` (jamais un message
 *     distinguant "tenant inexistant" de "accès refusé", pour ne rien révéler à un
 *     utilisateur non autorisé) ;
 *  4. Ne résout et ne rend le BROUILLON (`resolveTenantSiteForRendering(tenantId,
 *     "preview")`) qu'APRÈS ces deux vérifications — jamais avant.
 *
 * Le contenu initial ainsi résolu est passé à `PreviewFrameApp` comme valeurs de
 * DÉPART : la fenêtre parente (l'éditeur) peut ensuite les remplacer temporairement
 * par `postMessage` pour prévisualiser des modifications NON enregistrées (voir
 * PreviewStage) — jamais persisté par ce document, qui reste un simple afficheur.
 */
export default async function TenantDraftPreviewPage({
  params,
  searchParams,
}: {
  params: { tenantId: string };
  searchParams: { page?: string };
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/connexion");
  }

  const memberships = await withUser(session.user.id, (tx) =>
    tx.tenantUser.findMany({
      where: { userId: session.user.id },
      include: { role: true },
    }),
  );

  const subjectMemberships: PreviewAccessMembership[] = memberships.map((membership) => ({
    tenantId: membership.tenantId,
    status: membership.status,
    permissions: membership.role.permissions,
  }));

  const authorized = canAccessDraftPreview(
    { userId: session.user.id, isSuperAdmin: session.user.isSuperAdmin ?? false, memberships: subjectMemberships },
    params.tenantId,
  );
  if (!authorized) {
    notFound();
  }

  const site = await resolveTenantSiteForRendering(params.tenantId, "preview");
  if (!site) {
    notFound();
  }

  const requestedSlug = searchParams.page;
  const page =
    site.manifest.pages.find((candidate) => candidate.slug === requestedSlug) ??
    site.manifest.pages.find((candidate) => candidate.isHome) ??
    site.manifest.pages[0]!;

  const initialPage: PageForPreview = {
    id: page.slug,
    slug: page.slug,
    title: page.title,
    isHome: page.isHome,
    blocks: page.sections,
  };

  return (
    <PreviewFrameApp
      initialPage={initialPage}
      initialTokens={site.tokens}
      initialAnimationLevel={site.animationLevel}
    />
  );
}
