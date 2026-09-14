-- ============================================================================
-- Phase 1, étape « médiathèque R2 » — voir docs/12 §12.2 (21 septembre 2026).
-- Pose UNIQUEMENT la couche de persistance (limites par formule + `MediaAsset`) et
-- son isolation RLS ; le fournisseur de stockage (@yamacommerce/storage), le pipeline
-- d'import et l'interface sont des modules applicatifs séparés, pas cette migration.
--
-- Écrite à la main (pas de shadow database disponible), même méthode que les
-- migrations précédentes de ce projet.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Limites de médiathèque par formule — voir Plan.storageMB (déjà existant,
--    réutilisé comme quota TOTAL de stockage) + 4 nouvelles colonnes. Défauts fournis
--    pour ne pas casser les lignes déjà seedées ; le seed applicatif (seed.ts) écrase
--    ensuite ces valeurs avec les vraies limites par formule.
-- ----------------------------------------------------------------------------
ALTER TABLE "Plan" ADD COLUMN "maxImageFileMB" INTEGER NOT NULL DEFAULT 10;
ALTER TABLE "Plan" ADD COLUMN "maxVideoFileMB" INTEGER NOT NULL DEFAULT 200;
ALTER TABLE "Plan" ADD COLUMN "maxDocumentFileMB" INTEGER NOT NULL DEFAULT 10;
ALTER TABLE "Plan" ADD COLUMN "maxMediaFileCount" INTEGER NOT NULL DEFAULT 2000;
ALTER TABLE "Plan" ADD COLUMN "monthlyUploadMB" INTEGER NOT NULL DEFAULT 2048;

-- ----------------------------------------------------------------------------
-- 2. Médias — voir MediaAsset dans schema.prisma pour la documentation complète de
--    chaque champ. `tenantId` dénormalisé (Pattern A, comme TenantSiteVersion/Page).
-- ----------------------------------------------------------------------------
CREATE TYPE "MediaAssetType" AS ENUM ('IMAGE', 'VIDEO', 'DOCUMENT');
CREATE TYPE "MediaAssetStatus" AS ENUM ('PENDING', 'READY', 'FAILED', 'TRASHED');

CREATE TABLE "MediaAsset" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "type" "MediaAssetType" NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "durationSeconds" DOUBLE PRECISION,
    "altText" TEXT,
    "caption" TEXT,
    "folder" TEXT NOT NULL DEFAULT '',
    "status" "MediaAssetStatus" NOT NULL DEFAULT 'PENDING',
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "checksumSha256" TEXT NOT NULL,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "referenceCount" INTEGER NOT NULL DEFAULT 0,
    "variants" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MediaAsset_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MediaAsset_storageKey_key" ON "MediaAsset"("storageKey");
CREATE INDEX "MediaAsset_tenantId_status_idx" ON "MediaAsset"("tenantId", "status");
CREATE INDEX "MediaAsset_tenantId_folder_idx" ON "MediaAsset"("tenantId", "folder");
CREATE INDEX "MediaAsset_tenantId_checksumSha256_idx" ON "MediaAsset"("tenantId", "checksumSha256");
CREATE INDEX "MediaAsset_tenantId_deletedAt_idx" ON "MediaAsset"("tenantId", "deletedAt");

ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ----------------------------------------------------------------------------
-- 3. Row-Level Security (Pattern A) — voir
--    prisma/migrations/20260912000001_enable_row_level_security/migration.sql pour
--    `yamacommerce_tenant_isolation_check`. C'est CETTE policy, pas seulement la
--    logique applicative de @yamacommerce/storage, qui garantit qu'un client ne peut
--    "jamais lire/remplacer/supprimer les médias d'un autre tenant" même en cas de
--    bug applicatif — défense en profondeur.
-- ----------------------------------------------------------------------------
ALTER TABLE "MediaAsset" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MediaAsset" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "MediaAsset"
  USING (yamacommerce_tenant_isolation_check("tenantId"));
