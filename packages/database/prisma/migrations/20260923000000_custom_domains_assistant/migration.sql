-- ============================================================================
-- Phase 1, étape « assistant complet de domaines personnalisés » — voir docs/13
-- (16 septembre 2026). Remplace les statuts épars de `Domain`
-- (verified/verificationStatus/sslStatus/status) par UN SEUL cycle de vie
-- (`DomainLifecycleStatus`) et ajoute la vérification de propriété renforcée, la
-- redirection sans boucle possible, et la gestion "domaine géré par la plateforme".
--
-- La RLS de "Domain" est déjà en place depuis prisma/migrations/
-- 20260912000001_enable_row_level_security — aucune nouvelle policy nécessaire ici.
--
-- Écrite à la main (pas de shadow database disponible) : chaque colonne vérifiée par
-- comparaison avec `prisma migrate diff --from-empty` sur le schéma final, même
-- méthode que les migrations précédentes de ce projet.
-- ============================================================================

CREATE TYPE "DomainLifecycleStatus" AS ENUM (
  'DRAFT', 'PENDING_DNS', 'VERIFYING', 'VERIFIED', 'SSL_PENDING', 'ACTIVE',
  'MISCONFIGURED', 'SUSPENDED', 'EXPIRED', 'REMOVED'
);

-- L'index composite sur les anciennes colonnes doit être retiré AVANT de les
-- supprimer.
DROP INDEX "Domain_status_verificationStatus_idx";

-- Ajoute la nouvelle colonne de statut et la remplit depuis l'état actuel AVANT de
-- supprimer les anciennes colonnes (aucune ligne ne doit perdre son état).
ALTER TABLE "Domain" ADD COLUMN "lifecycleStatus" "DomainLifecycleStatus" NOT NULL DEFAULT 'DRAFT';

UPDATE "Domain" SET "lifecycleStatus" = (CASE
  WHEN "status" = 'suspended' THEN 'SUSPENDED'
  WHEN "verified" = true AND "sslStatus" = 'issued' THEN 'ACTIVE'
  WHEN "verified" = true AND "sslStatus" = 'pending' THEN 'SSL_PENDING'
  WHEN "verified" = true THEN 'VERIFIED'
  WHEN "verificationStatus" = 'failed' THEN 'MISCONFIGURED'
  ELSE 'DRAFT'
END)::"DomainLifecycleStatus";

ALTER TABLE "Domain"
  DROP COLUMN "verified",
  DROP COLUMN "verificationStatus",
  DROP COLUMN "sslStatus",
  DROP COLUMN "status",
  DROP COLUMN "renewalDate",
  DROP COLUMN "redirectSubdomainToCustom";

ALTER TABLE "Domain" RENAME COLUMN "purchasedByPlatform" TO "managedByPlatform";

ALTER TABLE "Domain"
  ADD COLUMN "serveDirectlyWhenNotPrimary" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "verificationTokenExpiresAt" TIMESTAMP(3),
  ADD COLUMN "verificationAttempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "registrarProvider" TEXT,
  ADD COLUMN "externalRegistrarId" TEXT,
  ADD COLUMN "purchasedAt" TIMESTAMP(3),
  ADD COLUMN "expiresAt" TIMESTAMP(3),
  ADD COLUMN "autoRenew" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "purchaseCostXOF" INTEGER,
  ADD COLUMN "paymentStatus" TEXT,
  ADD COLUMN "legalOwnerName" TEXT,
  ADD COLUMN "legalOwnerContact" JSONB,
  ADD COLUMN "transferStatus" TEXT,
  ADD COLUMN "isLocked" BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX "Domain_lifecycleStatus_idx" ON "Domain"("lifecycleStatus");
