-- ============================================================================
-- Phase 1, étape « publication définitive des sites » — voir docs/12 §12.3
-- (22 septembre 2026). Étend UNIQUEMENT `TenantSiteVersion` (numérotation,
-- message de publication, résumé des changements figé, domaine utilisé,
-- traçabilité de restauration) ; la RLS de cette table est déjà en place depuis
-- prisma/migrations/20260920000000_visual_editor_versioning, aucune nouvelle policy
-- n'est nécessaire ici.
--
-- Écrite à la main (pas de shadow database disponible), même méthode que les
-- migrations précédentes de ce projet : chaque colonne vérifiée par comparaison
-- avec `prisma migrate diff --from-empty` sur le schéma final.
-- ============================================================================

ALTER TABLE "TenantSiteVersion" ADD COLUMN "versionNumber" INTEGER;
ALTER TABLE "TenantSiteVersion" ADD COLUMN "publishMessage" TEXT;
ALTER TABLE "TenantSiteVersion" ADD COLUMN "changesSummary" JSONB;
ALTER TABLE "TenantSiteVersion" ADD COLUMN "domainUsed" TEXT;
ALTER TABLE "TenantSiteVersion" ADD COLUMN "wasScheduled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "TenantSiteVersion" ADD COLUMN "restoredFromVersionId" TEXT;
ALTER TABLE "TenantSiteVersion" ADD COLUMN "restoreJustification" TEXT;

ALTER TABLE "TenantSiteVersion" ADD CONSTRAINT "TenantSiteVersion_restoredFromVersionId_fkey"
  FOREIGN KEY ("restoredFromVersionId") REFERENCES "TenantSiteVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
