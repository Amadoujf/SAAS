import "server-only";
import type { AnimationLevel, DesignTokens } from "@yamacommerce/design-tokens";
import {
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

/**
 * Résout tout ce qu'il faut pour rendre le site d'UN tenant — toujours dans le
 * contexte RLS de ce seul tenant (`withTenant`), jamais d'accès cross-tenant. Voir
 * l'exigence du moteur de rendu : « respecter le tenant courant », « ne jamais
 * exposer les données d'une autre entreprise ».
 *
 * - `mode: "live"` : ne renvoie un résultat QUE si le template est publié ET le site
 *   du tenant est publié — sinon `null` (le tenant n'a pas encore de site public).
 * - `mode: "preview"` : renvoie le résultat même en brouillon. L'autorisation d'accéder
 *   à la prévisualisation (propriétaire du tenant ou Super Admin) est de la
 *   responsabilité de l'appelant (route/page), pas de cette fonction.
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

    const manifest = validateTemplateManifest(tenantSite.template.pageManifest);
    const tokens = await resolveEffectiveDesignTokens(tx, tenantId);
    const animationLevel = await resolveEffectiveAnimationLevel(tx, tenantId);

    return { manifest, tokens, animationLevel };
  });
}
