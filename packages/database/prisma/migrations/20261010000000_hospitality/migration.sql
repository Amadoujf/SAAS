-- Étape 7 — Hôtels et locations (secteur hospitality) : types de chambres (extension
-- typée de Listing), chambres physiques et ménage, tarifs par période, séjours sans surréservation.

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- CreateTable
CREATE TABLE "RoomTypeDetails" (
    "listingId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "maxAdults" INTEGER NOT NULL,
    "maxChildren" INTEGER NOT NULL DEFAULT 0,
    "bedSummary" TEXT NOT NULL,
    "sizeM2" INTEGER,
    "amenities" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "minNights" INTEGER NOT NULL DEFAULT 1,
    "checkInMinute" INTEGER NOT NULL DEFAULT 840,
    "checkOutMinute" INTEGER NOT NULL DEFAULT 720,
    "depositPercent" INTEGER NOT NULL DEFAULT 0,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "RoomTypeDetails_pkey" PRIMARY KEY ("listingId")
);

-- CreateTable
CREATE TABLE "HotelRoom" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "floor" TEXT,
    "housekeeping" TEXT NOT NULL DEFAULT 'clean',
    "note" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HotelRoom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoomRate" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "nightlyPrice" INTEGER NOT NULL,
    "label" TEXT,

    CONSTRAINT "RoomRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HotelStay" (
    "reservationId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "arrival" DATE NOT NULL,
    "departure" DATE NOT NULL,
    "nights" INTEGER NOT NULL,
    "adults" INTEGER NOT NULL,
    "children" INTEGER NOT NULL DEFAULT 0,
    "nightly" JSONB NOT NULL DEFAULT '[]',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "checkedInAt" TIMESTAMP(3),
    "checkedOutAt" TIMESTAMP(3),

    CONSTRAINT "HotelStay_pkey" PRIMARY KEY ("reservationId")
);

-- CreateTable
CREATE TABLE "HotelSettings" (
    "tenantId" TEXT NOT NULL,
    "autoConfirm" BOOLEAN NOT NULL DEFAULT true,
    "cancelFreeHours" INTEGER NOT NULL DEFAULT 48,
    "maxAdvanceDays" INTEGER NOT NULL DEFAULT 365,
    "maxNights" INTEGER NOT NULL DEFAULT 30,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HotelSettings_pkey" PRIMARY KEY ("tenantId")
);

-- CreateIndex
CREATE INDEX "RoomTypeDetails_tenantId_position_idx" ON "RoomTypeDetails"("tenantId", "position");

-- CreateIndex
CREATE INDEX "HotelRoom_tenantId_listingId_idx" ON "HotelRoom"("tenantId", "listingId");

-- CreateIndex
CREATE UNIQUE INDEX "HotelRoom_tenantId_number_key" ON "HotelRoom"("tenantId", "number");

-- CreateIndex
CREATE INDEX "RoomRate_tenantId_listingId_startDate_idx" ON "RoomRate"("tenantId", "listingId", "startDate");

-- CreateIndex
CREATE INDEX "HotelStay_tenantId_arrival_idx" ON "HotelStay"("tenantId", "arrival");

-- CreateIndex
CREATE INDEX "HotelStay_tenantId_roomId_arrival_idx" ON "HotelStay"("tenantId", "roomId", "arrival");

