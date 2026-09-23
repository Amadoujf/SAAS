import "server-only";
import { listActiveDomainsForTenant, resolveActiveDomainByHost, resolveDomainServeDecision } from "@yamacommerce/domains";
import { withSuperAdminAccess } from "@yamacommerce/database";
import { cachedLiveSiteResolver } from "@/lib/publishing/cache";
import { resolveTenantSiteForRendering, type TenantSiteRenderProps } from "./resolve-tenant-site";

/**
 * Résolution du site PUBLIC à partir du Host — voir docs/12 §12.3, « RENDU PUBLIC » :
 * « résoudre le tenant depuis le domaine ou sous-domaine », « ne jamais servir un
 * brouillon », « retourner une page correcte si le site est suspendu », « gérer les
 * pages inexistantes » ; et docs/13, « DOMAINES PRINCIPAUX ET REDIRECTIONS ». Point
 * d'entrée UNIQUE pour `app/page.tsx`, `app/[slug]/page.tsx`, `app/sitemap.ts` et
 * `app/robots.ts` — jamais de résolution dupliquée/divergente entre ces fichiers.
 *
 * `tenant.status` est vérifié ICI, explicitement — `resolveTenantSiteForRendering`
 * (voir resolve-tenant-site.ts) ne connaît que `TenantSite.isPublished` et le statut du
 * template, jamais celui du TENANT : un tenant SUSPENDU dont le site était déjà publié
 * avant sa suspension continuerait sinon d'être servi normalement.
 *
 * IMPORTANT (revue du 18 septembre 2026) — ce contrôle est le SEUL rempart
 * indépendant de Caddy/TLS : un certificat déjà émis peut rester valide après une
 * suspension tant que Caddy n'a pas redémarré (voir docs/13, limite connue de
 * `CaddyDomainProvider.revokeDomain`). C'est pourquoi la vérification de statut
 * ci-dessous a lieu AVANT tout appel à `deps.resolveSiteContent` (mis en cache via
 * `unstable_cache`, voir cache.ts) — jamais après, et jamais court-circuitée par une
 * entrée de cache de CONTENU déjà chaude : ce cache ne porte que sur le contenu d'un
 * tenant déjà autorisé à être servi, jamais sur la décision de l'autoriser.
 */
export type PublicSiteResolution =
  | { status: "not_found" }
  | { status: "suspended"; tenantName: string }
  | { status: "billing_suspended"; tenantName: string }
  | { status: "not_published" }
  | { status: "redirect"; targetDomain: string }
  | { status: "ok"; tenantId: string; tenantName: string; site: TenantSiteRenderProps };

export interface ResolvePublicSiteDeps {
  /** Injecté plutôt qu'appelé directement (`cachedLiveSiteResolver`, voir cache.ts) :
   *  `unstable_cache` exige un contexte de requête/build Next.js réel et lève une
   *  erreur (« incrementalCache missing ») en dehors — trouvé en écrivant un test réel
   *  contre PostgreSQL pour cette fonction (revue du 18 septembre 2026), même pattern
   *  que `PublishSiteDeps.invalidateCache`/`DnsCheckDeps.invalidateCache`. Les VRAIS
   *  appelants (pages Next.js) utilisent toujours `defaultResolvePublicSiteDeps`. */
  resolveSiteContent: (tenantId: string) => Promise<TenantSiteRenderProps | null>;
}

export const defaultResolvePublicSiteDeps: ResolvePublicSiteDeps = {
  resolveSiteContent: (tenantId) =>
    cachedLiveSiteResolver(tenantId, () => resolveTenantSiteForRendering(tenantId, "live")),
};

export type ActiveTenantResolution =
  | { status: "not_found" }
  | { status: "suspended"; tenantName: string }
  | { status: "billing_suspended"; tenantName: string }
  | { status: "redirect"; targetDomain: string }
  | { status: "ok"; tenantId: string; tenantName: string };

