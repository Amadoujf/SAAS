import { withSuperAdminAccess } from "@yamacommerce/database";
import { CaddyDomainProvider } from "./providers/caddy.provider";
import { CloudflareCustomHostnameProvider } from "./providers/cloudflare.provider";
import type { DomainProvider } from "./types";

// "local" (voir providers/local.provider.ts) est volontairement absent de ce
// registre : chaque test/démonstration construit sa PROPRE instance avec sa propre
// zone DNS simulée (`InMemoryDnsZone`) plutôt que de partager un état global — voir
// apps/web/lib/domains/demo-domains-context.ts pour l'instance utilisée par la
// démonstration interactive.
const providers: Partial<Record<DomainProvider["name"], DomainProvider>> = {
  caddy: new CaddyDomainProvider(),
  cloudflare_custom_hostname: new CloudflareCustomHostnameProvider(),
};

export function getDomainProvider(name: DomainProvider["name"]): DomainProvider {
  const provider = providers[name];
  if (!provider) {
    throw new Error(`getDomainProvider : aucun fournisseur enregistré pour "${name}".`);
  }
  return provider;
}

/**
 * Résout le tenant à partir d'un nom d'hôte HTTP (Host header). Utilisé par le
 * middleware Next.js (`apps/web/middleware.ts`) — jamais par une route qui accepterait
 * un `tenantId` fourni par le client.
 *
 * N'exige RIEN de moins que `ACTIVE` (certificat réellement émis) — voir docs/13,
 * « Ne jamais afficher un domaine comme actif avant que le HTTPS fonctionne
 * réellement ». Pour la question DIFFÉRENTE « peut-on émettre un certificat pour ce
 * domaine ? », voir `isDomainAllowedForTls` ci-dessous, qui doit au contraire
 * accepter un domaine `VERIFIED` pas encore actif (sinon aucun certificat ne
 * pourrait jamais être émis en premier lieu).
 *
 * Utilise `withSuperAdminAccess` — jamais le client `prisma` nu : résoudre "à quel
 * tenant appartient ce domaine" est par nature une opération PRÉ-authentification,
 * cross-tenant (voir la policy RLS Pattern A de `Domain`, qui bloque TOUTE lecture
 * tant qu'aucun `app.current_tenant_id`/`app.is_super_admin` n'est positionné) —
 * exactement comme résoudre un utilisateur par e-mail au moment de la connexion.
 * L'appelant NE PEUT PAS fournir de `tenantId` pour se scoper lui-même, puisque
 * découvrir ce `tenantId` est justement le but de cette fonction.
 */
export async function resolveTenantByHost(host: string) {
  const resolved = await resolveActiveDomainByHost(host);
  return resolved?.tenant ?? null;
}

/**
 * Comme `resolveTenantByHost`, mais renvoie AUSSI la ligne `Domain` elle-même — voir
 * apps/web/lib/rendering/resolve-public-site.ts, qui en a besoin pour décider si CE
 * domaine précis doit servir directement ou rediriger vers le principal du tenant
 * (voir @yamacommerce/domains `domain-redirect.ts`).
 */
export async function resolveActiveDomainByHost(host: string) {
  const normalizedHost = host.split(":")[0]?.toLowerCase() ?? host.toLowerCase();

  const domain = await withSuperAdminAccess((tx) =>
    tx.domain.findUnique({ where: { domain: normalizedHost }, include: { tenant: true } }),
  );

  if (!domain || domain.lifecycleStatus !== "ACTIVE") {
    return null;
  }

  return domain;
}

/** Tous les domaines ACTIFS d'un tenant — nécessaire pour `resolveDomainServeDecision`
 *  (il faut connaître le domaine PRINCIPAL, pas seulement celui de la requête en cours). */
export async function listActiveDomainsForTenant(tenantId: string) {
  return withSuperAdminAccess((tx) => tx.domain.findMany({ where: { tenantId, lifecycleStatus: "ACTIVE" } }));
}

const TLS_ELIGIBLE_STATUSES = new Set(["VERIFIED", "SSL_PENDING", "ACTIVE"]);

/**
 * Consultée par l'endpoint `/api/domains/ask` que Caddy interroge (directive
 * `on_demand_tls.ask`) AVANT d'émettre un certificat pour un domaine personnalisé —
 * doit donc accepter un domaine dont la PROPRIÉTÉ est déjà confirmée (voir
 * « VÉRIFICATION DE PROPRIÉTÉ » : jamais confirmée par le seul fait de pointer vers
 * l'application), sans exiger que le certificat existe déjà (ce serait circulaire).
 */
export async function isDomainAllowedForTls(host: string): Promise<boolean> {
  const normalizedHost = host.split(":")[0]?.toLowerCase() ?? host.toLowerCase();
  const domain = await withSuperAdminAccess((tx) =>
    tx.domain.findUnique({ where: { domain: normalizedHost }, include: { tenant: true } }),
  );
  if (!domain || domain.tenant.status !== "ACTIVE") return false;
  return TLS_ELIGIBLE_STATUSES.has(domain.lifecycleStatus);
}

/**
 * Vérifie qu'un domaine n'est pas déjà revendiqué par une autre entreprise — étape 1 de
 * l'assistant de configuration de domaine. La contrainte d'unicité `Domain.domain` en
 * base est la garantie définitive (une course entre deux créations simultanées est
 * tranchée par la contrainte SQL, pas par cette fonction) ; cette vérification n'est
 * qu'un retour rapide et lisible pour l'interface, jamais la seule protection.
 *
 * `withSuperAdminAccess` — voir la note de `resolveTenantByHost` : sans elle, la RLS
 * masquerait tous les domaines des AUTRES tenants et cette fonction renverrait
 * toujours `true`, quel que soit le domaine.
 */
export async function isDomainAvailable(domain: string): Promise<boolean> {
  const normalized = domain.trim().toLowerCase();
  const existing = await withSuperAdminAccess((tx) => tx.domain.findUnique({ where: { domain: normalized } }));
  return existing === null;
}
