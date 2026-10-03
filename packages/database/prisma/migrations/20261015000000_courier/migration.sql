-- Secteur livraison : courses, historique, versements des livreurs, reversements aux expéditeurs.

ALTER TABLE "Deliverer" ADD COLUMN     "accessToken" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
ADD COLUMN     "name" TEXT;

CREATE TABLE "CourierJob" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "senderId" TEXT NOT NULL,
    "pickupName" TEXT NOT NULL,
    "pickupPhone" TEXT NOT NULL,
    "pickupAddress" TEXT NOT NULL,
    "pickupCommune" TEXT,
    "recipientName" TEXT NOT NULL,
    "recipientPhone" TEXT NOT NULL,
    "dropoffAddress" TEXT NOT NULL,
    "dropoffCommune" TEXT,
    "instructions" TEXT,
    "zoneId" TEXT,
    "packageDescription" TEXT NOT NULL,
    "size" TEXT NOT NULL DEFAULT 'small',
    "fee" INTEGER NOT NULL,
    "feePaidBy" TEXT NOT NULL DEFAULT 'sender',
    "codAmount" INTEGER NOT NULL DEFAULT 0,
    "delivererId" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "scheduledDate" DATE,
    "senderToken" TEXT NOT NULL,
    "recipientToken" TEXT NOT NULL,
    "deliveryCode" TEXT NOT NULL,
    "proofType" TEXT,
    "proofName" TEXT,
    "collectedAmount" INTEGER,
    "collectedAt" TIMESTAMPTZ(3),
    "remittanceId" TEXT,
    "settlementId" TEXT,
    "failureReason" TEXT,
    "cancelReason" TEXT,
    "deliveredAt" TIMESTAMPTZ(3),
    "channel" TEXT NOT NULL DEFAULT 'dashboard',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "CourierJob_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CourierJobEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT NOT NULL,
    "note" TEXT,
    "actorType" TEXT NOT NULL,
    "actorId" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CourierJobEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CourierRemittance" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "delivererId" TEXT NOT NULL,
    "receiptNumber" TEXT NOT NULL,
    "expectedAmount" INTEGER NOT NULL,
    "receivedAmount" INTEGER NOT NULL,
    "discrepancyNote" TEXT,
    "receivedBy" TEXT,
    "receivedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CourierRemittance_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CourierSettlement" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "receiptNumber" TEXT NOT NULL,
    "codTotal" INTEGER NOT NULL,
    "feesDeducted" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "method" TEXT NOT NULL,
    "reference" TEXT,
    "settledBy" TEXT,
    "settledAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CourierSettlement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CourierSettings" (
    "tenantId" TEXT NOT NULL,
    "mediumSurcharge" INTEGER NOT NULL DEFAULT 500,
    "largeSurcharge" INTEGER NOT NULL DEFAULT 1500,
    "maxCod" INTEGER NOT NULL DEFAULT 500000,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "publicRequests" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourierSettings_pkey" PRIMARY KEY ("tenantId")
);

CREATE UNIQUE INDEX "CourierJob_senderToken_key" ON "CourierJob"("senderToken");

CREATE UNIQUE INDEX "CourierJob_recipientToken_key" ON "CourierJob"("recipientToken");

CREATE INDEX "CourierJob_tenantId_status_idx" ON "CourierJob"("tenantId", "status");

CREATE INDEX "CourierJob_tenantId_delivererId_status_idx" ON "CourierJob"("tenantId", "delivererId", "status");

CREATE INDEX "CourierJob_tenantId_senderId_idx" ON "CourierJob"("tenantId", "senderId");

CREATE UNIQUE INDEX "CourierJob_tenantId_reference_key" ON "CourierJob"("tenantId", "reference");

CREATE UNIQUE INDEX "CourierJob_id_tenantId_key" ON "CourierJob"("id", "tenantId");

CREATE INDEX "CourierJobEvent_tenantId_jobId_idx" ON "CourierJobEvent"("tenantId", "jobId");

CREATE INDEX "CourierRemittance_tenantId_delivererId_idx" ON "CourierRemittance"("tenantId", "delivererId");

CREATE UNIQUE INDEX "CourierRemittance_tenantId_receiptNumber_key" ON "CourierRemittance"("tenantId", "receiptNumber");

CREATE UNIQUE INDEX "CourierRemittance_id_tenantId_key" ON "CourierRemittance"("id", "tenantId");

CREATE INDEX "CourierSettlement_tenantId_senderId_idx" ON "CourierSettlement"("tenantId", "senderId");

