import "server-only";
import { randomUUID } from "node:crypto";
import {
  InMemoryDnsResolver,
  InMemoryDnsZone,
  LocalDomainProvider,
  checkExpectedDnsRecords,
  computeExpectedDnsRecords,
  computeVerificationTokenExpiry,
  detectHomographRisk,
  generateSubdomainAlternatives,
  generateVerificationToken,
  isVerificationTokenExpired,
  normalizeDomainName,
  normalizeSubdomain,
  resolveDomainServeDecision,
  suggestSubdomainFromName,
  toQualifiedHost,
  validateDomainFormat,
  validateSubdomainFormat,
  type ExpectedDnsRecord,
} from "@yamacommerce/domains";

/** Même jeu de valeurs que l'enum Prisma `DomainLifecycleStatus` — redéclaré ici
 *  plutôt qu'importé : la démonstration ne dépend JAMAIS de Prisma/@prisma/client. */
export type DemoDomainStatus =
  | "DRAFT"
  | "PENDING_DNS"
  | "VERIFYING"
  | "VERIFIED"
  | "SSL_PENDING"
  | "ACTIVE"
  | "MISCONFIGURED"
  | "SUSPENDED"
  | "EXPIRED"
  | "REMOVED";

/**
 * Démonstration de l'assistant de domaines — voir docs/13 : « Comme aucun compte
 * Cloudflare de production n'est disponible, construire : Un adaptateur local
 * complet, Un simulateur de propagation DNS, Un simulateur de création HTTPS, Une
 * interface démontrable de bout en bout. »
 *
 * RÉUTILISE le VRAI code partagé avec la production : validation/normalisation,
 * détection d'homographe, `checkExpectedDnsRecords`, `resolveDomainServeDecision`,
 * ET `LocalDomainProvider`/`InMemoryDnsResolver` (les MÊMES classes utilisées par les
 * tests unitaires du pipeline réel). Seule la couche de STOCKAGE des domaines est
 * simplifiée (tableau en mémoire plutôt que `Domain` via Prisma) — même principe que
 * demo-publishing-context.ts.
 *
 * `globalThis` — même raison que les autres contextes de démonstration : chaque
 * route Next.js en développement est un bundle webpack séparé.
 */

export interface DemoDomain {
  id: string;
  domain: string;
  type: "subdomain" | "custom";
  isPrimary: boolean;
  serveDirectlyWhenNotPrimary: boolean;
  lifecycleStatus: DemoDomainStatus;
  verificationToken: string | null;
  verificationTokenExpiresAt: string | null;
  verificationAttempts: number;
  expectedDnsRecords: ExpectedDnsRecord[];
  detectedDnsRecords: { type: string; host: string; value: string }[];
  lastCheckedAt: string | null;
  createdAt: string;
}

interface DemoDomainsState {
  domains: DemoDomain[];
  dnsZone: InMemoryDnsZone;
  /** DOIVENT vivre dans cet état stocké sur `globalThis`, pas comme simples constantes
   *  de module : `LocalDomainProvider` porte un état interne (tentatives de
   *  provisionnement TLS par domaine, voir local.provider.ts) qui doit survivre à la
   *  fois entre requêtes ET entre recompilations Next.js — voir la note de tête de
   *  fichier de demo-media-context.ts (même bug déjà rencontré et corrigé pour la
   *  médiathèque le 21 septembre 2026, et pour la publication le 22).
   */
  localProvider: LocalDomainProvider;
  dnsResolver: InMemoryDnsResolver;
}

const globalForDemoDomains = globalThis as typeof globalThis & {
  __yamacommerceDemoDomains?: DemoDomainsState;
};

const DEMO_SUFFIX = "yamacommerce.demo";

function initialState(): DemoDomainsState {
  const now = new Date().toISOString();
  const freeSubdomain: DemoDomain = {
    id: randomUUID(),
    domain: `boutique-demo.${DEMO_SUFFIX}`,
    type: "subdomain",
    isPrimary: true,
    serveDirectlyWhenNotPrimary: true,
    lifecycleStatus: "ACTIVE",
    verificationToken: null,
    verificationTokenExpiresAt: null,
    verificationAttempts: 0,
    expectedDnsRecords: [],
    detectedDnsRecords: [],
    lastCheckedAt: null,
    createdAt: now,
  };
  const dnsZone = new InMemoryDnsZone();
  return {
    domains: [freeSubdomain],
    dnsZone,
    localProvider: new LocalDomainProvider(dnsZone, 2),
    dnsResolver: new InMemoryDnsResolver(dnsZone),
  };
}

const state: DemoDomainsState =
  globalForDemoDomains.__yamacommerceDemoDomains ??
  (globalForDemoDomains.__yamacommerceDemoDomains = initialState());

/** Mute `state` EN PLACE plutôt que de réassigner `globalForDemoDomains...` — ce
 *  dernier ne changerait pas la référence déjà capturée par la constante `state`
 *  ci-dessus, utilisée partout ailleurs dans ce module (même piège déjà corrigé pour
 *  `demo-publishing-context.ts`). */
