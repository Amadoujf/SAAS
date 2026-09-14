import type { Prisma, MediaAssetStatus, MediaAssetType } from "@prisma/client";

/**
 * Persistance de la médiathèque — voir docs/12 §12.2, « médiathèque R2 » (21
 * septembre 2026). Portée : lignes `MediaAsset` uniquement (cycle de vie
 * PENDING → READY/FAILED → TRASHED → suppression définitive) — jamais d'accès au
 * fournisseur de stockage réel ici (voir @yamacommerce/storage, appelé séparément par
 * l'orchestrateur d'import côté application).
 *
 * Même convention que `site-versions-registry.ts` : chaque fonction reçoit `tx` (déjà
 * scoping-vérifié par `withTenant(tenantId, ...)`) ET `tenantId` explicitement — la
 * policy RLS (voir migration `20260921000000_media_library`) empêche de toute façon
 * qu'une ligne d'un autre tenant soit jamais retournée/modifiée, mais chaque fonction
 * filtre AUSSI explicitement sur `tenantId` en clause `WHERE` : défense en profondeur,
 * jamais une confiance aveugle en la seule RLS.
 */

export interface CreatePendingMediaAssetInput {
  ownerId: string;
  originalName: string;
  storageKey: string;
  type: MediaAssetType;
  mimeType: string;
  sizeBytes: number;
  folder?: string;
}

export async function createPendingMediaAsset(
  tx: Prisma.TransactionClient,
  tenantId: string,
  input: CreatePendingMediaAssetInput,
) {
  return tx.mediaAsset.create({
    data: {
      tenantId,
      ownerId: input.ownerId,
      originalName: input.originalName,
      storageKey: input.storageKey,
      type: input.type,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      folder: input.folder ?? "",
      status: "PENDING",
      checksumSha256: "",
    },
  });
}

export interface MarkMediaAssetReadyInput {
  sizeBytes: number;
  mimeType: string;
  width?: number | null;
  height?: number | null;
  durationSeconds?: number | null;
  checksumSha256: string;
  variants?: unknown;
  metadata?: unknown;
}

/** PENDING -> READY, une fois le fichier réellement reçu et vérifié (voir
 *  `validateUploadedFile`, @yamacommerce/storage) — jamais avant. */
export async function markMediaAssetReady(
  tx: Prisma.TransactionClient,
  tenantId: string,
  id: string,
  input: MarkMediaAssetReadyInput,
) {
  const { count } = await tx.mediaAsset.updateMany({
    where: { id, tenantId, status: "PENDING" },
    data: {
      status: "READY",
      sizeBytes: input.sizeBytes,
      mimeType: input.mimeType,
      width: input.width ?? null,
      height: input.height ?? null,
      durationSeconds: input.durationSeconds ?? null,
      checksumSha256: input.checksumSha256,
      ...(input.variants !== undefined ? { variants: input.variants as Prisma.InputJsonValue } : {}),
      ...(input.metadata !== undefined ? { metadata: input.metadata as Prisma.InputJsonValue } : {}),
    },
  });
  if (count === 0) {
    throw new Error(
      `markMediaAssetReady: aucune ligne PENDING "${id}" pour le tenant "${tenantId}" (déjà traitée ou inexistante).`,
    );
  }
  return tx.mediaAsset.findFirstOrThrow({ where: { id, tenantId } });
}

/** PENDING -> FAILED — le fichier a été rejeté par la validation (voir
 *  `validateUploadedFile`). La ligne est conservée brièvement pour audit
 *  (`metadata.rejectionReason`) plutôt que supprimée silencieusement. */
export async function markMediaAssetFailed(
  tx: Prisma.TransactionClient,
  tenantId: string,
  id: string,
  reason: string,
) {
  await tx.mediaAsset.updateMany({
    where: { id, tenantId, status: "PENDING" },
    data: { status: "FAILED", metadata: { rejectionReason: reason } },
  });
}

export async function getMediaAsset(tx: Prisma.TransactionClient, tenantId: string, id: string) {
  return tx.mediaAsset.findFirst({ where: { id, tenantId } });
}

export interface ListMediaAssetsFilter {
  folder?: string;
  type?: MediaAssetType;
  status?: MediaAssetStatus | MediaAssetStatus[];
  search?: string;
  cursor?: string;
  limit?: number;
}

/** Par défaut, n'inclut ni les brouillons d'import (PENDING/FAILED) ni la corbeille
 *  (TRASHED) — voir « Le média devient disponible dans l'éditeur » (seulement une
 *  fois READY) et « Corbeille » (liste séparée, voir `listTrashedMediaAssets`). */
export async function listMediaAssets(
  tx: Prisma.TransactionClient,
  tenantId: string,
  filter: ListMediaAssetsFilter = {},
) {
  const limit = Math.min(filter.limit ?? 60, 200);
  const status = filter.status ?? "READY";
  return tx.mediaAsset.findMany({
    where: {
      tenantId,
      status: Array.isArray(status) ? { in: status } : status,
      ...(filter.folder !== undefined ? { folder: filter.folder } : {}),
      ...(filter.type ? { type: filter.type } : {}),
      ...(filter.search
        ? { originalName: { contains: filter.search, mode: "insensitive" } }
        : {}),
    },
    orderBy: { importedAt: "desc" },
    take: limit,
    ...(filter.cursor ? { skip: 1, cursor: { id: filter.cursor } } : {}),
  });
}

export async function listTrashedMediaAssets(tx: Prisma.TransactionClient, tenantId: string) {
  return tx.mediaAsset.findMany({
    where: { tenantId, status: "TRASHED" },
    orderBy: { deletedAt: "desc" },
  });
}

export interface UpdateMediaAssetInput {
  originalName?: string;
  altText?: string | null;
  caption?: string | null;
  folder?: string;
}

