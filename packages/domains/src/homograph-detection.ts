import { domainToUnicode } from "node:url";

/**
 * Détection (heuristique) d'un domaine « homographe » — voir docs/13, « SÉCURITÉ » :
 * « protection contre les homographes ». Un domaine visuellement trompeur mélange
 * généralement des caractères de plusieurs écritures Unicode DANS UN MÊME label
 * (ex. un "а" cyrillique remplaçant le "a" latin dans "аpple.com") — un label
 * n'utilisant qu'UNE seule écriture, même non-latine, n'est jamais un homographe en
 * lui-même (voir « domaine IDN » dans les tests obligatoires, qui doit rester
 * autorisé).
 *
 * Reste un signal d'AVERTISSEMENT, pas un blocage automatique définitif : voir
 * apps/web/lib/domains/custom-domain-pipeline.ts, qui l'utilise pour exiger une
 * confirmation explicite plutôt qu'un refus silencieux.
 */
const SCRIPT_PATTERNS: Record<string, RegExp> = {
  Latin: /\p{Script=Latin}/u,
  Cyrillic: /\p{Script=Cyrillic}/u,
  Greek: /\p{Script=Greek}/u,
  Armenian: /\p{Script=Armenian}/u,
};

function scriptsUsedIn(label: string): string[] {
  const used: string[] = [];
  for (const [script, pattern] of Object.entries(SCRIPT_PATTERNS)) {
    if (pattern.test(label)) used.push(script);
  }
  return used;
}

export interface HomographCheckResult {
  risky: boolean;
  reason?: string;
}

export function detectHomographRisk(asciiDomain: string): HomographCheckResult {
  const unicodeDomain = domainToUnicode(asciiDomain);
  const labels = unicodeDomain.split(".");

  for (const label of labels) {
    const scripts = scriptsUsedIn(label);
    if (scripts.length > 1) {
      return {
        risky: true,
        reason: `Le segment "${label}" mélange plusieurs écritures (${scripts.join(", ")}) — vérifiez qu'il n'imite pas un autre domaine.`,
      };
    }
  }

  return { risky: false };
}