export function resetDemoDomainsState(): void {
  const fresh = initialState();
  state.domains = fresh.domains;
  // Réutilise TOUJOURS le même objet `state.dnsZone` (juste vidé) plutôt que celui de
  // `fresh` : `localProvider`/`dnsResolver` doivent pointer vers CETTE zone précise,
  // jamais une autre — les reconstruire ici, liés à `state.dnsZone` lui-même, est ce
  // qui garantit qu'aucune des trois références ne diverge jamais après un reset.
  state.dnsZone.clear();
  state.localProvider = new LocalDomainProvider(state.dnsZone, 2);
  state.dnsResolver = new InMemoryDnsResolver(state.dnsZone);
}

export function getDemoDomainsSnapshot(): DemoDomain[] {
  return state.domains;
}

// --- Sous-domaine gratuit ---------------------------------------------------

export function demoSuggestSubdomains(companyName: string, count = 4) {
  const base = suggestSubdomainFromName(companyName);
  const candidates = [base, ...generateSubdomainAlternatives(base, count - 1)];
  return candidates.map((subdomain) => {
    const fullDomain = `${subdomain}.${DEMO_SUFFIX}`;
    return { subdomain, fullDomain, available: !state.domains.some((d) => d.domain === fullDomain) };
  });
}

export type DemoSubdomainCheck =
  | { status: "available"; fullDomain: string }
  | { status: "invalid"; issues: string[] }
  | { status: "taken" };

export function demoCheckSubdomain(rawInput: string): DemoSubdomainCheck {
  const normalized = normalizeSubdomain(rawInput);
  const format = validateSubdomainFormat(normalized);
  if (!format.valid) return { status: "invalid", issues: format.issues };
  const fullDomain = `${normalized}.${DEMO_SUFFIX}`;
  return state.domains.some((d) => d.domain === fullDomain) ? { status: "taken" } : { status: "available", fullDomain };
}

export function demoClaimSubdomain(rawInput: string): DemoSubdomainCheck {
  const check = demoCheckSubdomain(rawInput);
  if (check.status !== "available") return check;

  const wasFirst = state.domains.length === 0;
  state.domains.push({
    id: randomUUID(),
    domain: check.fullDomain,
    type: "subdomain",
    isPrimary: wasFirst,
    serveDirectlyWhenNotPrimary: true,
    lifecycleStatus: "ACTIVE",
    verificationToken: null,
    verificationTokenExpiresAt: null,
    verificationAttempts: 0,
    expectedDnsRecords: [],
    detectedDnsRecords: [],
    lastCheckedAt: null,
    createdAt: new Date().toISOString(),
  });
  return check;
}

// --- Domaine personnalisé ----------------------------------------------------

export type DemoAddCustomDomainResult =
  | { outcome: "created"; domainId: string; domain: string; homographWarning?: string }
  | { outcome: "invalid"; issues: string[] }
  | { outcome: "taken" };

export function demoAddCustomDomain(
  rawDomain: string,
  confirmHomographRisk: boolean,
): DemoAddCustomDomainResult {
  const normalized = normalizeDomainName(rawDomain);
  const format = validateDomainFormat(normalized);
  if (!format.valid) return { outcome: "invalid", issues: format.issues };

  const homograph = detectHomographRisk(normalized);
  if (homograph.risky && !confirmHomographRisk) {
    return { outcome: "invalid", issues: [`homograph_risk:${homograph.reason}`] };
  }

  if (state.domains.some((d) => d.domain === normalized)) return { outcome: "taken" };

  const token = generateVerificationToken();
  const expiresAt = computeVerificationTokenExpiry();
  const expectedDnsRecords = computeExpectedDnsRecords(normalized, token);

  const domain: DemoDomain = {
    id: randomUUID(),
    domain: normalized,
    type: "custom",
    isPrimary: false,
    serveDirectlyWhenNotPrimary: false,
    lifecycleStatus: "PENDING_DNS",
    verificationToken: token,
    verificationTokenExpiresAt: expiresAt.toISOString(),
    verificationAttempts: 0,
    expectedDnsRecords,
    detectedDnsRecords: [],
    lastCheckedAt: null,
    createdAt: new Date().toISOString(),
  };
  state.domains.push(domain);

  return {
    outcome: "created",
    domainId: domain.id,
    domain: normalized,
    homographWarning: homograph.risky ? homograph.reason : undefined,
  };
}

/** Simule le client ajoutant (ou pas) les enregistrements DNS chez son fournisseur —
 *  voir « Un simulateur de propagation DNS ». `partial: true` n'ajoute que
 *  l'enregistrement de routage (A/CNAME), jamais le TXT — pour démontrer « DNS
 *  incorrect »/« Vérification en cours » sans propriété confirmée. */
