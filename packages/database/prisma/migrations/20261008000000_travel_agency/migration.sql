-- Étape 5 — Voyage (secteur travel_agency) : fiche technique des voyages (extension
-- typée de Listing), programme, voyageurs nominatifs, pièces, encaissements.

CREATE TABLE "TravelPackageDetails" (
    "listingId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "tripType" TEXT NOT NULL,
    "destinationCountry" TEXT NOT NULL,
    "destinationCity" TEXT,
    "durationDays" INTEGER NOT NULL,
    "durationNights" INTEGER NOT NULL DEFAULT 0,
    "included" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "excludedNote" TEXT,
    "depositPercent" INTEGER NOT NULL DEFAULT 30,
    "requiredDocuments" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "meetingPoint" TEXT,

    CONSTRAINT "TravelPackageDetails_pkey" PRIMARY KEY ("listingId")
);

CREATE TABLE "TravelItineraryDay" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "dayNumber" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "TravelItineraryDay_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ReservationTraveler" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "birthDate" DATE,
    "nationality" TEXT,
    "passportCipher" JSONB,
    "passportLast4" TEXT,
    "passportExpiry" DATE,
    "isLead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReservationTraveler_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TravelerDocument" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "travelerId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'missing',
    "note" TEXT,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TravelerDocument_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ReservationPayment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "receiptNumber" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "method" TEXT NOT NULL,
    "reference" TEXT,
    "paidAt" TIMESTAMPTZ(3) NOT NULL,
    "recordedBy" TEXT,
    "voidedAt" TIMESTAMPTZ(3),
    "voidReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReservationPayment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TravelPackageDetails_tenantId_tripType_destinationCountry_d_idx" ON "TravelPackageDetails"("tenantId", "tripType", "destinationCountry", "durationDays");

CREATE UNIQUE INDEX "TravelItineraryDay_listingId_dayNumber_key" ON "TravelItineraryDay"("listingId", "dayNumber");

CREATE INDEX "ReservationTraveler_tenantId_reservationId_idx" ON "ReservationTraveler"("tenantId", "reservationId");

CREATE UNIQUE INDEX "ReservationTraveler_reservationId_position_key" ON "ReservationTraveler"("reservationId", "position");

CREATE INDEX "TravelerDocument_tenantId_kind_status_idx" ON "TravelerDocument"("tenantId", "kind", "status");

CREATE UNIQUE INDEX "TravelerDocument_travelerId_kind_key" ON "TravelerDocument"("travelerId", "kind");

CREATE INDEX "ReservationPayment_tenantId_reservationId_idx" ON "ReservationPayment"("tenantId", "reservationId");

CREATE UNIQUE INDEX "ReservationPayment_tenantId_receiptNumber_key" ON "ReservationPayment"("tenantId", "receiptNumber");

