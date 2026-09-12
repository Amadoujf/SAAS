import { resolveTxt } from "node:dns/promises";
import type { DomainProvider, DomainProvisioningResult, DomainVerificationResult } from "../types";

/**
 * Fournisseur de domaine basé sur Caddy (on-demand TLS) — voir infra/Caddyfile.
 *
 * Caddy est configuré en "on-demand TLS" avec une directive `ask` qui interroge
 * `apps/web` (`/api/domains/ask`) pour savoir si un domaine est autorisé avant
 * d'émettre un certificat. Ce provider ne pilote donc pas directement Caddy : il
 * vérifie le domaine côté DNS et laisse la table `Domain` (verified = true) faire
 * office de source de vérité que l'endpoint `/api/domains/ask` consulte.
 */
export class CaddyDomainProvider implements DomainProvider {
  readonly name = "caddy" as const;

  async verifyDomain(domain: string, expectedToken: string): Promise<DomainVerificationResult> {
    try {
      const records = await resolveTxt(`_yamacommerce-verification.${domain}`);
      const found = records.flat().some((value) => value.trim() === expectedToken);
      return found
        ? { verified: true }
        : {
            verified: false,
            reason: "Enregistrement TXT de vérification introuvable ou incorrect.",
          };
    } catch (error) {
      return {
        verified: false,
        reason: `Résolution DNS impossible : ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  async provisionDomain(_domain: string): Promise<DomainProvisioningResult> {
    // Avec Caddy en on-demand TLS, le certificat est émis automatiquement au premier
    // appel HTTPS reçu pour un domaine autorisé (via /api/domains/ask) — rien à
    // déclencher explicitement ici.
    return { sslStatus: "pending" };
  }

  async revokeDomain(_domain: string): Promise<void> {
    // La révocation se traduit par le passage de `Domain.verified` à false : l'endpoint
    // `/api/domains/ask` refusera alors tout nouveau renouvellement de certificat.
  }
}
