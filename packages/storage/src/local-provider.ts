import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { mkdir, readdir, readFile, rm, stat, writeFile, copyFile } from "node:fs/promises";
import { dirname, join, relative, sep } from "node:path";
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
 * Adaptateur de développement/tests — voir docs/12 §12.2, « un adaptateur local pour
 * le développement et les tests ». Stocke les fichiers sur disque, sous un répertoire
 * racine, en respectant EXACTEMENT la même isolation par préfixe de tenant que
 * `R2StorageProvider` (voir storage-key.ts, utilisé par les deux) — un test
 * d'isolation qui passe ici donne une vraie garantie sur le contrat de l'interface,
 * pas seulement sur cette implémentation.
 *
 * "URLs pré-signées" simulées via un jeton HMAC (voir `signToken`/`verifyToken`) —
 * sans base de données ni état serveur à conserver entre `createUpload` et la requête
 * HTTP réelle qui reçoit les octets (voir apps/web, route qui appelle
 * `verifyUploadToken`/`writeUploadedBytes` ci-dessous) : même propriété qu'une vraie
 * URL présignée S3/R2 (le jeton EST la preuve d'autorisation, rien à chercher en base).
 */
export interface LocalStorageProviderOptions {
  rootDir: string;
  /** Base des URLs générées (routes HTTP de l'application qui délèguent à cette
   *  instance — voir `writeUploadedBytes`/`readForDownload` ci-dessous). */
  uploadBaseUrl: string;
  downloadBaseUrl: string;
  signingSecret: string;
}

interface TokenPayload {
  tenantId: string;
  storageKey: string;
  expiresAt: number;
  /** "upload" | "download" — un jeton d'upload ne doit jamais servir à télécharger,
   *  et inversement (portées disjointes, voir `signToken`). */
  scope: "upload" | "download";
}

function signToken(payload: TokenPayload, secret: string): string {
  const json = JSON.stringify(payload);
  const encoded = Buffer.from(json, "utf8").toString("base64url");
  const signature = createHmac("sha256", secret).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}

export class InvalidTokenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidTokenError";
  }
}

function verifyToken(token: string, secret: string, expectedScope: "upload" | "download"): TokenPayload {
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) {
    throw new InvalidTokenError("Jeton malformé.");
  }
  const expectedSignature = createHmac("sha256", secret).update(encoded).digest("base64url");
  const a = Buffer.from(signature);
  const b = Buffer.from(expectedSignature);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new InvalidTokenError("Signature de jeton invalide.");
  }
  const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as TokenPayload;
  if (payload.scope !== expectedScope) {
    throw new InvalidTokenError(`Jeton pour une portée différente (attendu "${expectedScope}").`);
  }
  if (Date.now() > payload.expiresAt) {
    throw new InvalidTokenError("Jeton expiré.");
  }
  return payload;
}

export class LocalStorageProvider implements StorageProvider {
  constructor(private readonly options: LocalStorageProviderOptions) {}

  private absolutePath(storageKey: string): string {
    // `storageKey` est déjà validée (voir assertOwnedKey/buildStorageKey) — aucun
    // segment "..", donc `join` ne peut pas sortir de `rootDir`.
    return join(this.options.rootDir, ...storageKey.split("/"));
  }

  async createUpload(input: CreateUploadInput): Promise<CreateUploadResult> {
    const storageKey = buildStorageKey(input.tenantId, ...input.keySegments);
    const expiresAt = new Date(Date.now() + (input.expiresInSeconds ?? 900) * 1000);
    const token = signToken(
      { tenantId: input.tenantId, storageKey, expiresAt: expiresAt.getTime(), scope: "upload" },
      this.options.signingSecret,
    );
    return {
      storageKey,
      uploadUrl: `${this.options.uploadBaseUrl}?token=${encodeURIComponent(token)}`,
      uploadMethod: "PUT",
      headers: { "content-type": input.contentType },
      expiresAt,
    };
  }

