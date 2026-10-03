-- Éducation : formations, classes, élèves, accès famille, inscriptions, échéances,
-- présences, évaluations, notes, réglages.

CREATE TABLE "ProgramDetails" (
    "listingId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'training',
    "level" TEXT,
    "format" TEXT NOT NULL DEFAULT 'onsite',
    "durationLabel" TEXT,
    "registrationFee" INTEGER NOT NULL DEFAULT 0,
    "defaultInstallments" INTEGER NOT NULL DEFAULT 1,
    "audience" TEXT NOT NULL DEFAULT 'all',
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProgramDetails_pkey" PRIMARY KEY ("listingId")
);

CREATE TABLE "ClassGroup" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "teacherUserId" TEXT,
    "room" TEXT,
    "schedule" JSONB NOT NULL DEFAULT '[]',
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "capacity" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClassGroup_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Student" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "guardianId" TEXT NOT NULL,
    "guardianRelation" TEXT NOT NULL DEFAULT 'parent',
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "birthDate" DATE,
    "accessToken" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Student_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FamilyAccess" (
    "customerId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FamilyAccess_pkey" PRIMARY KEY ("customerId")
);

CREATE TABLE "EnrollmentDetails" (
    "reservationId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "classGroupId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "registrationFee" INTEGER NOT NULL DEFAULT 0,
    "tuition" INTEGER NOT NULL DEFAULT 0,
    "discountAmount" INTEGER NOT NULL DEFAULT 0,
    "discountReason" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EnrollmentDetails_pkey" PRIMARY KEY ("reservationId")
);

CREATE TABLE "EnrollmentInstallment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "dueDate" DATE NOT NULL,
    "amount" INTEGER NOT NULL,

    CONSTRAINT "EnrollmentInstallment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AttendanceRecord" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "classGroupId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "sessionDate" DATE NOT NULL,
    "status" TEXT NOT NULL,
    "note" TEXT,
    "recordedBy" TEXT,
    "recordedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttendanceRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Assessment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "classGroupId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "coefficient" DECIMAL(4,2) NOT NULL DEFAULT 1,
    "maxScore" INTEGER NOT NULL DEFAULT 20,
    "publishedAt" TIMESTAMPTZ(3),
    "createdBy" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Assessment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Grade" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "score" DECIMAL(5,2),
    "absent" BOOLEAN NOT NULL DEFAULT false,
    "comment" TEXT,
    "recordedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Grade_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EducationSettings" (
    "tenantId" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL DEFAULT '',
    "gradeScale" INTEGER NOT NULL DEFAULT 20,
    "absenceAlert" INTEGER NOT NULL DEFAULT 3,
    "onlineEnrollment" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EducationSettings_pkey" PRIMARY KEY ("tenantId")
);

CREATE INDEX "ProgramDetails_tenantId_idx" ON "ProgramDetails"("tenantId");

CREATE INDEX "ClassGroup_tenantId_listingId_idx" ON "ClassGroup"("tenantId", "listingId");

CREATE INDEX "ClassGroup_tenantId_teacherUserId_idx" ON "ClassGroup"("tenantId", "teacherUserId");

CREATE UNIQUE INDEX "ClassGroup_id_tenantId_key" ON "ClassGroup"("id", "tenantId");

CREATE UNIQUE INDEX "Student_accessToken_key" ON "Student"("accessToken");

CREATE INDEX "Student_tenantId_guardianId_idx" ON "Student"("tenantId", "guardianId");

CREATE UNIQUE INDEX "Student_id_tenantId_key" ON "Student"("id", "tenantId");

CREATE UNIQUE INDEX "FamilyAccess_accessToken_key" ON "FamilyAccess"("accessToken");

CREATE INDEX "FamilyAccess_tenantId_idx" ON "FamilyAccess"("tenantId");

CREATE INDEX "EnrollmentDetails_tenantId_classGroupId_idx" ON "EnrollmentDetails"("tenantId", "classGroupId");

CREATE INDEX "EnrollmentDetails_tenantId_studentId_idx" ON "EnrollmentDetails"("tenantId", "studentId");

