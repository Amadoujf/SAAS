import "server-only";
import { revalidateTag, unstable_cache } from "next/cache";

/**
 * Stratégie de cache du rendu public — voir docs/12 §12.3, « CACHE » : « Créer une
 * stratégie de cache par : tenant, domaine, version, page. » et « Une publication ou
 * restauration doit invalider UNIQUEMENT le site concerné, pas tous les tenants. ».
 *
 * Un seul tag PAR TENANT (`site:{tenantId}`) plutôt qu'un tag par domaine/version/page
 * séparé : une publication remplace TOUJOURS la version publiée dans son ENTIER (voir
 * `publishVersion`, jamais de mise à jour partielle) — un tag plus fin n'apporterait
 * aucune granularité utile, seulement de la complexité, puisqu'il faudrait de toute
 * façon invalider TOUTES les pages de CE tenant à chaque publication.
 */
export function siteCacheTag(tenantId: string): string {
  return `site:${tenantId}`;
}

/** Enveloppe `resolveTenantSiteForRendering(tenantId, "live")` (voir
 *  lib/rendering/resolve-tenant-site.ts) derrière `unstable_cache`, taguée par tenant.
 *  Le mode "preview" (éditeur) n'est JAMAIS mis en cache : un brouillon doit toujours
 *  refléter l'état actuel sans délai. */
export function cachedLiveSiteResolver<T>(tenantId: string, resolve: () => Promise<T>): Promise<T> {
  const cached = unstable_cache(resolve, [`tenant-site-live-${tenantId}`], {
    tags: [siteCacheTag(tenantId)],
  });
  return cached();
}

/** Invalide le cache public d'UN SEUL tenant — appelé après publication, restauration,
 *  ou promotion d'une publication programmée. Ne touche jamais un autre tenant. */
export function invalidateSiteCache(tenantId: string): void {
  revalidateTag(siteCacheTag(tenantId));
}
