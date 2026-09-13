import "server-only";
import type { AnimationLevel, DesignTokens } from "@yamacommerce/design-tokens";
import {
  getOrCreateDraftVersion,
  getPublishedVersion,
  resolveEffectiveAnimationLevel,
  resolveEffectiveDesignTokens,
  withTenant,
} from "@yamacommerce/database";
import { validateTemplateManifest, type TemplateManifest } from "@yamacommerce/templates";

export interface TenantSiteRenderProps {
  manifest: TemplateManifest;
  tokens: DesignTokens;
  animationLevel: AnimationLevel;
}

export type RenderMode = "live" | "preview";

type PageRow = { slug: string; title: string; isHome: boolean; blocks: unknown };

/** Convertit des lignes `Page` (éditeur visuel, voir @yamacommerce/database
 *  `site-versions-registry.ts`) en `TemplateManifest` — même schéma de validation que
 *  le manifeste par défaut d'un template, jamais de contenu non validé rendu. */
function pagesToManifest(pages: PageRow[]): TemplateManifest {
  return validateTemplateManifest({
    pages: pages.map((page) => ({
      slug: page.slug,
      title: page.title,
      isHome: page.isHome,
      sections: page.blocks,
    })),
  });
}

/**
 * Résout tout ce qu'il faut pour rendre le site d'UN tenant — toujours dans le
 * contexte RLS de ce seul tenant (`withTenant`), jamais d'accès cross-tenant. Voir
 * l'exigence du moteur de rendu : « respecter le tenant courant », « ne jamais
 * exposer les données d'une autre entreprise ».
 *
 * - `mode: "live"` : ne renvoie un résultat QUE si le template est publié ET le site
 *   du tenant est publié — sinon `null` (le tenant n'a pas encore de site public). Le
 *   contenu vient de la version PUBLIÉE de l'éditeur visuel (`TenantSiteVersion`,
 *   voir docs/12 §12.2) si le tenant a déjà personnalisé/publié une fois ; sinon,
 *   repli sur le manifeste par défaut du template — un tenant qui n'a jamais ouvert
 *   l'éditeur continue de servir son template tel quel.
 * - `mode: "preview"` : renvoie le contenu même en brouillon — celui du BROUILLON
 *   courant de l'éditeur (créé à la volée s'il n'existe pas encore, seedé depuis le
 *   template). L'autorisation d'accéder à la prévisualisation (propriétaire du tenant
 *   ou Super Admin) est de la responsabilité de l'appelant (route/page), pas de cette
 *   fonction.
 */
export async function resolveTenantSiteForRendering(
  tenantId: string,
  mode: RenderMode,
): Promise<TenantSiteRenderProps | null> {
  return withTenant(tenantId, async (tx) => {
    const tenantSite = await tx.tenantSite.findUnique({
      where: { tenantId },
      include: { template: true },
    });
    if (!tenantSite) return null;

    if (
      mode === "live" &&
      (!tenantSite.isPublished || tenantSite.template.status !== "published")
    ) {
      return null;
    }

    let manifest: TemplateManifest;
    if (mode === "preview") {
      const draft = await getOrCreateDraftVersion(tx, tenantId, tenantSite.id);
      manifest =
        draft.pages.length > 0
          ? pagesToManifest(draft.pages)
          : validateTemplateManifest(tenantSite.template.pageManifest);
    } else {
      const published = await getPublishedVersion(tx, tenantSite.id);
      manifest =
        published && published.pages.length > 0
          ? pagesToManifest(published.pages)
          : validateTemplateManifest(tenantSite.template.pageManifest);
    }

    const tokens = await resolveEffectiveDesignTokens(tx, tenantId);
    const animationLevel = await resolveEffectiveAnimationLevel(tx, tenantId);

    return { manifest, tokens, animationLevel };
  });
}
