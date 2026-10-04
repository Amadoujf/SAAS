-- Étape 6 — Services / salons (secteur services) : prestations (extension typée de
-- Listing), équipe, compétences, horaires, absences, rendez-vous sans chevauchement.

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- CreateTable
CREATE TABLE "ServiceDetails" (
    "listingId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "bufferMinutes" INTEGER NOT NULL DEFAULT 0,
    "priceFrom" BOOLEAN NOT NULL DEFAULT false,
    "onlineBooking" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ServiceDetails_pkey" PRIMARY KEY ("listingId")
);

-- CreateTable
CREATE TABLE "ServiceStaff" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "title" TEXT,
    "bio" TEXT,
    "photoUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "acceptsOnline" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceStaff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceStaffSkill" (
    "tenantId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,

    CONSTRAINT "ServiceStaffSkill_pkey" PRIMARY KEY ("staffId","listingId")
);

-- CreateTable
CREATE TABLE "StaffWorkingHours" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "startMinute" INTEGER NOT NULL,
    "endMinute" INTEGER NOT NULL,

    CONSTRAINT "StaffWorkingHours_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffTimeOff" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "startAt" TIMESTAMPTZ(3) NOT NULL,
    "endAt" TIMESTAMPTZ(3) NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffTimeOff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceAppointment" (
    "reservationId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "startAt" TIMESTAMPTZ(3) NOT NULL,
    "endAt" TIMESTAMPTZ(3) NOT NULL,
    "blockedUntil" TIMESTAMPTZ(3) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ServiceAppointment_pkey" PRIMARY KEY ("reservationId")
);

-- CreateTable
CREATE TABLE "ServiceBookingSettings" (
    "tenantId" TEXT NOT NULL,
    "slotStepMinutes" INTEGER NOT NULL DEFAULT 15,
    "minLeadMinutes" INTEGER NOT NULL DEFAULT 60,
    "maxAdvanceDays" INTEGER NOT NULL DEFAULT 45,
    "cancelCutoffHours" INTEGER NOT NULL DEFAULT 3,
    "autoConfirm" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceBookingSettings_pkey" PRIMARY KEY ("tenantId")
);

-- CreateIndex
CREATE INDEX "ServiceDetails_tenantId_category_position_idx" ON "ServiceDetails"("tenantId", "category", "position");

-- CreateIndex
CREATE INDEX "ServiceStaff_tenantId_isActive_position_idx" ON "ServiceStaff"("tenantId", "isActive", "position");

-- CreateIndex
CREATE INDEX "ServiceStaffSkill_tenantId_listingId_idx" ON "ServiceStaffSkill"("tenantId", "listingId");

-- CreateIndex
CREATE INDEX "StaffWorkingHours_tenantId_staffId_weekday_idx" ON "StaffWorkingHours"("tenantId", "staffId", "weekday");

-- CreateIndex
CREATE INDEX "StaffTimeOff_tenantId_staffId_startAt_idx" ON "StaffTimeOff"("tenantId", "staffId", "startAt");

-- CreateIndex
CREATE INDEX "ServiceAppointment_tenantId_staffId_startAt_idx" ON "ServiceAppointment"("tenantId", "staffId", "startAt");

-- CreateIndex
CREATE INDEX "ServiceAppointment_tenantId_startAt_idx" ON "ServiceAppointment"("tenantId", "startAt");

