import { isReservedSubdomain } from "./reserved-subdomains";

/**
 * Validation du sous-domaine gratuit — voir docs/13, « PARCOURS 1 ». Module PUR :
 * aucune vérification d'unicité en base ici (voir apps/web/lib/domains/subdomain-
 * pipeline.ts) — uniquement la FORME, qui ne dépend d'aucune donnée externe.
 */
export const SUBDOMAIN_MIN_LENGTH = 3;
export const SUBDOMAIN_MAX_LENGTH = 63; // limite DNS standard d'un label.

/** Normalise AVANT toute vérification — voir « Normalisation avant vérification » :
 *  minuscules, espaces/underscores convertis en tiret, caractères hors
 *  [a-z0-9-] retirés. Ne garantit pas un résultat valide (voir
 *  `validateSubdomainFormat`), seulement une forme canonique comparable. */
export function normalizeSubdomain(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // retire les accents (é -> e).
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

export type SubdomainIssueCode =
  | "too_short"
  | "too_long"
  | "invalid_characters"
  | "leading_or_trailing_hyphen"
  | "reserved";

export interface SubdomainValidationResult {
  valid: boolean;
  issues: SubdomainIssueCode[];
}

/**
 * Valide un sous-domaine DÉJÀ normalisé (voir `normalizeSubdomain`) — voir
 * « Règles » : minuscules uniquement, lettres/chiffres/tirets, aucun espace, aucun
 * tiret au début ou à la fin, longueur min/max, termes réservés.
 */
export function validateSubdomainFormat(candidate: string): SubdomainValidationResult {
  const issues: SubdomainIssueCode[] = [];

  if (!/^[a-z0-9-]*$/.test(candidate)) {
    issues.push("invalid_characters");
  }
  if (candidate.startsWith("-") || candidate.endsWith("-")) {
    issues.push("leading_or_trailing_hyphen");
  }
  if (candidate.length < SUBDOMAIN_MIN_LENGTH) {
    issues.push("too_short");
  }
  if (candidate.length > SUBDOMAIN_MAX_LENGTH) {
    issues.push("too_long");
  }
  if (isReservedSubdomain(candidate)) {
    issues.push("reserved");
  }

  return { valid: issues.length === 0, issues };
}

/** Propose un sous-domaine de départ à partir du nom de l'entreprise — voir
 *  « proposer automatiquement un sous-domaine ». Ne garantit PAS la disponibilité
 *  (voir apps/web/lib/domains/subdomain-pipeline.ts, qui vérifie l'unicité en base). */
export function suggestSubdomainFromName(companyName: string): string {
  const normalized = normalizeSubdomain(companyName);
  if (normalized.length >= SUBDOMAIN_MIN_LENGTH) return normalized.slice(0, SUBDOMAIN_MAX_LENGTH);
  return `boutique-${normalized}`.slice(0, SUBDOMAIN_MAX_LENGTH);
}

/** Variantes suggérées quand le premier choix est indisponible — un simple suffixe
 *  numérique reste le plus prévisible/compréhensible pour un commerçant. */
export function generateSubdomainAlternatives(base: string, count = 3): string[] {
  const alternatives: string[] = [];
  for (let i = 2; alternatives.length < count; i += 1) {
    const suffix = `-${i}`;
    const truncatedBase = base.slice(0, SUBDOMAIN_MAX_LENGTH - suffix.length);
    alternatives.push(`${truncatedBase}${suffix}`);
  }
  return alternatives;
}