CREATE INDEX "EnrollmentInstallment_tenantId_dueDate_idx" ON "EnrollmentInstallment"("tenantId", "dueDate");

CREATE UNIQUE INDEX "EnrollmentInstallment_reservationId_position_key" ON "EnrollmentInstallment"("reservationId", "position");

CREATE INDEX "AttendanceRecord_tenantId_studentId_idx" ON "AttendanceRecord"("tenantId", "studentId");

CREATE UNIQUE INDEX "AttendanceRecord_classGroupId_studentId_sessionDate_key" ON "AttendanceRecord"("classGroupId", "studentId", "sessionDate");

CREATE INDEX "Assessment_tenantId_classGroupId_idx" ON "Assessment"("tenantId", "classGroupId");

CREATE UNIQUE INDEX "Assessment_id_tenantId_key" ON "Assessment"("id", "tenantId");

CREATE INDEX "Grade_tenantId_studentId_idx" ON "Grade"("tenantId", "studentId");

CREATE UNIQUE INDEX "Grade_assessmentId_studentId_key" ON "Grade"("assessmentId", "studentId");

ALTER TABLE "ProgramDetails" ADD CONSTRAINT "ProgramDetails_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProgramDetails" ADD CONSTRAINT "ProgramDetails_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ClassGroup" ADD CONSTRAINT "ClassGroup_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ClassGroup" ADD CONSTRAINT "ClassGroup_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "ProgramDetails"("listingId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ClassGroup" ADD CONSTRAINT "ClassGroup_teacherUserId_fkey" FOREIGN KEY ("teacherUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Student" ADD CONSTRAINT "Student_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Student" ADD CONSTRAINT "Student_guardianId_fkey" FOREIGN KEY ("guardianId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "FamilyAccess" ADD CONSTRAINT "FamilyAccess_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "FamilyAccess" ADD CONSTRAINT "FamilyAccess_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "EnrollmentDetails" ADD CONSTRAINT "EnrollmentDetails_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "EnrollmentDetails" ADD CONSTRAINT "EnrollmentDetails_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "EnrollmentDetails" ADD CONSTRAINT "EnrollmentDetails_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "EnrollmentDetails" ADD CONSTRAINT "EnrollmentDetails_classGroupId_fkey" FOREIGN KEY ("classGroupId") REFERENCES "ClassGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "EnrollmentInstallment" ADD CONSTRAINT "EnrollmentInstallment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "EnrollmentInstallment" ADD CONSTRAINT "EnrollmentInstallment_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "EnrollmentDetails"("reservationId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_classGroupId_fkey" FOREIGN KEY ("classGroupId") REFERENCES "ClassGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_classGroupId_fkey" FOREIGN KEY ("classGroupId") REFERENCES "ClassGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Grade" ADD CONSTRAINT "Grade_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Grade" ADD CONSTRAINT "Grade_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Grade" ADD CONSTRAINT "Grade_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "EducationSettings" ADD CONSTRAINT "EducationSettings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Intégrité métier
-- ---------------------------------------------------------------------------
ALTER TABLE "ProgramDetails" ADD CONSTRAINT "ProgramDetails_check" CHECK (
  "category" IN ('school', 'training', 'language', 'tutoring', 'other')
  AND "format" IN ('onsite', 'online', 'hybrid')
  AND "audience" IN ('children', 'teens', 'adults', 'all')
  AND "registrationFee" >= 0 AND "defaultInstallments" BETWEEN 1 AND 12);
ALTER TABLE "ClassGroup" ADD CONSTRAINT "ClassGroup_check" CHECK (
  length(trim("name")) BETWEEN 1 AND 80 AND "capacity" BETWEEN 1 AND 500 AND "startDate" <= "endDate");
ALTER TABLE "Student" ADD CONSTRAINT "Student_check" CHECK (
  "guardianRelation" IN ('parent', 'guardian', 'self')
  AND length(trim("firstName")) BETWEEN 1 AND 80 AND length(trim("lastName")) BETWEEN 1 AND 80);
ALTER TABLE "EnrollmentDetails" ADD CONSTRAINT "EnrollmentDetails_check" CHECK (
  "registrationFee" >= 0 AND "tuition" >= 0 AND "discountAmount" >= 0
  AND "discountAmount" <= "registrationFee" + "tuition"
  AND ("discountAmount" = 0 OR length(trim(coalesce("discountReason", ''))) > 0));
ALTER TABLE "EnrollmentInstallment" ADD CONSTRAINT "EnrollmentInstallment_check" CHECK (
  "amount" > 0 AND "position" BETWEEN 1 AND 24 AND length(trim("label")) BETWEEN 1 AND 60);
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_status_check" CHECK ("status" IN ('present', 'absent', 'late', 'excused'));
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_check" CHECK (
  length(trim("title")) BETWEEN 1 AND 120 AND "coefficient" > 0 AND "coefficient" <= 20 AND "maxScore" BETWEEN 1 AND 1000);
