import "server-only";
import { getDomainProvider, NodeDnsResolver } from "@yamacommerce/domains";
import { RedisRateLimiter, redisConnection } from "@yamacommerce/queue";
import type { DnsCheckDeps } from "./dns-check-pipeline";

/**
 * Dépendances RÉELLES du sous-système domaines (DNS public + Caddy + Redis) — voir
 * « conserve exactement la même interface pour PostgreSQL, BullMQ et R2 » (transposé
 * ici à DNS/HTTPS) : seul ce fichier change entre la démonstration (voir
 * demo-domains-context.ts, `InMemoryDnsResolver` + `LocalDomainProvider`) et la
 * production.
 */
let cached: DnsCheckDeps | null = null;

export function realDnsCheckDeps(): DnsCheckDeps {
  if (!cached) {
    cached = {
      dnsResolver: new NodeDnsResolver(),
      domainProvider: getDomainProvider(
        (process.env.DOMAIN_PROVIDER as "caddy" | "cloudflare_custom_hostname") ?? "caddy",
      ),
    };
  }
  return cached;
}

export function realRateLimiter() {
  return new RedisRateLimiter(redisConnection);
}
