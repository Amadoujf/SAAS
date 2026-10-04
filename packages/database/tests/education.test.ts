import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../src/client";
import { withSuperAdminAccess, withTenant } from "../src/tenant-context";
import { testOwnerClient } from "./test-owner-client";
import { addDays } from "../src/service-slots";
import { setListingStatus } from "../src/listing-registry";
import {
  absenceSummary,
  allocateInstallments,
  assignClass,
  completeEnrollment,
  createAssessment,
  createClass,
  createProgram,
  defaultInstallmentPlan,
  educationOverview,
  enrollStudent,
  getClassRoster,
  getFamilyPortal,
  getPublicProgramBySlug,
  getStudentPortal,
  listClasses,
  overdueInstallments,
  publishAssessment,
  recordAttendance,
  recordEnrollmentPayment,
  recordGrades,
  rotateFamilyToken,
  setEnrollmentPlan,
  studentReport,
  updateClass,
  updateEducationSettings,
  voidEnrollmentPayment,
  withdrawEnrollment,
  type ProgramInput,
} from "../src/education-registry";

/**
 * Éducation (étape 10) sur PostgreSQL RÉEL : formations, classes à capacité tenue sous
 * verrou, inscriptions au montant calculé côté serveur, échéances déduites des
 * encaissements, présences et notes limitées aux classes de l'enseignant et aux élèves
 * inscrits, notes visibles seulement une fois publiées, espaces famille / élève par
 * jeton, isolation entre établissements.
 */
let databaseAvailable = true;
try {
  await prisma.$queryRaw`SELECT 1`;
} catch (error) {
  if (process.env.REQUIRE_DB_TESTS === "true") {
    throw new Error(`REQUIRE_DB_TESTS=true mais PostgreSQL est injoignable : ${error instanceof Error ? error.message : String(error)}`);
  }
  databaseAvailable = false;
  // eslint-disable-next-line no-console
  console.warn("[education.test] Base de données injoignable — suite ignorée (skip).");
}

const staff = { userId: null, type: "employee" as const };
const guest = { userId: null, type: "customer" as const };
const ADMIN = { userId: null, all: true };
const today = new Date().toISOString().slice(0, 10);
let phoneSeq = 0;
const parent = (firstName = "Parent") => ({ firstName, lastName: "Diop", phone: `76${String(3_000_000 + ++phoneSeq + Math.floor(Math.random() * 1000) * 100).padStart(7, "0")}` });

const program = (extra: Partial<ProgramInput> = {}): ProgramInput => ({
  title: "Anglais B1",
  category: "language",
  format: "onsite",
  audience: "adults",
  tuition: 150_000,
  registrationFee: 20_000,
  defaultInstallments: 3,
  durationLabel: "3 mois",
  ...extra,
});