ALTER TABLE "Grade" ADD CONSTRAINT "Grade_check" CHECK (
  ("absent" AND "score" IS NULL) OR (NOT "absent" AND "score" IS NOT NULL AND "score" >= 0));
ALTER TABLE "EducationSettings" ADD CONSTRAINT "EducationSettings_check" CHECK (
  "gradeScale" IN (10, 20, 100) AND "absenceAlert" BETWEEN 1 AND 100);

-- Une note ne dépasse jamais le barème de SON évaluation.
CREATE OR REPLACE FUNCTION yamacommerce_grade_max_check() RETURNS trigger AS $$
DECLARE max_score int;
BEGIN
  SELECT "maxScore" INTO max_score FROM "Assessment" WHERE "id" = NEW."assessmentId";
  IF NEW."score" IS NOT NULL AND NEW."score" > max_score THEN
    RAISE EXCEPTION 'Note supérieure au barème (%).', max_score USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "Grade_max_check" BEFORE INSERT OR UPDATE ON "Grade"
  FOR EACH ROW EXECUTE FUNCTION yamacommerce_grade_max_check();

-- Un élève n'a qu'UNE inscription active par formation.
CREATE UNIQUE INDEX "EnrollmentDetails_one_active_per_program" ON "EnrollmentDetails"("studentId", "listingId") WHERE "active";

-- `active` suit le statut de la réservation commune, quel que soit le chemin.
CREATE OR REPLACE FUNCTION yamacommerce_sync_enrollment_active() RETURNS trigger AS $$
BEGIN
  UPDATE "EnrollmentDetails"
     SET "active" = NEW."status" IN ('requested', 'confirmed')
   WHERE "reservationId" = NEW."id" AND "tenantId" = NEW."tenantId";
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "Reservation_sync_enrollment_active"
  AFTER UPDATE OF "status" ON "Reservation"
  FOR EACH ROW WHEN (OLD."status" IS DISTINCT FROM NEW."status")
  EXECUTE FUNCTION yamacommerce_sync_enrollment_active();

