-- ============================================================================
-- Facturation SaaS (abonnements des ENTREPRISES à la plateforme, via Chariow au
-- lancement) — 20 septembre 2026. Entièrement distinct des paiements des CLIENTS
-- FINAUX sur le site d'une entreprise (packages/payments, jamais touché ici).
--
-- 1. Renomme Plan -> SubscriptionPlan et Subscription -> TenantSubscription
--    (ADDITIF : ces deux modèles sont déjà utilisés en production par
--    real-media-context.ts et readiness-resolver.ts/@yamacommerce/publishing
--    readiness.ts — un renommage de TABLE préserve automatiquement les policies RLS
--    déjà posées sur "Subscription", Postgres les rattache à l'OID, pas au nom).
-- 2. Étend SubscriptionStatus (nouveau type + bascule, jamais ALTER TYPE ADD VALUE :
--    cette opération est restreinte dans un bloc transactionnel selon la version de
--    PostgreSQL — on évite le risque en recréant le type).
-- 3. Convertit TenantSubscription.billingCycle (String libre) en véritable enum.
-- 4. Ajoute les nouveaux champs administrables de SubscriptionPlan (jamais codés en
--    dur — voir la revue) et les nouveaux champs d'état de TenantSubscription.
-- 5. Crée 5 nouvelles tables, TOUTES avec une vraie policy RLS Pattern A DÈS LA
--    CRÉATION (jamais l'écart "pas de RLS" déjà corrigé deux fois cette session) ;
--    SubscriptionEvent (journal d'audit append-only) reçoit en plus un REVOKE
--    UPDATE/DELETE, même précédent que StockMovement/OrderStatusHistory.
-- 6. Champs temporels critiques en `timestamptz` dès la création (jamais un
--    `timestamp` sans fuseau réintroduisant le bug de comparaison dépendante de la
--    session Postgres déjà corrigé pour Order.reservationExpiresAt).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Renommage des tables (préserve automatiquement RLS déjà posée sur Subscription
--    et l'absence de RLS sur Plan — un rename ne change ni l'un ni l'autre).
-- ----------------------------------------------------------------------------
ALTER TABLE "Plan" RENAME TO "SubscriptionPlan";
ALTER TABLE "SubscriptionPlan" RENAME CONSTRAINT "Plan_pkey" TO "SubscriptionPlan_pkey";
ALTER INDEX "Plan_name_key" RENAME TO "SubscriptionPlan_name_key";

ALTER TABLE "Subscription" RENAME TO "TenantSubscription";
ALTER TABLE "TenantSubscription" RENAME CONSTRAINT "Subscription_pkey" TO "TenantSubscription_pkey";
ALTER TABLE "TenantSubscription" RENAME CONSTRAINT "Subscription_tenantId_fkey" TO "TenantSubscription_tenantId_fkey";
ALTER TABLE "TenantSubscription" RENAME CONSTRAINT "Subscription_planId_fkey" TO "TenantSubscription_planId_fkey";
ALTER INDEX "Subscription_tenantId_key" RENAME TO "TenantSubscription_tenantId_key";

-- ----------------------------------------------------------------------------
-- 2. Extension de SubscriptionStatus — nouveau type, bascule, jamais
--    ALTER TYPE ... ADD VALUE (sûr indépendamment de la version PostgreSQL).
-- ----------------------------------------------------------------------------
CREATE TYPE "SubscriptionStatus_new" AS ENUM ('PENDING', 'TRIALING', 'ACTIVE', 'GRACE_PERIOD', 'PAST_DUE', 'SUSPENDED', 'CANCELED', 'EXPIRED');
ALTER TABLE "TenantSubscription" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "TenantSubscription" ALTER COLUMN "status" TYPE "SubscriptionStatus_new" USING ("status"::text::"SubscriptionStatus_new");
ALTER TABLE "TenantSubscription" ALTER COLUMN "status" SET DEFAULT 'TRIALING';
DROP TYPE "SubscriptionStatus";
ALTER TYPE "SubscriptionStatus_new" RENAME TO "SubscriptionStatus";

-- ----------------------------------------------------------------------------
-- 3. TenantSubscription.billingCycle : String libre -> vrai enum BillingCycle.
-- ----------------------------------------------------------------------------
CREATE TYPE "BillingCycle" AS ENUM ('MONTHLY', 'YEARLY');
ALTER TABLE "TenantSubscription" ALTER COLUMN "billingCycle" DROP DEFAULT;
ALTER TABLE "TenantSubscription" ALTER COLUMN "billingCycle" TYPE "BillingCycle" USING (UPPER("billingCycle")::"BillingCycle");
ALTER TABLE "TenantSubscription" ALTER COLUMN "billingCycle" SET DEFAULT 'MONTHLY';

-- ----------------------------------------------------------------------------
-- 4. RenewalMode et PlanStatus — nouveaux enums.
-- ----------------------------------------------------------------------------
CREATE TYPE "RenewalMode" AS ENUM ('MANUAL', 'AUTOMATIC');
CREATE TYPE "PlanStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- ----------------------------------------------------------------------------
-- 5. Nouveaux champs administrables de SubscriptionPlan.
-- ----------------------------------------------------------------------------
ALTER TABLE "SubscriptionPlan" ADD COLUMN "status" "PlanStatus" NOT NULL DEFAULT 'DRAFT';
-- Backfill : une formule déjà active reste PUBLISHED (jamais invisible après cette
-- migration) ; `isActive` reste en base pour compat mais n'est plus la source de
-- vérité de la vente — voir le commentaire du modèle dans schema.prisma.
UPDATE "SubscriptionPlan" SET "status" = 'PUBLISHED' WHERE "isActive" = true;
UPDATE "SubscriptionPlan" SET "status" = 'ARCHIVED' WHERE "isActive" = false;

ALTER TABLE "SubscriptionPlan" ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'XOF';
ALTER TABLE "SubscriptionPlan" ADD COLUMN "monthlyDurationDays" INTEGER NOT NULL DEFAULT 30;
ALTER TABLE "SubscriptionPlan" ADD COLUMN "yearlyDurationDays" INTEGER NOT NULL DEFAULT 365;
ALTER TABLE "SubscriptionPlan" ADD COLUMN "gracePeriodDays" INTEGER NOT NULL DEFAULT 3;
ALTER TABLE "SubscriptionPlan" ADD COLUMN "setupFeeXOF" INTEGER;
ALTER TABLE "SubscriptionPlan" ADD COLUMN "maxCustomDomains" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "SubscriptionPlan" ADD COLUMN "maxEmailsPerMonth" INTEGER;
ALTER TABLE "SubscriptionPlan" ADD COLUMN "maxWhatsAppMessagesPerMonth" INTEGER;
ALTER TABLE "SubscriptionPlan" ADD COLUMN "renewalMode" "RenewalMode" NOT NULL DEFAULT 'MANUAL';
ALTER TABLE "SubscriptionPlan" ADD COLUMN "chariowMonthlyProductId" TEXT;
ALTER TABLE "SubscriptionPlan" ADD COLUMN "chariowYearlyProductId" TEXT;

-- ----------------------------------------------------------------------------
-- 6. Nouveaux champs d'état de TenantSubscription — champs temporels critiques en
--    timestamptz DÈS LA CRÉATION (voir la note de tête de fichier, point 6).
-- ----------------------------------------------------------------------------
ALTER TABLE "TenantSubscription" ADD COLUMN "renewalMode" "RenewalMode" NOT NULL DEFAULT 'MANUAL';
ALTER TABLE "TenantSubscription" ADD COLUMN "graceEndsAt" TIMESTAMPTZ(3);
ALTER TABLE "TenantSubscription" ADD COLUMN "suspendedAt" TIMESTAMPTZ(3);
ALTER TABLE "TenantSubscription" ADD COLUMN "canceledAt" TIMESTAMP(3);
ALTER TABLE "TenantSubscription" ADD COLUMN "lastPaymentId" TEXT;
ALTER TABLE "TenantSubscription" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- currentPeriodStart/currentPeriodEnd existaient déjà en `timestamp` sans fuseau —
-- même correctif que Order.reservationExpiresAt : `AT TIME ZONE 'UTC'` car Prisma y
-- a toujours écrit l'instant UTC quel que soit le fuseau de session (voir la
-- migration `20260927000000_reservation_expiry_timestamptz` pour la même preuve).
ALTER TABLE "TenantSubscription" ALTER COLUMN "currentPeriodStart" TYPE TIMESTAMPTZ(3) USING ("currentPeriodStart" AT TIME ZONE 'UTC');
ALTER TABLE "TenantSubscription" ALTER COLUMN "currentPeriodEnd" TYPE TIMESTAMPTZ(3) USING ("currentPeriodEnd" AT TIME ZONE 'UTC');

CREATE INDEX "TenantSubscription_tenantId_idx" ON "TenantSubscription"("tenantId");
CREATE INDEX "TenantSubscription_status_idx" ON "TenantSubscription"("status");

-- ----------------------------------------------------------------------------
-- 7. SubscriptionPayment — mutable (transition de statut en place, comme Payment
--    côté commerce), PAS de REVOKE.
-- ----------------------------------------------------------------------------
CREATE TABLE "SubscriptionPayment" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "subscriptionId" TEXT NOT NULL,
  "planId" TEXT NOT NULL,
  "checkoutSessionId" TEXT,
  "provider" TEXT NOT NULL,
  "providerSaleId" TEXT,
  "amountXOF" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'XOF',
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "periodExtensionDays" INTEGER,
  "rawPayload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "confirmedAt" TIMESTAMP(3),
  CONSTRAINT "SubscriptionPayment_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SubscriptionPayment_provider_providerSaleId_key" ON "SubscriptionPayment"("provider", "providerSaleId");
CREATE INDEX "SubscriptionPayment_tenantId_idx" ON "SubscriptionPayment"("tenantId");
CREATE INDEX "SubscriptionPayment_subscriptionId_idx" ON "SubscriptionPayment"("subscriptionId");
ALTER TABLE "SubscriptionPayment" ADD CONSTRAINT "SubscriptionPayment_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SubscriptionPayment" ADD CONSTRAINT "SubscriptionPayment_subscriptionId_fkey"
  FOREIGN KEY ("subscriptionId") REFERENCES "TenantSubscription"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ----------------------------------------------------------------------------
-- 8. SubscriptionEvent — journal d'audit APPEND-ONLY, REVOKE UPDATE/DELETE.
-- ----------------------------------------------------------------------------
CREATE TABLE "SubscriptionEvent" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "subscriptionId" TEXT,
  "type" TEXT NOT NULL,
  "actorType" TEXT NOT NULL,
  "actorUserId" TEXT,
  "justification" TEXT,
  "payloadSnapshot" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SubscriptionEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SubscriptionEvent_tenantId_idx" ON "SubscriptionEvent"("tenantId");
CREATE INDEX "SubscriptionEvent_subscriptionId_idx" ON "SubscriptionEvent"("subscriptionId");
ALTER TABLE "SubscriptionEvent" ADD CONSTRAINT "SubscriptionEvent_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SubscriptionEvent" ADD CONSTRAINT "SubscriptionEvent_subscriptionId_fkey"
  FOREIGN KEY ("subscriptionId") REFERENCES "TenantSubscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ----------------------------------------------------------------------------
-- 9. SubscriptionEntitlement — dérogations Super Admin par ressource.
-- ----------------------------------------------------------------------------
CREATE TABLE "SubscriptionEntitlement" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "resourceKey" TEXT NOT NULL,
  "limitValue" INTEGER,
  "resetPeriod" TEXT NOT NULL DEFAULT 'none',
  "reason" TEXT,
  "grantedBy" TEXT,
  "expiresAt" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SubscriptionEntitlement_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SubscriptionEntitlement_tenantId_resourceKey_key" ON "SubscriptionEntitlement"("tenantId", "resourceKey");
CREATE INDEX "SubscriptionEntitlement_tenantId_idx" ON "SubscriptionEntitlement"("tenantId");
ALTER TABLE "SubscriptionEntitlement" ADD CONSTRAINT "SubscriptionEntitlement_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ----------------------------------------------------------------------------
-- 10. SubscriptionUsage — compteurs cumulatifs sans table source propre.
-- ----------------------------------------------------------------------------
CREATE TABLE "SubscriptionUsage" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "resourceKey" TEXT NOT NULL,
  "periodKey" TEXT NOT NULL,
  "usedValue" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SubscriptionUsage_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SubscriptionUsage_tenantId_resourceKey_periodKey_key" ON "SubscriptionUsage"("tenantId", "resourceKey", "periodKey");
CREATE INDEX "SubscriptionUsage_tenantId_idx" ON "SubscriptionUsage"("tenantId");
ALTER TABLE "SubscriptionUsage" ADD CONSTRAINT "SubscriptionUsage_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ----------------------------------------------------------------------------
-- 11. BillingCheckoutSession — corrélation checkout Chariow <-> webhook Pulse.
-- ----------------------------------------------------------------------------
CREATE TABLE "BillingCheckoutSession" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "subscriptionId" TEXT,
  "planId" TEXT NOT NULL,
  "billingCycle" "BillingCycle" NOT NULL,
  "provider" TEXT NOT NULL,
  "providerCheckoutId" TEXT,
  "internalReference" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "amountXOF" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'XOF',
  "expiresAt" TIMESTAMPTZ(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BillingCheckoutSession_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "BillingCheckoutSession_internalReference_key" ON "BillingCheckoutSession"("internalReference");
CREATE INDEX "BillingCheckoutSession_tenantId_idx" ON "BillingCheckoutSession"("tenantId");
ALTER TABLE "BillingCheckoutSession" ADD CONSTRAINT "BillingCheckoutSession_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ----------------------------------------------------------------------------
-- 12. RLS Pattern A dès la création pour les 5 nouvelles tables.
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  tbl text;
  tables text[] := ARRAY['SubscriptionPayment', 'SubscriptionEvent', 'SubscriptionEntitlement', 'SubscriptionUsage', 'BillingCheckoutSession'];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', tbl);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY;', tbl);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I USING (yamacommerce_tenant_isolation_check("tenantId"));',
      tbl
    );
  END LOOP;
END
$$;

-- ----------------------------------------------------------------------------
-- 13. Immutabilité du journal d'audit — même précédent que StockMovement/
--     OrderStatusHistory : aucun code de ce projet ne modifie ni ne supprime jamais
--     une ligne SubscriptionEvent (voir subscription-registry.ts : seulement des
--     `create`).
-- ----------------------------------------------------------------------------
REVOKE UPDATE, DELETE ON "SubscriptionEvent" FROM yamacommerce_app;
