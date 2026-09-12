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
  readonly name: "caddy" | "cloudflare_custom_hostname";

  /** Vérifie que le domaine pointe bien vers la plateforme (DNS TXT ou CNAME attendu). */
  verifyDomain(domain: string, expectedToken: string): Promise<DomainVerificationResult>;

  /** Déclenche le provisionnement TLS pour un domaine déjà vérifié. */
  provisionDomain(domain: string): Promise<DomainProvisioningResult>;

  /** Retire un domaine (tenant supprimé/désactivé). */
  revokeDomain(domain: string): Promise<void>;
}
