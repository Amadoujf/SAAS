-- Étape 9 — Automobile (secteur automobile) : fiches véhicules (extension de Listing),
-- essais sans chevauchement, dossiers de vente (réservations communes + encaissements
-- communs), prospects et leur historique, importations suivies par étapes, réglages.

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- CreateTable
CREATE TABLE "VehicleDetails" (
    "listingId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "make" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "version" TEXT,
    "year" INTEGER NOT NULL,
    "mileageKm" INTEGER NOT NULL DEFAULT 0,
    "fuel" TEXT NOT NULL,
    "transmission" TEXT NOT NULL,
    "bodyType" TEXT NOT NULL,
    "color" TEXT,
    "engine" TEXT,
    "seats" INTEGER,
    "condition" TEXT NOT NULL,
    "stockStatus" TEXT NOT NULL DEFAULT 'available',
    "features" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "negotiable" BOOLEAN NOT NULL DEFAULT false,
    "vin" TEXT,
    "plate" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "VehicleDetails_pkey" PRIMARY KEY ("listingId")
);

-- CreateTable
CREATE TABLE "VehicleTestDrive" (
    "reservationId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "startAt" TIMESTAMPTZ(3) NOT NULL,
    "endAt" TIMESTAMPTZ(3) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "licenseConfirmed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "VehicleTestDrive_pkey" PRIMARY KEY ("reservationId")
);

-- CreateTable
CREATE TABLE "VehicleSale" (
    "reservationId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "leadId" TEXT,
    "agreedPrice" INTEGER NOT NULL,
    "tradeInValue" INTEGER NOT NULL DEFAULT 0,
    "tradeInDescription" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "deliveredAt" TIMESTAMPTZ(3),

    CONSTRAINT "VehicleSale_pkey" PRIMARY KEY ("reservationId")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "listingId" TEXT,
    "source" TEXT NOT NULL DEFAULT 'web',
    "interest" TEXT NOT NULL DEFAULT 'purchase',
    "status" TEXT NOT NULL DEFAULT 'new',
    "message" TEXT,
    "budget" INTEGER,
    "lostReason" TEXT,
    "assignedTo" TEXT,
    "nextActionAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "listingAvailabilityId" TEXT,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT,
    "body" TEXT,
    "createdBy" TEXT,
    "createdByType" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleImport" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "customerId" TEXT,
    "origin" TEXT NOT NULL,
    "stage" TEXT NOT NULL DEFAULT 'purchased',
    "eta" DATE,
    "vessel" TEXT,
    "containerRef" TEXT,
    "note" TEXT,
    "accessToken" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "listingAvailabilityId" TEXT,

    CONSTRAINT "VehicleImport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleImportEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "importId" TEXT NOT NULL,
    "fromStage" TEXT,
    "toStage" TEXT NOT NULL,
    "note" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VehicleImportEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutoSettings" (
    "tenantId" TEXT NOT NULL,
    "openingHours" JSONB NOT NULL DEFAULT '[]',
    "testDriveMinutes" INTEGER NOT NULL DEFAULT 45,
    "slotStepMinutes" INTEGER NOT NULL DEFAULT 30,
    "maxAdvanceDays" INTEGER NOT NULL DEFAULT 30,
    "depositPercent" INTEGER NOT NULL DEFAULT 10,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutoSettings_pkey" PRIMARY KEY ("tenantId")
);

-- CreateIndex
CREATE INDEX "VehicleDetails_tenantId_stockStatus_idx" ON "VehicleDetails"("tenantId", "stockStatus");

-- CreateIndex
CREATE INDEX "VehicleTestDrive_tenantId_startAt_idx" ON "VehicleTestDrive"("tenantId", "startAt");

-- CreateIndex
CREATE INDEX "VehicleSale_tenantId_listingId_idx" ON "VehicleSale"("tenantId", "listingId");