/**
 * Partie « domaine/tenant autorisé ? » de `resolvePublicSite`, extraite pour être
 * réutilisée par toute page publique qui ne dépend PAS du manifeste de l'éditeur
 * (voir `app/catalogue/page.tsx`, `app/p/[slug]/page.tsx` — le catalogue réel n'est
 * pas une page de section éditée, mais doit hériter des MÊMES protections
 * domaine/tenant suspendu que le reste du site, jamais une seconde résolution
 * divergente). `resolvePublicSite` reste le SEUL point d'entrée pour les pages liées
 * au manifeste (accueil/pages statiques) ; cette fonction est le SEUL point d'entrée
 * pour tout le reste.
 */
export async function resolveActiveTenant(host: string): Promise<ActiveTenantResolution> {
  const domain = await resolveActiveDomainByHost(host);
  if (!domain) return { status: "not_found" };
  const tenant = domain.tenant;
  if (tenant.status === "SUSPENDED") return { status: "suspended", tenantName: tenant.name };
  if (tenant.status !== "ACTIVE") return { status: "not_found" };

  // Distinct de `tenant.status === "SUSPENDED"` (décision Super Admin sur le TENANT
  // entier) — voir docs/14-facturation-saas-abonnements.md, « politique de
  // disponibilité du site ». GRACE_PERIOD n'affecte JAMAIS le site public (aucune
  // pénalité avant la fin de la grâce, voir readiness.ts `ALLOWED_SUBSCRIPTION_STATUSES`).
  //
  // CORRECTION DE STABILISATION (22 septembre 2026) — l'ABSENCE de ligne
  // `TenantSubscription` était auparavant traitée comme "site public inchangé", ce qui
  // permettait de contourner la facturation en supprimant/perdant la ligne
  // d'abonnement (voir docs/14). Elle bloque désormais le site PAR DÉFAUT, exactement
  // comme SUSPENDED/EXPIRED — la SEULE exception est un tenant explicitement marqué
  // `Tenant.billingExemptedAt` (dérogation Super Admin ponctuelle, jamais un défaut).
  const subscription = await withSuperAdminAccess((tx) =>
    tx.tenantSubscription.findUnique({ where: { tenantId: tenant.id }, select: { status: true } }),
  );
  if (subscription?.status === "SUSPENDED" || subscription?.status === "EXPIRED") {
    return { status: "billing_suspended", tenantName: tenant.name };
  }
  if (!subscription && !tenant.billingExemptedAt) {
    return { status: "billing_suspended", tenantName: tenant.name };
  }

  const allDomains = await listActiveDomainsForTenant(tenant.id);
  const decision = resolveDomainServeDecision(
    {
      id: domain.id,
      domain: domain.domain,
      isPrimary: domain.isPrimary,
      isLive: true, // `listActiveDomainsForTenant`/`resolveActiveDomainByHost` ne renvoient déjà que des domaines ACTIVE.
      serveDirectlyWhenNotPrimary: domain.serveDirectlyWhenNotPrimary,
    },
    allDomains.map((d) => ({
      id: d.id,
      domain: d.domain,
      isPrimary: d.isPrimary,
      isLive: true,
      serveDirectlyWhenNotPrimary: d.serveDirectlyWhenNotPrimary,
    })),
  );
  if (decision.action === "redirect") {
    return { status: "redirect", targetDomain: decision.targetDomain };
  }

  return { status: "ok", tenantId: tenant.id, tenantName: tenant.name };
}

export async function resolvePublicSite(
  host: string,
  deps: ResolvePublicSiteDeps = defaultResolvePublicSiteDeps,
): Promise<PublicSiteResolution> {
  const active = await resolveActiveTenant(host);
  if (active.status !== "ok") return active;

  const site = await deps.resolveSiteContent(active.tenantId);
  if (!site) return { status: "not_published" };

  return { status: "ok", tenantId: active.tenantId, tenantName: active.tenantName, site };
}
