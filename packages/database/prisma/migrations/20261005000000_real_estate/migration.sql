-- Étape 4 — Immobilier (secteur real_estate) : fiche technique des biens (extension
-- typée de Listing), baux et échéances de loyer. Le secteur devient disponible à la
-- souscription dans la même migration.

-- CreateTable
CREATE TABLE "PropertyDetails" (
    "listingId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "propertyType" TEXT NOT NULL,
    "dealType" TEXT NOT NULL,
    "bedrooms" INTEGER,
    "bathrooms" INTEGER,
    "surfaceM2" INTEGER,
    "landSurfaceM2" INTEGER,
    "furnished" BOOLEAN NOT NULL DEFAULT false,
    "amenities" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "agencyReference" TEXT,
    "customAttributes" JSONB,

    CONSTRAINT "PropertyDetails_pkey" PRIMARY KEY ("listingId")
);

-- CreateTable
CREATE TABLE "Lease" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "occupantCustomerId" TEXT NOT NULL,
    "landlordName" TEXT,
    "landlordPhone" TEXT,
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "monthlyRent" INTEGER NOT NULL,
    "charges" INTEGER NOT NULL DEFAULT 0,
    "depositAmount" INTEGER NOT NULL DEFAULT 0,
    "dueDay" INTEGER NOT NULL DEFAULT 5,
    "status" TEXT NOT NULL DEFAULT 'active',
    "notes" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "listingAvailabilityId" TEXT,

    CONSTRAINT "Lease_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RentPayment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "leaseId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "dueDate" DATE NOT NULL,
    "amountDue" INTEGER NOT NULL,
    "amountPaid" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "method" TEXT,
    "paymentReference" TEXT,
    "paidAt" TIMESTAMP(3),
    "recordedBy" TEXT,
    "receiptNumber" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RentPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PropertyDetails_tenantId_propertyType_dealType_bedrooms_sur_idx" ON "PropertyDetails"("tenantId", "propertyType", "dealType", "bedrooms", "surfaceM2");

-- CreateIndex
CREATE INDEX "Lease_tenantId_status_idx" ON "Lease"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Lease_tenantId_reference_key" ON "Lease"("tenantId", "reference");

-- CreateIndex
CREATE INDEX "RentPayment_tenantId_status_dueDate_idx" ON "RentPayment"("tenantId", "status", "dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "RentPayment_leaseId_period_key" ON "RentPayment"("leaseId", "period");

-- AddForeignKey
ALTER TABLE "PropertyDetails" ADD CONSTRAINT "PropertyDetails_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyDetails" ADD CONSTRAINT "PropertyDetails_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lease" ADD CONSTRAINT "Lease_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lease" ADD CONSTRAINT "Lease_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lease" ADD CONSTRAINT "Lease_occupantCustomerId_fkey" FOREIGN KEY ("occupantCustomerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lease" ADD CONSTRAINT "Lease_listingAvailabilityId_fkey" FOREIGN KEY ("listingAvailabilityId") REFERENCES "ListingAvailability"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentPayment" ADD CONSTRAINT "RentPayment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentPayment" ADD CONSTRAINT "RentPayment_leaseId_fkey" FOREIGN KEY ("leaseId") REFERENCES "Lease"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- Intégrité métier
-- ---------------------------------------------------------------------------
ALTER TABLE "PropertyDetails" ADD CONSTRAINT "PropertyDetails_type_check"
  CHECK ("propertyType" IN ('apartment', 'house', 'villa', 'land', 'commercial', 'office'));
ALTER TABLE "PropertyDetails" ADD CONSTRAINT "PropertyDetails_deal_check" CHECK ("dealType" IN ('sale', 'rent'));
ALTER TABLE "PropertyDetails" ADD CONSTRAINT "PropertyDetails_numbers_check" CHECK (
  ("bedrooms" IS NULL OR "bedrooms" BETWEEN 0 AND 50) AND ("bathrooms" IS NULL OR "bathrooms" BETWEEN 0 AND 50)
  AND ("surfaceM2" IS NULL OR "surfaceM2" > 0) AND ("landSurfaceM2" IS NULL OR "landSurfaceM2" > 0));

ALTER TABLE "Lease" ADD CONSTRAINT "Lease_status_check" CHECK ("status" IN ('active', 'ended', 'terminated'));
ALTER TABLE "Lease" ADD CONSTRAINT "Lease_amounts_check"
  CHECK ("monthlyRent" > 0 AND "charges" >= 0 AND "depositAmount" >= 0);
ALTER TABLE "Lease" ADD CONSTRAINT "Lease_due_day_check" CHECK ("dueDay" BETWEEN 1 AND 28);
ALTER TABLE "Lease" ADD CONSTRAINT "Lease_dates_check" CHECK ("endDate" IS NULL OR "endDate" > "startDate");
-- Un bien n'a jamais deux baux actifs en même temps.
CREATE UNIQUE INDEX "Lease_one_active_per_listing" ON "Lease"("listingId") WHERE "status" = 'active';

ALTER TABLE "RentPayment" ADD CONSTRAINT "RentPayment_status_check" CHECK ("status" IN ('pending', 'paid', 'canceled'));
ALTER TABLE "RentPayment" ADD CONSTRAINT "RentPayment_period_check" CHECK ("period" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$');
ALTER TABLE "RentPayment" ADD CONSTRAINT "RentPayment_amounts_check" CHECK ("amountDue" > 0 AND "amountPaid" >= 0);
-- « Payé » exige un encaissement réellement enregistré : montant, date et moyen.
ALTER TABLE "RentPayment" ADD CONSTRAINT "RentPayment_paid_is_recorded" CHECK (
  "status" <> 'paid' OR ("amountPaid" > 0 AND "paidAt" IS NOT NULL AND "method" IS NOT NULL));
ALTER TABLE "RentPayment" ADD CONSTRAINT "RentPayment_method_check"
  CHECK ("method" IS NULL OR "method" IN ('cash', 'wave', 'orange_money', 'bank_transfer', 'check'));

-- Même entreprise partout (clés composites, en plus de la RLS).
CREATE UNIQUE INDEX "Lease_tenantId_id_key" ON "Lease"("tenantId", "id");
ALTER TABLE "PropertyDetails" ADD CONSTRAINT "PropertyDetails_same_tenant_fkey"
  FOREIGN KEY ("tenantId", "listingId") REFERENCES "Listing"("tenantId", "id");
ALTER TABLE "Lease" ADD CONSTRAINT "Lease_listing_same_tenant_fkey"
  FOREIGN KEY ("tenantId", "listingId") REFERENCES "Listing"("tenantId", "id");
ALTER TABLE "Lease" ADD CONSTRAINT "Lease_occupant_same_tenant_fkey"
  FOREIGN KEY ("tenantId", "occupantCustomerId") REFERENCES "Customer"("tenantId", "id");
ALTER TABLE "RentPayment" ADD CONSTRAINT "RentPayment_lease_same_tenant_fkey"
  FOREIGN KEY ("tenantId", "leaseId") REFERENCES "Lease"("tenantId", "id");

-- ---------------------------------------------------------------------------
-- Row-Level Security dès la création
-- ---------------------------------------------------------------------------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['PropertyDetails', 'Lease', 'RentPayment'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY;', t);
    EXECUTE format('CREATE POLICY tenant_isolation ON %I USING (yamacommerce_tenant_isolation_check("tenantId"));', t);
  END LOOP;
END $$;

-- Le secteur Immobilier devient opérationnel (souscriptible).
UPDATE "Sector" SET "isAvailable" = true WHERE "key" = 'real_estate';