CREATE UNIQUE INDEX "CourierSettlement_tenantId_receiptNumber_key" ON "CourierSettlement"("tenantId", "receiptNumber");

CREATE UNIQUE INDEX "CourierSettlement_id_tenantId_key" ON "CourierSettlement"("id", "tenantId");

CREATE UNIQUE INDEX "Deliverer_accessToken_key" ON "Deliverer"("accessToken");

CREATE UNIQUE INDEX "Deliverer_id_tenantId_key" ON "Deliverer"("id", "tenantId");

CREATE UNIQUE INDEX "DeliveryZone_id_tenantId_key" ON "DeliveryZone"("id", "tenantId");

ALTER TABLE "CourierJob" ADD CONSTRAINT "CourierJob_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CourierJob" ADD CONSTRAINT "CourierJob_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CourierJob" ADD CONSTRAINT "CourierJob_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "DeliveryZone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CourierJob" ADD CONSTRAINT "CourierJob_delivererId_fkey" FOREIGN KEY ("delivererId") REFERENCES "Deliverer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CourierJob" ADD CONSTRAINT "CourierJob_remittanceId_fkey" FOREIGN KEY ("remittanceId") REFERENCES "CourierRemittance"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CourierJob" ADD CONSTRAINT "CourierJob_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES "CourierSettlement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CourierJobEvent" ADD CONSTRAINT "CourierJobEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CourierJobEvent" ADD CONSTRAINT "CourierJobEvent_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "CourierJob"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CourierRemittance" ADD CONSTRAINT "CourierRemittance_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CourierRemittance" ADD CONSTRAINT "CourierRemittance_delivererId_fkey" FOREIGN KEY ("delivererId") REFERENCES "Deliverer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CourierSettlement" ADD CONSTRAINT "CourierSettlement_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CourierSettlement" ADD CONSTRAINT "CourierSettlement_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CourierSettings" ADD CONSTRAINT "CourierSettings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Intégrité métier
-- ---------------------------------------------------------------------------
ALTER TABLE "CourierJob" ADD CONSTRAINT "CourierJob_check" CHECK (
  "status" IN ('pending', 'assigned', 'picked_up', 'in_transit', 'delivered', 'failed', 'returning', 'returned', 'canceled')
  AND "size" IN ('small', 'medium', 'large')
  AND "feePaidBy" IN ('sender', 'recipient')
  AND "channel" IN ('web', 'dashboard', 'phone', 'whatsapp')
  AND "fee" >= 0 AND "codAmount" >= 0 AND "attempts" BETWEEN 0 AND 10
  AND "deliveryCode" ~ '^[0-9]{4}$'
  AND ("proofType" IS NULL OR "proofType" IN ('code', 'name'))
  -- Assignée ou en route : toujours un livreur.
  AND ("status" NOT IN ('assigned', 'picked_up', 'in_transit', 'returning') OR "delivererId" IS NOT NULL)
  -- Livrée : preuve, date, et encaissement EXACT de la somme attendue.
  AND ("status" <> 'delivered' OR ("proofType" IS NOT NULL AND "deliveredAt" IS NOT NULL
       AND "collectedAmount" = "codAmount" + CASE WHEN "feePaidBy" = 'recipient' THEN "fee" ELSE 0 END))
  AND ("status" = 'delivered' OR "collectedAmount" IS NULL)
  -- Un versement ne couvre que des courses livrées avec espèces encaissées.
  AND ("remittanceId" IS NULL OR ("status" = 'delivered' AND "collectedAmount" > 0))
  AND ("settlementId" IS NULL OR "status" IN ('delivered', 'returned'))
  AND ("status" <> 'canceled' OR length(trim(coalesce("cancelReason", ''))) > 0)
  AND ("status" <> 'failed' OR length(trim(coalesce("failureReason", ''))) > 0));
ALTER TABLE "CourierJobEvent" ADD CONSTRAINT "CourierJobEvent_actor_check" CHECK ("actorType" IN ('staff', 'deliverer', 'customer', 'system'));
ALTER TABLE "CourierRemittance" ADD CONSTRAINT "CourierRemittance_check" CHECK (
  "expectedAmount" > 0 AND "receivedAmount" >= 0
  AND ("receivedAmount" = "expectedAmount" OR length(trim(coalesce("discrepancyNote", ''))) > 0));
ALTER TABLE "CourierSettlement" ADD CONSTRAINT "CourierSettlement_check" CHECK (
  "codTotal" >= 0 AND "feesDeducted" >= 0 AND "amount" = "codTotal" - "feesDeducted"
  AND "method" IN ('cash', 'wave', 'orange_money', 'free_money', 'bank_transfer', 'other'));
