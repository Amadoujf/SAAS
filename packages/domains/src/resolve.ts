import { prisma } from "@yamacommerce/database";
import { CaddyDomainProvider } from "./providers/caddy.provider";
import { CloudflareCustomHostnameProvider } from "./providers/cloudflare.provider";
import type { DomainProvider } from "./types";

const providers: Record<DomainProvider["name"], DomainProvider> = {
  caddy: new CaddyDomainProvider(),
  cloudflare_custom_hostname: new CloudflareCustomHostnameProvider(),
};

export function getDomainProvider(name: DomainProvider["name"]): DomainProvider {
  return providers[name];
}

/**
 * Résout le tenant à partir d'un nom d'hôte HTTP (Host header). Utilisé par le
 * middleware Next.js (`apps/web/middleware.ts`) — jamais par une route qui accepterait
 * un `tenantId` fourni par le client.
 */
export async function resolveTenantByHost(host: string) {
  const normalizedHost = host.split(":")[0]?.toLowerCase() ?? host.toLowerCase();

  const domain = await prisma.domain.findUnique({
    where: { domain: normalizedHost },
    include: { tenant: true },
  });

  if (!domain || !domain.verified) {
    return null;
  }

  return domain.tenant;
}

/**
 * Consultée par l'endpoint `/api/domains/ask` que Caddy interroge (directive
 * `on_demand_tls.ask`) avant d'émettre un certificat pour un domaine personnalisé.
 */
export async function isDomainAllowedForTls(host: string): Promise<boolean> {
  const tenant = await resolveTenantByHost(host);
  return tenant !== null && tenant.status === "ACTIVE";
}

/**
 * Vérifie qu'un domaine n'est pas déjà revendiqué par une autre entreprise — étape 1 de
 * l'assistant de configuration de domaine. La contrainte d'unicité `Domain.domain` en
 * base est la garantie définitive (une course entre deux créations simultanées est
 * tranchée par la contrainte SQL, pas par cette fonction) ; cette vérification n'est
 * qu'un retour rapide et lisible pour l'interface, jamais la seule protection.
 */
export async function isDomainAvailable(domain: string): Promise<boolean> {
  const normalized = domain.trim().toLowerCase();
  const existing = await prisma.domain.findUnique({ where: { domain: normalized } });
  return existing === null;
}
