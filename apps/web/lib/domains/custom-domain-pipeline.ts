import "server-only";
import {
  createCustomDomain,
  getDomainForTenant,
  regenerateVerificationToken,
  removeDomain as removeDomainRegistry,
  setPrimaryDomain as setPrimaryDomainRegistry,
  withSuperAdminAccess,
  withTenant,
  writeAuditLog,
} from "@yamacommerce/database";
import {
  computeExpectedDnsRecords,
  computeVerificationTokenExpiry,
  detectHomographRisk,
  generateVerificationToken,
  isDomainAvailable,
  nextDnsCheckDelayMs,
  normalizeDomainName,
  validateDomainFormat,
} from "@yamacommerce/domains";
import type { DomainProvider } from "@yamacommerce/domains";
import { QUEUE_NAMES, domainDnsCheckQueue } from "@yamacommerce/queue";

/**
 * Domaine personnalisé déjà possédé par le client — voir docs/13, « PARCOURS 2 ».
 * Couvre les étapes 1 à 6 de l'assistant (saisie -> instructions DNS affichées) ; la
 * suite (détection, vérification, HTTPS) est dns-check-pipeline.ts.
 */
export type AddCustomDomainResult =
  | { outcome: "created"; domainId: string; domain: string; homographWarning?: string }
  | { outcome: "invalid"; issues: string[] }
  | { outcome: "taken" };

export interface AddCustomDomainInput {
  tenantId: string;
  actorUserId: string;
  rawDomain: string;
  /** Le client a explicitement confirmé malgré l'avertissement homographe (voir
   *  homograph-detection.ts) — sans confirmation, un domaine à risque est REFUSÉ,
   *  jamais silencieusement accepté ni silencieusement bloqué. */
  confirmHomographRisk?: boolean;
  dnsProvider?: string;
}

export async function addCustomDomain(input: AddCustomDomainInput): Promise<AddCustomDomainResult> {
  const normalized = normalizeDomainName(input.rawDomain);
  const format = validateDomainFormat(normalized);
  if (!format.valid) return { outcome: "invalid", issues: format.issues };

  const homograph = detectHomographRisk(normalized);
  if (homograph.risky && !input.confirmHomographRisk) {
    return { outcome: "invalid", issues: [`homograph_risk:${homograph.reason}`] };
  }

  const available = await isDomainAvailable(normalized);
  if (!available) return { outcome: "taken" };

  const token = generateVerificationToken();
  const expiresAt = computeVerificationTokenExpiry();
  const expectedDnsRecords = computeExpectedDnsRecords(normalized, token);

  try {
    const domain = await withTenant(input.tenantId, (tx) =>
      createCustomDomain(tx, input.tenantId, {
        domain: normalized,
        type: "custom",
        verificationToken: token,
        verificationTokenExpiresAt: expiresAt,
        expectedDnsRecords,
        dnsProvider: input.dnsProvider ?? "caddy",
      }),
    );
    await withSuperAdminAccess((tx) =>
      writeAuditLog(tx, {
        tenantId: input.tenantId,
        actorUserId: input.actorUserId,
        actorType: "owner",
        action: "domain.custom_domain_added",
        entityType: "Domain",
        entityId: domain.id,
        metadata: { domain: normalized, homographWarning: homograph.risky ? homograph.reason : null },
      }),
    );
    // Amorce la chaîne de détection DNS — voir dns-check-schedule.ts : la première
    // tentative attend un court délai, la propagation DNS n'étant jamais instantanée.
    await domainDnsCheckQueue.add(
      QUEUE_NAMES.domainDnsCheck,
      { tenantId: input.tenantId, domainId: domain.id, attempt: 1 },
      { delay: nextDnsCheckDelayMs(1), jobId: `${domain.id}-1` },
    );

    return {
      outcome: "created",
      domainId: domain.id,
      domain: normalized,
      homographWarning: homograph.risky ? homograph.reason : undefined,
    };
  } catch {
    return { outcome: "taken" }; // course entre deux créations simultanées.
  }
}

export type SetPrimaryDomainResult = { outcome: "primary_set" } | { outcome: "not_active" };