-- CreateIndex
CREATE INDEX "Lead_tenantId_status_createdAt_idx" ON "Lead"("tenantId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "LeadEvent_tenantId_leadId_idx" ON "LeadEvent"("tenantId", "leadId");

-- CreateIndex
CREATE UNIQUE INDEX "VehicleImport_accessToken_key" ON "VehicleImport"("accessToken");

-- CreateIndex
CREATE INDEX "VehicleImport_tenantId_stage_idx" ON "VehicleImport"("tenantId", "stage");

-- CreateIndex
CREATE UNIQUE INDEX "VehicleImport_tenantId_reference_key" ON "VehicleImport"("tenantId", "reference");

-- CreateIndex
CREATE INDEX "VehicleImportEvent_tenantId_importId_idx" ON "VehicleImportEvent"("tenantId", "importId");

-- AddForeignKey
ALTER TABLE "VehicleDetails" ADD CONSTRAINT "VehicleDetails_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleDetails" ADD CONSTRAINT "VehicleDetails_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleTestDrive" ADD CONSTRAINT "VehicleTestDrive_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleTestDrive" ADD CONSTRAINT "VehicleTestDrive_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleTestDrive" ADD CONSTRAINT "VehicleTestDrive_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleSale" ADD CONSTRAINT "VehicleSale_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleSale" ADD CONSTRAINT "VehicleSale_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleSale" ADD CONSTRAINT "VehicleSale_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleSale" ADD CONSTRAINT "VehicleSale_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_listingAvailabilityId_fkey" FOREIGN KEY ("listingAvailabilityId") REFERENCES "ListingAvailability"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadEvent" ADD CONSTRAINT "LeadEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadEvent" ADD CONSTRAINT "LeadEvent_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleImport" ADD CONSTRAINT "VehicleImport_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleImport" ADD CONSTRAINT "VehicleImport_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleImport" ADD CONSTRAINT "VehicleImport_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleImport" ADD CONSTRAINT "VehicleImport_listingAvailabilityId_fkey" FOREIGN KEY ("listingAvailabilityId") REFERENCES "ListingAvailability"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleImportEvent" ADD CONSTRAINT "VehicleImportEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleImportEvent" ADD CONSTRAINT "VehicleImportEvent_importId_fkey" FOREIGN KEY ("importId") REFERENCES "VehicleImport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutoSettings" ADD CONSTRAINT "AutoSettings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- Intégrité métier
-- ---------------------------------------------------------------------------
ALTER TABLE "VehicleDetails" ADD CONSTRAINT "VehicleDetails_check" CHECK (
  length(trim("make")) BETWEEN 1 AND 40 AND length(trim("model")) BETWEEN 1 AND 60
  AND "year" BETWEEN 1950 AND 2100 AND "mileageKm" BETWEEN 0 AND 2000000
  AND "fuel" IN ('essence', 'diesel', 'hybride', 'electrique', 'gpl')
  AND "transmission" IN ('manuelle', 'automatique')
  AND "bodyType" IN ('citadine', 'berline', 'break', 'suv', '4x4', 'pickup', 'monospace', 'coupe', 'utilitaire')
  AND "condition" IN ('new', 'used', 'imported_used')
  AND "stockStatus" IN ('incoming', 'available', 'reserved', 'sold')
  AND ("seats" IS NULL OR "seats" BETWEEN 1 AND 60));
ALTER TABLE "VehicleTestDrive" ADD CONSTRAINT "VehicleTestDrive_range_check" CHECK ("startAt" < "endAt");
ALTER TABLE "VehicleSale" ADD CONSTRAINT "VehicleSale_amounts_check" CHECK (
  "agreedPrice" > 0 AND "tradeInValue" >= 0 AND "tradeInValue" < "agreedPrice");
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_check" CHECK (
  "source" IN ('web', 'phone', 'whatsapp', 'walk_in')
  AND "interest" IN ('purchase', 'test_drive', 'trade_in', 'financing', 'import_request')
  AND "status" IN ('new', 'contacted', 'test_drive', 'negotiation', 'won', 'lost')
  AND ("status" <> 'lost' OR "lostReason" IS NOT NULL)
  AND ("budget" IS NULL OR "budget" > 0));
ALTER TABLE "LeadEvent" ADD CONSTRAINT "LeadEvent_kind_check" CHECK ("kind" IN ('created', 'status', 'note', 'request'));
ALTER TABLE "VehicleImport" ADD CONSTRAINT "VehicleImport_check" CHECK (
  "stage" IN ('purchased', 'shipped', 'at_port', 'customs', 'ready', 'canceled') AND length(trim("origin")) BETWEEN 1 AND 60);
ALTER TABLE "AutoSettings" ADD CONSTRAINT "AutoSettings_check" CHECK (
  "testDriveMinutes" BETWEEN 15 AND 240 AND "slotStepMinutes" IN (15, 30, 60)
  AND "maxAdvanceDays" BETWEEN 1 AND 180 AND "depositPercent" BETWEEN 0 AND 100);

-- Jamais deux essais actifs qui se chevauchent pour un même véhicule.
ALTER TABLE "VehicleTestDrive" ADD CONSTRAINT "VehicleTestDrive_no_overlap"
  EXCLUDE USING gist ("listingId" WITH =, tstzrange("startAt", "endAt", '[)') WITH &&) WHERE ("active");
-- Un seul dossier de vente en cours par véhicule.
CREATE UNIQUE INDEX "VehicleSale_one_active_per_vehicle" ON "VehicleSale"("listingId") WHERE "active";

