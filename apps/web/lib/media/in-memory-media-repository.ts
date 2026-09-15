import { randomUUID } from "node:crypto";
import type {
  CreatePendingInput,
  ListFilter,
  MarkReadyInput,
  MediaAssetRecord,
  MediaRepository,
  UpdateInput,
  UsageSnapshot,
} from "./media-repository";

/**
 * Implémentation en mémoire de `MediaRepository` — voir media-repository.ts. Utilisée
 * PAR LA DÉMONSTRATION `/demo/mediatheque` (aucun PostgreSQL requis, comme tous les
 * autres `/demo/*`) ET par les tests unitaires du pipeline d'import
 * (upload-pipeline.test.ts) : les mêmes garanties (isolation par tenantId, cycle de
 * vie PENDING -> READY/FAILED -> TRASHED -> supprimé) sont donc vérifiées deux fois —
 * une fois ici (rapide, sans base de données), une fois contre PostgreSQL réel (voir
 * @yamacommerce/database `media-assets-registry.ts` + tests, RLS incluse).
 *
 * État PURE MÉMOIRE DE PROCESSUS : perdu à chaque redémarrage du serveur de
 * développement — acceptable pour une démonstration, jamais pour la production (voir
 * `PrismaMediaRepository`).
 */
export class InMemoryMediaRepository implements MediaRepository {
  private readonly records = new Map<string, MediaAssetRecord>();

  private ownedOrNull(tenantId: string, id: string): MediaAssetRecord | null {
    const record = this.records.get(id);
    if (!record || record.tenantId !== tenantId) return null;
    return record;
  }

  async createPending(tenantId: string, input: CreatePendingInput): Promise<MediaAssetRecord> {
    const record: MediaAssetRecord = {
      id: randomUUID(),
      tenantId,
      ownerId: input.ownerId,
      originalName: input.originalName,
      storageKey: input.storageKey,
      type: input.type,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      width: null,
      height: null,
      durationSeconds: null,
      altText: null,
      caption: null,
      folder: input.folder ?? "",
      status: "PENDING",
      isPublic: false,
      checksumSha256: "",
      importedAt: new Date(),
      deletedAt: null,
      metadata: {},
      referenceCount: 0,
      variants: [],
    };
    this.records.set(record.id, record);
    return { ...record };
  }

  async markReady(tenantId: string, id: string, input: MarkReadyInput): Promise<MediaAssetRecord> {
    const record = this.ownedOrNull(tenantId, id);
    if (!record || record.status !== "PENDING") {
      throw new Error(`markReady: aucune ligne PENDING "${id}" pour ce tenant.`);
    }
    record.status = "READY";
    record.sizeBytes = input.sizeBytes;
    record.mimeType = input.mimeType;
    record.width = input.width ?? null;
    record.height = input.height ?? null;
    record.durationSeconds = input.durationSeconds ?? null;
    record.checksumSha256 = input.checksumSha256;
    if (input.variants) record.variants = input.variants;
    if (input.metadata) record.metadata = input.metadata;
    return { ...record };
  }

  async markFailed(tenantId: string, id: string, reason: string): Promise<void> {
    const record = this.ownedOrNull(tenantId, id);
    if (!record || record.status !== "PENDING") return;
    record.status = "FAILED";
    record.metadata = { rejectionReason: reason };
  }

  async get(tenantId: string, id: string): Promise<MediaAssetRecord | null> {
    const record = this.ownedOrNull(tenantId, id);
    return record ? { ...record } : null;
  }

  async list(tenantId: string, filter: ListFilter = {}): Promise<MediaAssetRecord[]> {
    const statusFilter = filter.status ?? "READY";
    const statuses = Array.isArray(statusFilter) ? statusFilter : [statusFilter];
    return [...this.records.values()]
      .filter((record) => record.tenantId === tenantId)
      .filter((record) => statuses.includes(record.status))
      .filter((record) => (filter.folder !== undefined ? record.folder === filter.folder : true))
      .filter((record) => (filter.type ? record.type === filter.type : true))
      .filter((record) =>
        filter.search
          ? record.originalName.toLowerCase().includes(filter.search.toLowerCase())
          : true,
      )
      .sort((a, b) => b.importedAt.getTime() - a.importedAt.getTime())
      .map((record) => ({ ...record }));
  }

  async update(tenantId: string, id: string, input: UpdateInput): Promise<MediaAssetRecord> {
    const record = this.ownedOrNull(tenantId, id);
    if (!record) throw new Error(`update: média "${id}" introuvable pour ce tenant.`);
    if (input.originalName !== undefined) record.originalName = input.originalName;
    if (input.altText !== undefined) record.altText = input.altText;
    if (input.caption !== undefined) record.caption = input.caption;
    if (input.folder !== undefined) record.folder = input.folder;
    return { ...record };
  }

  async setPublic(tenantId: string, id: string, isPublic: boolean): Promise<void> {
    const record = this.ownedOrNull(tenantId, id);
    if (record) record.isPublic = isPublic;
  }

  async findByChecksum(tenantId: string, checksumSha256: string): Promise<MediaAssetRecord | null> {
    const found = [...this.records.values()].find(
      (record) => record.tenantId === tenantId && record.status === "READY" && record.checksumSha256 === checksumSha256,
    );
    return found ? { ...found } : null;
  }

  async trash(tenantId: string, id: string): Promise<void> {
    const record = this.ownedOrNull(tenantId, id);
    if (!record || record.status !== "READY") {
      throw new Error(`trash: média "${id}" introuvable ou déjà dans la corbeille.`);
    }
    record.status = "TRASHED";
    record.deletedAt = new Date();
  }

  async restore(tenantId: string, id: string): Promise<void> {
    const record = this.ownedOrNull(tenantId, id);
    if (!record || record.status !== "TRASHED") {
      throw new Error(`restore: média "${id}" introuvable dans la corbeille.`);
    }
    record.status = "READY";
    record.deletedAt = null;
  }

  async permanentlyDelete(tenantId: string, id: string): Promise<void> {
    const record = this.ownedOrNull(tenantId, id);
    if (!record || record.status !== "TRASHED") {
      throw new Error(`permanentlyDelete: média "${id}" introuvable dans la corbeille.`);
    }
    this.records.delete(id);
  }

  async setReferenceCount(tenantId: string, id: string, count: number): Promise<void> {
    const record = this.ownedOrNull(tenantId, id);
    if (record) record.referenceCount = count;
  }

  async getUsageSnapshot(tenantId: string, monthlyWindowStart: Date): Promise<UsageSnapshot> {
    const all = [...this.records.values()].filter((record) => record.tenantId === tenantId);
    const activeOrTrashed = all.filter((record) => record.status === "READY" || record.status === "TRASHED");
    const totalStorageBytes = activeOrTrashed.reduce((sum, record) => sum + record.sizeBytes, 0);
    const fileCount = all.filter((record) => record.status === "READY").length;
    const monthlyUploadedBytes = activeOrTrashed
      .filter((record) => record.importedAt >= monthlyWindowStart)
      .reduce((sum, record) => sum + record.sizeBytes, 0);
    return { totalStorageBytes, fileCount, monthlyUploadedBytes };
  }
}
