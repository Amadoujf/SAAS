import { resolveTxt } from "node:dns/promises";
import { readdir, rm } from "node:fs/promises";
import path from "node:path";
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

  /**
   * BUG DE SÉCURITÉ corrigé le 18 septembre 2026 (trouvé en testant pour de vrai un
   * cycle activation -> suspension avec un VRAI binaire Caddy, voir la revue du même
   * jour) : passer `Domain.verified` à false bloque bien toute NOUVELLE émission via
   * `/api/domains/ask`, mais Caddy ne consulte `ask` QUE lors de l'émission ou du
   * renouvellement d'un certificat — jamais à chaque connexion. Un certificat déjà
   * émis et mis en cache continue donc de répondre en HTTPS, sans plus jamais
   * réinterroger `ask`, jusqu'à son renouvellement naturel (des mois plus tard avec un
   * VRAI émetteur ACME). Un domaine SUSPENDU restait donc accessible en HTTPS tant que
   * son certificat n'expirait pas — vérifié : `curl` réussit toujours après suspension
   * tant que ce correctif n'est pas appliqué.
   *
   * Caddy n'expose aucune API admin pour invalider un certificat on-demand précis
   * (confirmé en explorant l'API admin d'un vrai processus Caddy) : le seul mécanisme
   * réel est de supprimer les fichiers de certificat de son `FileStorage` sur disque —
   * ce qui exige que ce processus (`apps/web`) et Caddy partagent ce volume (voir
   * infra/docker-compose.yml, service `caddy`, volume `yamacommerce_caddy_data`).
   * `CADDY_CERT_STORAGE_PATH` DOIT pointer vers le même chemin que le `storage` de
   * Caddy (répertoire `data/caddy`, structure `certificates/<émetteur>/<domaine>/`).
   * Si cette variable est absente (ex. Caddy sur un autre hôte, sans volume partagé),
   * on l'assume PAS silencieusement corrigé : on log un avertissement explicite plutôt
   * que de prétendre avoir révoqué un certificat qu'on n'a pas pu atteindre.
   */
  async revokeDomain(domain: string): Promise<void> {
    const storagePath = process.env.CADDY_CERT_STORAGE_PATH;
    if (!storagePath) {
      // eslint-disable-next-line no-console
      console.warn(
        `CaddyDomainProvider.revokeDomain("${domain}") : CADDY_CERT_STORAGE_PATH n'est pas ` +
          "configuré — un certificat déjà émis pour ce domaine peut rester actif en HTTPS " +
          "jusqu'à son renouvellement naturel malgré la suspension/le retrait en base.",
      );
      return;
    }

    const certificatesDir = path.join(storagePath, "certificates");
    let issuerDirs: string[];
    try {
      issuerDirs = await readdir(certificatesDir);
    } catch {
      return; // Rien n'a encore été émis sur ce stockage — rien à révoquer.
    }

    await Promise.all(
      issuerDirs.map((issuerDir) =>
        rm(path.join(certificatesDir, issuerDir, domain), { recursive: true, force: true }),
      ),
    );
  }
}
