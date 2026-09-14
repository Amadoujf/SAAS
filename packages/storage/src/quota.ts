/**
 * Calcul des quotas de médiathèque — voir docs/12 §12.2, « médiathèque R2 » (21
 * septembre 2026), section LIMITES. Module PUR : reçoit la configuration de la
 * formule (résolue par l'appelant depuis `Plan`, voir @yamacommerce/database) et
 * l'usage courant (résolu depuis `computeStorageUsage`/`computeMonthlyUploadUsage`,
 * voir media-assets-registry.ts) — ne connaît lui-même ni Prisma ni les noms de
 * formules ("Essentiel", "Business", ...), pour rester réutilisable tel quel si un
 * futur secteur définit ses propres formules.
 */

export interface MediaQuotaConfig {
  totalStorageBytes: number;
  maxImageBytes: number;
  maxVideoBytes: number;
  maxDocumentBytes: number;
  maxFileCount: number;
  monthlyUploadBytes: number;
}

export interface MediaUsageSnapshot {
  totalStorageBytes: number;
  fileCount: number;
  monthlyUploadedBytes: number;
}

export type MediaCategory = "image" | "video" | "document";

/** Construit une config de quota à partir de valeurs en mégaoctets (c'est ainsi que
 *  `Plan` les stocke, voir schema.prisma) — conversion en un seul endroit. */
export function quotaConfigFromMB(input: {
  storageMB: number;
  maxImageFileMB: number;
  maxVideoFileMB: number;
  maxDocumentFileMB: number;
  maxMediaFileCount: number;
  monthlyUploadMB: number;
}): MediaQuotaConfig {
  const MB = 1024 * 1024;
  return {
    totalStorageBytes: input.storageMB * MB,
    maxImageBytes: input.maxImageFileMB * MB,
    maxVideoBytes: input.maxVideoFileMB * MB,
    maxDocumentBytes: input.maxDocumentFileMB * MB,
    maxFileCount: input.maxMediaFileCount,
    monthlyUploadBytes: input.monthlyUploadMB * MB,
  };
}

export function maxBytesForCategory(config: MediaQuotaConfig, category: MediaCategory): number {
  switch (category) {
    case "image":
      return config.maxImageBytes;
    case "video":
      return config.maxVideoBytes;
    case "document":
      return config.maxDocumentBytes;
  }
}

export type QuotaCheckFailureReason =
  | "file_too_large"
  | "storage_quota_exceeded"
  | "file_count_exceeded"
  | "monthly_upload_quota_exceeded";

export type QuotaCheckResult =
  | { allowed: true; warning: false }
  /** Autorisé, mais l'utilisation totale FRANCHIRA le seuil d'avertissement de 80 %
   *  une fois ce fichier accepté — voir « Avertissement à 80 % ». */
  | { allowed: true; warning: true }
  | { allowed: false; warning: false; reason: QuotaCheckFailureReason; message: string };

const WARNING_THRESHOLD_RATIO = 0.8;

/**
 * Vérifie si un NOUVEAL import de `fileSizeBytes` (de catégorie `category`) peut être
 * accepté, compte tenu de l'usage courant — voir « Blocage propre à 100 % ». Une seule
 * fonction couvre les 4 limites demandées (taille du fichier, quota total, nombre de
 * fichiers, quota mensuel) pour que l'appelant n'ait qu'un point d'entrée à respecter
 * avant de générer une autorisation d'import (voir upload-pipeline.ts, étape 2 du
 * parcours : « Le serveur vérifie son abonnement et son quota »).
 */
export function checkQuota(
  config: MediaQuotaConfig,
  usage: MediaUsageSnapshot,
  category: MediaCategory,
  fileSizeBytes: number,
): QuotaCheckResult {
  const maxForCategory = maxBytesForCategory(config, category);
  if (fileSizeBytes > maxForCategory) {
    return {
      allowed: false,
      warning: false,
      reason: "file_too_large",
      message: `Ce fichier dépasse la taille maximale autorisée pour ce type (${maxForCategory} octets).`,
    };
  }

  if (usage.fileCount + 1 > config.maxFileCount) {
    return {
      allowed: false,
      warning: false,
      reason: "file_count_exceeded",
      message: `Le nombre maximal de fichiers de la formule (${config.maxFileCount}) est atteint.`,
    };
  }

  if (usage.totalStorageBytes + fileSizeBytes > config.totalStorageBytes) {
    return {
      allowed: false,
      warning: false,
      reason: "storage_quota_exceeded",
      message: "Le quota de stockage total de la formule est atteint.",
    };
  }

  if (usage.monthlyUploadedBytes + fileSizeBytes > config.monthlyUploadBytes) {
    return {
      allowed: false,
      warning: false,
      reason: "monthly_upload_quota_exceeded",
      message: "Le quota mensuel d'importation de la formule est atteint.",
    };
  }

  const projectedStorageRatio = (usage.totalStorageBytes + fileSizeBytes) / config.totalStorageBytes;
  const projectedMonthlyRatio =
    (usage.monthlyUploadedBytes + fileSizeBytes) / config.monthlyUploadBytes;
  const warning =
    projectedStorageRatio >= WARNING_THRESHOLD_RATIO || projectedMonthlyRatio >= WARNING_THRESHOLD_RATIO;

  return { allowed: true, warning };
}

export interface QuotaUsageSummary {
  storageUsedRatio: number;
  monthlyUsedRatio: number;
  fileCountUsedRatio: number;
  level: "ok" | "warning" | "exceeded";
}

/** Résumé prêt à afficher (voir « Affichage de l'espace utilisé ») — les 3 ratios
 *  ET un niveau global (le pire des trois) pour une barre de progression simple. */
export function summarizeQuotaUsage(
  config: MediaQuotaConfig,
  usage: MediaUsageSnapshot,
): QuotaUsageSummary {
  const storageUsedRatio = config.totalStorageBytes > 0 ? usage.totalStorageBytes / config.totalStorageBytes : 0;
  const monthlyUsedRatio =
    config.monthlyUploadBytes > 0 ? usage.monthlyUploadedBytes / config.monthlyUploadBytes : 0;
  const fileCountUsedRatio = config.maxFileCount > 0 ? usage.fileCount / config.maxFileCount : 0;
  const worst = Math.max(storageUsedRatio, monthlyUsedRatio, fileCountUsedRatio);
  const level: QuotaUsageSummary["level"] =
    worst >= 1 ? "exceeded" : worst >= WARNING_THRESHOLD_RATIO ? "warning" : "ok";
  return { storageUsedRatio, monthlyUsedRatio, fileCountUsedRatio, level };
}
