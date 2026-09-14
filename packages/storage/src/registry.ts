import { LocalStorageProvider, type LocalStorageProviderOptions } from "./local-provider";
import { R2StorageProvider, type R2StorageProviderOptions } from "./r2-provider";
import type { StorageProvider } from "./provider";

/**
 * Point de bascule UNIQUE entre les fournisseurs de stockage — voir docs/12 §12.2,
 * « un registre permettant de remplacer R2 ultérieurement ». Le reste de
 * l'application (routes d'import, médiathèque) importe TOUJOURS `getStorageProvider`,
 * jamais `LocalStorageProvider`/`R2StorageProvider` directement — un futur
 * remplacement de fournisseur (ou l'ajout d'un troisième, ex. S3 AWS pur) ne change
 * que ce fichier.
 */
export type StorageProviderKind = "local" | "r2";

export interface StorageRegistryConfig {
  kind: StorageProviderKind;
  local?: LocalStorageProviderOptions;
  r2?: R2StorageProviderOptions;
}

let cachedProvider: StorageProvider | undefined;
let cachedConfigKey: string | undefined;

function buildProvider(config: StorageRegistryConfig): StorageProvider {
  if (config.kind === "local") {
    if (!config.local) {
      throw new Error("getStorageProvider: configuration 'local' manquante.");
    }
    return new LocalStorageProvider(config.local);
  }
  if (!config.r2) {
    throw new Error("getStorageProvider: configuration 'r2' manquante.");
  }
  return new R2StorageProvider(config.r2);
}

/**
 * Retourne l'instance de fournisseur active, en la (re)construisant seulement si la
 * configuration a changé — évite de recréer un `S3Client` (coûteux) à chaque appel
 * dans un contexte serveur qui réutilise le même process (voir Next.js Route
 * Handlers). Le cache est volontairement en mémoire de PROCESSUS, jamais persisté :
 * un redéploiement/redémarrage repart toujours de la configuration fournie par
 * l'appelant (variables d'environnement), jamais d'un état figé.
 */
export function getStorageProvider(config: StorageRegistryConfig): StorageProvider {
  const configKey = JSON.stringify(config);
  if (!cachedProvider || cachedConfigKey !== configKey) {
    cachedProvider = buildProvider(config);
    cachedConfigKey = configKey;
  }
  return cachedProvider;
}

/** Réservé aux tests : force la reconstruction au prochain appel. */
export function resetStorageProviderCache(): void {
  cachedProvider = undefined;
  cachedConfigKey = undefined;
}
