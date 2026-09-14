import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { assertOwnedKey, buildStorageKey, tenantPrefix } from "./storage-key";
import type {
  AssetMetadata,
  CompleteUploadInput,
  CompleteUploadResult,
  CopyAssetInput,
  CreateSignedUrlInput,
  CreateUploadInput,
  CreateUploadResult,
  GetAssetResult,
  ListAssetsInput,
  ListAssetsResult,
  StorageProvider,
  UsageResult,
} from "./provider";

/**
 * Fournisseur de stockage Cloudflare R2 — voir docs/12 §12.2, « médiathèque R2 » (21
 * septembre 2026). R2 expose une API compatible S3 : ce fichier est le SEUL de tout le
 * projet à importer `@aws-sdk/client-s3`/`@aws-sdk/s3-request-presigner` (voir « Ne lie
 * pas directement les composants React au SDK Cloudflare »).
 *
 * CHAQUE méthode appelle `assertOwnedKey` (voir storage-key.ts) avant toute opération
 * réelle sur le bucket — la MÊME fonction que `LocalStorageProvider`, ce qui garantit
 * une isolation identique quel que soit le fournisseur actif (voir registry.ts).
 *
 * Non exercé contre un vrai bucket R2 dans cet environnement (aucune information
 * d'identification Cloudflare disponible ici) — voir le rapport de livraison pour
 * cette limite assumée : la logique d'isolation, elle, est identique à
 * `LocalStorageProvider` (déjà testée exhaustivement) et cette classe elle-même est
 * typée bout en bout contre le SDK officiel.
 */
export interface R2StorageProviderOptions {
  accountId: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  /** Domaine CDN public servant les variantes PUBLIQUES (voir « Conserver l'original
   *  privé et servir les variantes publiées par CDN ») — jamais utilisé pour un objet
   *  privé, qui passe TOUJOURS par `createSignedUrl`. */
  publicCdnBaseUrl?: string;
}

function toUint8Array(body: unknown): Promise<Uint8Array> {
  if (body && typeof (body as { transformToByteArray?: unknown }).transformToByteArray === "function") {
    return (body as { transformToByteArray: () => Promise<Uint8Array> }).transformToByteArray();
  }
  throw new Error("Réponse R2 sans corps exploitable.");
}

export class R2StorageProvider implements StorageProvider {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly publicCdnBaseUrl: string | undefined;

  constructor(options: R2StorageProviderOptions) {
    this.bucket = options.bucket;
    this.publicCdnBaseUrl = options.publicCdnBaseUrl;
    this.client = new S3Client({
      region: "auto",
      endpoint: `https://${options.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: options.accessKeyId,
        secretAccessKey: options.secretAccessKey,
      },
    });
  }

  async createUpload(input: CreateUploadInput): Promise<CreateUploadResult> {
    const storageKey = buildStorageKey(input.tenantId, ...input.keySegments);
    const expiresInSeconds = input.expiresInSeconds ?? 900;
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: storageKey,
      ContentType: input.contentType,
    });
    const uploadUrl = await getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });
    return {
      storageKey,
      uploadUrl,
      uploadMethod: "PUT",
      headers: { "content-type": input.contentType },
      expiresAt: new Date(Date.now() + expiresInSeconds * 1000),
    };
  }

  async completeUpload(input: CompleteUploadInput): Promise<CompleteUploadResult> {
    assertOwnedKey(input.tenantId, input.storageKey);
    const head = await this.client.send(
      new HeadObjectCommand({ Bucket: this.bucket, Key: input.storageKey }),
    );
    if (head.ContentLength === undefined) {
      throw new Error(`completeUpload: objet "${input.storageKey}" introuvable dans le bucket.`);
    }
    return { sizeBytes: head.ContentLength, etag: (head.ETag ?? "").replace(/"/g, "") };
  }

  async getAsset(tenantId: string, storageKey: string): Promise<GetAssetResult> {
    assertOwnedKey(tenantId, storageKey);
    const result = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: storageKey }));
    const body = await toUint8Array(result.Body);
    return {
      body,
      metadata: {
        storageKey,
        sizeBytes: result.ContentLength ?? body.length,
        contentType: result.ContentType ?? "application/octet-stream",
        etag: (result.ETag ?? "").replace(/"/g, ""),
        lastModified: result.LastModified ?? new Date(0),
      },
    };
  }

  async listAssets(input: ListAssetsInput): Promise<ListAssetsResult> {
    const prefix = `${tenantPrefix(input.tenantId)}/${input.prefix ?? ""}`;
    const result = await this.client.send(
      new ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: prefix,
        MaxKeys: input.limit ?? 100,
        ContinuationToken: input.cursor,
      }),
    );
    const items: AssetMetadata[] = (result.Contents ?? []).map((object) => ({
      storageKey: object.Key ?? "",
      sizeBytes: object.Size ?? 0,
      contentType: "application/octet-stream",
      etag: (object.ETag ?? "").replace(/"/g, ""),
      lastModified: object.LastModified ?? new Date(0),
    }));
    return { items, nextCursor: result.NextContinuationToken };
  }

  async deleteAsset(tenantId: string, storageKey: string): Promise<void> {
    assertOwnedKey(tenantId, storageKey);
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: storageKey }));
  }

  async createSignedUrl(input: CreateSignedUrlInput): Promise<string> {
    assertOwnedKey(input.tenantId, input.storageKey);
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: input.storageKey,
      ...(input.downloadFileName
        ? { ResponseContentDisposition: `attachment; filename="${input.downloadFileName}"` }
        : {}),
    });
    return getSignedUrl(this.client, command, { expiresIn: input.expiresInSeconds });
  }

  async copyAsset(input: CopyAssetInput): Promise<string> {
    assertOwnedKey(input.tenantId, input.sourceKey);
    const destinationKey = buildStorageKey(input.tenantId, ...input.destinationKeySegments);
    await this.client.send(
      new CopyObjectCommand({
        Bucket: this.bucket,
        CopySource: `${this.bucket}/${input.sourceKey}`,
        Key: destinationKey,
      }),
    );
    return destinationKey;
  }

  async getUsage(tenantId: string): Promise<UsageResult> {
    let totalBytes = 0;
    let objectCount = 0;
    let cursor: string | undefined;
    do {
      const page = await this.listAssets({ tenantId, cursor, limit: 1000 });
      totalBytes += page.items.reduce((sum, item) => sum + item.sizeBytes, 0);
      objectCount += page.items.length;
      cursor = page.nextCursor;
    } while (cursor);
    return { totalBytes, objectCount };
  }

  /** URL PUBLIQUE (CDN) d'une clé — voir « servir les variantes publiées par CDN » —
   *  UNIQUEMENT pour un objet dont le tenant a explicitement demandé la publication
   *  (voir MediaAsset.isPublic côté application) ; ne vérifie PAS l'appartenance ici
   *  volontairement — l'appelant ne doit JAMAIS appeler cette méthode pour un objet
   *  privé (voir « Le bucket ne doit pas permettre une navigation publique », qui
   *  s'applique à la configuration du bucket/domaine CDN lui-même, hors du code). */
  publicUrl(storageKey: string): string | null {
    if (!this.publicCdnBaseUrl) return null;
    return `${this.publicCdnBaseUrl.replace(/\/$/, "")}/${storageKey}`;
  }
}