/** Change le domaine principal — voir docs/13, « SEO » : « Mettre à jour les URL
 *  canoniques »/« sitemap »/« robots »/« métadonnées sociales » sont TOUJOURS
 *  calculées dynamiquement à partir du Host résolu à la requête (voir
 *  lib/rendering/resolve-public-site.ts) — la SEULE action nécessaire ici est
 *  d'invalider le cache pour que le changement soit visible immédiatement, jamais
 *  une mise à jour de valeurs stockées séparément qui pourraient diverger. */
export async function setPrimaryDomain(
  tenantId: string,
  actorUserId: string,
  domainId: string,
  deps: { invalidateCache: (tenantId: string) => void },
): Promise<SetPrimaryDomainResult> {
  try {
    await withTenant(tenantId, (tx) => setPrimaryDomainRegistry(tx, tenantId, domainId));
  } catch {
    return { outcome: "not_active" };
  }

  await withSuperAdminAccess((tx) =>
    writeAuditLog(tx, {
      tenantId,
      actorUserId,
      actorType: "owner",
      action: "domain.set_primary",
      entityType: "Domain",
      entityId: domainId,
    }),
  );
  // Injecté plutôt qu'appelé directement — voir la note de `removeDomain` ci-dessous.
  deps.invalidateCache(tenantId);
  return { outcome: "primary_set" };
}

/**
 * `deps.domainProvider.revokeDomain` — voir docs/13, « SÉCURITÉ » (revue du 18
 * septembre 2026) : le statut `REMOVED` en base bloque déjà toute résolution
 * publique (voir @yamacommerce/domains `resolveActiveDomainByHost`), mais ne
 * touche à AUCUN état côté fournisseur réel (Caddy garde son certificat déjà
 * émis en cache tant qu'il n'est pas explicitement révoqué). Défense en
 * profondeur : révoque aussi côté fournisseur, jamais un simple changement de
 * statut en base seul.
 *
 * `deps.invalidateCache` — injecté plutôt qu'appelé directement (`invalidateSiteCache`,
 * voir cache.ts) : `revalidateTag` exige un contexte de requête/build Next.js réel et
 * lève une erreur (« static generation store missing ») en dehors — trouvé en
 * exécutant la suite de tests pour de vrai (revue du 18 septembre 2026), même pattern
 * que `PublishSiteDeps.invalidateCache` dans lib/publishing/publish-pipeline.ts. Les
 * VRAIS appelants (routes) passent toujours `invalidateSiteCache`.
 */
export async function removeDomain(
  tenantId: string,
  actorUserId: string,
  domainId: string,
  deps: { domainProvider: DomainProvider; invalidateCache: (tenantId: string) => void },
): Promise<void> {
  const domain = await withTenant(tenantId, (tx) => getDomainForTenant(tx, tenantId, domainId));
  await withTenant(tenantId, (tx) => removeDomainRegistry(tx, tenantId, domainId));
  if (domain) await deps.domainProvider.revokeDomain(domain.domain);
  await withSuperAdminAccess((tx) =>
    writeAuditLog(tx, {
      tenantId,
      actorUserId,
      actorType: "owner",
      action: "domain.removed",
      entityType: "Domain",
      entityId: domainId,
    }),
  );
  deps.invalidateCache(tenantId);
}

export async function regenerateDomainVerificationToken(
  tenantId: string,
  actorUserId: string,
  domainId: string,
): Promise<{ token: string; expiresAt: Date }> {
  const token = generateVerificationToken();
  const expiresAt = computeVerificationTokenExpiry();
  const domain = await withTenant(tenantId, (tx) => getDomainForTenant(tx, tenantId, domainId));
  if (!domain) throw new Error(`regenerateDomainVerificationToken : domaine "${domainId}" introuvable.`);
  const expectedDnsRecords = computeExpectedDnsRecords(domain.domain, token);
  await withTenant(tenantId, (tx) =>
    regenerateVerificationToken(tx, tenantId, domainId, token, expiresAt, expectedDnsRecords),
  );
  await withSuperAdminAccess((tx) =>
    writeAuditLog(tx, {
      tenantId,
      actorUserId,
      actorType: "owner",
      action: "domain.verification_token_regenerated",
      entityType: "Domain",
      entityId: domainId,
    }),
  );
  await domainDnsCheckQueue.add(
    QUEUE_NAMES.domainDnsCheck,
    { tenantId, domainId, attempt: 1 },
    { delay: nextDnsCheckDelayMs(1), jobId: `${domainId}-1-${Date.now()}` },
  );
  return { token, expiresAt };
}