export function demoSimulateDnsPropagation(domainId: string, partial = false): void {
  const domain = state.domains.find((d) => d.id === domainId);
  if (!domain) throw new Error("Domaine introuvable.");
  for (const record of domain.expectedDnsRecords) {
    if (partial && record.type === "TXT") continue;
    state.dnsZone.setRecord(record.type, toQualifiedHost(domain.domain, record.host), record.value);
  }
}

/** Simule une casse de configuration après activation — retire l'enregistrement de
 *  routage (garde le TXT, sans importance une fois actif). */
export function demoBreakDnsConfiguration(domainId: string): void {
  const domain = state.domains.find((d) => d.id === domainId);
  if (!domain) throw new Error("Domaine introuvable.");
  state.dnsZone.clear(domain.domain);
}

export type DemoDnsCheckOutcome =
  | "token_expired"
  | "pending_dns"
  | "verifying"
  | "ssl_pending"
  | "active"
  | "misconfigured"
  | "not_applicable";

export async function demoCheckDomainDns(domainId: string): Promise<DemoDnsCheckOutcome> {
  const domain = state.domains.find((d) => d.id === domainId);
  if (!domain) throw new Error("Domaine introuvable.");
  if (domain.lifecycleStatus === "REMOVED" || domain.lifecycleStatus === "SUSPENDED") return "not_applicable";

  const { allMatched, records } = await checkExpectedDnsRecords(
    state.dnsResolver,
    domain.domain,
    domain.expectedDnsRecords,
  );
  domain.detectedDnsRecords = records
    .filter((r) => r.detectedValue !== undefined)
    .map((r) => ({ type: r.expected.type, host: r.expected.host, value: r.detectedValue! }));
  domain.lastCheckedAt = new Date().toISOString();
  domain.verificationAttempts += 1;
  if (domain.lifecycleStatus === "PENDING_DNS") domain.lifecycleStatus = "VERIFYING";

  if (domain.lifecycleStatus === "ACTIVE") {
    if (!allMatched) {
      domain.lifecycleStatus = "MISCONFIGURED";
      return "misconfigured";
    }
    return "not_applicable";
  }

  if (domain.lifecycleStatus === "SSL_PENDING") {
    const cert = await state.localProvider.provisionDomain(domain.domain);
    if (cert.sslStatus === "issued") {
      domain.lifecycleStatus = "ACTIVE";
      return "active";
    }
    return "ssl_pending";
  }

  if (
    domain.verificationTokenExpiresAt &&
    isVerificationTokenExpired(new Date(domain.verificationTokenExpiresAt))
  ) {
    return "token_expired";
  }

  const verification = await state.localProvider.verifyDomain(domain.domain, domain.verificationToken ?? "");
  if (!verification.verified) {
    return allMatched ? "verifying" : "pending_dns";
  }

  domain.lifecycleStatus = "SSL_PENDING";
  const cert = await state.localProvider.provisionDomain(domain.domain);
  if (cert.sslStatus === "issued") {
    domain.lifecycleStatus = "ACTIVE";
    return "active";
  }
  return "ssl_pending";
}

export type DemoSetPrimaryResult = { outcome: "primary_set" } | { outcome: "not_active" };

export function demoSetPrimaryDomain(domainId: string): DemoSetPrimaryResult {
  const target = state.domains.find((d) => d.id === domainId);
  if (!target || target.lifecycleStatus !== "ACTIVE") return { outcome: "not_active" };
  for (const domain of state.domains) domain.isPrimary = domain.id === domainId;
  return { outcome: "primary_set" };
}

export function demoRemoveDomain(domainId: string): void {
  const domain = state.domains.find((d) => d.id === domainId);
  if (!domain) throw new Error("Domaine introuvable.");
  domain.lifecycleStatus = "REMOVED";
  domain.isPrimary = false;
}

export function demoSuspendDomain(domainId: string): void {
  const domain = state.domains.find((d) => d.id === domainId);
  if (domain) domain.lifecycleStatus = "SUSPENDED";
}

export function demoReactivateDomain(domainId: string): void {
  const domain = state.domains.find((d) => d.id === domainId);
  if (domain && domain.lifecycleStatus === "SUSPENDED") domain.lifecycleStatus = "VERIFIED";
}

/** Décide, pour un domaine donné, s'il sert directement ou redirige vers le
 *  principal — voir @yamacommerce/domains `domain-redirect.ts`. Utilisé par
 *  l'aperçu public de la démonstration (« Voir le site »). */
export function demoResolveServeDecision(domainId: string) {
  const target = state.domains.find((d) => d.id === domainId);
  if (!target) throw new Error("Domaine introuvable.");
  const toRedirectable = (d: DemoDomain) => ({
    id: d.id,
    domain: d.domain,
    isPrimary: d.isPrimary,
    isLive: d.lifecycleStatus === "ACTIVE",
    serveDirectlyWhenNotPrimary: d.serveDirectlyWhenNotPrimary,
  });
  return resolveDomainServeDecision(toRedirectable(target), state.domains.map(toRedirectable));
}