describe.skipIf(!databaseAvailable)("Éducation (réel, PostgreSQL)", () => {
  const suffix = Date.now();
  const sectorKey = `test-sector-edu-${suffix}`;
  let schoolA: string;
  let schoolB: string;
  let teacherId: string;
  let otherTeacherId: string;

  const publishedProgram = async (tenant: string, input: ProgramInput) =>
    withTenant(tenant, async (tx) => {
      const p = await createProgram(tx, tenant, input, null);
      await setListingStatus(tx, tenant, p.id, "published", null);
      return p;
    });

  beforeAll(async () => {
    await withSuperAdminAccess(async (tx) => {
      await tx.sector.create({ data: { key: sectorKey, name: "Secteur de test", defaultModuleKeys: [], isSystem: false } });
      const data = (s: string) => ({ slug: `test-edu-${s}-${suffix}`, name: `École ${s}`, businessType: "ECOMMERCE" as const, sectorKey, status: "ACTIVE" as const, billingExemptedAt: new Date(), timezone: "Africa/Dakar" });
      schoolA = (await tx.tenant.create({ data: data("a") })).id;
      schoolB = (await tx.tenant.create({ data: data("b") })).id;
      const role = await tx.role.findFirstOrThrow({ where: { tenantId: null, name: "TEACHER" } });
      const mk = async (n: string) => {
        const u = await tx.user.create({ data: { email: `prof-${n}-${suffix}@exemple.sn`, passwordHash: "x", fullName: `Prof ${n}` } });
        await tx.tenantUser.create({ data: { tenantId: schoolA, userId: u.id, roleId: role.id, status: "ACTIVE" } });
        return u.id;
      };
      teacherId = await mk("a");
      otherTeacherId = await mk("b");
    });
  });

  afterAll(async () => {
    const o = testOwnerClient();
    const ids = { in: [schoolA, schoolB] };
    await o.grade.deleteMany({ where: { tenantId: ids } });
    await o.assessment.deleteMany({ where: { tenantId: ids } });
    await o.attendanceRecord.deleteMany({ where: { tenantId: ids } });
    await o.enrollmentInstallment.deleteMany({ where: { tenantId: ids } });
    await o.enrollmentDetails.deleteMany({ where: { tenantId: ids } });
    await o.reservationPayment.deleteMany({ where: { tenantId: ids } });
    await o.reservationStatusHistory.deleteMany({ where: { tenantId: ids } });
    await o.reservation.deleteMany({ where: { tenantId: ids } });
    await o.student.deleteMany({ where: { tenantId: ids } });
    await o.familyAccess.deleteMany({ where: { tenantId: ids } });
    await o.classGroup.deleteMany({ where: { tenantId: ids } });
    await o.programDetails.deleteMany({ where: { tenantId: ids } });
    await o.listingRevision.deleteMany({ where: { tenantId: ids } });
    await o.listing.deleteMany({ where: { tenantId: ids } });
    await o.educationSettings.deleteMany({ where: { tenantId: ids } });
    await o.customer.deleteMany({ where: { tenantId: ids } });
    await o.counter.deleteMany({ where: { tenantId: ids } });
    await o.tenantUser.deleteMany({ where: { tenantId: ids } });
    await o.user.deleteMany({ where: { id: { in: [teacherId, otherTeacherId] } } });
    await o.tenant.deleteMany({ where: { id: ids } });
    await o.sector.deleteMany({ where: { key: sectorKey } });
    await o.$disconnect();
  });

  it("plan d'échéances par défaut : frais d'inscription puis mensualités exactes", () => {
    const plan = defaultInstallmentPlan({ registrationFee: 20_000, tuition: 100_000, discountAmount: 10_000, count: 3, firstDueDate: "2026-01-31", enrollmentDate: "2026-01-10" });
    expect(plan.map((p) => p.amount)).toEqual([20_000, 30_000, 30_000, 30_000]);
    expect(plan.map((p) => p.dueDate)).toEqual(["2026-01-10", "2026-01-31", "2026-02-28", "2026-03-31"]);
    const odd = defaultInstallmentPlan({ registrationFee: 0, tuition: 100_000, discountAmount: 0, count: 3, firstDueDate: "2026-01-05", enrollmentDate: "2026-01-05" });
    expect(odd.reduce((s, p) => s + p.amount, 0)).toBe(100_000);
    const views = allocateInstallments(
      plan.map((p, i) => ({ id: String(i), position: i + 1, label: p.label, dueDate: new Date(`${p.dueDate}T00:00:00Z`), amount: p.amount })),
      [{ amount: 35_000, voidedAt: null }, { amount: 50_000, voidedAt: new Date() }],
      "2026-02-15",
    );
    expect(views.map((v) => v.state)).toEqual(["paid", "overdue", "due", "due"]);
    expect(views[1]!.covered).toBe(15_000);
  });

  it("formations, classes, inscriptions : montant serveur, capacité, doublon, remise motivée", async () => {
    await expect(withTenant(schoolA, (tx) => createProgram(tx, schoolA, program({ category: "magie" }), null))).rejects.toThrow(/Catégorie/);
    const p = await publishedProgram(schoolA, program());
    expect(p.type).toBe("course");
    expect(p.program!.registrationFee).toBe(20_000);
    const c = await withTenant(schoolA, (tx) => createClass(tx, schoolA, { listingId: p.id, name: "B1 soir", teacherUserId: teacherId, startDate: addDays(today, -30), endDate: addDays(today, 60), capacity: 2, schedule: [{ weekday: 1, startMinute: 18 * 60, endMinute: 20 * 60 }] }));
    await expect(withTenant(schoolA, (tx) => createClass(tx, schoolA, { listingId: p.id, name: "X", startDate: today, endDate: addDays(today, -1), capacity: 5 }))).rejects.toThrow(/fin précède/);

    // Demande en ligne : aucune remise possible, montant = frais + scolarité de la fiche.
    await expect(withTenant(schoolA, (tx) => enrollStudent(tx, schoolA, { listingId: p.id, guardian: parent(), student: { firstName: "Awa", lastName: "Diop" }, discountAmount: 50_000, channel: "web", actor: guest }))).rejects.toThrow(/invalide/);
    const web = await withTenant(schoolA, (tx) => enrollStudent(tx, schoolA, { listingId: p.id, classGroupId: c.id, guardian: parent("Fatou"), student: { firstName: "Awa", lastName: "Diop", birthDate: "2010-04-02" }, channel: "web", actor: guest }));
    expect(web.status).toBe("requested");
    expect(web.totalAmount).toBe(170_000);
    expect(web.enrollment!.installments.reduce((s, i) => s + i.amount, 0)).toBe(170_000);
    // Même élève, même formation : refusé (et doublé par l'index unique partiel).
    await expect(withTenant(schoolA, (tx) => enrollStudent(tx, schoolA, { listingId: p.id, guardianId: web.customerId, studentId: web.enrollment!.studentId, channel: "dashboard", actor: staff }))).rejects.toThrow(/déjà inscrit/);
    await expect(
      testOwnerClient().enrollmentDetails.create({ data: { reservationId: web.id, tenantId: schoolA, studentId: web.enrollment!.studentId, listingId: p.id } }),
    ).rejects.toThrow();

    // Remise : motif obligatoire.
    await expect(withTenant(schoolA, (tx) => enrollStudent(tx, schoolA, { listingId: p.id, classGroupId: c.id, guardian: parent(), student: { firstName: "Moussa", lastName: "Fall" }, discountAmount: 30_000, channel: "dashboard", actor: staff }))).rejects.toThrow(/Motivez/);
    const desk = await withTenant(schoolA, (tx) => enrollStudent(tx, schoolA, { listingId: p.id, classGroupId: c.id, guardian: parent(), student: { firstName: "Moussa", lastName: "Fall" }, discountAmount: 30_000, discountReason: "Bourse", channel: "dashboard", actor: staff }));
    expect(desk.status).toBe("confirmed");
    expect(desk.totalAmount).toBe(140_000);

    // Classe pleine (2 places) : une troisième inscription est refusée.
    await expect(withTenant(schoolA, (tx) => enrollStudent(tx, schoolA, { listingId: p.id, classGroupId: c.id, guardian: parent(), student: { firstName: "Ibou", lastName: "Sarr" }, channel: "dashboard", actor: staff }))).rejects.toThrow(/complète/);
    await expect(withTenant(schoolA, (tx) => updateClass(tx, schoolA, c.id, { capacity: 1 }))).rejects.toThrow(/déjà 2 inscrits/);
    const pub = await withTenant(schoolA, (tx) => getPublicProgramBySlug(tx, schoolA, p.slug));
    expect(pub!.classes[0]!.remaining).toBe(0);

    // Concurrence : 4 inscriptions simultanées sur une classe de 3 places → 3 réussissent.
    const c3 = await withTenant(schoolA, (tx) => createClass(tx, schoolA, { listingId: p.id, name: "B1 matin", startDate: today, endDate: addDays(today, 90), capacity: 3 }));
    const results = await Promise.allSettled(
      [0, 1, 2, 3].map((i) => withTenant(schoolA, (tx) => enrollStudent(tx, schoolA, { listingId: p.id, classGroupId: c3.id, guardian: parent(), student: { firstName: `Élève${i}`, lastName: "Ndiaye" }, channel: "dashboard", actor: staff }))),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(3);
    expect(await withTenant(schoolA, (tx) => tx.enrollmentDetails.count({ where: { classGroupId: c3.id, active: true } }))).toBe(3);

    // Désinscription : la place se libère (déclencheur `active`).
    const first = results.find((r) => r.status === "fulfilled") as PromiseFulfilledResult<Awaited<ReturnType<typeof enrollStudent>>>;
    await expect(withTenant(schoolA, (tx) => withdrawEnrollment(tx, schoolA, first.value.id, staff, " "))).rejects.toThrow(/motif/);
    await withTenant(schoolA, (tx) => withdrawEnrollment(tx, schoolA, first.value.id, staff, "Déménagement"));
    expect(await withTenant(schoolA, (tx) => tx.enrollmentDetails.findUniqueOrThrow({ where: { reservationId: first.value.id } }))).toMatchObject({ active: false });
  });

  it("encaissements : reçus communs, échéances déduites, jamais de trop-perçu, remise bornée par le déjà-payé", async () => {
    const p = await publishedProgram(schoolA, program({ title: "Informatique", tuition: 90_000, registrationFee: 10_000, defaultInstallments: 3 }));
    const c = await withTenant(schoolA, (tx) => createClass(tx, schoolA, { listingId: p.id, name: "Info 1", startDate: addDays(today, -60), endDate: addDays(today, 30), capacity: 10 }));
    const e = await withTenant(schoolA, (tx) =>
      enrollStudent(tx, schoolA, {
        listingId: p.id,
        classGroupId: c.id,
        guardian: parent(),
        student: { firstName: "Khady", lastName: "Ba" },
        relation: "self",
        channel: "dashboard",
        actor: staff,
        installments: [
          { label: "Inscription", dueDate: addDays(today, -40), amount: 10_000 },
          { label: "Mois 1", dueDate: addDays(today, -30), amount: 45_000 },
          { label: "Mois 2", dueDate: addDays(today, 10), amount: 45_000 },
        ],
      }),
    );
    await expect(withTenant(schoolA, (tx) => setEnrollmentPlan(tx, schoolA, e.id, { installments: [{ label: "Tout", dueDate: today, amount: 99_000 }] }))).rejects.toThrow(/totalisent/);
    const pay = await withTenant(schoolA, (tx) => recordEnrollmentPayment(tx, schoolA, { reservationId: e.id, amount: 30_000, method: "wave", actorUserId: null }));
    expect(pay.receiptNumber).toMatch(/^REC-\d{4}-\d{6}$/);
    await expect(withTenant(schoolA, (tx) => recordEnrollmentPayment(tx, schoolA, { reservationId: e.id, amount: 80_000, method: "cash", actorUserId: null }))).rejects.toThrow(/reste à payer/);

    const late = await withTenant(schoolA, (tx) => overdueInstallments(tx, schoolA));
    const mine = late.find((l) => l.reservation.id === e.id)!;
    expect(mine.amount).toBe(25_000); // Mois 1 : 45 000 − 20 000 déjà affectés
    expect(mine.late.map((i) => i.label)).toEqual(["Mois 1"]);

    // Remise : le total ne descend jamais sous le déjà-encaissé.
    await expect(withTenant(schoolA, (tx) => setEnrollmentPlan(tx, schoolA, e.id, { discountAmount: 80_000, discountReason: "Bourse" }))).rejects.toThrow(/Déjà encaissé/);
    const r = await withTenant(schoolA, (tx) => setEnrollmentPlan(tx, schoolA, e.id, { discountAmount: 20_000, discountReason: "Fratrie" }));
    expect(r.totalAmount).toBe(80_000);
    expect(r.enrollment!.installments.reduce((s, i) => s + i.amount, 0)).toBe(80_000);

    // Annulation d'encaissement motivée : la ligne reste visible.
    await expect(withTenant(schoolA, (tx) => voidEnrollmentPayment(tx, schoolA, pay.id, ""))).rejects.toThrow(/motif/);
    await withTenant(schoolA, (tx) => voidEnrollmentPayment(tx, schoolA, pay.id, "Saisie en double"));
    await withTenant(schoolA, (tx) => recordEnrollmentPayment(tx, schoolA, { reservationId: e.id, amount: 80_000, method: "bank_transfer", actorUserId: null }));
    const done = await withTenant(schoolA, (tx) => completeEnrollment(tx, schoolA, e.id, staff));
    expect(done.status).toBe("completed");
    expect(done.payments).toHaveLength(2);
    await expect(withTenant(schoolA, (tx) => recordEnrollmentPayment(tx, schoolA, { reservationId: e.id, amount: 1, method: "cash", actorUserId: null }))).rejects.toThrow(/reste à payer/);
  });

  it("enseignant : seulement SES classes, seulement les élèves inscrits, note bornée, publication", async () => {
    const p = await publishedProgram(schoolA, program({ title: "Maths 3e", category: "school", audience: "teens" }));
    const mineClass = await withTenant(schoolA, (tx) => createClass(tx, schoolA, { listingId: p.id, name: "3e A", teacherUserId: teacherId, startDate: addDays(today, -20), endDate: addDays(today, 100), capacity: 30 }));
    const otherClass = await withTenant(schoolA, (tx) => createClass(tx, schoolA, { listingId: p.id, name: "3e B", teacherUserId: otherTeacherId, startDate: addDays(today, -20), endDate: addDays(today, 100), capacity: 30 }));
    const enroll = (classGroupId: string, firstName: string, guardian = parent()) =>
      withTenant(schoolA, (tx) => enrollStudent(tx, schoolA, { listingId: p.id, classGroupId, guardian, student: { firstName, lastName: "Sow" }, channel: "dashboard", actor: staff }));
    const g = parent("Mariama");
    const a1 = await enroll(mineClass.id, "Aïda", g);
    const a2 = await enroll(mineClass.id, "Bamba");
    const b1 = await enroll(otherClass.id, "Cheikh");
    const teacher = { userId: teacherId, all: false };

    expect((await withTenant(schoolA, (tx) => listClasses(tx, schoolA, teacher, { listingId: p.id }))).map((c) => c.name)).toEqual(["3e A"]);
    await expect(withTenant(schoolA, (tx) => getClassRoster(tx, schoolA, otherClass.id, teacher))).rejects.toThrow(/introuvable/);
    await expect(withTenant(schoolA, (tx) => recordAttendance(tx, schoolA, { classGroupId: otherClass.id, sessionDate: today, entries: [{ studentId: b1.enrollment!.studentId, status: "present" }], scope: teacher }))).rejects.toThrow(/introuvable/);
    // Un élève d'une autre classe ne peut pas être pointé ici.
    await expect(withTenant(schoolA, (tx) => recordAttendance(tx, schoolA, { classGroupId: mineClass.id, sessionDate: today, entries: [{ studentId: b1.enrollment!.studentId, status: "present" }], scope: teacher }))).rejects.toThrow(/pas inscrit/);
    await expect(withTenant(schoolA, (tx) => recordAttendance(tx, schoolA, { classGroupId: mineClass.id, sessionDate: addDays(today, 1), entries: [{ studentId: a1.enrollment!.studentId, status: "present" }], scope: teacher }))).rejects.toThrow(/à venir/);
    await withTenant(schoolA, (tx) => recordAttendance(tx, schoolA, { classGroupId: mineClass.id, sessionDate: today, entries: [{ studentId: a1.enrollment!.studentId, status: "absent" }, { studentId: a2.enrollment!.studentId, status: "present" }], scope: teacher }));
    // Ré-appel de la même séance : corrigé, jamais dupliqué.
    await withTenant(schoolA, (tx) => recordAttendance(tx, schoolA, { classGroupId: mineClass.id, sessionDate: today, entries: [{ studentId: a1.enrollment!.studentId, status: "excused", note: "Certificat" }], scope: teacher }));
    const abs = await withTenant(schoolA, (tx) => absenceSummary(tx, schoolA, mineClass.id, teacher));
    expect(abs.byStudent.get(a1.enrollment!.studentId)).toMatchObject({ excused: 1, absent: 0 });

    const test = await withTenant(schoolA, (tx) => createAssessment(tx, schoolA, { classGroupId: mineClass.id, title: "Devoir 1", date: today, coefficient: 2, scope: teacher }));
    expect(test.maxScore).toBe(20);
    await expect(withTenant(schoolA, (tx) => recordGrades(tx, schoolA, { assessmentId: test.id, entries: [{ studentId: a1.enrollment!.studentId, score: 21 }], scope: teacher }))).rejects.toThrow(/entre 0 et 20/);
    await expect(withTenant(schoolA, (tx) => recordGrades(tx, schoolA, { assessmentId: test.id, entries: [{ studentId: b1.enrollment!.studentId, score: 12 }], scope: teacher }))).rejects.toThrow(/pas inscrit/);
    await expect(withTenant(schoolA, (tx) => recordGrades(tx, schoolA, { assessmentId: test.id, entries: [{ studentId: a1.enrollment!.studentId, score: 12 }], scope: { userId: otherTeacherId, all: false } }))).rejects.toThrow(/introuvable/);
    await withTenant(schoolA, (tx) => recordGrades(tx, schoolA, { assessmentId: test.id, entries: [{ studentId: a1.enrollment!.studentId, score: 15.5 }, { studentId: a2.enrollment!.studentId, absent: true }], scope: teacher }));
    // Le barème est aussi tenu par la base (déclencheur), quel que soit le chemin.
    const o = testOwnerClient();
    const grade = await o.grade.findFirstOrThrow({ where: { assessmentId: test.id, studentId: a1.enrollment!.studentId } });
    await expect(o.grade.update({ where: { id: grade.id }, data: { score: 25 } })).rejects.toThrow(/barème/);
    await o.$disconnect();

    // Avant publication : invisible pour la famille et l'élève ; visible pour l'équipe.
    expect((await withTenant(schoolA, (tx) => studentReport(tx, schoolA, a1.enrollment!.studentId, { publishedOnly: true }))).lines[0]!.assessments).toHaveLength(0);
    expect((await withTenant(schoolA, (tx) => studentReport(tx, schoolA, a1.enrollment!.studentId, { publishedOnly: false }))).lines[0]!.average).toBe(15.5);
    await withTenant(schoolA, (tx) => publishAssessment(tx, schoolA, test.id, teacher));
    await expect(withTenant(schoolA, (tx) => recordGrades(tx, schoolA, { assessmentId: test.id, entries: [{ studentId: a1.enrollment!.studentId, score: 18 }], scope: teacher }))).rejects.toThrow(/publiées/);
    await withTenant(schoolA, (tx) => recordGrades(tx, schoolA, { assessmentId: test.id, entries: [{ studentId: a1.enrollment!.studentId, score: 16 }], scope: ADMIN }));

    // Espace famille : SES enfants seulement, notes publiées, échéances.
    const access = await withTenant(schoolA, (tx) => tx.familyAccess.findFirstOrThrow({ where: { customerId: a1.customerId! } }));
    const family = await withTenant(schoolA, (tx) => getFamilyPortal(tx, schoolA, access.accessToken));
    expect(family!.children.map((c) => c.student.firstName)).toEqual(["Aïda"]);
    expect(family!.children[0]!.report.lines[0]!.assessments[0]!.score).toBe(16);
    expect(family!.children[0]!.attendance.excused).toBe(1);
    expect(family!.children[0]!.enrollments[0]!.installments.every((i) => i.state !== "paid")).toBe(true);
    const student = await withTenant(schoolA, (tx) => getStudentPortal(tx, schoolA, family!.children[0]!.student.accessToken));
    expect(student!.classes[0]!.teacher).toBe("Prof a");
    expect(student).not.toHaveProperty("children");

    // Lien révoqué : l'ancien ne fonctionne plus.
    await withTenant(schoolA, (tx) => rotateFamilyToken(tx, schoolA, a1.customerId!));
    expect(await withTenant(schoolA, (tx) => getFamilyPortal(tx, schoolA, access.accessToken))).toBeNull();
  });

  it("réglages, tableau de bord, isolation entre établissements", async () => {
    await expect(withTenant(schoolA, (tx) => updateEducationSettings(tx, schoolA, { gradeScale: 15 }))).rejects.toThrow(/Barème/);
    await withTenant(schoolA, (tx) => updateEducationSettings(tx, schoolA, { academicYear: "2026-2027", onlineEnrollment: false }));
    const p = await publishedProgram(schoolA, program({ title: "Wolof débutant" }));
    await expect(withTenant(schoolA, (tx) => enrollStudent(tx, schoolA, { listingId: p.id, guardian: parent(), student: { firstName: "Léa", lastName: "Gomis" }, channel: "web", actor: guest }))).rejects.toThrow(/fermées/);
    await withTenant(schoolA, (tx) => updateEducationSettings(tx, schoolA, { onlineEnrollment: true }));
    const web = await withTenant(schoolA, (tx) => enrollStudent(tx, schoolA, { listingId: p.id, guardian: parent(), student: { firstName: "Léa", lastName: "Gomis" }, channel: "web", actor: guest }));
    const c = await withTenant(schoolA, (tx) => createClass(tx, schoolA, { listingId: p.id, name: "W1", startDate: addDays(today, 5), endDate: addDays(today, 90), capacity: 8 }));
    const confirmed = await withTenant(schoolA, (tx) => assignClass(tx, schoolA, web.id, c.id, staff));
    expect(confirmed.status).toBe("confirmed");
    expect(confirmed.enrollment!.classGroup!.name).toBe("W1");

    const overview = await withTenant(schoolA, (tx) => educationOverview(tx, schoolA));
    expect(overview.activeEnrollments).toBeGreaterThan(0);
    // Encaissé ce mois : 80 000 (le paiement annulé de 30 000 n'est jamais compté).
    expect(overview.collectedThisMonth).toBe(80_000);

    // L'établissement B ne voit rien de A, et ne peut rien y écrire.
    expect(await withTenant(schoolB, (tx) => listClasses(tx, schoolB, ADMIN))).toHaveLength(0);
    expect(await withTenant(schoolB, (tx) => tx.student.count())).toBe(0);
    expect(await withTenant(schoolB, (tx) => tx.grade.count())).toBe(0);
    expect(await withTenant(schoolB, (tx) => getPublicProgramBySlug(tx, schoolB, p.slug))).toBeNull();
    await expect(withTenant(schoolB, (tx) => assignClass(tx, schoolB, web.id, c.id, staff))).rejects.toThrow();
    await expect(withTenant(schoolB, (tx) => recordEnrollmentPayment(tx, schoolB, { reservationId: web.id, amount: 1000, method: "cash", actorUserId: null }))).rejects.toThrow();
    const token = (await withTenant(schoolA, (tx) => tx.familyAccess.findFirstOrThrow({ where: { customerId: web.customerId! } }))).accessToken;
    expect(await withTenant(schoolB, (tx) => getFamilyPortal(tx, schoolB, token))).toBeNull();
    // Un élève de B ne peut pas être rattaché à une classe de A, même en écrivant directement.
    const bProgram = await publishedProgram(schoolB, program({ title: "Arabe" }));
    const bEnroll = await withTenant(schoolB, (tx) => enrollStudent(tx, schoolB, { listingId: bProgram.id, guardian: parent(), student: { firstName: "Omar", lastName: "Kane" }, channel: "dashboard", actor: staff }));
    const o = testOwnerClient();
    await expect(o.enrollmentDetails.update({ where: { reservationId: bEnroll.id }, data: { classGroupId: c.id } })).rejects.toThrow();
    await o.$disconnect();
  });
});
