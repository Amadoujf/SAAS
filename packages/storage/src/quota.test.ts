import { describe, expect, it } from "vitest";
import { checkQuota, quotaConfigFromMB, summarizeQuotaUsage, type MediaQuotaConfig } from "./quota";

const ESSENTIEL: MediaQuotaConfig = quotaConfigFromMB({
  storageMB: 2_048,
  maxImageFileMB: 10,
  maxVideoFileMB: 200,
  maxDocumentFileMB: 10,
  maxMediaFileCount: 2_000,
  monthlyUploadMB: 2_048,
});

const MB = 1024 * 1024;

describe("quotaConfigFromMB", () => {
  it("convertit les méga-octets en octets", () => {
    expect(ESSENTIEL.totalStorageBytes).toBe(2_048 * MB);
    expect(ESSENTIEL.maxImageBytes).toBe(10 * MB);
  });
});

describe("checkQuota", () => {
  const emptyUsage = { totalStorageBytes: 0, fileCount: 0, monthlyUploadedBytes: 0 };

  it("autorise un fichier raisonnable sans avertissement", () => {
    const result = checkQuota(ESSENTIEL, emptyUsage, "image", 2 * MB);
    expect(result).toEqual({ allowed: true, warning: false });
  });

  it("rejette un fichier dépassant la taille maximale POUR CE TYPE (image)", () => {
    const result = checkQuota(ESSENTIEL, emptyUsage, "image", 11 * MB);
    expect(result).toMatchObject({ allowed: false, reason: "file_too_large" });
  });

  it("une vidéo peut dépasser la limite d'image sans être rejetée pour cette raison", () => {
    const result = checkQuota(ESSENTIEL, emptyUsage, "video", 150 * MB);
    expect(result.allowed).toBe(true);
  });

  it("rejette quand le quota de STOCKAGE TOTAL serait dépassé", () => {
    const usage = { totalStorageBytes: ESSENTIEL.totalStorageBytes - MB, fileCount: 0, monthlyUploadedBytes: 0 };
    const result = checkQuota(ESSENTIEL, usage, "image", 2 * MB);
    expect(result).toMatchObject({ allowed: false, reason: "storage_quota_exceeded" });
  });

  it("rejette quand le NOMBRE MAXIMAL DE FICHIERS serait dépassé", () => {
    const usage = { totalStorageBytes: 0, fileCount: ESSENTIEL.maxFileCount, monthlyUploadedBytes: 0 };
    const result = checkQuota(ESSENTIEL, usage, "image", 1 * MB);
    expect(result).toMatchObject({ allowed: false, reason: "file_count_exceeded" });
  });

  it("rejette quand le QUOTA MENSUEL D'IMPORTATION serait dépassé", () => {
    const usage = {
      totalStorageBytes: 0,
      fileCount: 0,
      monthlyUploadedBytes: ESSENTIEL.monthlyUploadBytes - MB,
    };
    const result = checkQuota(ESSENTIEL, usage, "image", 2 * MB);
    expect(result).toMatchObject({ allowed: false, reason: "monthly_upload_quota_exceeded" });
  });

  it("AVERTISSEMENT À 80% : autorise mais signale un avertissement au franchissement du seuil", () => {
    // Petite config dédiée : un seul fichier "image" (jusqu'à sa propre limite de
    // catégorie) doit pouvoir faire franchir le seuil de 80% du stockage TOTAL, ce
    // qu'ESSENTIEL (2048 Mo de total pour seulement 10 Mo par image) ne permet pas en
    // un seul import.
    const small: MediaQuotaConfig = quotaConfigFromMB({
      storageMB: 100,
      maxImageFileMB: 50,
      maxVideoFileMB: 50,
      maxDocumentFileMB: 50,
      maxMediaFileCount: 100,
      monthlyUploadMB: 1_000, // hors de portée pour ce test
    });
    const usage = { totalStorageBytes: Math.floor(small.totalStorageBytes * 0.79), fileCount: 0, monthlyUploadedBytes: 0 };
    // Ce fichier fait franchir le seuil des 80% de stockage total (79% + 2%).
    const result = checkQuota(small, usage, "image", Math.ceil(small.totalStorageBytes * 0.02));
    expect(result).toMatchObject({ allowed: true, warning: true });
  });

  it("BLOCAGE PROPRE À 100% : refuse strictement au-delà, jamais un dépassement silencieux", () => {
    const usage = { totalStorageBytes: ESSENTIEL.totalStorageBytes, fileCount: 0, monthlyUploadedBytes: 0 };
    const result = checkQuota(ESSENTIEL, usage, "image", 1);
    expect(result.allowed).toBe(false);
  });
});

describe("summarizeQuotaUsage", () => {
  it("niveau 'ok' sous 80%", () => {
    const usage = { totalStorageBytes: ESSENTIEL.totalStorageBytes * 0.5, fileCount: 0, monthlyUploadedBytes: 0 };
    expect(summarizeQuotaUsage(ESSENTIEL, usage).level).toBe("ok");
  });

  it("niveau 'warning' entre 80% et 100%", () => {
    const usage = { totalStorageBytes: ESSENTIEL.totalStorageBytes * 0.85, fileCount: 0, monthlyUploadedBytes: 0 };
    expect(summarizeQuotaUsage(ESSENTIEL, usage).level).toBe("warning");
  });

  it("niveau 'exceeded' à 100% ou plus", () => {
    const usage = { totalStorageBytes: ESSENTIEL.totalStorageBytes * 1.1, fileCount: 0, monthlyUploadedBytes: 0 };
    expect(summarizeQuotaUsage(ESSENTIEL, usage).level).toBe("exceeded");
  });

  it("retient le PIRE des trois ratios (stockage/mensuel/nombre de fichiers)", () => {
    const usage = {
      totalStorageBytes: 0,
      fileCount: ESSENTIEL.maxFileCount, // 100% sur ce seul critère
      monthlyUploadedBytes: 0,
    };
    expect(summarizeQuotaUsage(ESSENTIEL, usage).level).toBe("exceeded");
  });
});
