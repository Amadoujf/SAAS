import "server-only";
import { resolveTenantByHost } from "@yamacommerce/domains";
import { cachedLiveSiteResolver } from "@/lib/publishing/cache";
import { resolveTenantSiteForRendering, type TenantSiteRenderProps } from "./resolve-tenant-site";

/**
 * Résolution du site PUBLIC à partir du Host — voir docs/12 §12.3, « RENDU PUBLIC » :
 * « résoudre le tenant depuis le domaine ou sous-domaine », « ne jamais servir un
 * brouillon », « retourner une page correcte si le site est suspendu », « gérer les
 * pages inexistantes ». Point d'entrée UNIQUE pour `app/page.tsx`, `app/[slug]/page.tsx`,
 * `app/sitemap.ts` et `app/robots.ts` — jamais de résolution dupliquée/divergente entre
 * ces quatre fichiers.
 *
 * `tenant.status` est vérifié ICI, explicitement — `resolveTenantSiteForRendering`
 * (voir resolve-tenant-site.ts) ne connaît que `TenantSite.isPublished` et le statut du
 * template, jamais celui du TENANT : un tenant SUSPENDU dont le site était déjà publié
 * avant sa suspension continuerait sinon d'être servi normalement.
 */
export type PublicSiteResolution =
  | { status: "not_found" }
  | { status: "suspended"; tenantName: string }
  | { status: "not_published" }
  | { status: "ok"; tenantId: string; tenantName: string; site: TenantSiteRenderProps };

export async function resolvePublicSite(host: string): Promise<PublicSiteResolution> {
  const tenant = await resolveTenantByHost(host);
  if (!tenant) return { status: "not_found" };
  if (tenant.status === "SUSPENDED") return { status: "suspended", tenantName: tenant.name };
  if (tenant.status !== "ACTIVE") return { status: "not_found" };

  const site = await cachedLiveSiteResolver(tenant.id, () =>
    resolveTenantSiteForRendering(tenant.id, "live"),
  );
  if (!site) return { status: "not_published" };

  return { status: "ok", tenantId: tenant.id, tenantName: tenant.name, site };
}
