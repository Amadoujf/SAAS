-- Étape 3 — primitives génériques des secteurs hors commerce (docs/04 §4.5.2) :
-- fiches (Listing + historique immuable), créneaux réservables, réservations
-- (+ historique immuable). Les tables d'extension typées de chaque secteur
-- (PropertyDetails, TravelPackageDetails, …) arrivent avec chaque secteur.

-- CreateTable
CREATE TABLE "Listing" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "moduleKey" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "summary" TEXT,
    "description" TEXT,
    "price" INTEGER,
    "priceUnit" TEXT NOT NULL DEFAULT 'total',
    "currency" TEXT NOT NULL DEFAULT 'XOF',
    "location" JSONB,
    "media" JSONB NOT NULL DEFAULT '[]',
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Listing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ListingRevision" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "changedBy" TEXT,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ListingRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ListingAvailability" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "startAt" TIMESTAMPTZ(3) NOT NULL,
    "endAt" TIMESTAMPTZ(3),
    "capacity" INTEGER NOT NULL DEFAULT 1,
    "reservedCount" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'open',
    "priceOverride" INTEGER,
    "label" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ListingAvailability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reservation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "listingId" TEXT,
    "availabilityId" TEXT,
    "customerId" TEXT NOT NULL,
    "moduleKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'requested',
    "startAt" TIMESTAMPTZ(3) NOT NULL,
    "endAt" TIMESTAMPTZ(3),
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" INTEGER,
    "totalAmount" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'XOF',
    "customerNote" TEXT,
    "internalNote" TEXT,
    "channel" TEXT NOT NULL DEFAULT 'web',
    "accessToken" TEXT NOT NULL,
    "confirmedAt" TIMESTAMP(3),
    "canceledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReservationStatusHistory" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT NOT NULL,
    "changedBy" TEXT,
    "changedByType" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReservationStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Listing_tenantId_moduleKey_status_idx" ON "Listing"("tenantId", "moduleKey", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Listing_tenantId_slug_key" ON "Listing"("tenantId", "slug");

-- CreateIndex
CREATE INDEX "ListingRevision_listingId_changedAt_idx" ON "ListingRevision"("listingId", "changedAt");

-- CreateIndex
CREATE INDEX "ListingAvailability_tenantId_startAt_idx" ON "ListingAvailability"("tenantId", "startAt");

-- CreateIndex
CREATE UNIQUE INDEX "ListingAvailability_listingId_startAt_key" ON "ListingAvailability"("listingId", "startAt");

-- CreateIndex
CREATE UNIQUE INDEX "Reservation_accessToken_key" ON "Reservation"("accessToken");

-- CreateIndex
CREATE INDEX "Reservation_tenantId_moduleKey_startAt_idx" ON "Reservation"("tenantId", "moduleKey", "startAt");

-- CreateIndex
CREATE INDEX "Reservation_tenantId_status_idx" ON "Reservation"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Reservation_tenantId_reference_key" ON "Reservation"("tenantId", "reference");

-- CreateIndex
CREATE INDEX "ReservationStatusHistory_reservationId_createdAt_idx" ON "ReservationStatusHistory"("reservationId", "createdAt");

-- AddForeignKey
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListingRevision" ADD CONSTRAINT "ListingRevision_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListingRevision" ADD CONSTRAINT "ListingRevision_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListingAvailability" ADD CONSTRAINT "ListingAvailability_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListingAvailability" ADD CONSTRAINT "ListingAvailability_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_availabilityId_fkey" FOREIGN KEY ("availabilityId") REFERENCES "ListingAvailability"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReservationStatusHistory" ADD CONSTRAINT "ReservationStatusHistory_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReservationStatusHistory" ADD CONSTRAINT "ReservationStatusHistory_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- Intégrité métier en base (jamais seulement dans le code applicatif)
-- ---------------------------------------------------------------------------
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_type_check"
  CHECK ("type" IN ('property', 'travel_package', 'service_offering', 'room', 'vehicle', 'course'));
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_status_check"
  CHECK ("status" IN ('draft', 'published', 'unavailable', 'archived'));
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_priceUnit_check"
  CHECK ("priceUnit" IN ('total', 'per_person', 'per_night', 'per_month', 'per_session', 'on_request'));
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_price_non_negative" CHECK ("price" IS NULL OR "price" >= 0);