  /** Appelée par la route HTTP locale (jamais directement par un composant React) qui
   *  reçoit le PUT du navigateur — vérifie le jeton puis écrit les octets. */
  async writeUploadedBytes(token: string, body: Uint8Array): Promise<{ storageKey: string; tenantId: string }> {
    const payload = verifyToken(token, this.options.signingSecret, "upload");
    const path = this.absolutePath(payload.storageKey);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, body);
    return { storageKey: payload.storageKey, tenantId: payload.tenantId };
  }

  async completeUpload(input: CompleteUploadInput): Promise<CompleteUploadResult> {
    assertOwnedKey(input.tenantId, input.storageKey);
    const path = this.absolutePath(input.storageKey);
    const info = await stat(path).catch(() => null);
    if (!info) {
      throw new Error(`completeUpload: aucun fichier reçu pour la clé "${input.storageKey}".`);
    }
    const body = await readFile(path);
    return { sizeBytes: info.size, etag: createHash("sha256").update(body).digest("hex") };
  }

  async getAsset(tenantId: string, storageKey: string): Promise<GetAssetResult> {
    assertOwnedKey(tenantId, storageKey);
    const path = this.absolutePath(storageKey);
    const [body, info] = await Promise.all([readFile(path), stat(path)]);
    return {
      body,
      metadata: {
        storageKey,
        sizeBytes: info.size,
        contentType: "application/octet-stream",
        etag: createHash("sha256").update(body).digest("hex"),
        lastModified: info.mtime,
      },
    };
  }

  async listAssets(input: ListAssetsInput): Promise<ListAssetsResult> {
    const rootDir = this.options.rootDir;
    const searchRoot = join(rootDir, ...tenantPrefix(input.tenantId).split("/"), input.prefix ?? "");
    const items: AssetMetadata[] = [];
    async function walk(dir: string) {
      const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
      for (const entry of entries) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
          await walk(full);
        } else {
          const info = await stat(full);
          const body = await readFile(full);
          const relativePath = relative(rootDir, full);
          items.push({
            storageKey: relativePath.split(sep).join("/"),
            sizeBytes: info.size,
            contentType: "application/octet-stream",
            etag: createHash("sha256").update(body).digest("hex"),
            lastModified: info.mtime,
          });
        }
      }
    }
    await walk(searchRoot);
    const limit = input.limit ?? 100;
    return { items: items.slice(0, limit) };
  }

  async deleteAsset(tenantId: string, storageKey: string): Promise<void> {
    assertOwnedKey(tenantId, storageKey);
    await rm(this.absolutePath(storageKey), { force: true });
  }

  async createSignedUrl(input: CreateSignedUrlInput): Promise<string> {
    assertOwnedKey(input.tenantId, input.storageKey);
    const expiresAt = Date.now() + input.expiresInSeconds * 1000;
    const token = signToken(
      { tenantId: input.tenantId, storageKey: input.storageKey, expiresAt, scope: "download" },
      this.options.signingSecret,
    );
    const suffix = input.downloadFileName ? `&filename=${encodeURIComponent(input.downloadFileName)}` : "";
    return `${this.options.downloadBaseUrl}?token=${encodeURIComponent(token)}${suffix}`;
  }

  /** Appelée par la route HTTP locale qui sert les octets d'une URL "signée". */
  async readForDownload(token: string): Promise<GetAssetResult> {
    const payload = verifyToken(token, this.options.signingSecret, "download");
    return this.getAsset(payload.tenantId, payload.storageKey);
  }

  async copyAsset(input: CopyAssetInput): Promise<string> {
    assertOwnedKey(input.tenantId, input.sourceKey);
    const destinationKey = buildStorageKey(input.tenantId, ...input.destinationKeySegments);
    const sourcePath = this.absolutePath(input.sourceKey);
    const destPath = this.absolutePath(destinationKey);
    await mkdir(dirname(destPath), { recursive: true });
    await copyFile(sourcePath, destPath);
    return destinationKey;
  }

  async getUsage(tenantId: string): Promise<UsageResult> {
    const { items } = await this.listAssets({ tenantId, limit: Number.MAX_SAFE_INTEGER });
    return {
      totalBytes: items.reduce((sum, item) => sum + item.sizeBytes, 0),
      objectCount: items.length,
    };
  }
}
