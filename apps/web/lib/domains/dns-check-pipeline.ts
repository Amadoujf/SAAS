import "server-only";
import {
  getDomainForTenant,
  markActive,
  markMisconfigured,
  markSslPending,
  markVerified,
  recordDnsCheckAttempt,
  withSuperAdminAccess,
  withTenant,
  writeAuditLog,
} from "@yamacommerce/database";
import {
  checkExpectedDnsRecords,
  isVerificationTokenExpired,
  type DnsResolver,
  type DomainProvider,
  type ExpectedDnsRecord,
} from "@yamacommerce/domains";
import { QUEUE_NAMES, notificationsQueue } from "@yamacommerce/queue";
import { invalidateSiteCache } from "@/lib/publishing/cache";

/**
 * Cœur de la « DÉTECTION DNS » — voir docs/13. Point d'entrée UNIQUE utilisé à la
 * fois par le bouton « Vérifier maintenant » (rate-limité côté route, voir
 * app/api/domains/[id]/verify-now/route.ts) ET par le worker planifié (voir
 * apps/worker + app/api/internal/domains/check/route.ts) — jamais deux logiques de
 * vérification différentes.
 *
 * Un seul appel fait TOUT ce qu'une tentative peut raisonnablement accomplir :
 * détecte les enregistrements, avance le statut d'AU PLUS une étape (jamais de
 * DRAFT direct à ACTIVE en un seul appel — chaque étape reste observable), et
 * notifie sur les transitions significatives.
 */
export interface DnsCheckDeps {
  dnsResolver: DnsResolver;
  domainProvider: DomainProvider;
}

/** Jamais "verified" comme état FINAL d'un appel : une fois la propriété confirmée,
 *  cette fonction enchaîne immédiatement sur le provisionnement TLS (voir « Activer
 *  le certificat HTTPS », étape 9 de l'assistant) et retourne "ssl_pending" ou
 *  "active" — jamais un état intermédiaire qui laisserait croire à un appelant qu'il
 *  doit lui-même déclencher une étape suivante séparée. */
export type DnsCheckOutcome =
  | "token_expired"
  | "pending_dns"
  | "verifying"
  | "ssl_pending"
  | "active"
  | "misconfigured"
  | "not_applicable"; // domaine REMOVED/SUSPENDED/ACTIVE-sans-changement.

export async function checkDomainDnsAndAdvance(
  tenantId: string,
  domainId: string,
  deps: DnsCheckDeps,
): Promise<DnsCheckOutcome> {
  const domain = await withTenant(tenantId, (tx) => getDomainForTenant(tx, tenantId, domainId));
  if (!domain) throw new Error(`checkDomainDnsAndAdvance : domaine "${domainId}" introuvable.`);
  if (domain.lifecycleStatus === "REMOVED" || domain.lifecycleStatus === "SUSPENDED") {
    return "not_applicable";
  }

  const expected = (domain.expectedDnsRecords ?? []) as unknown as ExpectedDnsRecord[];
  const { allMatched, records } = await checkExpectedDnsRecords(deps.dnsResolver, domain.domain, expected);
  await withTenant(tenantId, (tx) => recordDnsCheckAttempt(tx, tenantId, domainId, records));

  // --- Domaine déjà en service : ne surveille plus que la casse (misconfiguration). ---
  if (domain.lifecycleStatus === "ACTIVE") {
    if (!allMatched) {
      await withTenant(tenantId, (tx) => markMisconfigured(tx, tenantId, domainId));
      await notify(tenantId, domainId, "domain_misconfigured");
      return "misconfigured";
    }
    return "not_applicable";
  }

  // --- SSL en cours : re-tente le provisionnement (idempotent, voir la note de
  // `DomainProvider.provisionDomain` dans types.ts — pas de méthode "status" séparée). ---
  if (domain.lifecycleStatus === "SSL_PENDING") {
    const cert = await deps.domainProvider.provisionDomain(domain.domain);
    if (cert.sslStatus === "issued") {
      await withTenant(tenantId, (tx) => markActive(tx, tenantId, domainId));
      invalidateSiteCache(tenantId);
      await notify(tenantId, domainId, "https_enabled");
      return "active";
    }
    return "ssl_pending";
  }

  // --- Propriété pas encore confirmée : DRAFT/PENDING_DNS/VERIFYING/MISCONFIGURED. ---
  if (domain.verificationTokenExpiresAt && isVerificationTokenExpired(domain.verificationTokenExpiresAt)) {
    return "token_expired";
  }

  const verification = await deps.domainProvider.verifyDomain(domain.domain, domain.verificationToken ?? "");
  if (!verification.verified) {
    return allMatched ? "verifying" : "pending_dns";
  }

  await withTenant(tenantId, (tx) => markVerified(tx, tenantId, domainId));
  await notify(tenantId, domainId, "domain_verified");

  // Enchaîne immédiatement sur le provisionnement TLS — voir « Activer le
  // certificat HTTPS » (étape 9 de l'assistant), pas une étape séparée à déclencher
  // manuellement par le client.
  await withTenant(tenantId, (tx) => markSslPending(tx, tenantId, domainId));
  const cert = await deps.domainProvider.provisionDomain(domain.domain);
  if (cert.sslStatus === "issued") {
    await withTenant(tenantId, (tx) => markActive(tx, tenantId, domainId));
    invalidateSiteCache(tenantId);
    await notify(tenantId, domainId, "https_enabled");
    return "active";
  }
  return "ssl_pending";
}

async function notify(
  tenantId: string,
  domainId: string,
  templateType: "domain_verified" | "https_enabled" | "domain_misconfigured",
): Promise<void> {
  await withSuperAdminAccess((tx) =>
    writeAuditLog(tx, {
      tenantId,
      actorUserId: null,
      actorType: "system",
      action: `domain.${templateType}`,
      entityType: "Domain",
      entityId: domainId,
    }),
  );
  // Voir docs/13, « NOTIFICATIONS » — enqueue toujours (file déjà câblée, envoi réel
  // TODO Phase 2, même convention que le reste du projet, voir emailsWorker).
  await notificationsQueue.add(QUEUE_NAMES.notifications, {
    tenantId,
    channel: "internal",
    templateType,
    recipient: tenantId, // résolu au propriétaire par le worker de notification (TODO Phase 2).
    variables: { domainId },
  });
}
