import { randomUUID } from "node:crypto";
import {
  checkQuota,
  generateImageVariants,
  validateUploadedFile,
  type MediaQuotaConfig,
  type StorageProvider,
} from "@yamacommerce/storage";
import { categoryForType, mediaAssetTypeForCategory } from "./categories";
import type { MediaAssetRecord, MediaRepository, MediaVariantRecord } from "./media-repository";

/**
 * Orchestration du parcours d'import — voir docs/12 §12.2, « médiathèque R2 » (21
 * septembre 2026), section IMPORTATION : « 1. Le client choisit un fichier. 2. Le
 * serveur vérifie son abonnement et son quota. [...] 4. Le serveur génère une
 * autorisation d'import. 5. Le navigateur téléverse le fichier. 6. Le serveur
 * vérifie réellement le fichier. 7. Les métadonnées sont enregistrées. 8. Les
 * variantes optimisées sont générées. 9. Le média devient disponible dans
 * l'éditeur. ».
 *
 * Module PUR VIS-À-VIS DE SES DÉPENDANCES : reçoit `MediaRepository` et
 * `StorageProvider` en paramètres (jamais importés statiquement en dur) — c'est ce
 * qui permet de tester le pipeline COMPLET avec `InMemoryMediaRepository` +
 * `LocalStorageProvider`, sans PostgreSQL ni bucket réel, ET de réutiliser
 * EXACTEMENT la même logique pour `/api/media/*` (PrismaMediaRepository, réel) et
 * `/api/demo-media/*` (InMemoryMediaRepository, démonstration) — voir
 * media-repository.ts.
 */

export class QuotaExceededError extends Error {
  constructor(
    public readonly reason: string,
    message: string,
  ) {
    super(message);
    this.name = "QuotaExceededError";
  }
}

export interface UploadPipelineDeps {
  repository: MediaRepository;
  storage: StorageProvider;
  quotaConfig: MediaQuotaConfig;
}

/** Devine grossièrement la catégorie à partir du `Content-Type` DÉCLARÉ par le
 *  navigateur — UNIQUEMENT pour choisir la limite de taille à vérifier AVANT
 *  l'import (étape 2 du parcours, avant même de connaître le contenu réel). Ce n'est
 *  JAMAIS la vérification de sécurité finale (voir `validateUploadedFile`, appelée
 *  après réception, sur le contenu réel) — seulement un pré-contrôle de quota pour ne
 *  pas générer une autorisation d'import inutile pour un fichier déjà trop gros/hors
 *  quota selon ce que le client prétend envoyer. */
function coarseCategoryFromMimeType(mimeType: string): "image" | "video" | "document" | null {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType === "application/pdf") return "document";
  return null;
}

function sanitizeFileNameForKey(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9_.-]/g, "-").slice(-120);
}

