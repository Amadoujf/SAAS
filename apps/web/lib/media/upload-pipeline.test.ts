import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LocalStorageProvider, quotaConfigFromMB, type MediaQuotaConfig } from "@yamacommerce/storage";
import { InMemoryMediaRepository } from "./in-memory-media-repository";
import {
  QuotaExceededError,
  completeMediaUpload,
  requestMediaUpload,
  type UploadPipelineDeps,
} from "./upload-pipeline";

const TENANT_A = "11111111-1111-4111-8111-111111111111";
const TENANT_B = "22222222-2222-4222-8222-222222222222";
const OWNER_A = "owner-a";

let rootDir: string;
let storage: LocalStorageProvider;
let repository: InMemoryMediaRepository;
let deps: UploadPipelineDeps;
const fakeAbsoluteBaseUrl = "http://localhost/unused";

const QUOTA: MediaQuotaConfig = quotaConfigFromMB({
  storageMB: 50,
  maxImageFileMB: 5,
  maxVideoFileMB: 50,
  maxDocumentFileMB: 5,
  maxMediaFileCount: 10,
  monthlyUploadMB: 50,
});

/** `fetch` factice : au lieu d'un vrai aller-retour HTTP, écrit directement les
 *  octets via `LocalStorageProvider.writeUploadedBytes` — voir la note de
 *  `uploadServerGeneratedAsset` (fetchImpl injectable pour les tests). */
async function fakeFetch(url: string, init?: RequestInit): Promise<Response> {
  const token = new URL(url).searchParams.get("token")!;
  await storage.writeUploadedBytes(token, Buffer.from(init!.body as Uint8Array));
  return new Response(null, { status: 200 });
}

async function syntheticJpeg(width: number, height: number): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 3, background: { r: 10, g: 20, b: 30 } } })
    .jpeg()
    .toBuffer();
}

/** Simule le NAVIGATEUR qui téléverse le fichier (étape 5 du parcours) directement
 *  sur `uploadUrl`, sans passer par une vraie requête HTTP. */
async function browserUploads(uploadUrl: string, bytes: Uint8Array) {
  const token = new URL(uploadUrl, "http://localhost").searchParams.get("token")!;
  await storage.writeUploadedBytes(token, bytes);
}

beforeEach(async () => {
  rootDir = await mkdtemp(join(tmpdir(), "yamacommerce-pipeline-test-"));
  storage = new LocalStorageProvider({
    rootDir,
    uploadBaseUrl: "/api/media/local-upload",
    downloadBaseUrl: "/api/media/local-serve",
    signingSecret: "test-secret",
  });
  repository = new InMemoryMediaRepository();
  deps = { repository, storage, quotaConfig: QUOTA };
});

afterEach(async () => {
  await rm(rootDir, { recursive: true, force: true });
});

describe("requestMediaUpload", () => {
  it("génère une autorisation d'import et une ligne PENDING", async () => {
    const result = await requestMediaUpload(deps, {
      tenantId: TENANT_A,
      ownerId: OWNER_A,
      originalFileName: "photo.jpg",
      declaredMimeType: "image/jpeg",
      declaredSizeBytes: 1024,
    });
    expect(result.uploadUrl).toContain("token=");
    const pending = await repository.get(TENANT_A, result.mediaAssetId);
    expect(pending?.status).toBe("PENDING");
  });

  it("QUOTA : refuse un fichier dépassant la taille maximale de sa catégorie", async () => {
    await expect(
      requestMediaUpload(deps, {
        tenantId: TENANT_A,
        ownerId: OWNER_A,
        originalFileName: "gros.jpg",
        declaredMimeType: "image/jpeg",
        declaredSizeBytes: 6 * 1024 * 1024, // > 5 Mo (limite image)
      }),
    ).rejects.toThrow(QuotaExceededError);
  });

  it("refuse un type MIME non pris en charge", async () => {
    await expect(
      requestMediaUpload(deps, {
        tenantId: TENANT_A,
        ownerId: OWNER_A,
        originalFileName: "archive.zip",
        declaredMimeType: "application/zip",
        declaredSizeBytes: 1024,
      }),
    ).rejects.toThrow(QuotaExceededError);
  });
});

