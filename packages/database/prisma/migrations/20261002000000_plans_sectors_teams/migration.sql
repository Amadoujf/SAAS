-- Formules commerciales (octobre 2026), secteurs disponibles, invitations d'équipe,
-- demandes de devis plateforme.

-- 1. Formules --------------------------------------------------------------------
ALTER TABLE "SubscriptionPlan" ADD COLUMN "isQuoteOnly" BOOLEAN NOT NULL DEFAULT false;

UPDATE "SubscriptionPlan" SET
  "priceMonthly" = 9900, "priceYearly" = 99000,
  "maxProducts" = 100, "maxEmployees" = 1, "maxShops" = 1,
  "customDomainAllowed" = false, "maxCustomDomains" = 0,
  "advancedReports" = false, "whatsappAutomation" = false,
  "maxAIGenerationsPerMonth" = 0, "maxAIImagesAnalyzedPerMonth" = 0, "maxAIProductsImportedPerMonth" = 0,
  "aiEstimatedCostCapXOF" = 0,
  "features" = '["premium_site","template_customization","orders","customer_requests","cod_payment","manual_mobile_money"]'
WHERE "name" = 'Essentiel';

UPDATE "SubscriptionPlan" SET
  "priceMonthly" = 24900, "priceYearly" = 249000,
  "maxProducts" = 1000, "maxEmployees" = 5, "maxShops" = 1,
  "customDomainAllowed" = true, "maxCustomDomains" = 1,
  "advancedReports" = false, "whatsappAutomation" = false,
  "maxAIGenerationsPerMonth" = 300, "maxAIImagesAnalyzedPerMonth" = 100, "maxAIProductsImportedPerMonth" = 500,
  "aiEstimatedCostCapXOF" = 2500,
  "features" = '["premium_site","template_customization","orders","customer_requests","cod_payment","manual_mobile_money","custom_domain","business_management","invoices","statistics","ai_quota"]'
WHERE "name" = 'Business';

UPDATE "SubscriptionPlan" SET
  "priceMonthly" = 49900, "priceYearly" = 499000,
  "maxProducts" = 5000, "maxEmployees" = 15, "maxShops" = 1,
  "customDomainAllowed" = true, "maxCustomDomains" = 3,
  "advancedReports" = true, "whatsappAutomation" = true,
  "maxAIGenerationsPerMonth" = 1500, "maxAIImagesAnalyzedPerMonth" = 500, "maxAIProductsImportedPerMonth" = 5000,
  "aiEstimatedCostCapXOF" = 10000,
  "features" = '["premium_site","template_customization","orders","customer_requests","cod_payment","manual_mobile_money","custom_domain","business_management","invoices","statistics","ai_quota","advanced_management","automations","priority_support","advanced_reports"]'
WHERE "name" = 'Premium';

UPDATE "SubscriptionPlan" SET
  "name" = 'Sur mesure', "isQuoteOnly" = true,
  "priceMonthly" = 0, "priceYearly" = 0,
  "features" = '["premium_site","template_customization","orders","customer_requests","cod_payment","manual_mobile_money","custom_domain","business_management","invoices","statistics","ai_quota","advanced_management","automations","priority_support","advanced_reports","multi_establishment","integrations","dedicated_onboarding"]'
WHERE "name" = 'Entreprise';

-- 2. Secteurs disponibles à l'achat ---------------------------------------------------
ALTER TABLE "Sector" ADD COLUMN "isAvailable" BOOLEAN NOT NULL DEFAULT false;
UPDATE "Sector" SET "isAvailable" = true WHERE "key" IN ('ecommerce', 'fashion');

-- 3. Invitations d'équipe --------------------------------------------------------------
CREATE TABLE "TenantInvitation" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "roleName" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "invitedBy" TEXT,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "acceptedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TenantInvitation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "TenantInvitation_tokenHash_key" ON "TenantInvitation"("tokenHash");
CREATE INDEX "TenantInvitation_tenantId_email_idx" ON "TenantInvitation"("tenantId", "email");
ALTER TABLE "TenantInvitation" ADD CONSTRAINT "TenantInvitation_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TenantInvitation" ADD CONSTRAINT "TenantInvitation_role_check"
  CHECK ("roleName" IN ('MANAGER', 'SALES', 'INVENTORY_MANAGER', 'MARKETING', 'ACCOUNTANT', 'DELIVERY_STAFF'));

ALTER TABLE "TenantInvitation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TenantInvitation" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "TenantInvitation"
  USING (yamacommerce_tenant_isolation_check("tenantId"));

-- 4. Demandes de devis plateforme (Super Admin uniquement) ----------------------------
CREATE TABLE "PlatformInquiry" (
  "id" TEXT NOT NULL,
  "kind" TEXT NOT NULL DEFAULT 'custom_plan',
  "fullName" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "phone" TEXT,
  "companyName" TEXT,
  "sectorKey" TEXT,
  "message" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'new',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlatformInquiry_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PlatformInquiry_status_createdAt_idx" ON "PlatformInquiry"("status", "createdAt");
ALTER TABLE "PlatformInquiry" ADD CONSTRAINT "PlatformInquiry_kind_check" CHECK ("kind" IN ('custom_plan', 'contact'));
ALTER TABLE "PlatformInquiry" ADD CONSTRAINT "PlatformInquiry_status_check" CHECK ("status" IN ('new', 'contacted', 'closed'));

ALTER TABLE "PlatformInquiry" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PlatformInquiry" FORCE ROW LEVEL SECURITY;
CREATE POLICY platform_only ON "PlatformInquiry"
  USING (current_setting('app.is_super_admin', true) = 'true');

-- 5. Le quota catalogue devient un quota de « fiches » (tous secteurs) --------------
UPDATE "SubscriptionEntitlement" SET "resourceKey" = 'records' WHERE "resourceKey" = 'products';
