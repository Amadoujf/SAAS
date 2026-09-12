-- ============================================================================
-- Phase 1 : registre de templates (design tokens + manifeste de pages/sections)
-- Voir docs/12-systeme-templates-et-direction-artistique.md et la demande de
-- validation du 13 septembre 2026 (ordre : design tokens → registre de templates).
--
-- Remplace les modèles placeholder "SiteTemplate"/"TenantSite"/"Page" posés en
-- Phase 0 (jamais appliqués à une base réelle, aucune perte de données possible) par
-- des modèles complets. Écrite à la main (pas de shadow database disponible pour
-- `prisma migrate diff --from-migrations`), chaque colonne vérifiée par comparaison
-- avec `prisma migrate diff --from-empty` sur le schéma final.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Suppression des tables placeholder de la Phase 0 (dans l'ordre des dépendances :
--    l'enfant "Page" avant son parent "TenantSite", lui-même avant "SiteTemplate").
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS "Page";
DROP TABLE IF EXISTS "TenantSite";
DROP TABLE IF EXISTS "SiteTemplate";

-- ----------------------------------------------------------------------------
-- 2. Registre des templates.
-- ----------------------------------------------------------------------------
CREATE TABLE "SiteTemplate" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sectorKey" TEXT NOT NULL,
    "description" TEXT,
    "artDirectionKey" TEXT NOT NULL,
    "previewImageUrl" TEXT,
    "pageManifest" JSONB NOT NULL,
    "availableSectionKeys" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "requiredModuleKeys" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "optionalModuleKeys" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "defaultDesignTokens" JSONB NOT NULL,
    "defaultAnimationLevel" TEXT NOT NULL DEFAULT 'dynamic',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "version" INTEGER NOT NULL DEFAULT 1,
    "mobileCompatible" BOOLEAN NOT NULL DEFAULT true,
    "demoData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SiteTemplate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SiteTemplate_key_key" ON "SiteTemplate"("key");
CREATE INDEX "SiteTemplate_sectorKey_status_idx" ON "SiteTemplate"("sectorKey", "status");

ALTER TABLE "SiteTemplate" ADD CONSTRAINT "SiteTemplate_sectorKey_fkey"
  FOREIGN KEY ("sectorKey") REFERENCES "Sector"("key") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ----------------------------------------------------------------------------
-- 3. Site de chaque entreprise (jamais de donnée métier ici — voir docs/12 §12.1).
-- ----------------------------------------------------------------------------
CREATE TABLE "TenantSite" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "designTokenOverrides" JSONB NOT NULL DEFAULT '{}',
    "animationLevelOverride" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TenantSite_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TenantSite_tenantId_key" ON "TenantSite"("tenantId");

ALTER TABLE "TenantSite" ADD CONSTRAINT "TenantSite_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TenantSite" ADD CONSTRAINT "TenantSite_templateId_fkey"
  FOREIGN KEY ("templateId") REFERENCES "SiteTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ----------------------------------------------------------------------------
-- 4. Row-Level Security pour "TenantSite" (porte tenantId). "SiteTemplate" est un
--    registre global sans tenantId (comme Plan/Sector/Module) : pas de policy.
--    Privilèges pour "yamacommerce_app" hérités via ALTER DEFAULT PRIVILEGES (posé en
--    Phase 0) — aucun GRANT explicite nécessaire ici.
-- ----------------------------------------------------------------------------
ALTER TABLE "TenantSite" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TenantSite" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "TenantSite"
  USING (yamacommerce_tenant_isolation_check("tenantId"));