ALTER TABLE "TravelPackageDetails" ADD CONSTRAINT "TravelPackageDetails_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "TravelPackageDetails" ADD CONSTRAINT "TravelPackageDetails_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "TravelItineraryDay" ADD CONSTRAINT "TravelItineraryDay_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "TravelItineraryDay" ADD CONSTRAINT "TravelItineraryDay_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "TravelPackageDetails"("listingId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ReservationTraveler" ADD CONSTRAINT "ReservationTraveler_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ReservationTraveler" ADD CONSTRAINT "ReservationTraveler_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "TravelerDocument" ADD CONSTRAINT "TravelerDocument_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "TravelerDocument" ADD CONSTRAINT "TravelerDocument_travelerId_fkey" FOREIGN KEY ("travelerId") REFERENCES "ReservationTraveler"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ReservationPayment" ADD CONSTRAINT "ReservationPayment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ReservationPayment" ADD CONSTRAINT "ReservationPayment_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Intégrité métier
-- ---------------------------------------------------------------------------
ALTER TABLE "TravelPackageDetails" ADD CONSTRAINT "TravelPackageDetails_trip_type_check"
  CHECK ("tripType" IN ('circuit', 'stay', 'pilgrimage', 'excursion', 'cruise'));
ALTER TABLE "TravelPackageDetails" ADD CONSTRAINT "TravelPackageDetails_numbers_check" CHECK (
  "durationDays" BETWEEN 1 AND 90 AND "durationNights" BETWEEN 0 AND 90 AND "depositPercent" BETWEEN 0 AND 100);
ALTER TABLE "TravelItineraryDay" ADD CONSTRAINT "TravelItineraryDay_day_check" CHECK ("dayNumber" BETWEEN 1 AND 90);
ALTER TABLE "ReservationTraveler" ADD CONSTRAINT "ReservationTraveler_position_check" CHECK ("position" BETWEEN 1 AND 50);
-- Un seul voyageur principal par réservation.
CREATE UNIQUE INDEX "ReservationTraveler_one_lead" ON "ReservationTraveler"("reservationId") WHERE "isLead";
ALTER TABLE "TravelerDocument" ADD CONSTRAINT "TravelerDocument_kind_check"
  CHECK ("kind" IN ('passport', 'id_card', 'visa', 'yellow_fever', 'photo', 'travel_insurance'));
ALTER TABLE "TravelerDocument" ADD CONSTRAINT "TravelerDocument_status_check"
  CHECK ("status" IN ('missing', 'received', 'submitted', 'approved', 'refused'));
ALTER TABLE "ReservationPayment" ADD CONSTRAINT "ReservationPayment_kind_check" CHECK ("kind" IN ('deposit', 'balance', 'other'));
ALTER TABLE "ReservationPayment" ADD CONSTRAINT "ReservationPayment_amount_check" CHECK ("amount" > 0);
ALTER TABLE "ReservationPayment" ADD CONSTRAINT "ReservationPayment_method_check"
  CHECK ("method" IN ('cash', 'wave', 'orange_money', 'bank_transfer', 'card_terminal'));
ALTER TABLE "ReservationPayment" ADD CONSTRAINT "ReservationPayment_void_check"
  CHECK (("voidedAt" IS NULL AND "voidReason" IS NULL) OR ("voidedAt" IS NOT NULL AND length(trim("voidReason")) > 0));

-- Même entreprise partout (clés composites, en plus de la RLS).
CREATE UNIQUE INDEX "ReservationTraveler_tenantId_id_key" ON "ReservationTraveler"("tenantId", "id");
CREATE UNIQUE INDEX "TravelPackageDetails_tenantId_listingId_key" ON "TravelPackageDetails"("tenantId", "listingId");
ALTER TABLE "TravelPackageDetails" ADD CONSTRAINT "TravelPackageDetails_same_tenant_fkey"
  FOREIGN KEY ("tenantId", "listingId") REFERENCES "Listing"("tenantId", "id");
ALTER TABLE "TravelItineraryDay" ADD CONSTRAINT "TravelItineraryDay_same_tenant_fkey"
  FOREIGN KEY ("tenantId", "listingId") REFERENCES "TravelPackageDetails"("tenantId", "listingId");
ALTER TABLE "ReservationTraveler" ADD CONSTRAINT "ReservationTraveler_same_tenant_fkey"
  FOREIGN KEY ("tenantId", "reservationId") REFERENCES "Reservation"("tenantId", "id");
ALTER TABLE "TravelerDocument" ADD CONSTRAINT "TravelerDocument_same_tenant_fkey"
  FOREIGN KEY ("tenantId", "travelerId") REFERENCES "ReservationTraveler"("tenantId", "id");
ALTER TABLE "ReservationPayment" ADD CONSTRAINT "ReservationPayment_same_tenant_fkey"
  FOREIGN KEY ("tenantId", "reservationId") REFERENCES "Reservation"("tenantId", "id");

-- ---------------------------------------------------------------------------
-- Row-Level Security dès la création
-- ---------------------------------------------------------------------------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['TravelPackageDetails', 'TravelItineraryDay', 'ReservationTraveler', 'TravelerDocument', 'ReservationPayment'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY;', t);
    EXECUTE format('CREATE POLICY tenant_isolation ON %I USING (yamacommerce_tenant_isolation_check("tenantId"));', t);
  END LOOP;
END $$;

-- Encaissements : jamais supprimés ; seule l'annulation motivée est modifiable.
REVOKE UPDATE, DELETE ON "ReservationPayment" FROM yamacommerce_app;
GRANT UPDATE ("voidedAt", "voidReason") ON "ReservationPayment" TO yamacommerce_app;

-- Le secteur Voyage devient opérationnel (souscriptible).
UPDATE "Sector" SET "isAvailable" = true WHERE "key" = 'travel_agency';
