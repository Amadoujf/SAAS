/**
 * Abstraction de persistance des métadonnées `MediaAsset` — voir docs/12 §12.2,
 * « médiathèque R2 » (21 septembre 2026). Le pipeline d'import (upload-pipeline.ts)
 * ne connaît QUE cette interface, jamais Prisma ni une structure de stockage en
 * mémoire directement : `PrismaMediaRepository` (@yamacommerce/database +
 * `withTenant`, la vraie implémentation) et `InMemoryMediaRepository` (utilisée par
 * la démonstration `/demo/mediatheque` ET par les tests unitaires du pipeline, sans
 * PostgreSQL) implémentent le MÊME contrat — voir la même logique de bascule que
 * `@yamacommerce/storage` `registry.ts` pour le fournisseur de fichiers.
 */

export type MediaAssetType = "IMAGE" | "VIDEO" | "DOCUMENT";
export type MediaAssetStatus = "PENDING" | "READY" | "FAILED" | "TRASHED";

export interface MediaAssetRecord {
  id: string;
  tenantId: string;
  ownerId: string;
  originalName: string;
  storageKey: string;
  type: MediaAssetType;
  mimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
  altText: string | null;
  caption: string | null;
  folder: string;
  status: MediaAssetStatus;
  isPublic: boolean;
  checksumSha256: string;
  importedAt: Date;
  deletedAt: Date | null;
  metadata: Record<string, unknown>;
  referenceCount: number;
  variants: MediaVariantRecord[];
}

export interface MediaVariantRecord {
  key: string;
  format: string;
  storageKey: string;
  width: number;
  height: number;
  sizeBytes: number;
}

export interface CreatePendingInput {
  ownerId: string;
  originalName: string;
  storageKey: string;
  type: MediaAssetType;
  mimeType: string;
  sizeBytes: number;
  folder?: string;
}

export interface MarkReadyInput {
  sizeBytes: number;
  mimeType: string;
  width?: number | null;
  height?: number | null;
  durationSeconds?: number | null;
  checksumSha256: string;
  variants?: MediaVariantRecord[];
  metadata?: Record<string, unknown>;
}

export interface ListFilter {
  folder?: string;
  type?: MediaAssetType;
  status?: MediaAssetStatus | MediaAssetStatus[];
  search?: string;
}

export interface UpdateInput {
  originalName?: string;
  altText?: string | null;
  caption?: string | null;
  folder?: string;
}

export interface UsageSnapshot {
  totalStorageBytes: number;
  fileCount: number;
  monthlyUploadedBytes: number;
}

export interface MediaRepository {
  createPending(tenantId: string, input: CreatePendingInput): Promise<MediaAssetRecord>;
  markReady(tenantId: string, id: string, input: MarkReadyInput): Promise<MediaAssetRecord>;
  markFailed(tenantId: string, id: string, reason: string): Promise<void>;
  get(tenantId: string, id: string): Promise<MediaAssetRecord | null>;
  list(tenantId: string, filter?: ListFilter): Promise<MediaAssetRecord[]>;
  update(tenantId: string, id: string, input: UpdateInput): Promise<MediaAssetRecord>;
  /** Voir docs/12 §12.3, « MÉDIAS » — appelé UNIQUEMENT par le pipeline de publication
   *  pour promouvoir (jamais démarquer) un média réellement utilisé par la version
   *  publiée. */
  setPublic(tenantId: string, id: string, isPublic: boolean): Promise<void>;
  findByChecksum(tenantId: string, checksumSha256: string): Promise<MediaAssetRecord | null>;
  trash(tenantId: string, id: string): Promise<void>;
  restore(tenantId: string, id: string): Promise<void>;
  permanentlyDelete(tenantId: string, id: string): Promise<void>;
  setReferenceCount(tenantId: string, id: string, count: number): Promise<void>;
  getUsageSnapshot(tenantId: string, monthlyWindowStart: Date): Promise<UsageSnapshot>;
}
