import "server-only";
import {
  withTenant,
  createPendingMediaAsset,
  findMediaAssetByChecksum,
  getMediaAsset,
  listMediaAssets,
  markMediaAssetFailed,
  markMediaAssetReady,
  permanentlyDeleteMediaAsset,
  refreshMediaAssetReferenceCount,
  restoreMediaAsset,
  trashMediaAsset,
  updateMediaAsset,
  computeStorageUsage,
  computeMonthlyUploadUsage,
} from "@yamacommerce/database";
import type {
  CreatePendingInput,
  ListFilter,
  MarkReadyInput,
  MediaAssetRecord,
  MediaRepository,
  UpdateInput,
  UsageSnapshot,
  MediaVariantRecord,
} from "./media-repository";

/**
 * Implémentation RÉELLE de `MediaRepository`, contre PostgreSQL — voir
 * @yamacommerce/database `media-assets-registry.ts` (RLS incluse) pour la garantie
 * d'isolation multi-tenant. Chaque méthode ouvre sa propre transaction scoping via
 * `withTenant(tenantId, ...)` — jamais de connexion partagée/non scoping entre deux
 * appels de ce repository.
 */
function toRecord(row: {
  id: string;
  tenantId: string;
  ownerId: string;
  originalName: string;
  storageKey: string;
  type: string;
  mimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
  altText: string | null;
  caption: string | null;
  folder: string;
  status: string;
  isPublic: boolean;
  checksumSha256: string;
  importedAt: Date;
  deletedAt: Date | null;
  metadata: unknown;
  referenceCount: number;
  variants: unknown;
}): MediaAssetRecord {
  return {
    ...row,
    type: row.type as MediaAssetRecord["type"],
    status: row.status as MediaAssetRecord["status"],
    metadata: (row.metadata ?? {}) as Record<string, unknown>,
    variants: (Array.isArray(row.variants) ? row.variants : []) as MediaVariantRecord[],
  };
}

export class PrismaMediaRepository implements MediaRepository {
  async createPending(tenantId: string, input: CreatePendingInput): Promise<MediaAssetRecord> {
    const row = await withTenant(tenantId, (tx) =>
      createPendingMediaAsset(tx, tenantId, { ...input, type: input.type }),
    );
    return toRecord(row);
  }

  async markReady(tenantId: string, id: string, input: MarkReadyInput): Promise<MediaAssetRecord> {
    const row = await withTenant(tenantId, (tx) =>
      markMediaAssetReady(tx, tenantId, id, {
        ...input,
        variants: input.variants,
        metadata: input.metadata,
      }),
    );
    return toRecord(row);
  }

  async markFailed(tenantId: string, id: string, reason: string): Promise<void> {
    await withTenant(tenantId, (tx) => markMediaAssetFailed(tx, tenantId, id, reason));
  }

  async get(tenantId: string, id: string): Promise<MediaAssetRecord | null> {
    const row = await withTenant(tenantId, (tx) => getMediaAsset(tx, tenantId, id));
    return row ? toRecord(row) : null;
  }

  async list(tenantId: string, filter: ListFilter = {}): Promise<MediaAssetRecord[]> {
    const rows = await withTenant(tenantId, (tx) =>
      listMediaAssets(tx, tenantId, filter as Parameters<typeof listMediaAssets>[2]),
    );
    return rows.map(toRecord);
  }

  async update(tenantId: string, id: string, input: UpdateInput): Promise<MediaAssetRecord> {
    const row = await withTenant(tenantId, (tx) => updateMediaAsset(tx, tenantId, id, input));
    return toRecord(row);
  }

  async findByChecksum(tenantId: string, checksumSha256: string): Promise<MediaAssetRecord | null> {
    const row = await withTenant(tenantId, (tx) => findMediaAssetByChecksum(tx, tenantId, checksumSha256));
    return row ? toRecord(row) : null;
  }

  async trash(tenantId: string, id: string): Promise<void> {
    await withTenant(tenantId, (tx) => trashMediaAsset(tx, tenantId, id));
  }

  async restore(tenantId: string, id: string): Promise<void> {
    await withTenant(tenantId, (tx) => restoreMediaAsset(tx, tenantId, id));
  }

  async permanentlyDelete(tenantId: string, id: string): Promise<void> {
    await withTenant(tenantId, (tx) => permanentlyDeleteMediaAsset(tx, tenantId, id));
  }

  async setReferenceCount(tenantId: string, id: string, count: number): Promise<void> {
    await withTenant(tenantId, (tx) => refreshMediaAssetReferenceCount(tx, tenantId, id, count));
  }

  async getUsageSnapshot(tenantId: string, monthlyWindowStart: Date): Promise<UsageSnapshot> {
    return withTenant(tenantId, async (tx) => {
      const [usage, monthlyUploadedBytes] = await Promise.all([
        computeStorageUsage(tx, tenantId),
        computeMonthlyUploadUsage(tx, tenantId, monthlyWindowStart),
      ]);
      return {
        totalStorageBytes: usage.totalBytes,
        fileCount: usage.fileCount,
        monthlyUploadedBytes,
      };
    });
  }
}