ALTER TABLE "ListingAvailability" ADD CONSTRAINT "ListingAvailability_status_check"
  CHECK ("status" IN ('open', 'closed'));
ALTER TABLE "ListingAvailability" ADD CONSTRAINT "ListingAvailability_capacity_positive" CHECK ("capacity" >= 1);
-- Jamais de surréservation, même en cas de bug applicatif ou de course concurrente.
ALTER TABLE "ListingAvailability" ADD CONSTRAINT "ListingAvailability_reserved_within_capacity"
  CHECK ("reservedCount" >= 0 AND "reservedCount" <= "capacity");
ALTER TABLE "ListingAvailability" ADD CONSTRAINT "ListingAvailability_end_after_start"
  CHECK ("endAt" IS NULL OR "endAt" > "startAt");
ALTER TABLE "ListingAvailability" ADD CONSTRAINT "ListingAvailability_price_non_negative"
  CHECK ("priceOverride" IS NULL OR "priceOverride" >= 0);

ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_status_check"
  CHECK ("status" IN ('requested', 'confirmed', 'completed', 'canceled', 'no_show'));
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_quantity_positive" CHECK ("quantity" >= 1);
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_amounts_non_negative"
  CHECK (("unitPrice" IS NULL OR "unitPrice" >= 0) AND ("totalAmount" IS NULL OR "totalAmount" >= 0));
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_end_after_start"
  CHECK ("endAt" IS NULL OR "endAt" > "startAt");

-- Une réservation, un créneau ou une révision ne peut JAMAIS pointer vers la fiche,
-- le créneau ou le client d'une AUTRE entreprise : clés étrangères composites
-- (tenantId, id), en plus de la RLS.
CREATE UNIQUE INDEX "Listing_tenantId_id_key" ON "Listing"("tenantId", "id");
CREATE UNIQUE INDEX "ListingAvailability_tenantId_id_key" ON "ListingAvailability"("tenantId", "id");
CREATE UNIQUE INDEX "Reservation_tenantId_id_key" ON "Reservation"("tenantId", "id");
CREATE UNIQUE INDEX IF NOT EXISTS "Customer_tenantId_id_key" ON "Customer"("tenantId", "id");

ALTER TABLE "ListingRevision" ADD CONSTRAINT "ListingRevision_same_tenant_fkey"
  FOREIGN KEY ("tenantId", "listingId") REFERENCES "Listing"("tenantId", "id");
ALTER TABLE "ListingAvailability" ADD CONSTRAINT "ListingAvailability_same_tenant_fkey"
  FOREIGN KEY ("tenantId", "listingId") REFERENCES "Listing"("tenantId", "id");
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_listing_same_tenant_fkey"
  FOREIGN KEY ("tenantId", "listingId") REFERENCES "Listing"("tenantId", "id");
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_availability_same_tenant_fkey"
  FOREIGN KEY ("tenantId", "availabilityId") REFERENCES "ListingAvailability"("tenantId", "id");
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_customer_same_tenant_fkey"
  FOREIGN KEY ("tenantId", "customerId") REFERENCES "Customer"("tenantId", "id");
ALTER TABLE "ReservationStatusHistory" ADD CONSTRAINT "ReservationStatusHistory_same_tenant_fkey"
  FOREIGN KEY ("tenantId", "reservationId") REFERENCES "Reservation"("tenantId", "id");

-- ---------------------------------------------------------------------------
-- Row-Level Security (Pattern A) dès la création — même méthode que Cart/Order.
-- ---------------------------------------------------------------------------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['Listing', 'ListingRevision', 'ListingAvailability', 'Reservation', 'ReservationStatusHistory'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY;', t);
    EXECUTE format('CREATE POLICY tenant_isolation ON %I USING (yamacommerce_tenant_isolation_check("tenantId"));', t);
  END LOOP;
END $$;

-- Historiques immuables : une révision de fiche ou une transition de réservation ne
-- peut jamais être réécrite après coup (même garantie que OrderStatusHistory).
REVOKE UPDATE, DELETE ON "ListingRevision" FROM yamacommerce_app;
REVOKE UPDATE, DELETE ON "ReservationStatusHistory" FROM yamacommerce_app;
