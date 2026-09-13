-- ============================================================================
-- Phase 1, étape « éditeur visuel » : fondation données (brouillon/publié,
-- historique/restauration, publication programmée) — voir docs/12 §12.2 et
-- docs/04 §4.5.7. Cette migration pose UNIQUEMENT la couche de persistance
-- (`TenantSiteVersion`, `Page`) et son isolation RLS ; l'interface glisser-déposer et
-- le job de publication programmée sont des étapes suivantes, volontairement pas
-- construites ici (« sans passer à l'élément suivant sans confirmation »).
--
-- Écrite à la main (pas de shadow database disponible pour
-- `prisma migrate diff --from-migrations`) : chaque colonne/index/contrainte
-- vérifié par comparaison avec `prisma migrate diff --from-empty` sur le schéma final
-- (même méthode que les migrations précédentes de ce projet).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Historique de versions d'un site tenant. `tenantId` est dénormalisé depuis
--    TenantSite.tenantId (au lieu d'une jointure dans la policy RLS) pour suivre
--    exactement le Pattern A déjà utilisé par tout le reste du schéma.
-- ----------------------------------------------------------------------------
CREATE TABLE "TenantSiteVersion" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "tenantSiteId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "scheduledAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantSiteVersion_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TenantSiteVersion_tenantSiteId_status_idx" ON "TenantSiteVersion"("tenantSiteId", "status");
CREATE INDEX "TenantSiteVersion_tenantId_idx" ON "TenantSiteVersion"("tenantId");

ALTER TABLE "TenantSiteVersion" ADD CONSTRAINT "TenantSiteVersion_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TenantSiteVersion" ADD CONSTRAINT "TenantSiteVersion_tenantSiteId_fkey"
  FOREIGN KEY ("tenantSiteId") REFERENCES "TenantSite"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ----------------------------------------------------------------------------
-- 2. Pages au sein d'une version. `blocks` porte un tableau de `SectionInstance`
--    (voir @yamacommerce/templates) — jamais écrit sans validation préalable côté
--    application (même garantie que SiteTemplate.pageManifest).
--    ON DELETE CASCADE sur tenantSiteVersionId : supprimer une version (ex. purge
--    d'anciens brouillons de test) supprime ses pages, jamais l'inverse.
-- ----------------------------------------------------------------------------
CREATE TABLE "Page" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "tenantSiteVersionId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "isHome" BOOLEAN NOT NULL DEFAULT false,
    "blocks" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Page_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Page_tenantId_idx" ON "Page"("tenantId");
CREATE UNIQUE INDEX "Page_tenantSiteVersionId_slug_key" ON "Page"("tenantSiteVersionId", "slug");

ALTER TABLE "Page" ADD CONSTRAINT "Page_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Page" ADD CONSTRAINT "Page_tenantSiteVersionId_fkey"
  FOREIGN KEY ("tenantSiteVersionId") REFERENCES "TenantSiteVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ----------------------------------------------------------------------------
-- 3. Row-Level Security (Pattern A, voir docs/04 §4.4 et
--    prisma/migrations/20260912000001_enable_row_level_security/migration.sql pour
--    la définition de yamacommerce_tenant_isolation_check). Privilèges pour
--    "yamacommerce_app" hérités via ALTER DEFAULT PRIVILEGES (posé en Phase 0) —
--    aucun GRANT explicite nécessaire ici.
-- ----------------------------------------------------------------------------
ALTER TABLE "TenantSiteVersion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TenantSiteVersion" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "TenantSiteVersion"
  USING (yamacommerce_tenant_isolation_check("tenantId"));

ALTER TABLE "Page" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Page" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Page"
  USING (yamacommerce_tenant_isolation_check("tenantId"));