-- `active` suit le statut de la réservation commune, quel que soit le chemin.
CREATE OR REPLACE FUNCTION yamacommerce_sync_vehicle_active() RETURNS trigger AS $$
BEGIN
  UPDATE "VehicleTestDrive"
     SET "active" = NEW."status" IN ('requested', 'confirmed', 'completed')
   WHERE "reservationId" = NEW."id" AND "tenantId" = NEW."tenantId";
  UPDATE "VehicleSale"
     SET "active" = NEW."status" IN ('requested', 'confirmed')
   WHERE "reservationId" = NEW."id" AND "tenantId" = NEW."tenantId";
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "Reservation_sync_vehicle_active"
  AFTER UPDATE OF "status" ON "Reservation"
  FOR EACH ROW WHEN (OLD."status" IS DISTINCT FROM NEW."status")
  EXECUTE FUNCTION yamacommerce_sync_vehicle_active();

-- Même entreprise partout (clés composites, en plus de la RLS).
CREATE UNIQUE INDEX "VehicleDetails_tenantId_listingId_key" ON "VehicleDetails"("tenantId", "listingId");
CREATE UNIQUE INDEX "Lead_tenantId_id_key" ON "Lead"("tenantId", "id");
CREATE UNIQUE INDEX "VehicleImport_tenantId_id_key" ON "VehicleImport"("tenantId", "id");
ALTER TABLE "VehicleDetails" ADD CONSTRAINT "VehicleDetails_same_tenant_fkey"
  FOREIGN KEY ("tenantId", "listingId") REFERENCES "Listing"("tenantId", "id");
ALTER TABLE "VehicleTestDrive" ADD CONSTRAINT "VehicleTestDrive_reservation_same_tenant_fkey"
  FOREIGN KEY ("tenantId", "reservationId") REFERENCES "Reservation"("tenantId", "id");
ALTER TABLE "VehicleTestDrive" ADD CONSTRAINT "VehicleTestDrive_vehicle_same_tenant_fkey"
  FOREIGN KEY ("tenantId", "listingId") REFERENCES "VehicleDetails"("tenantId", "listingId");
ALTER TABLE "VehicleSale" ADD CONSTRAINT "VehicleSale_reservation_same_tenant_fkey"
  FOREIGN KEY ("tenantId", "reservationId") REFERENCES "Reservation"("tenantId", "id");
ALTER TABLE "VehicleSale" ADD CONSTRAINT "VehicleSale_vehicle_same_tenant_fkey"
  FOREIGN KEY ("tenantId", "listingId") REFERENCES "VehicleDetails"("tenantId", "listingId");
ALTER TABLE "VehicleSale" ADD CONSTRAINT "VehicleSale_lead_same_tenant_fkey"
  FOREIGN KEY ("tenantId", "leadId") REFERENCES "Lead"("tenantId", "id");
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_customer_same_tenant_fkey"
  FOREIGN KEY ("tenantId", "customerId") REFERENCES "Customer"("tenantId", "id");
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_listing_same_tenant_fkey"
  FOREIGN KEY ("tenantId", "listingId") REFERENCES "Listing"("tenantId", "id");
ALTER TABLE "LeadEvent" ADD CONSTRAINT "LeadEvent_lead_same_tenant_fkey"
  FOREIGN KEY ("tenantId", "leadId") REFERENCES "Lead"("tenantId", "id");
ALTER TABLE "VehicleImport" ADD CONSTRAINT "VehicleImport_vehicle_same_tenant_fkey"
  FOREIGN KEY ("tenantId", "listingId") REFERENCES "VehicleDetails"("tenantId", "listingId");
ALTER TABLE "VehicleImport" ADD CONSTRAINT "VehicleImport_customer_same_tenant_fkey"
  FOREIGN KEY ("tenantId", "customerId") REFERENCES "Customer"("tenantId", "id");
ALTER TABLE "VehicleImportEvent" ADD CONSTRAINT "VehicleImportEvent_import_same_tenant_fkey"
  FOREIGN KEY ("tenantId", "importId") REFERENCES "VehicleImport"("tenantId", "id");

-- ---------------------------------------------------------------------------
-- Row-Level Security dès la création
-- ---------------------------------------------------------------------------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['VehicleDetails', 'VehicleTestDrive', 'VehicleSale', 'Lead', 'LeadEvent', 'VehicleImport', 'VehicleImportEvent', 'AutoSettings'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY;', t);
    EXECUTE format('CREATE POLICY tenant_isolation ON %I USING (yamacommerce_tenant_isolation_check("tenantId"));', t);
  END LOOP;
END $$;

-- Historiques : immuables.
REVOKE UPDATE, DELETE ON "LeadEvent" FROM yamacommerce_app;
REVOKE UPDATE, DELETE ON "VehicleImportEvent" FROM yamacommerce_app;

-- Le secteur Automobile devient opérationnel (souscriptible).
UPDATE "Sector" SET "isAvailable" = true WHERE "key" = 'automobile';
