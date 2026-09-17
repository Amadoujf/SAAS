import { domainToASCII, domainToUnicode } from "node:url";
import { isIP } from "node:net";

/**
 * Validation d'un domaine personnalisé DÉJÀ POSSÉDÉ par le client — voir docs/13,
 * « PARCOURS 2 » et « SÉCURITÉ ». Module PUR : ne résout jamais le DNS ici (voir
 * apps/web/lib/domains/dns-check.ts pour la détection réelle) — uniquement la forme
 * et les cas structurellement invalides/dangereux (IP, localhost, TLD réservée).
 */

/** RFC 2606 + quelques usages internes courants — jamais des domaines publics
 *  routables, quel que soit leur DNS apparent. */
const BLOCKED_TLDS = new Set(["test", "example", "invalid", "localhost", "local", "internal"]);

/**
 * Normalise une entrée utilisateur AVANT toute vérification — voir « Normalisation
 * avant vérification » : retire un éventuel schéma/chemin collé par erreur (copier-
 * coller d'une URL complète), minuscules, et encode en Punycode (ASCII) via l'API
 * `URL` native de Node — jamais une implémentation maison de l'IDN.
 */
export function normalizeDomainName(input: string): string {
  let value = input.trim().toLowerCase();
  value = value.replace(/^[a-z]+:\/\//, ""); // retire un schéma éventuel (http://, https://).
  value = value.split("/")[0]!; // retire un chemin/query éventuel.
  value = value.replace(/\.$/, ""); // retire un point final (FQDN).
  return domainToASCII(value);
}

/** Forme lisible pour l'affichage (ex. un domaine IDN reste lisible dans sa langue
 *  d'origine à l'écran, jamais son Punycode brut) — jamais utilisée pour comparaison
 *  ou stockage, uniquement pour l'UI. */
export function toDisplayDomainName(asciiDomain: string): string {
  return domainToUnicode(asciiDomain);
}

export function isApexDomain(domain: string): boolean {
  return domain.split(".").length <= 2;
}

export type DomainIssueCode =
  | "empty"
  | "invalid_format"
  | "is_ip_address"
  | "is_localhost_or_internal"
  | "blocked_tld"
  | "too_long";

export interface DomainValidationResult {
  valid: boolean;
  issues: DomainIssueCode[];
}

const LABEL_PATTERN = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;

/**
 * Valide un domaine DÉJÀ normalisé (voir `normalizeDomainName`, donc déjà en
 * Punycode ASCII) — voir « Validation stricte des domaines », « Blocage des IP,
 * localhost et domaines internes », « Protection SSRF » : un domaine qui n'est
 * structurellement PAS un nom d'hôte public routable est rejeté ici, avant même
 * toute tentative de résolution DNS réelle (qui pourrait sinon être détournée pour
 * sonder un réseau interne — voir le worker de vérification DNS).
 */
export function validateDomainFormat(domain: string): DomainValidationResult {
  const issues: DomainIssueCode[] = [];

  if (!domain) {
    return { valid: false, issues: ["empty"] };
  }
  if (domain.length > 253) {
    issues.push("too_long");
  }
  if (isIP(domain) !== 0) {
    issues.push("is_ip_address");
  }

  const labels = domain.split(".");
  const looksWellFormed = labels.length >= 2 && labels.every((label) => LABEL_PATTERN.test(label));
  if (!looksWellFormed) {
    issues.push("invalid_format");
  }

  const tld = labels[labels.length - 1];
  if (domain === "localhost" || labels.includes("local") || labels.includes("internal")) {
    issues.push("is_localhost_or_internal");
  } else if (tld && BLOCKED_TLDS.has(tld)) {
    issues.push("blocked_tld");
  }

  return { valid: issues.length === 0, issues };
}
