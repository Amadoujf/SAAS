-- Contenus mis en avant sur l'accueil des boutiques (templates commerce).
CREATE TABLE "StorefrontContent" (
  "tenantId" TEXT NOT NULL,
  "content" JSONB NOT NULL,
  "updatedBy" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StorefrontContent_pkey" PRIMARY KEY ("tenantId")
);
ALTER TABLE "StorefrontContent" ADD CONSTRAINT "StorefrontContent_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "StorefrontContent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StorefrontContent" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "StorefrontContent"
  USING (yamacommerce_tenant_isolation_check("tenantId"));