ALTER TABLE "CourierSettings" ADD CONSTRAINT "CourierSettings_check" CHECK (
  "mediumSurcharge" >= 0 AND "largeSurcharge" >= 0 AND "maxCod" BETWEEN 0 AND 10000000 AND "maxAttempts" BETWEEN 1 AND 10);

-- Une course ne se verse et ne se reverse qu'une fois : les rattachements sont définitifs.
CREATE OR REPLACE FUNCTION yamacommerce_courier_money_lock() RETURNS trigger AS $$
BEGIN
  IF OLD."remittanceId" IS NOT NULL AND NEW."remittanceId" IS DISTINCT FROM OLD."remittanceId" THEN
    RAISE EXCEPTION 'Course déjà versée au bureau.' USING ERRCODE = 'check_violation';
  END IF;
  IF OLD."settlementId" IS NOT NULL AND NEW."settlementId" IS DISTINCT FROM OLD."settlementId" THEN
    RAISE EXCEPTION 'Course déjà reversée à l''expéditeur.' USING ERRCODE = 'check_violation';
  END IF;
  IF OLD."status" IN ('delivered', 'returned', 'canceled') AND NEW."status" <> OLD."status" THEN
    RAISE EXCEPTION 'Course close : statut définitif.' USING ERRCODE = 'check_violation';
  END IF;
  IF OLD."status" = 'delivered' AND (NEW."collectedAmount" IS DISTINCT FROM OLD."collectedAmount" OR NEW."codAmount" <> OLD."codAmount" OR NEW."fee" <> OLD."fee") THEN
    RAISE EXCEPTION 'Montants d''une course livrée non modifiables.' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "CourierJob_money_lock" BEFORE UPDATE ON "CourierJob"
  FOR EACH ROW EXECUTE FUNCTION yamacommerce_courier_money_lock();

-- Même entreprise partout (clés composites, en plus de la RLS).
ALTER TABLE "CourierJob" ADD CONSTRAINT "CourierJob_sender_same_tenant_fkey" FOREIGN KEY ("tenantId", "senderId") REFERENCES "Customer"("tenantId", "id");
ALTER TABLE "CourierJob" ADD CONSTRAINT "CourierJob_zone_same_tenant_fkey" FOREIGN KEY ("zoneId", "tenantId") REFERENCES "DeliveryZone"("id", "tenantId");
ALTER TABLE "CourierJob" ADD CONSTRAINT "CourierJob_deliverer_same_tenant_fkey" FOREIGN KEY ("delivererId", "tenantId") REFERENCES "Deliverer"("id", "tenantId");
ALTER TABLE "CourierJob" ADD CONSTRAINT "CourierJob_remittance_same_tenant_fkey" FOREIGN KEY ("remittanceId", "tenantId") REFERENCES "CourierRemittance"("id", "tenantId");
ALTER TABLE "CourierJob" ADD CONSTRAINT "CourierJob_settlement_same_tenant_fkey" FOREIGN KEY ("settlementId", "tenantId") REFERENCES "CourierSettlement"("id", "tenantId");
ALTER TABLE "CourierJobEvent" ADD CONSTRAINT "CourierJobEvent_job_same_tenant_fkey" FOREIGN KEY ("jobId", "tenantId") REFERENCES "CourierJob"("id", "tenantId");
ALTER TABLE "CourierRemittance" ADD CONSTRAINT "CourierRemittance_deliverer_same_tenant_fkey" FOREIGN KEY ("delivererId", "tenantId") REFERENCES "Deliverer"("id", "tenantId");
ALTER TABLE "CourierSettlement" ADD CONSTRAINT "CourierSettlement_sender_same_tenant_fkey" FOREIGN KEY ("tenantId", "senderId") REFERENCES "Customer"("tenantId", "id");

-- ---------------------------------------------------------------------------
-- Row-Level Security dès la création ; historique en lecture seule
-- ---------------------------------------------------------------------------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['CourierJob', 'CourierJobEvent', 'CourierRemittance', 'CourierSettlement', 'CourierSettings'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY;', t);
    EXECUTE format('CREATE POLICY tenant_isolation ON %I USING (yamacommerce_tenant_isolation_check("tenantId"));', t);
  END LOOP;
END $$;
REVOKE UPDATE, DELETE ON "CourierJobEvent", "CourierRemittance", "CourierSettlement" FROM yamacommerce_app;

-- Le secteur Livraison devient opérationnel (souscriptible).
UPDATE "Sector" SET "isAvailable" = true WHERE "key" = 'delivery';
