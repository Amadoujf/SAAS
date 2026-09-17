import "server-only";
import { createFreeSubdomain, withSuperAdminAccess, withTenant, writeAuditLog } from "@yamacommerce/database";
import {
  generateSubdomainAlternatives,
  isDomainAvailable,
  normalizeSubdomain,
  suggestSubdomainFromName,
  validateSubdomainFormat,
} from "@yamacommerce/domains";

/**
 * Sous-domaine gratuit — voir docs/13, « PARCOURS 1 ». Composé de règles pures
 * (@yamacommerce/domains) + de la vérification d'unicité globale (nécessairement
 * impure, voir `isDomainAvailable`) + de la persistance (@yamacommerce/database).
 */
export function platformSubdomainSuffix(): string {
  return process.env.PLATFORM_SUBDOMAIN_SUFFIX ?? "yamacommerce.ai";
}

export interface SubdomainSuggestion {
  subdomain: string;
  fullDomain: string;
  available: boolean;
}

/** Propose le sous-domaine dérivé du nom de l'entreprise, PUIS des alternatives si
 *  indisponible — voir « Rechercher sa disponibilité », « Choisir une autre
 *  proposition ». Vérifie réellement l'unicité globale pour chaque candidat, jamais
 *  seulement leur format. */
export async function suggestAvailableSubdomains(
  companyName: string,
  count = 4,
): Promise<SubdomainSuggestion[]> {
  const suffix = platformSubdomainSuffix();
  const base = suggestSubdomainFromName(companyName);
  const candidates = [base, ...generateSubdomainAlternatives(base, count - 1)];

  const suggestions: SubdomainSuggestion[] = [];
  for (const candidate of candidates) {
    const fullDomain = `${candidate}.${suffix}`;
    suggestions.push({ subdomain: candidate, fullDomain, available: await isDomainAvailable(fullDomain) });
  }
  return suggestions;
}

export type SubdomainAvailabilityCheck =
  | { status: "available"; fullDomain: string }
  | { status: "invalid"; issues: string[] }
  | { status: "taken" };

/** Vérifie un sous-domaine choisi/modifié PAR le client — voir « Modifier le
 *  sous-domaine avant publication ». Normalise AVANT de valider (voir « Normalisation
 *  avant vérification »). */
export async function checkSubdomainAvailability(rawInput: string): Promise<SubdomainAvailabilityCheck> {
  const normalized = normalizeSubdomain(rawInput);
  const format = validateSubdomainFormat(normalized);
  if (!format.valid) return { status: "invalid", issues: format.issues };

  const fullDomain = `${normalized}.${platformSubdomainSuffix()}`;
  const available = await isDomainAvailable(fullDomain);
  return available ? { status: "available", fullDomain } : { status: "taken" };
}

export interface ClaimSubdomainInput {
  tenantId: string;
  actorUserId: string;
  rawSubdomain: string;
}

export type ClaimSubdomainResult =
  | { outcome: "claimed"; fullDomain: string }
  | { outcome: "invalid"; issues: string[] }
  | { outcome: "taken" };

export async function claimFreeSubdomain(input: ClaimSubdomainInput): Promise<ClaimSubdomainResult> {
  const check = await checkSubdomainAvailability(input.rawSubdomain);
  if (check.status === "invalid") return { outcome: "invalid", issues: check.issues };
  if (check.status === "taken") return { outcome: "taken" };

  try {
    const domain = await withTenant(input.tenantId, (tx) =>
      createFreeSubdomain(tx, input.tenantId, check.fullDomain, "caddy"),
    );
    await withSuperAdminAccess((tx) =>
      writeAuditLog(tx, {
        tenantId: input.tenantId,
        actorUserId: input.actorUserId,
        actorType: "owner",
        action: "domain.subdomain_claimed",
        entityType: "Domain",
        entityId: domain.id,
        metadata: { domain: domain.domain },
      }),
    );
    return { outcome: "claimed", fullDomain: domain.domain };
  } catch {
    // Course entre deux créations simultanées — la contrainte SQL a tranché.
    return { outcome: "taken" };
  }
}