-- AddForeignKey
ALTER TABLE "ServiceDetails" ADD CONSTRAINT "ServiceDetails_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceDetails" ADD CONSTRAINT "ServiceDetails_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceStaff" ADD CONSTRAINT "ServiceStaff_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceStaffSkill" ADD CONSTRAINT "ServiceStaffSkill_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceStaffSkill" ADD CONSTRAINT "ServiceStaffSkill_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "ServiceStaff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceStaffSkill" ADD CONSTRAINT "ServiceStaffSkill_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "ServiceDetails"("listingId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffWorkingHours" ADD CONSTRAINT "StaffWorkingHours_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffWorkingHours" ADD CONSTRAINT "StaffWorkingHours_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "ServiceStaff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffTimeOff" ADD CONSTRAINT "StaffTimeOff_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffTimeOff" ADD CONSTRAINT "StaffTimeOff_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "ServiceStaff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceAppointment" ADD CONSTRAINT "ServiceAppointment_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceAppointment" ADD CONSTRAINT "ServiceAppointment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceAppointment" ADD CONSTRAINT "ServiceAppointment_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "ServiceStaff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceAppointment" ADD CONSTRAINT "ServiceAppointment_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "ServiceDetails"("listingId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceBookingSettings" ADD CONSTRAINT "ServiceBookingSettings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- Intégrité métier
-- ---------------------------------------------------------------------------
ALTER TABLE "ServiceDetails" ADD CONSTRAINT "ServiceDetails_numbers_check" CHECK (
  "durationMinutes" BETWEEN 5 AND 600 AND "bufferMinutes" BETWEEN 0 AND 180 AND length(trim("category")) BETWEEN 1 AND 60);
ALTER TABLE "ServiceStaff" ADD CONSTRAINT "ServiceStaff_name_check" CHECK (length(trim("displayName")) BETWEEN 1 AND 80);
ALTER TABLE "StaffWorkingHours" ADD CONSTRAINT "StaffWorkingHours_range_check" CHECK (
  "weekday" BETWEEN 0 AND 6 AND "startMinute" >= 0 AND "endMinute" <= 1440 AND "startMinute" < "endMinute");
ALTER TABLE "StaffTimeOff" ADD CONSTRAINT "StaffTimeOff_range_check" CHECK ("startAt" < "endAt");
ALTER TABLE "ServiceAppointment" ADD CONSTRAINT "ServiceAppointment_range_check" CHECK (
  "startAt" < "endAt" AND "endAt" <= "blockedUntil");
ALTER TABLE "ServiceBookingSettings" ADD CONSTRAINT "ServiceBookingSettings_numbers_check" CHECK (
  "slotStepMinutes" IN (5, 10, 15, 20, 30, 60) AND "minLeadMinutes" BETWEEN 0 AND 10080
  AND "maxAdvanceDays" BETWEEN 1 AND 365 AND "cancelCutoffHours" BETWEEN 0 AND 168);

-- Deux plages actives d'une même personne ne se chevauchent JAMAIS, même sous des
-- réservations simultanées (garantie de la base, en plus du verrou applicatif).
ALTER TABLE "ServiceAppointment" ADD CONSTRAINT "ServiceAppointment_no_overlap"
  EXCLUDE USING gist ("staffId" WITH =, tstzrange("startAt", "blockedUntil", '[)') WITH &&) WHERE ("active");

-- `active` suit le statut de la réservation : une annulation ou une absence libère la
-- plage, quel que soit le chemin qui a changé le statut.
CREATE OR REPLACE FUNCTION yamacommerce_sync_appointment_active() RETURNS trigger AS $$
BEGIN
  UPDATE "ServiceAppointment"
     SET "active" = NEW."status" IN ('requested', 'confirmed', 'completed')
   WHERE "reservationId" = NEW."id" AND "tenantId" = NEW."tenantId";
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "Reservation_sync_appointment_active"
  AFTER UPDATE OF "status" ON "Reservation"
  FOR EACH ROW WHEN (OLD."status" IS DISTINCT FROM NEW."status")
  EXECUTE FUNCTION yamacommerce_sync_appointment_active();

-- Même entreprise partout (clés composites, en plus de la RLS).
CREATE UNIQUE INDEX "ServiceDetails_tenantId_listingId_key" ON "ServiceDetails"("tenantId", "listingId");
CREATE UNIQUE INDEX "ServiceStaff_tenantId_id_key" ON "ServiceStaff"("tenantId", "id");
ALTER TABLE "ServiceDetails" ADD CONSTRAINT "ServiceDetails_same_tenant_fkey"
  FOREIGN KEY ("tenantId", "listingId") REFERENCES "Listing"("tenantId", "id");
ALTER TABLE "ServiceStaffSkill" ADD CONSTRAINT "ServiceStaffSkill_staff_same_tenant_fkey"
  FOREIGN KEY ("tenantId", "staffId") REFERENCES "ServiceStaff"("tenantId", "id");
ALTER TABLE "ServiceStaffSkill" ADD CONSTRAINT "ServiceStaffSkill_service_same_tenant_fkey"
  FOREIGN KEY ("tenantId", "listingId") REFERENCES "ServiceDetails"("tenantId", "listingId");
ALTER TABLE "StaffWorkingHours" ADD CONSTRAINT "StaffWorkingHours_same_tenant_fkey"
  FOREIGN KEY ("tenantId", "staffId") REFERENCES "ServiceStaff"("tenantId", "id");
ALTER TABLE "StaffTimeOff" ADD CONSTRAINT "StaffTimeOff_same_tenant_fkey"
  FOREIGN KEY ("tenantId", "staffId") REFERENCES "ServiceStaff"("tenantId", "id");
ALTER TABLE "ServiceAppointment" ADD CONSTRAINT "ServiceAppointment_reservation_same_tenant_fkey"
  FOREIGN KEY ("tenantId", "reservationId") REFERENCES "Reservation"("tenantId", "id");
ALTER TABLE "ServiceAppointment" ADD CONSTRAINT "ServiceAppointment_staff_same_tenant_fkey"
  FOREIGN KEY ("tenantId", "staffId") REFERENCES "ServiceStaff"("tenantId", "id");
ALTER TABLE "ServiceAppointment" ADD CONSTRAINT "ServiceAppointment_service_same_tenant_fkey"
  FOREIGN KEY ("tenantId", "listingId") REFERENCES "ServiceDetails"("tenantId", "listingId");

-- ---------------------------------------------------------------------------
-- Row-Level Security dès la création
-- ---------------------------------------------------------------------------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['ServiceDetails', 'ServiceStaff', 'ServiceStaffSkill', 'StaffWorkingHours', 'StaffTimeOff', 'ServiceAppointment', 'ServiceBookingSettings'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY;', t);
    EXECUTE format('CREATE POLICY tenant_isolation ON %I USING (yamacommerce_tenant_isolation_check("tenantId"));', t);
  END LOOP;
END $$;

-- Le secteur Services devient opérationnel (souscriptible).
UPDATE "Sector" SET "isAvailable" = true WHERE "key" = 'services';