-- Même entreprise partout (clés composites, en plus de la RLS).
CREATE UNIQUE INDEX "ProgramDetails_tenantId_listingId_key" ON "ProgramDetails"("tenantId", "listingId");
CREATE UNIQUE INDEX "EnrollmentDetails_tenantId_reservationId_key" ON "EnrollmentDetails"("tenantId", "reservationId");
ALTER TABLE "ProgramDetails" ADD CONSTRAINT "ProgramDetails_same_tenant_fkey" FOREIGN KEY ("tenantId", "listingId") REFERENCES "Listing"("tenantId", "id");
ALTER TABLE "ClassGroup" ADD CONSTRAINT "ClassGroup_program_same_tenant_fkey" FOREIGN KEY ("tenantId", "listingId") REFERENCES "ProgramDetails"("tenantId", "listingId");
ALTER TABLE "Student" ADD CONSTRAINT "Student_guardian_same_tenant_fkey" FOREIGN KEY ("tenantId", "guardianId") REFERENCES "Customer"("tenantId", "id");
ALTER TABLE "FamilyAccess" ADD CONSTRAINT "FamilyAccess_customer_same_tenant_fkey" FOREIGN KEY ("tenantId", "customerId") REFERENCES "Customer"("tenantId", "id");
ALTER TABLE "EnrollmentDetails" ADD CONSTRAINT "EnrollmentDetails_reservation_same_tenant_fkey" FOREIGN KEY ("tenantId", "reservationId") REFERENCES "Reservation"("tenantId", "id");
ALTER TABLE "EnrollmentDetails" ADD CONSTRAINT "EnrollmentDetails_student_same_tenant_fkey" FOREIGN KEY ("studentId", "tenantId") REFERENCES "Student"("id", "tenantId");
ALTER TABLE "EnrollmentDetails" ADD CONSTRAINT "EnrollmentDetails_program_same_tenant_fkey" FOREIGN KEY ("tenantId", "listingId") REFERENCES "ProgramDetails"("tenantId", "listingId");
ALTER TABLE "EnrollmentDetails" ADD CONSTRAINT "EnrollmentDetails_class_same_tenant_fkey" FOREIGN KEY ("classGroupId", "tenantId") REFERENCES "ClassGroup"("id", "tenantId");
ALTER TABLE "EnrollmentInstallment" ADD CONSTRAINT "EnrollmentInstallment_same_tenant_fkey" FOREIGN KEY ("tenantId", "reservationId") REFERENCES "EnrollmentDetails"("tenantId", "reservationId");
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_class_same_tenant_fkey" FOREIGN KEY ("classGroupId", "tenantId") REFERENCES "ClassGroup"("id", "tenantId");
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_student_same_tenant_fkey" FOREIGN KEY ("studentId", "tenantId") REFERENCES "Student"("id", "tenantId");
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_class_same_tenant_fkey" FOREIGN KEY ("classGroupId", "tenantId") REFERENCES "ClassGroup"("id", "tenantId");
ALTER TABLE "Grade" ADD CONSTRAINT "Grade_assessment_same_tenant_fkey" FOREIGN KEY ("assessmentId", "tenantId") REFERENCES "Assessment"("id", "tenantId");
ALTER TABLE "Grade" ADD CONSTRAINT "Grade_student_same_tenant_fkey" FOREIGN KEY ("studentId", "tenantId") REFERENCES "Student"("id", "tenantId");

-- ---------------------------------------------------------------------------
-- Row-Level Security dès la création
-- ---------------------------------------------------------------------------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['ProgramDetails', 'ClassGroup', 'Student', 'FamilyAccess', 'EnrollmentDetails', 'EnrollmentInstallment', 'AttendanceRecord', 'Assessment', 'Grade', 'EducationSettings'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY;', t);
    EXECUTE format('CREATE POLICY tenant_isolation ON %I USING (yamacommerce_tenant_isolation_check("tenantId"));', t);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- Rôle Enseignant et permissions académiques (rôles système globaux)
-- ---------------------------------------------------------------------------
INSERT INTO "Role" ("id", "tenantId", "name", "isSystem", "permissions")
SELECT gen_random_uuid()::text, NULL, 'TEACHER', true, ARRAY['academics.view', 'academics.record']
WHERE NOT EXISTS (SELECT 1 FROM "Role" WHERE "tenantId" IS NULL AND "name" = 'TEACHER');
UPDATE "Role" SET "permissions" = (SELECT array_agg(DISTINCT p) FROM unnest("permissions" || ARRAY['academics.view', 'academics.record', 'academics.manage']) p)
 WHERE "tenantId" IS NULL AND "name" IN ('OWNER', 'MANAGER');
UPDATE "Role" SET "permissions" = (SELECT array_agg(DISTINCT p) FROM unnest("permissions" || ARRAY['academics.view']) p)
 WHERE "tenantId" IS NULL AND "name" = 'SALES';

-- Le secteur Éducation devient opérationnel (souscriptible).
UPDATE "Sector" SET "isAvailable" = true WHERE "key" = 'education';
