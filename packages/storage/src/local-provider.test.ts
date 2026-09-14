import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { InvalidTokenError, LocalStorageProvider } from "./local-provider";
import { StorageIsolationError } from "./storage-key";

const TENANT_A = "11111111-1111-4111-8111-111111111111";
const TENANT_B = "22222222-2222-4222-8222-222222222222";

let rootDir: string;
let provider: LocalStorageProvider;

beforeEach(async () => {
  rootDir = await mkdtemp(join(tmpdir(), "yamacommerce-storage-test-"));
  provider = new LocalStorageProvider({
    rootDir,
    uploadBaseUrl: "http://localhost/api/media/local-upload",
    downloadBaseUrl: "http://localhost/api/media/local-serve",
    signingSecret: "test-secret",
  });
});

afterEach(async () => {
  await rm(rootDir, { recursive: true, force: true });
});

async function uploadFile(tenantId: string, keySegments: string[], content: string) {
  const upload = await provider.createUpload({
    tenantId,
    keySegments,
    contentType: "image/png",
  });
  const token = new URL(upload.uploadUrl).searchParams.get("token")!;
  await provider.writeUploadedBytes(token, Buffer.from(content));
  return { upload, token };
}

describe("LocalStorageProvider — cycle de vie normal", () => {
  it("createUpload -> writeUploadedBytes -> completeUpload retourne la vraie taille", async () => {
    const { upload } = await uploadFile(TENANT_A, ["originals", "a.png"], "hello world");
    const result = await provider.completeUpload({ tenantId: TENANT_A, storageKey: upload.storageKey });
    expect(result.sizeBytes).toBe(Buffer.byteLength("hello world"));
    expect(result.etag).toMatch(/^[0-9a-f]{64}$/);
  });

  it("getAsset relit le contenu réellement écrit", async () => {
    const { upload } = await uploadFile(TENANT_A, ["originals", "b.png"], "contenu réel");
    const asset = await provider.getAsset(TENANT_A, upload.storageKey);
    expect(Buffer.from(asset.body).toString()).toBe("contenu réel");
  });

  it("deleteAsset supprime le fichier", async () => {
    const { upload } = await uploadFile(TENANT_A, ["originals", "c.png"], "à supprimer");
    await provider.deleteAsset(TENANT_A, upload.storageKey);
    await expect(provider.getAsset(TENANT_A, upload.storageKey)).rejects.toThrow();
  });

  it("createSignedUrl + readForDownload redonne le bon contenu", async () => {
    const { upload } = await uploadFile(TENANT_A, ["originals", "d.png"], "téléchargement");
    const signedUrl = await provider.createSignedUrl({
      tenantId: TENANT_A,
      storageKey: upload.storageKey,
      expiresInSeconds: 60,
    });
    const token = new URL(signedUrl).searchParams.get("token")!;
    const result = await provider.readForDownload(token);
    expect(Buffer.from(result.body).toString()).toBe("téléchargement");
  });

  it("URL SIGNÉE EXPIRÉE : readForDownload refuse un jeton dont l'expiration est passée", async () => {
    const { upload } = await uploadFile(TENANT_A, ["originals", "e.png"], "expire");
    const signedUrl = await provider.createSignedUrl({
      tenantId: TENANT_A,
      storageKey: upload.storageKey,
      expiresInSeconds: -1, // déjà expiré au moment de la génération
    });
    const token = new URL(signedUrl).searchParams.get("token")!;
    await expect(provider.readForDownload(token)).rejects.toThrow(InvalidTokenError);
  });

  it("un jeton d'upload ne peut pas servir de jeton de téléchargement (portées disjointes)", async () => {
    const upload = await provider.createUpload({
      tenantId: TENANT_A,
      keySegments: ["originals", "f.png"],
      contentType: "image/png",
    });
    const uploadToken = new URL(upload.uploadUrl).searchParams.get("token")!;
    await expect(provider.readForDownload(uploadToken)).rejects.toThrow(InvalidTokenError);
  });

  it("un jeton altéré (signature invalide) est refusé", async () => {
    const { token } = await uploadFile(TENANT_A, ["originals", "g.png"], "x");
    const tampered = token.slice(0, -2) + "zz";
    await expect(provider.writeUploadedBytes(tampered, Buffer.from("y"))).rejects.toThrow(
      InvalidTokenError,
    );
  });

  it("copyAsset copie le contenu vers une nouvelle clé du MÊME tenant", async () => {
    const { upload } = await uploadFile(TENANT_A, ["originals", "h.png"], "à copier");
    const destKey = await provider.copyAsset({
      tenantId: TENANT_A,
      sourceKey: upload.storageKey,
      destinationKeySegments: ["variants", "h-thumb.png"],
    });
    const copied = await provider.getAsset(TENANT_A, destKey);
    expect(Buffer.from(copied.body).toString()).toBe("à copier");
  });

  it("getUsage additionne correctement la taille des fichiers du tenant", async () => {
    await uploadFile(TENANT_A, ["originals", "i1.png"], "12345");
    await uploadFile(TENANT_A, ["originals", "i2.png"], "1234567890");
    const usage = await provider.getUsage(TENANT_A);
    expect(usage.totalBytes).toBe(15);
    expect(usage.objectCount).toBe(2);
  });

  it("listAssets retourne les fichiers sous le préfixe du tenant", async () => {
    await uploadFile(TENANT_A, ["originals", "j1.png"], "a");
    await uploadFile(TENANT_A, ["originals", "sub", "j2.png"], "b");
    const result = await provider.listAssets({ tenantId: TENANT_A });
    expect(result.items).toHaveLength(2);
  });
});

