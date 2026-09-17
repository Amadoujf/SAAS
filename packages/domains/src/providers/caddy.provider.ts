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

  /**
   * Avec Caddy en on-demand TLS, il n'existe pas d'API de statut de certificat
   * interrogeable (voir infra/Caddyfile) : le certificat est émis automatiquement
   * au premier appel HTTPS reçu pour un domaine autorisé (via `/api/domains/ask`).
   * Cette méthode EST donc à la fois le déclenchement ET la vérification : une
   * requête HTTPS réelle envers le domaine sert de sonde — si elle aboutit
   * (poignée de main TLS réussie, quel que soit le code HTTP retourné), le
   * certificat est RÉELLEMENT émis et fonctionnel ; sinon, "pending" (voir
   * « Ne jamais afficher un domaine comme actif avant que le HTTPS fonctionne
   * réellement »). Rappelée à chaque tentative par le worker de détection tant que
   * le statut reste "pending" — chaque appel a une chance de déclencher l'émission
   * ET de la constater.
   */
  async provisionDomain(domain: string): Promise<DomainProvisioningResult> {
    try {
      await fetch(`https://${domain}`, { method: "HEAD", signal: AbortSignal.timeout(5000) });
      return { sslStatus: "issued" };
    } catch {
      return { sslStatus: "pending" };
    }
  }

  async revokeDomain(_domain: string): Promise<void> {
    // La révocation se traduit par le passage de `Domain.verified` à false : l'endpoint
    // `/api/domains/ask` refusera alors tout nouveau renouvellement de certificat.
  }
}