export async function updateMediaAsset(
  tx: Prisma.TransactionClient,
  tenantId: string,
  id: string,
  input: UpdateMediaAssetInput,
) {
  const { count } = await tx.mediaAsset.updateMany({ where: { id, tenantId }, data: input });
  if (count === 0) {
    throw new Error(`updateMediaAsset: média "${id}" introuvable pour le tenant "${tenantId}".`);
  }
  return tx.mediaAsset.findFirstOrThrow({ where: { id, tenantId } });
}

/** Recherche de doublon PAR CHECKSUM, TOUJOURS scopée à CE tenant — voir « éviter une
 *  déduplication qui révélerait les fichiers d'un autre tenant » : cette fonction ne
 *  prend même pas de paramètre permettant d'élargir la recherche au-delà de
 *  `tenantId`, pour rendre une fuite cross-tenant structurellement impossible ici,
 *  pas seulement empêchée par convention d'appel. */
export async function findMediaAssetByChecksum(
  tx: Prisma.TransactionClient,
  tenantId: string,
  checksumSha256: string,
) {
  return tx.mediaAsset.findFirst({
    where: { tenantId, checksumSha256, status: "READY" },
    orderBy: { importedAt: "desc" },
  });
}

/** Corbeille — voir « Déplacer d'abord le fichier dans la corbeille ». Ne touche
 *  jamais au stockage réel (voir l'orchestrateur applicatif) : uniquement le
 *  statut/la date de suppression logique. */
export async function trashMediaAsset(tx: Prisma.TransactionClient, tenantId: string, id: string) {
  const { count } = await tx.mediaAsset.updateMany({
    where: { id, tenantId, status: "READY" },
    data: { status: "TRASHED", deletedAt: new Date() },
  });
  if (count === 0) {
    throw new Error(`trashMediaAsset: média "${id}" introuvable ou déjà dans la corbeille.`);
  }
}

export async function restoreMediaAsset(tx: Prisma.TransactionClient, tenantId: string, id: string) {
  const { count } = await tx.mediaAsset.updateMany({
    where: { id, tenantId, status: "TRASHED" },
    data: { status: "READY", deletedAt: null },
  });
  if (count === 0) {
    throw new Error(`restoreMediaAsset: média "${id}" introuvable dans la corbeille.`);
  }
}

/** Suppression DÉFINITIVE — supprime la ligne. Le stockage réel doit être purgé par
 *  l'appelant AVANT ou APRÈS cet appel (voir l'orchestrateur) ; cette fonction ne
 *  s'occupe que de la base. N'agit QUE sur une ligne déjà TRASHED — jamais un
 *  raccourci direct READY -> supprimé, pour garantir le passage obligatoire par la
 *  corbeille (voir « Prévoir une suppression définitive différée »). */
export async function permanentlyDeleteMediaAsset(
  tx: Prisma.TransactionClient,
  tenantId: string,
  id: string,
) {
  const { count } = await tx.mediaAsset.deleteMany({ where: { id, tenantId, status: "TRASHED" } });
  if (count === 0) {
    throw new Error(
      `permanentlyDeleteMediaAsset: média "${id}" introuvable dans la corbeille pour le tenant "${tenantId}".`,
    );
  }
}

/** Candidats à la purge automatique différée — voir « Prévoir une suppression
 *  définitive différée » (ex. un job planifié purge tout ce qui est dans la corbeille
 *  depuis plus de 30 jours). */
export async function listPermanentDeletionCandidates(
  tx: Prisma.TransactionClient,
  tenantId: string,
  trashedBefore: Date,
) {
  return tx.mediaAsset.findMany({
    where: { tenantId, status: "TRASHED", deletedAt: { lte: trashedBefore } },
  });
}

export async function refreshMediaAssetReferenceCount(
  tx: Prisma.TransactionClient,
  tenantId: string,
  id: string,
  referenceCount: number,
) {
  await tx.mediaAsset.updateMany({ where: { id, tenantId }, data: { referenceCount } });
}

export interface StorageUsage {
  totalBytes: number;
  fileCount: number;
}

/** Utilisation RÉELLE du stockage — inclut READY ET TRASHED (un fichier dans la
 *  corbeille occupe toujours de l'espace réel tant qu'il n'est pas purgé
 *  définitivement, voir « Affichage de l'espace utilisé »). `fileCount`, en revanche,
 *  ne compte que les fichiers ACTIFS (READY) — voir « Nombre maximal de fichiers »,
 *  qui limite ce que le client gère activement, pas sa corbeille. */
export async function computeStorageUsage(
  tx: Prisma.TransactionClient,
  tenantId: string,
): Promise<StorageUsage> {
  const [usage, activeCount] = await Promise.all([
    tx.mediaAsset.aggregate({
      where: { tenantId, status: { in: ["READY", "TRASHED"] } },
      _sum: { sizeBytes: true },
    }),
    tx.mediaAsset.count({ where: { tenantId, status: "READY" } }),
  ]);
  return { totalBytes: usage._sum.sizeBytes ?? 0, fileCount: activeCount };
}

/** Somme des importations depuis `since` (voir « Quota mensuel d'importation ») —
 *  basée sur `importedAt`, jamais affectée par une suppression ultérieure (un import
 *  compte pour le mois où il a eu lieu, qu'il soit ensuite gardé ou supprimé). */
export async function computeMonthlyUploadUsage(
  tx: Prisma.TransactionClient,
  tenantId: string,
  since: Date,
): Promise<number> {
  const usage = await tx.mediaAsset.aggregate({
    where: { tenantId, importedAt: { gte: since }, status: { in: ["READY", "TRASHED"] } },
    _sum: { sizeBytes: true },
  });
  return usage._sum.sizeBytes ?? 0;
}