describe("LocalStorageProvider — ISOLATION ENTRE TENANTS", () => {
  it("le tenant B ne peut pas LIRE un fichier du tenant A", async () => {
    const { upload } = await uploadFile(TENANT_A, ["originals", "secret.png"], "confidentiel");
    await expect(provider.getAsset(TENANT_B, upload.storageKey)).rejects.toThrow(StorageIsolationError);
  });

  it("le tenant B ne peut pas SUPPRIMER un fichier du tenant A", async () => {
    const { upload } = await uploadFile(TENANT_A, ["originals", "keep.png"], "à garder");
    await expect(provider.deleteAsset(TENANT_B, upload.storageKey)).rejects.toThrow(
      StorageIsolationError,
    );
    // Le fichier doit rester intact.
    const asset = await provider.getAsset(TENANT_A, upload.storageKey);
    expect(Buffer.from(asset.body).toString()).toBe("à garder");
  });

  it("le tenant B ne peut pas générer d'URL signée pour un fichier du tenant A", async () => {
    const { upload } = await uploadFile(TENANT_A, ["originals", "nosign.png"], "x");
    await expect(
      provider.createSignedUrl({ tenantId: TENANT_B, storageKey: upload.storageKey, expiresInSeconds: 60 }),
    ).rejects.toThrow(StorageIsolationError);
  });

  it("le tenant B ne peut pas COPIER (donc remplacer indirectement) un fichier du tenant A", async () => {
    const { upload } = await uploadFile(TENANT_A, ["originals", "nocopy.png"], "x");
    await expect(
      provider.copyAsset({
        tenantId: TENANT_B,
        sourceKey: upload.storageKey,
        destinationKeySegments: ["originals", "vole.png"],
      }),
    ).rejects.toThrow(StorageIsolationError);
  });

  it("completeUpload refuse une clé n'appartenant pas au tenant appelant", async () => {
    const { upload } = await uploadFile(TENANT_A, ["originals", "nocomplete.png"], "x");
    await expect(
      provider.completeUpload({ tenantId: TENANT_B, storageKey: upload.storageKey }),
    ).rejects.toThrow(StorageIsolationError);
  });

  it("listAssets du tenant B ne retourne jamais les fichiers du tenant A", async () => {
    await uploadFile(TENANT_A, ["originals", "onlyA.png"], "a");
    await uploadFile(TENANT_B, ["originals", "onlyB.png"], "b");
    const resultB = await provider.listAssets({ tenantId: TENANT_B });
    expect(resultB.items).toHaveLength(1);
    expect(resultB.items[0]?.storageKey).toContain("onlyB.png");
  });

  it("getUsage du tenant B n'inclut jamais les fichiers du tenant A", async () => {
    await uploadFile(TENANT_A, ["originals", "big.png"], "x".repeat(1000));
    await uploadFile(TENANT_B, ["originals", "small.png"], "y".repeat(10));
    const usageB = await provider.getUsage(TENANT_B);
    expect(usageB.totalBytes).toBe(10);
  });
});
