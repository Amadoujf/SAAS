import "server-only";
import path from "node:path";
import { getStorageProvider, type StorageRegistryConfig } from "@yamacommerce/storage";

/**
 * Résolution de la configuration de stockage — voir docs/12 §12.2, « médiathèque R2 »
 * (21 septembre 2026). Point UNIQUE qui lit les variables d'environnement ; tout le
 * reste de l'application appelle `storageProvider()`, jamais `getStorageProvider`
 * directement (voir « un registre permettant de remplacer R2 ultérieurement »).
 *
 * Par défaut (aucune variable `STORAGE_PROVIDER=r2`), utilise l'adaptateur LOCAL —
 * comme le reste du projet ("everything demoable without external infra"), le
 * développement et les tests n'ont jamais besoin d'un vrai compte Cloudflare.
 */
export function resolveStorageConfig(): StorageRegistryConfig {
  if (process.env.STORAGE_PROVIDER === "r2") {
    const accountId = process.env.R2_ACCOUNT_ID;
    const bucket = process.env.R2_BUCKET;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
    if (!accountId || !bucket || !accessKeyId || !secretAccessKey) {
      throw new Error(
        "STORAGE_PROVIDER=r2 mais R2_ACCOUNT_ID/R2_BUCKET/R2_ACCESS_KEY_ID/R2_SECRET_ACCESS_KEY manquent.",
      );
    }
    return {
      kind: "r2",
      r2: {
        accountId,
        bucket,
        accessKeyId,
        secretAccessKey,
        publicCdnBaseUrl: process.env.R2_PUBLIC_CDN_BASE_URL,
      },
    };
  }

  return {
    kind: "local",
    local: {
      rootDir: process.env.LOCAL_STORAGE_ROOT_DIR ?? path.join(process.cwd(), ".local-storage"),
      uploadBaseUrl: "/api/media/local-upload",
      downloadBaseUrl: "/api/media/local-serve",
      // Secret de développement uniquement — voir README pour la variable réelle en
      // production (jamais utilisée quand STORAGE_PROVIDER=r2, l'adaptateur local ne
      // tournant jamais en production).
      signingSecret: process.env.LOCAL_STORAGE_SIGNING_SECRET ?? "dev-only-insecure-secret",
    },
  };
}

export function storageProvider() {
  return getStorageProvider(resolveStorageConfig());
}

/** Base absolue de l'application — nécessaire pour que le SERVEUR lui-même appelle
 *  ses propres routes d'upload local (voir upload-pipeline.ts,
 *  `uploadServerGeneratedAsset` : les variantes sont générées côté serveur, jamais
 *  par le navigateur, mais empruntent le MÊME chemin `createUpload` + PUT que
 *  n'importe quel autre import). */
export function appBaseUrl(): string {
  return process.env.APP_BASE_URL ?? "http://localhost:3000";
}
