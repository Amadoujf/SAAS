/**
 * Interface générique de fournisseur de stockage — voir docs/12 §12.2, « médiathèque
 * R2 » (21 septembre 2026), « Ne lie pas directement les composants React au SDK
 * Cloudflare. ». Toute l'application (routes d'import, médiathèque, éditeur) parle
 * UNIQUEMENT à `StorageProvider` ; jamais à `@aws-sdk/client-s3` ni à un chemin de
 * fichier local directement — voir `R2StorageProvider`/`LocalStorageProvider` pour les
 * deux implémentations, et `registry.ts` pour le point de bascule entre elles.
 *
 * CHAQUE méthode prend `tenantId` en premier argument et une clé de stockage (le cas
 * échéant) : les DEUX implémentations DOIVENT appeler `assertOwnedKey`/`buildStorageKey`
 * (voir storage-key.ts) avant toute opération réelle — c'est ce qui garantit qu'aucun
 * appelant, même en cas de bug plus haut dans la pile, ne peut jamais lire/remplacer/
 * supprimer/signer une URL pour la clé d'un AUTRE tenant (voir « ISOLATION »).
 */

export interface CreateUploadInput {
  tenantId: string;
  /** Segments de clé SOUS le préfixe du tenant (ex. ["originals", "<uuid>.jpg"]) —
   *  voir `buildStorageKey`. Fournis par l'appelant (upload-pipeline.ts), jamais
   *  dérivés du nom de fichier original tel quel (voir « déduire les noms ou chemins
   *  internes »). */
  keySegments: string[];
  contentType: string;
  /** Utilisé par les fournisseurs qui en ont besoin pour la signature (R2/S3) —
   *  purement informatif pour l'adaptateur local. */
  expectedSizeBytes?: number;
  expiresInSeconds?: number;
}

export interface CreateUploadResult {
  storageKey: string;
  /** URL vers laquelle le NAVIGATEUR envoie directement le fichier (PUT) — voir
   *  « Utilise des URL pré-signées afin que les fichiers soient envoyés directement
   *  vers R2. ». Pour l'adaptateur local (dev/tests), une route interne de l'app
   *  jouant exactement le même rôle, avec la même sémantique PUT. */
  uploadUrl: string;
  uploadMethod: "PUT";
  headers?: Record<string, string>;
  expiresAt: Date;
}

export interface CompleteUploadInput {
  tenantId: string;
  storageKey: string;
}

export interface CompleteUploadResult {
  sizeBytes: number;
  etag: string;
}

export interface AssetMetadata {
  storageKey: string;
  sizeBytes: number;
  contentType: string;
  etag: string;
  lastModified: Date;
}

export interface GetAssetResult {
  metadata: AssetMetadata;
  body: Uint8Array;
}

export interface ListAssetsInput {
  tenantId: string;
  /** Sous-préfixe RELATIF au préfixe du tenant (ex. "originals/") — jamais un chemin
   *  absolu ou celui d'un autre tenant. */
  prefix?: string;
  cursor?: string;
  limit?: number;
}

export interface ListAssetsResult {
  items: AssetMetadata[];
  nextCursor?: string;
}

export interface CreateSignedUrlInput {
  tenantId: string;
  storageKey: string;
  expiresInSeconds: number;
  /** `Content-Disposition` suggéré pour un téléchargement (voir « Téléchargement »). */
  downloadFileName?: string;
}

export interface CopyAssetInput {
  tenantId: string;
  sourceKey: string;
  destinationKeySegments: string[];
}

export interface UsageResult {
  totalBytes: number;
  objectCount: number;
}

/**
 * Contrat générique implémenté par chaque fournisseur de stockage. Voir la
 * documentation de chaque méthode dans les implémentations (local-provider.ts,
 * r2-provider.ts) pour le détail des garanties d'isolation.
 */
export interface StorageProvider {
  createUpload(input: CreateUploadInput): Promise<CreateUploadResult>;
  completeUpload(input: CompleteUploadInput): Promise<CompleteUploadResult>;
  getAsset(tenantId: string, storageKey: string): Promise<GetAssetResult>;
  listAssets(input: ListAssetsInput): Promise<ListAssetsResult>;
  deleteAsset(tenantId: string, storageKey: string): Promise<void>;
  createSignedUrl(input: CreateSignedUrlInput): Promise<string>;
  copyAsset(input: CopyAssetInput): Promise<string>;
  getUsage(tenantId: string): Promise<UsageResult>;
}
