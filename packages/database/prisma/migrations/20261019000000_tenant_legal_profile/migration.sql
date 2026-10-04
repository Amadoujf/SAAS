-- Informations légales d'une entreprise (mentions légales, conditions de vente,
-- politique de confidentialité de SON site). Une ligne au plus par entreprise.

CREATE TABLE "TenantLegalProfile" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "legalName" TEXT,
    "legalForm" TEXT,
    "ninea" TEXT,
    "rccm" TEXT,
    "address" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "publicationDirector" TEXT,
    "returnPolicy" TEXT,
    "additionalTerms" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TenantLegalProfile_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "TenantLegalProfile_length_check" CHECK (
      coalesce(char_length("legalName"), 0) <= 120
      AND coalesce(char_length("legalForm"), 0) <= 60
      AND coalesce(char_length("ninea"), 0) <= 30
      AND coalesce(char_length("rccm"), 0) <= 40
      AND coalesce(char_length("address"), 0) <= 240
      AND coalesce(char_length("email"), 0) <= 120
      AND coalesce(char_length("phone"), 0) <= 30
      AND coalesce(char_length("publicationDirector"), 0) <= 120
      AND coalesce(char_length("returnPolicy"), 0) <= 3000
      AND coalesce(char_length("additionalTerms"), 0) <= 6000
    )
);
CREATE UNIQUE INDEX "TenantLegalProfile_tenantId_key" ON "TenantLegalProfile"("tenantId");
ALTER TABLE "TenantLegalProfile" ADD CONSTRAINT "TenantLegalProfile_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "TenantLegalProfile" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TenantLegalProfile" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "TenantLegalProfile" USING (yamacommerce_tenant_isolation_check("tenantId"));
