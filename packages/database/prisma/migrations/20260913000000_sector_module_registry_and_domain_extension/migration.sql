-- ============================================================================
-- Phase 1 : registre secteurs/modules + extension du modèle Domain
-- (assistant de configuration de domaine, facturation, renouvellement)
-- Voir docs/11-secteurs-et-modules.md et l'exigence "domaine personnalisé" validée
-- le 13 septembre 2026.
--
-- Écrite à la main (pas de shadow database disponible dans cet environnement pour
-- `prisma migrate diff --from-migrations`) mais dans le style exact que Prisma aurait
-- généré, vérifiée par relecture champ par champ contre prisma/schema.prisma.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Extension du modèle Domain — assistant de configuration, cycle de vie,
--    facturation plateforme.
-- ----------------------------------------------------------------------------
ALTER TABLE "Domain"
  ADD COLUMN "verificationStatus" TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN "expectedDnsRecords" JSONB DEFAULT '[]',
  ADD COLUMN "detectedDnsRecords" JSONB,
  ADD COLUMN "lastCheckedAt" TIMESTAMP(3),
  ADD COLUMN "incompleteReminderSentAt" TIMESTAMP(3),
  ADD COLUMN "redirectSubdomainToCustom" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "status" TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN "purchasedByPlatform" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "priceBilledXOF" INTEGER,
  ADD COLUMN "renewalDate" TIMESTAMP(3),
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX "Domain_status_verificationStatus_idx" ON "Domain"("status", "verificationStatus");

-- La contrainte d'unicité globale sur "domain" existe déjà depuis la migration
-- initiale (@unique) : elle garantit à elle seule qu'un même domaine ne peut jamais
-- être rattaché à deux tenants — aucun changement nécessaire ici.

-- ----------------------------------------------------------------------------
-- 2. Formules d'abonnement — modules sectoriels inclus.
-- ----------------------------------------------------------------------------
ALTER TABLE "Plan" ADD COLUMN "includedModuleKeys" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- ----------------------------------------------------------------------------
-- 2bis. Tenant — rattachement au registre des secteurs (remplace fonctionnellement
--       l'enum BusinessType, conservé pour compatibilité d'affichage).
-- ----------------------------------------------------------------------------
ALTER TABLE "Tenant" ADD COLUMN "sectorKey" TEXT;

-- ----------------------------------------------------------------------------
-- 3. Registre des secteurs.
-- ----------------------------------------------------------------------------
CREATE TABLE "Sector" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "iconKey" TEXT,
    "vocabulary" JSONB NOT NULL DEFAULT '{}',
    "description" TEXT,
    "defaultModuleKeys" TEXT[],
    "optionalModuleKeys" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "compatibleTemplateTags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "proposedPageManifest" JSONB NOT NULL DEFAULT '[]',
    "customFieldSchema" JSONB,
    "isSystem" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Sector_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Sector_key_key" ON "Sector"("key");

ALTER TABLE "Tenant" ADD CONSTRAINT "Tenant_sectorKey_fkey"
  FOREIGN KEY ("sectorKey") REFERENCES "Sector"("key") ON DELETE SET NULL ON UPDATE CASCADE;

-- ----------------------------------------------------------------------------
-- 4. Registre des modules.
-- ----------------------------------------------------------------------------
CREATE TABLE "Module" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "sectorKeys" TEXT[],
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Module_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Module_key_key" ON "Module"("key");

-- ----------------------------------------------------------------------------
-- 5. Activation des modules par entreprise.
-- ----------------------------------------------------------------------------
CREATE TABLE "TenantModule" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "moduleKey" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "source" TEXT NOT NULL,
    "config" JSONB,
    "enabledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TenantModule_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TenantModule_tenantId_moduleKey_key" ON "TenantModule"("tenantId", "moduleKey");
CREATE INDEX "TenantModule_tenantId_isEnabled_idx" ON "TenantModule"("tenantId", "isEnabled");

ALTER TABLE "TenantModule" ADD CONSTRAINT "TenantModule_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ----------------------------------------------------------------------------
-- 6. Row-Level Security pour la nouvelle table portant tenantId.
--    (Sector et Module sont des registres globaux sans tenantId : pas de policy,
--    au même titre que Plan/SiteTemplate — voir docs/04 §4.4.)
--
--    Les privilèges GRANT/SELECT/INSERT/UPDATE/DELETE pour "yamacommerce_app" sont
--    hérités automatiquement via `ALTER DEFAULT PRIVILEGES`, déjà posé par la
--    migration `enable_row_level_security` de la Phase 0 — aucun GRANT explicite
--    n'est nécessaire ici tant que cette migration est appliquée par le même rôle
--    propriétaire que les précédentes.
-- ----------------------------------------------------------------------------
ALTER TABLE "TenantModule" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TenantModule" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "TenantModule"
  USING (yamacommerce_tenant_isolation_check("tenantId"));
