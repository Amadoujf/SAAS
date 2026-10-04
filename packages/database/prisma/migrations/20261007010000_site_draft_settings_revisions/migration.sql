-- Un seul brouillon pour tout le site (27 septembre 2026) : en plus des sections, le
-- brouillon porte désormais l'IDENTITÉ proposée (style, couleurs, logo) et les réglages
-- d'animation. Ils ne deviennent visibles qu'à la publication, comme les sections —
-- une proposition de l'assistant ne change jamais le site en ligne à elle seule.
ALTER TABLE "TenantSiteVersion" ADD COLUMN "settings" JSONB;

-- Historique des modifications du brouillon (assistant IA ou modification manuelle
-- depuis l'aperçu) : état avant/après, pour annuler la dernière modification tant que
-- le brouillon n'a pas changé depuis.
CREATE TABLE "SiteRevision" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "tenantSiteVersionId" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "before" JSONB NOT NULL,
  "after" JSONB NOT NULL,
  "afterSignature" TEXT NOT NULL,
  "aiJobId" TEXT,
  "createdBy" TEXT,
  "undoneAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SiteRevision_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SiteRevision_source_check" CHECK ("source" IN ('ai', 'manual'))
);
CREATE INDEX "SiteRevision_tenantId_createdAt_idx" ON "SiteRevision"("tenantId", "createdAt");
ALTER TABLE "SiteRevision" ADD CONSTRAINT "SiteRevision_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SiteRevision" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SiteRevision" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "SiteRevision" USING (yamacommerce_tenant_isolation_check("tenantId"));
GRANT SELECT, INSERT, UPDATE ON "SiteRevision" TO yamacommerce_app;
