import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { withTenant } from "@yamacommerce/database";
import type { TemplateManifest } from "@yamacommerce/templates";
import { auth } from "@/lib/auth";
import { getCurrentTenantMembership } from "@/lib/current-tenant";
import { requireTenantPermission } from "@/lib/tenant-permissions";
import { ensureTenantEditorSite } from "@/lib/site-editor/tenant-site";
import { resolveCatalogContentForManifest } from "@/lib/rendering/resolve-catalog-content";
import { loadStoreContext } from "@/lib/storefront/store-context";
import { templateLayout } from "@/lib/storefront/store-templates";
import { isDraftSettings, loadDraft, previewTokens, type DraftSnapshot } from "@/lib/site-ai/site-state";
import type { CompiledSite } from "@/lib/site-ai/compile";
import { PublishedSectorHome } from "@/components/published-sector-home";
import { PreviewBridge } from "@/components/site-ai/preview-bridge";
import { buildRestaurantContext } from "@/lib/restaurant/restaurant-context";

export const metadata: Metadata = { robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * Aperçu RÉEL de « Mon site » (dans l'iframe) : la page d'accueil du BROUILLON, ou une
 * proposition de l'assistant pas encore appliquée (`?job=…`, `&d=` pour l'une des trois
 * directions), rendue par le même moteur et la même coque de boutique que le site en
 * ligne. Réservé aux membres autorisés à modifier le site ; propositions lues sous
 * isolation (celles d'une autre entreprise sont introuvables).
 */
export default async function SiteDraftPreviewPage({ searchParams }: { searchParams: { job?: string; d?: string } }) {
  const session = await auth();
  if (!session?.user) redirect("/connexion");
  const membership = await getCurrentTenantMembership();
  if (!membership || !(await requireTenantPermission(membership.tenantId, "site.edit"))) redirect("/dashboard");
  const { tenantId, tenantName } = membership;
  const tenantSiteId = await ensureTenantEditorSite(tenantId, tenantName);

  const { snapshot, resolvedContent } = await withTenant(tenantId, async (tx) => {
    const draft = await loadDraft(tx, tenantId, tenantSiteId);
    let snapshot: DraftSnapshot = draft.snapshot;
    if (searchParams.job && /^[0-9a-f-]{36}$/i.test(searchParams.job)) {
      const job = await tx.aIGenerationJob.findFirst({ where: { id: searchParams.job, tenantId, status: "completed" } });
      if (!job) notFound();
      const out = job.outputPayload as { directions?: { compiled: CompiledSite }[]; after?: DraftSnapshot } | null;
      if (out?.directions) {
        const compiled = out.directions[Number(searchParams.d ?? 0)]?.compiled;
        if (!compiled) notFound();
        snapshot = { blocks: compiled.blocks, settings: { identity: { ...compiled.identity, logoUrl: draft.snapshot.settings.identity.logoUrl }, motion: compiled.motion } };
      } else if (out?.after && isDraftSettings(out.after.settings)) {
        snapshot = out.after;
      }
    }
    const manifest = { pages: [{ slug: "accueil", title: "Accueil", isHome: true, sections: snapshot.blocks }] } as TemplateManifest;
    return { snapshot, resolvedContent: await resolveCatalogContentForManifest(tx, tenantId, manifest) };
  });

  const tokens = previewTokens(snapshot.settings);
  const site = {
    manifest: { pages: [{ slug: "accueil", title: "Accueil", isHome: true, sections: snapshot.blocks }] } as TemplateManifest,
    tokens,
    animationLevel: snapshot.settings.motion.level,
    resolvedContent,
  };
  // Restaurant : l'aperçu est habillé comme le site du restaurant (en-tête, carte,
  // réservation), avec les couleurs et la typographie du brouillon.
  const restaurant = await buildRestaurantContext(tenantId, tenantName);
  if (restaurant) {
    return (
      <>
        <PublishedSectorHome site={site} restaurant={{ ...restaurant, tokens, logoUrl: snapshot.settings.identity.logoUrl ?? restaurant.logoUrl }} annotate />
        <PreviewBridge />
      </>
    );
  }
  const base = await loadStoreContext(tenantId, tenantName);
  const store = { ...base, tokens, logoUrl: snapshot.settings.identity.logoUrl, templateSlug: snapshot.settings.identity.style, layout: templateLayout(snapshot.settings.identity.style) };
  return (
    <>
      <PublishedSectorHome site={site} store={store} annotate />
      <PreviewBridge />
    </>
  );
}
