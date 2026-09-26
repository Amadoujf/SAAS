-- Parcours e-commerce opérationnel (1er octobre 2026) : paiement manuel Wave/Orange
-- Money avec preuve, zones de livraison configurables, réglages de vente, notes
-- internes et journal honnête des notifications. Réutilise les moteurs existants
-- (panier, commande, réservation, statuts) — aucune table parallèle.

ALTER TABLE "PaymentProviderConfig"
  ADD COLUMN "accountNumber" TEXT,
  ADD COLUMN "accountHolderName" TEXT,
  ADD COLUMN "publicInstructions" TEXT;

ALTER TABLE "Payment"
  ADD COLUMN "proofReference" TEXT,
  ADD COLUMN "proofImageUrl" TEXT,
  ADD COLUMN "proofSubmittedAt" TIMESTAMP(3),
  ADD COLUMN "reviewedByUserId" TEXT,
  ADD COLUMN "reviewedAt" TIMESTAMP(3),
  ADD COLUMN "reviewNote" TEXT;

ALTER TABLE "Order"
  ADD COLUMN "paymentMethod" TEXT NOT NULL DEFAULT 'cod',
  ADD COLUMN "internalNotes" TEXT;

ALTER TABLE "DeliveryZone"
  ADD COLUMN "name" TEXT,
  ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "excludedCategoryIds" TEXT[] DEFAULT ARRAY[]::TEXT[];

CREATE TABLE "CommerceSettings" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "pickupEnabled" BOOLEAN NOT NULL DEFAULT true,
  "pickupAddress" TEXT,
  "pickupInstructions" TEXT,
  "deliveryInstructions" TEXT,
  "guestCheckoutEnabled" BOOLEAN NOT NULL DEFAULT true,
  "manualPaymentWindowHours" INTEGER NOT NULL DEFAULT 24,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CommerceSettings_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CommerceSettings_tenantId_key" ON "CommerceSettings"("tenantId");
ALTER TABLE "CommerceSettings" ADD CONSTRAINT "CommerceSettings_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CommerceSettings" ADD CONSTRAINT "CommerceSettings_manualPaymentWindowHours_range"
  CHECK ("manualPaymentWindowHours" BETWEEN 1 AND 168);

CREATE TABLE "NotificationLog" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "orderId" TEXT,
  "event" TEXT NOT NULL,
  "channel" TEXT NOT NULL,
  "recipient" TEXT,
  "status" TEXT NOT NULL DEFAULT 'queued',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "sentAt" TIMESTAMP(3),
  CONSTRAINT "NotificationLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "NotificationLog_tenantId_createdAt_idx" ON "NotificationLog"("tenantId", "createdAt");
CREATE INDEX "NotificationLog_tenantId_orderId_idx" ON "NotificationLog"("tenantId", "orderId");
ALTER TABLE "NotificationLog" ADD CONSTRAINT "NotificationLog_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "NotificationLog" ADD CONSTRAINT "NotificationLog_status_check"
  CHECK ("status" IN ('queued', 'sent', 'failed', 'not_sent_no_provider'));

DO $$
DECLARE
  tbl text;
  tables text[] := ARRAY['CommerceSettings', 'NotificationLog'];
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
