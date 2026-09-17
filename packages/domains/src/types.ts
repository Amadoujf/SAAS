/**
 * Abstraction du fournisseur de domaine — ajustement obligatoire #5 de la Phase 0.
 *
 * Caddy (on-demand TLS) est utilisé en développement et pour les premiers déploiements ;
 * l'objectif de cette interface est de pouvoir migrer vers Cloudflare Custom Hostnames
 * si le volume de domaines personnalisés augmente, SANS changer le code appelant
 * (middleware de résolution de tenant, page Super Admin "Domaines").
 */
export interface DomainVerificationResult {
  verified: boolean;
  reason?: string;
}

export interface DomainProvisioningResult {
  sslStatus: "pending" | "issued" | "failed";
  providerRef?: string; // ex. cloudflareHostnameId
}

export interface DomainProvider {
  readonly name: "caddy" | "cloudflare_custom_hostname" | "local";

  /** Vérifie que le domaine pointe bien vers la plateforme (DNS TXT ou CNAME attendu). */
  verifyDomain(domain: string, expectedToken: string): Promise<DomainVerificationResult>;

  /**
   * Déclenche (ou vérifie l'avancement d')un provisionnement TLS pour un domaine
   * déjà vérifié — voir docs/13, « HTTPS » : « Demande de certificat », « Statut du
   * certificat ». DOIT être IDEMPOTENT et RAPPELABLE PLUSIEURS FOIS : le worker de
   * détection (voir apps/web/lib/domains/dns-check-pipeline.ts) l'appelle à chaque
   * tentative tant que le statut reste "pending", jusqu'à "issued" ou "failed" — une
   * seule et même méthode sert donc à la fois de déclenchement ET de scrutation
   * (pas de méthode `getCertificateStatus` séparée : pour Caddy en particulier, il
   * n'existe pas d'état "déclenché mais pas encore vérifié" distinct — chaque appel
   * EST la vérification, voir CaddyDomainProvider).
   */
  provisionDomain(domain: string): Promise<DomainProvisioningResult>;

  /** Retire un domaine (tenant supprimé/désactivé). */
  revokeDomain(domain: string): Promise<void>;
}