describe("completeMediaUpload — cas valide", () => {
  it("vérifie le fichier réel, génère les variantes, et passe le média à READY", async () => {
    const request = await requestMediaUpload(deps, {
      tenantId: TENANT_A,
      ownerId: OWNER_A,
      originalFileName: "photo.jpg",
      declaredMimeType: "image/jpeg",
      declaredSizeBytes: 500_000,
    });
    const bytes = await syntheticJpeg(1000, 800);
    await browserUploads(request.uploadUrl, bytes);

    const outcome = await completeMediaUpload(deps, {
      tenantId: TENANT_A,
      mediaAssetId: request.mediaAssetId,
      absoluteBaseUrl: fakeAbsoluteBaseUrl,
      fetchImpl: fakeFetch as unknown as typeof fetch,
    });

    expect(outcome.status).toBe("ready");
    if (outcome.status === "ready") {
      expect(outcome.asset.width).toBe(1000);
      expect(outcome.asset.variants.length).toBeGreaterThan(0);
      expect(outcome.asset.variants.some((v) => v.key === "thumbnail")).toBe(true);
    }
  }, 20_000);
});

describe("completeMediaUpload — rejets", () => {
  it("MIME FALSIFIÉ : le déclaré ne correspond pas au contenu réel -> FAILED, fichier nettoyé", async () => {
    const request = await requestMediaUpload(deps, {
      tenantId: TENANT_A,
      ownerId: OWNER_A,
      originalFileName: "photo.jpg",
      declaredMimeType: "image/jpeg",
      declaredSizeBytes: 500_000,
    });
    // Envoie en réalité un PNG alors que "image/jpeg" a été déclaré.
    const pngBytes = await sharp({ create: { width: 100, height: 100, channels: 3, background: "red" } })
      .png()
      .toBuffer();
    await browserUploads(request.uploadUrl, pngBytes);

    const outcome = await completeMediaUpload(deps, {
      tenantId: TENANT_A,
      mediaAssetId: request.mediaAssetId,
      absoluteBaseUrl: fakeAbsoluteBaseUrl,
    });

    expect(outcome).toMatchObject({ status: "failed", reason: "mime_mismatch" });
    const asset = await repository.get(TENANT_A, request.mediaAssetId);
    expect(asset?.status).toBe("FAILED");
    await expect(storage.getAsset(TENANT_A, asset!.storageKey)).rejects.toThrow();
  });

  it("FICHIER TROP VOLUMINEUX (réel, détecté après réception) -> FAILED", async () => {
    const request = await requestMediaUpload(deps, {
      tenantId: TENANT_A,
      ownerId: OWNER_A,
      originalFileName: "photo.jpg",
      declaredMimeType: "image/jpeg",
      declaredSizeBytes: 1024, // déclaré petit...
    });
    // ...mais réellement énorme une fois reçu : un JPEG valide (signature/dimensions
    // lisibles en tête de fichier) rembourré de zéros pour dépasser la limite de 5 Mo
    // par image — un JPEG uni compresserait sinon à quelques centaines d'octets,
    // quelle que soit sa résolution déclarée, et ne testerait rien du tout ici.
    const validJpeg = await syntheticJpeg(200, 200);
    const bigBuffer = Buffer.concat([validJpeg, Buffer.alloc(6 * 1024 * 1024)]);
    await browserUploads(request.uploadUrl, bigBuffer);

    const outcome = await completeMediaUpload(deps, {
      tenantId: TENANT_A,
      mediaAssetId: request.mediaAssetId,
      absoluteBaseUrl: fakeAbsoluteBaseUrl,
      fetchImpl: fakeFetch as unknown as typeof fetch,
    });
    expect(outcome).toMatchObject({ status: "failed", reason: "file_too_large" });
  }, 20_000);

  it("UPLOAD INCOMPLET : aucun octet jamais reçu -> FAILED proprement, jamais une exception", async () => {
    const request = await requestMediaUpload(deps, {
      tenantId: TENANT_A,
      ownerId: OWNER_A,
      originalFileName: "photo.jpg",
      declaredMimeType: "image/jpeg",
      declaredSizeBytes: 1024,
    });
    // Le navigateur n'a jamais terminé l'envoi — rien n'est écrit.
    const outcome = await completeMediaUpload(deps, {
      tenantId: TENANT_A,
      mediaAssetId: request.mediaAssetId,
      absoluteBaseUrl: fakeAbsoluteBaseUrl,
    });
    expect(outcome).toMatchObject({ status: "failed", reason: "incomplete_file" });
  });

  it("CONTENU DANGEREUX : script embarqué -> FAILED", async () => {
    const request = await requestMediaUpload(deps, {
      tenantId: TENANT_A,
      ownerId: OWNER_A,
      originalFileName: "photo.jpg",
      declaredMimeType: "image/jpeg",
      declaredSizeBytes: 1024,
    });
    const jpeg = await syntheticJpeg(50, 50);
    const withScript = Buffer.concat([jpeg, Buffer.from("<script>alert(1)</script>")]);
    await browserUploads(request.uploadUrl, withScript);

    const outcome = await completeMediaUpload(deps, {
      tenantId: TENANT_A,
      mediaAssetId: request.mediaAssetId,
      absoluteBaseUrl: fakeAbsoluteBaseUrl,
    });
    expect(outcome).toMatchObject({ status: "failed", reason: "dangerous_content" });
  });
});