function monthStart(now: Date): Date {
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

export interface RequestUploadInput {
  tenantId: string;
  ownerId: string;
  originalFileName: string;
  declaredMimeType: string;
  declaredSizeBytes: number;
  folder?: string;
}

export interface RequestUploadResult {
  mediaAssetId: string;
  uploadUrl: string;
  uploadMethod: "PUT";
  headers?: Record<string, string>;
  expiresAt: Date;
}

/** Étapes 2-4 du parcours : vérifie le quota PUIS génère l'autorisation d'import. */
export async function requestMediaUpload(
  deps: UploadPipelineDeps,
  input: RequestUploadInput,
): Promise<RequestUploadResult> {
  const category = coarseCategoryFromMimeType(input.declaredMimeType);
  if (!category) {
    throw new QuotaExceededError(
      "unsupported_type",
      `Type de fichier non pris en charge : "${input.declaredMimeType}".`,
    );
  }

  const usage = await deps.repository.getUsageSnapshot(input.tenantId, monthStart(new Date()));
  const quotaResult = checkQuota(deps.quotaConfig, usage, category, input.declaredSizeBytes);
  if (!quotaResult.allowed) {
    throw new QuotaExceededError(quotaResult.reason, quotaResult.message);
  }

  const keySegments = ["originals", `${randomUUID()}-${sanitizeFileNameForKey(input.originalFileName)}`];
  const upload = await deps.storage.createUpload({
    tenantId: input.tenantId,
    keySegments,
    contentType: input.declaredMimeType,
    expectedSizeBytes: input.declaredSizeBytes,
  });

  const asset = await deps.repository.createPending(input.tenantId, {
    ownerId: input.ownerId,
    originalName: input.originalFileName,
    storageKey: upload.storageKey,
    type: mediaAssetTypeForCategory(category),
    mimeType: input.declaredMimeType,
    sizeBytes: input.declaredSizeBytes,
    folder: input.folder,
  });

  return {
    mediaAssetId: asset.id,
    uploadUrl: upload.uploadUrl,
    uploadMethod: upload.uploadMethod,
    headers: upload.headers,
    expiresAt: upload.expiresAt,
  };
}

/** Permet au SERVEUR lui-même de déposer un objet (les variantes qu'il vient de
 *  générer) en empruntant le MÊME chemin `createUpload` + PUT qu'un navigateur —
 *  aucune méthode d'écriture directe n'est ajoutée à `StorageProvider` pour cela
 *  (l'interface reste exactement les 8 méthodes demandées). `fetchImpl` est
 *  injectable pour les tests (voir upload-pipeline.test.ts), qui n'ont pas de vrai
 *  serveur HTTP à interroger. */
export async function uploadServerGeneratedAsset(
  storage: StorageProvider,
  tenantId: string,
  keySegments: string[],
  contentType: string,
  bytes: Uint8Array,
  options: { absoluteBaseUrl: string; fetchImpl?: typeof fetch },
): Promise<{ storageKey: string }> {
  const upload = await storage.createUpload({ tenantId, keySegments, contentType });
  const url = upload.uploadUrl.startsWith("http")
    ? upload.uploadUrl
    : `${options.absoluteBaseUrl}${upload.uploadUrl}`;
  const doFetch = options.fetchImpl ?? fetch;
  const response = await doFetch(url, {
    method: "PUT",
    headers: upload.headers,
    body: bytes as BodyInit,
  });
  if (!response.ok) {
    throw new Error(`uploadServerGeneratedAsset: échec de l'envoi (HTTP ${response.status}).`);
  }
  await storage.completeUpload({ tenantId, storageKey: upload.storageKey });
  return { storageKey: upload.storageKey };
}

export interface CompleteUploadInput {
  tenantId: string;
  mediaAssetId: string;
  absoluteBaseUrl: string;
  fetchImpl?: typeof fetch;
}

export type CompleteUploadOutcome =
  | { status: "ready"; asset: MediaAssetRecord }
  | { status: "failed"; reason: string; message: string };

/** Étapes 6-9 du parcours : vérification réelle, dédoublonnage, génération des
 *  variantes, puis passage à READY. */
export async function completeMediaUpload(
  deps: UploadPipelineDeps,
  input: CompleteUploadInput,
): Promise<CompleteUploadOutcome> {
  const pending = await deps.repository.get(input.tenantId, input.mediaAssetId);
  if (!pending || pending.status !== "PENDING") {
    throw new Error(`completeMediaUpload: média "${input.mediaAssetId}" introuvable ou déjà traité.`);
  }

  // Fichier incomplet/jamais reçu (voir « Fichier incomplet ») : l'objet peut ne
  // jamais être arrivé (navigateur fermé en cours d'envoi, réseau coupé) — un échec
  // de vérification ICI est un résultat métier normal (média FAILED), jamais une
  // exception qui remonterait comme une erreur serveur 500.
  try {
    await deps.storage.completeUpload({ tenantId: input.tenantId, storageKey: pending.storageKey });
  } catch {
    await deps.repository.markFailed(input.tenantId, input.mediaAssetId, "incomplete_file");
    return {
      status: "failed",
      reason: "incomplete_file",
      message: "Le fichier n'a pas été reçu intégralement (import incomplet).",
    };
  }
  const uploaded = await deps.storage.getAsset(input.tenantId, pending.storageKey);

  const maxSizeBytes = Math.max(
    deps.quotaConfig.maxImageBytes,
    deps.quotaConfig.maxVideoBytes,
    deps.quotaConfig.maxDocumentBytes,
  );
  const validation = validateUploadedFile({
    buffer: uploaded.body,
    declaredMimeType: pending.mimeType,
    originalFileName: pending.originalName,
    maxSizeBytes,
  });

  if (!validation.success) {
    await deps.storage.deleteAsset(input.tenantId, pending.storageKey);
    await deps.repository.markFailed(input.tenantId, input.mediaAssetId, validation.reason);
    return { status: "failed", reason: validation.reason, message: validation.message };
  }

  const category = categoryForType(validation.type);
  const usage = await deps.repository.getUsageSnapshot(input.tenantId, monthStart(new Date()));
  const quotaResult = checkQuota(deps.quotaConfig, usage, category, validation.sizeBytes);
  if (!quotaResult.allowed) {
    await deps.storage.deleteAsset(input.tenantId, pending.storageKey);
    await deps.repository.markFailed(input.tenantId, input.mediaAssetId, quotaResult.reason);
    return { status: "failed", reason: quotaResult.reason, message: quotaResult.message };
  }

  // Déduplication PAR CHECKSUM, scopée au tenant (voir findByChecksum) — réutilise les
  // variantes déjà générées plutôt que de repasser par le décodage/encodage d'image.
  const duplicate = await deps.repository.findByChecksum(input.tenantId, validation.checksumSha256);
  let variants: MediaVariantRecord[] = duplicate?.variants ?? [];

  if (!duplicate && category === "image" && (validation.type === "jpeg" || validation.type === "png" || validation.type === "webp" || validation.type === "avif")) {
    const generated = await generateImageVariants({ buffer: uploaded.body, sourceType: validation.type });
    variants = await Promise.all(
      generated.map(async (variant) => {
        const written = await uploadServerGeneratedAsset(
          deps.storage,
          input.tenantId,
          ["variants", pending.id, `${variant.key}.${variant.format}`],
          `image/${variant.format}`,
          variant.bytes,
          { absoluteBaseUrl: input.absoluteBaseUrl, fetchImpl: input.fetchImpl },
        );
        return {
          key: variant.key,
          format: variant.format,
          storageKey: written.storageKey,
          width: variant.width,
          height: variant.height,
          sizeBytes: variant.sizeBytes,
        };
      }),
    );
  }

  const ready = await deps.repository.markReady(input.tenantId, input.mediaAssetId, {
    sizeBytes: validation.sizeBytes,
    mimeType: validation.mimeType,
    width: validation.dimensions?.width ?? null,
    height: validation.dimensions?.height ?? null,
    checksumSha256: validation.checksumSha256,
    variants,
  });

  return { status: "ready", asset: ready };
}
