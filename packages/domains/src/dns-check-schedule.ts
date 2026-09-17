/**
 * Délai progressif entre deux tentatives de détection DNS — voir docs/13,
 * « DÉTECTION DNS » : « Utilise plusieurs tentatives », « Applique un délai
 * progressif », « Arrête les vérifications inutiles ». Module PUR : ne sait rien de
 * BullMQ ni de la base — juste "combien de temps attendre avant la tentative N+1",
 * et "faut-il seulement continuer".
 *
 * Croît rapidement au début (la propagation DNS est souvent quasi-immédiate) puis
 * ralentit (au-delà de quelques minutes, revérifier toutes les secondes n'apporte
 * plus rien et gaspille des ressources) — plafonne à 30 minutes.
 */
const DELAYS_MS = [30_000, 60_000, 120_000, 300_000, 600_000, 1_200_000];
const MAX_DELAY_MS = 1_800_000;

/** Au-delà de cette tentative, la chaîne rapide s'arrête : le domaine bascule sur le
 *  balayage périodique lent (`listDomainsNeedingRecheck`, @yamacommerce/database)
 *  plutôt que de continuer à réessayer en boucle serrée indéfiniment. */
export const MAX_QUICK_ATTEMPTS = 8;

export function nextDnsCheckDelayMs(attempt: number): number {
  return DELAYS_MS[attempt - 1] ?? MAX_DELAY_MS;
}

export function shouldContinueQuickRetries(attempt: number): boolean {
  return attempt < MAX_QUICK_ATTEMPTS;
}
