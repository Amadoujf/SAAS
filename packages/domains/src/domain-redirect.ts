/**
 * Redirections entre domaines d'UN MÊME tenant — voir docs/13, « DOMAINES
 * PRINCIPAUX ET REDIRECTIONS ».
 *
 * Décision d'architecture : toute redirection pointe TOUJOURS directement vers le
 * domaine PRINCIPAL du tenant — jamais vers un autre domaine secondaire, jamais de
 * chaîne à plusieurs sauts. Ceci élimine STRUCTURELLEMENT toute possibilité de boucle
 * de redirection (voir « Éviter les boucles de redirection ») : avec un seul saut
 * possible et une seule destination (le principal, qui ne redirige jamais lui-même),
 * un cycle est mathématiquement impossible, plutôt que simplement "évité" par une
 * vérification au cas par cas.
 *
 * `serveDirectlyWhenNotPrimary` (voir `Domain` dans @yamacommerce/database) est
 * l'unique exception : posé sur le sous-domaine gratuit pour qu'il « reste toujours
 * fonctionnel en secours » même après connexion d'un domaine personnalisé — il sert
 * alors son propre contenu au lieu de rediriger.
 */
export interface RedirectableDomain {
  id: string;
  domain: string;
  isPrimary: boolean;
  isLive: boolean; // lifecycleStatus === "ACTIVE" — jamais de redirection vers/depuis un domaine pas encore en service.
  serveDirectlyWhenNotPrimary: boolean;
}

export type DomainServeDecision =
  | { action: "serve" }
  | { action: "redirect"; targetDomain: string };

/**
 * Décide, pour UN domaine résolu par hôte, s'il doit servir son contenu directement
 * ou rediriger vers le domaine principal du tenant.
 */
export function resolveDomainServeDecision(
  current: RedirectableDomain,
  allTenantDomains: RedirectableDomain[],
): DomainServeDecision {
  if (current.isPrimary) return { action: "serve" };

  const primary = allTenantDomains.find((d) => d.isPrimary && d.isLive);
  if (!primary || primary.id === current.id) return { action: "serve" }; // pas encore de principal actif : sert directement.
  if (current.serveDirectlyWhenNotPrimary) return { action: "serve" };

  return { action: "redirect", targetDomain: primary.domain };
}