-- AddForeignKey
ALTER TABLE "RoomTypeDetails" ADD CONSTRAINT "RoomTypeDetails_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomTypeDetails" ADD CONSTRAINT "RoomTypeDetails_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HotelRoom" ADD CONSTRAINT "HotelRoom_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HotelRoom" ADD CONSTRAINT "HotelRoom_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "RoomTypeDetails"("listingId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomRate" ADD CONSTRAINT "RoomRate_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomRate" ADD CONSTRAINT "RoomRate_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "RoomTypeDetails"("listingId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HotelStay" ADD CONSTRAINT "HotelStay_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HotelStay" ADD CONSTRAINT "HotelStay_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HotelStay" ADD CONSTRAINT "HotelStay_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "RoomTypeDetails"("listingId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HotelStay" ADD CONSTRAINT "HotelStay_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "HotelRoom"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HotelSettings" ADD CONSTRAINT "HotelSettings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- Intégrité métier
-- ---------------------------------------------------------------------------
ALTER TABLE "RoomTypeDetails" ADD CONSTRAINT "RoomTypeDetails_numbers_check" CHECK (
  "maxAdults" BETWEEN 1 AND 30 AND "maxChildren" BETWEEN 0 AND 20 AND "minNights" BETWEEN 1 AND 60
  AND "checkInMinute" BETWEEN 0 AND 1439 AND "checkOutMinute" BETWEEN 0 AND 1439
  AND "depositPercent" BETWEEN 0 AND 100 AND ("sizeM2" IS NULL OR "sizeM2" BETWEEN 1 AND 5000)
  AND length(trim("bedSummary")) BETWEEN 1 AND 80);
ALTER TABLE "HotelRoom" ADD CONSTRAINT "HotelRoom_housekeeping_check" CHECK ("housekeeping" IN ('clean', 'dirty', 'inspected', 'out_of_service'));
ALTER TABLE "HotelRoom" ADD CONSTRAINT "HotelRoom_number_check" CHECK (length(trim("number")) BETWEEN 1 AND 20);
ALTER TABLE "RoomRate" ADD CONSTRAINT "RoomRate_range_check" CHECK ("startDate" < "endDate" AND "nightlyPrice" >= 0);
ALTER TABLE "HotelStay" ADD CONSTRAINT "HotelStay_range_check" CHECK (
  "arrival" < "departure" AND "nights" = ("departure" - "arrival") AND "adults" BETWEEN 1 AND 30 AND "children" BETWEEN 0 AND 20);
ALTER TABLE "HotelSettings" ADD CONSTRAINT "HotelSettings_numbers_check" CHECK (
  "cancelFreeHours" BETWEEN 0 AND 720 AND "maxAdvanceDays" BETWEEN 1 AND 730 AND "maxNights" BETWEEN 1 AND 365);

-- Jamais deux périodes tarifaires qui se chevauchent pour un même type.
ALTER TABLE "RoomRate" ADD CONSTRAINT "RoomRate_no_overlap"
  EXCLUDE USING gist ("listingId" WITH =, daterange("startDate", "endDate", '[)') WITH &&);
-- Jamais deux séjours actifs qui se chevauchent dans une même chambre (garantie de la
-- base, en plus du verrou applicatif) ; le jour du départ reste libre pour une arrivée.
ALTER TABLE "HotelStay" ADD CONSTRAINT "HotelStay_no_overlap"
  EXCLUDE USING gist ("roomId" WITH =, daterange("arrival", "departure", '[)') WITH &&) WHERE ("active");

-- `active` suit le statut de la réservation : une annulation ou une non-présentation
-- libère la chambre, quel que soit le chemin qui a changé le statut.
CREATE OR REPLACE FUNCTION yamacommerce_sync_stay_active() RETURNS trigger AS $$
BEGIN
  UPDATE "HotelStay"
     SET "active" = NEW."status" IN ('requested', 'confirmed', 'completed')
   WHERE "reservationId" = NEW."id" AND "tenantId" = NEW."tenantId";
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "Reservation_sync_stay_active"
  AFTER UPDATE OF "status" ON "Reservation"
  FOR EACH ROW WHEN (OLD."status" IS DISTINCT FROM NEW."status")
  EXECUTE FUNCTION yamacommerce_sync_stay_active();

-- Même entreprise partout (clés composites, en plus de la RLS).
CREATE UNIQUE INDEX "RoomTypeDetails_tenantId_listingId_key" ON "RoomTypeDetails"("tenantId", "listingId");
CREATE UNIQUE INDEX "HotelRoom_tenantId_id_key" ON "HotelRoom"("tenantId", "id");
ALTER TABLE "RoomTypeDetails" ADD CONSTRAINT "RoomTypeDetails_same_tenant_fkey"
  FOREIGN KEY ("tenantId", "listingId") REFERENCES "Listing"("tenantId", "id");
ALTER TABLE "HotelRoom" ADD CONSTRAINT "HotelRoom_same_tenant_fkey"
  FOREIGN KEY ("tenantId", "listingId") REFERENCES "RoomTypeDetails"("tenantId", "listingId");
ALTER TABLE "RoomRate" ADD CONSTRAINT "RoomRate_same_tenant_fkey"
  FOREIGN KEY ("tenantId", "listingId") REFERENCES "RoomTypeDetails"("tenantId", "listingId");
ALTER TABLE "HotelStay" ADD CONSTRAINT "HotelStay_reservation_same_tenant_fkey"
  FOREIGN KEY ("tenantId", "reservationId") REFERENCES "Reservation"("tenantId", "id");
ALTER TABLE "HotelStay" ADD CONSTRAINT "HotelStay_room_same_tenant_fkey"
  FOREIGN KEY ("tenantId", "roomId") REFERENCES "HotelRoom"("tenantId", "id");
ALTER TABLE "HotelStay" ADD CONSTRAINT "HotelStay_type_same_tenant_fkey"
  FOREIGN KEY ("tenantId", "listingId") REFERENCES "RoomTypeDetails"("tenantId", "listingId");

-- ---------------------------------------------------------------------------
-- Row-Level Security dès la création
-- ---------------------------------------------------------------------------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['RoomTypeDetails', 'HotelRoom', 'RoomRate', 'HotelStay', 'HotelSettings'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY;', t);
    EXECUTE format('CREATE POLICY tenant_isolation ON %I USING (yamacommerce_tenant_isolation_check("tenantId"));', t);
  END LOOP;
END $$;

-- Le secteur Hôtels devient opérationnel (souscriptible).
UPDATE "Sector" SET "isAvailable" = true WHERE "key" = 'hospitality';
