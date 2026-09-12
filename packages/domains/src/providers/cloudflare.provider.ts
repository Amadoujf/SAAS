import type { DomainProvider, DomainProvisioningResult, DomainVerificationResult } from "../types";

/**
 * Fournisseur de bascule pour un volume de tenants plus important — voir ajustement #5.
 * Non implémenté en Phase 0 : présent pour matérialiser le point d'extension de
 * `DomainProvider` sans exiger de compte Cloudflare dès le départ. À implémenter en
 * Phase 3 (voir docs/09-plan-developpement.md) avec l'API "Cloudflare for SaaS —
 * Custom Hostnames".
 */
export class CloudflareCustomHostnameProvider implements DomainProvider {
  readonly name = "cloudflare_custom_hostname" as const;

  async verifyDomain(_domain: string, _expectedToken: string): Promise<DomainVerificationResult> {
    throw new Error(
      "CloudflareCustomHostnameProvider n'est pas encore implémenté — voir docs/09-plan-developpement.md, Phase 3.",
    );
  }

  async provisionDomain(_domain: string): Promise<DomainProvisioningResult> {
    throw new Error(
      "CloudflareCustomHostnameProvider n'est pas encore implémenté — voir docs/09-plan-developpement.md, Phase 3.",
    );
  }

  async revokeDomain(_domain: string): Promise<void> {
    throw new Error(
      "CloudflareCustomHostnameProvider n'est pas encore implémenté — voir docs/09-plan-developpement.md, Phase 3.",
    );
  }
}