describe("CHECKSUM — déduplication scopée au tenant", () => {
  it("un import identique réutilise les variantes déjà générées (pas de nouveau traitement image)", async () => {
    const bytes = await syntheticJpeg(1000, 800);

    async function importOnce() {
      const request = await requestMediaUpload(deps, {
        tenantId: TENANT_A,
        ownerId: OWNER_A,
        originalFileName: "photo.jpg",
        declaredMimeType: "image/jpeg",
        declaredSizeBytes: bytes.length,
      });
      await browserUploads(request.uploadUrl, bytes);
      return completeMediaUpload(deps, {
        tenantId: TENANT_A,
        mediaAssetId: request.mediaAssetId,
        absoluteBaseUrl: fakeAbsoluteBaseUrl,
        fetchImpl: fakeFetch as unknown as typeof fetch,
      });
    }

    const first = await importOnce();
    const second = await importOnce();
    expect(first.status).toBe("ready");
    expect(second.status).toBe("ready");
    if (first.status === "ready" && second.status === "ready") {
      const firstKeys = first.asset.variants.map((v) => v.storageKey).sort();
      const secondKeys = second.asset.variants.map((v) => v.storageKey).sort();
      expect(secondKeys).toEqual(firstKeys); // mêmes clés = variantes réutilisées, pas régénérées
    }
  }, 20_000);

  it("ISOLATION : un doublon chez le tenant A n'est jamais réutilisé pour le tenant B", async () => {
    const bytes = await syntheticJpeg(300, 300);

    const requestA = await requestMediaUpload(deps, {
      tenantId: TENANT_A,
      ownerId: OWNER_A,
      originalFileName: "photo.jpg",
      declaredMimeType: "image/jpeg",
      declaredSizeBytes: bytes.length,
    });
    await browserUploads(requestA.uploadUrl, bytes);
    await completeMediaUpload(deps, {
      tenantId: TENANT_A,
      mediaAssetId: requestA.mediaAssetId,
      absoluteBaseUrl: fakeAbsoluteBaseUrl,
      fetchImpl: fakeFetch as unknown as typeof fetch,
    });

    const foundForB = await repository.findByChecksum(
      TENANT_B,
      (await repository.get(TENANT_A, requestA.mediaAssetId))!.checksumSha256,
    );
    expect(foundForB).toBeNull();
  }, 20_000);
});
