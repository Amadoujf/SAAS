import { Prisma } from "@prisma/client";
import { resolveOrCreateCustomer, type CustomerInput } from "./customer-registry";
import { createListing, InvalidListingInputError, updateListing, type ListingInput } from "./listing-registry";
import { createReservation, ReservationNotFoundError, transitionReservationStatus } from "./reservation-registry";
import { recordReservationPayment, voidReservationPayment, type RecordPaymentInput } from "./travel-registry";
import { addDays, isIsoDate, normalizeRanges, type MinuteRange } from "./service-slots";

/**
 * Éducation (secteur `education`) — écoles privées, centres de formation, cours de
 * langues, soutien scolaire. S'appuie sur les briques communes :
 * - une formation EST une fiche commune (`Listing`, type « course ») + sa fiche
 *   pédagogique ; le prix de la fiche est la scolarité, les frais d'inscription à part ;
 * - une inscription EST une réservation commune (module « enrollments ») : son montant
 *   (frais + scolarité − remise motivée) est calculé ICI, jamais reçu du navigateur ;
 *   ses encaissements passent par le service commun (reçus `REC-…`, annulation motivée) ;
 * - le responsable (parent, tuteur, ou l'élève majeur lui-même) est un client du
 *   registre commun ; l'élève est rattaché à ce responsable.
 *
 * Règles tenues ici (et doublées en base) :
 * - une seule inscription active par élève et par formation (index unique partiel) ;
 * - l'effectif d'une classe ne dépasse jamais sa capacité (verrou sur la classe) ;
 * - les échéances totalisent exactement le montant dû ; leur état (réglée, partielle,
 *   en retard) est DÉDUIT des encaissements réels, jamais saisi à la main ;
 * - un enseignant ne voit et ne saisit que les présences et notes de SES classes ;
 *   seuls les élèves inscrits dans la classe peuvent y être pointés ou notés ;
 * - une note ne dépasse jamais le barème (déclencheur) ; elle n'est visible des
 *   familles qu'une fois l'évaluation publiée ;
 * - une famille ne voit que SES enfants, un élève que SON espace (jetons personnels).
 */

export const COURSES_MODULE = "courses";
export const ENROLLMENTS_MODULE = "enrollments";

export const PROGRAM_CATEGORIES = ["school", "training", "language", "tutoring", "other"] as const;
export const PROGRAM_FORMATS = ["onsite", "online", "hybrid"] as const;
export const PROGRAM_AUDIENCES = ["children", "teens", "adults", "all"] as const;
export const GUARDIAN_RELATIONS = ["parent", "guardian", "self"] as const;
export const ATTENDANCE_STATUSES = ["present", "absent", "late", "excused"] as const;
export const GRADE_SCALES = [10, 20, 100] as const;

export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export class EducationError extends Error {}

type Tx = Prisma.TransactionClient;
type Actor = { userId: string | null; type: "owner" | "employee" | "system" | "customer" };
/** Portée de l'acteur : `all` (gestion académique) ou seulement les classes de `userId`. */
export type AcademicScope = { userId: string | null; all: boolean };

const includes = <T extends readonly (string | number)[]>(list: T, v: unknown): v is T[number] => (list as readonly unknown[]).includes(v);
const int = (v: unknown, a: number, b: number) => Number.isInteger(v) && (v as number) >= a && (v as number) <= b;
const text = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");
const opt = (v: unknown, max: number) => text(v, max) || null;
const dateOnly = (iso: string) => new Date(`${iso}T00:00:00Z`);
const isoOf = (d: Date) => d.toISOString().slice(0, 10);

async function tenantToday(tx: Tx, tenantId: string, now = new Date()) {
  const tz = (await tx.tenant.findUnique({ where: { id: tenantId }, select: { timezone: true } }))?.timezone || "Africa/Dakar";
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(now);
}

// ============================================================================
// RÉGLAGES
// ============================================================================

const DEFAULT_SETTINGS = { academicYear: "", gradeScale: 20, absenceAlert: 3, onlineEnrollment: true };
export type EducationSettingsInput = Partial<typeof DEFAULT_SETTINGS>;

export async function getEducationSettings(tx: Tx, tenantId: string) {
  const s = await tx.educationSettings.findUnique({ where: { tenantId } });
  return s ? { academicYear: s.academicYear, gradeScale: s.gradeScale, absenceAlert: s.absenceAlert, onlineEnrollment: s.onlineEnrollment } : { ...DEFAULT_SETTINGS };
}

export async function updateEducationSettings(tx: Tx, tenantId: string, patch: EducationSettingsInput) {
  if (patch.gradeScale !== undefined && !includes(GRADE_SCALES, patch.gradeScale)) throw new EducationError("Barème inconnu (10, 20 ou 100).");
  if (patch.absenceAlert !== undefined && !int(patch.absenceAlert, 1, 100)) throw new EducationError("Seuil d'absences invalide.");
  const data = {
    ...(patch.academicYear !== undefined ? { academicYear: text(patch.academicYear, 20) } : {}),
    ...(patch.gradeScale !== undefined ? { gradeScale: patch.gradeScale } : {}),
    ...(patch.absenceAlert !== undefined ? { absenceAlert: patch.absenceAlert } : {}),
    ...(patch.onlineEnrollment !== undefined ? { onlineEnrollment: !!patch.onlineEnrollment } : {}),
  };
  await tx.educationSettings.upsert({ where: { tenantId }, create: { tenantId, ...DEFAULT_SETTINGS, ...data }, update: data });
  return getEducationSettings(tx, tenantId);
}

// ============================================================================
// FORMATIONS
// ============================================================================

export interface ProgramInput {
  title: string;
  summary?: string | null;
  description?: string | null;
  /** Scolarité (FCFA) ; absente = sur devis. */
  tuition?: number | null;
  media?: ListingInput["media"];
  featured?: boolean;
  category: string;
  level?: string | null;
  format: string;
  durationLabel?: string | null;
  registrationFee?: number;
  defaultInstallments?: number;
  audience: string;
  position?: number;
}

function assertProgram(i: Partial<ProgramInput>) {
  if (i.title !== undefined && !text(i.title, 120)) throw new InvalidListingInputError("Indiquez l'intitulé de la formation.");
  if (i.category !== undefined && !includes(PROGRAM_CATEGORIES, i.category)) throw new InvalidListingInputError("Catégorie inconnue.");
  if (i.format !== undefined && !includes(PROGRAM_FORMATS, i.format)) throw new InvalidListingInputError("Format inconnu.");
  if (i.audience !== undefined && !includes(PROGRAM_AUDIENCES, i.audience)) throw new InvalidListingInputError("Public inconnu.");
  if (i.tuition != null && !int(i.tuition, 0, 100_000_000)) throw new InvalidListingInputError("Scolarité invalide.");
  if (i.registrationFee !== undefined && !int(i.registrationFee, 0, 10_000_000)) throw new InvalidListingInputError("Frais d'inscription invalides.");
  if (i.defaultInstallments !== undefined && !int(i.defaultInstallments, 1, 12)) throw new InvalidListingInputError("Nombre d'échéances : entre 1 et 12.");
}

const programData = (i: Partial<ProgramInput>) => ({
  ...(i.category !== undefined ? { category: i.category } : {}),
  ...(i.level !== undefined ? { level: opt(i.level, 40) } : {}),
  ...(i.format !== undefined ? { format: i.format } : {}),
  ...(i.durationLabel !== undefined ? { durationLabel: opt(i.durationLabel, 40) } : {}),
  ...(i.registrationFee !== undefined ? { registrationFee: i.registrationFee } : {}),
  ...(i.defaultInstallments !== undefined ? { defaultInstallments: i.defaultInstallments } : {}),
  ...(i.audience !== undefined ? { audience: i.audience } : {}),
  ...(i.position !== undefined ? { position: i.position } : {}),
});

export async function createProgram(tx: Tx, tenantId: string, input: ProgramInput, actorUserId: string | null) {
  assertProgram(input);
  const listing = await createListing(
    tx,
    tenantId,
    { moduleKey: COURSES_MODULE, type: "course", title: text(input.title, 120), summary: input.summary ?? null, description: input.description ?? null, price: input.tuition ?? null, priceUnit: input.tuition == null ? "on_request" : "total", media: input.media, featured: input.featured },
    actorUserId,
  );
  await tx.programDetails.create({ data: { listingId: listing.id, tenantId, ...programData(input) } });
  return (await getProgram(tx, tenantId, listing.id))!;
}

export async function updateProgram(tx: Tx, tenantId: string, listingId: string, patch: Partial<ProgramInput>, actorUserId: string | null) {
  assertProgram(patch);
  const exists = await tx.programDetails.findFirst({ where: { listingId, tenantId }, select: { listingId: true } });
  if (!exists) throw new EducationError("Formation introuvable.");
  const listingPatch = {
    ...(patch.title !== undefined ? { title: text(patch.title, 120) } : {}),
    ...(patch.summary !== undefined ? { summary: patch.summary } : {}),
    ...(patch.description !== undefined ? { description: patch.description } : {}),
    ...(patch.tuition !== undefined ? { price: patch.tuition, priceUnit: patch.tuition == null ? ("on_request" as const) : ("total" as const) } : {}),
    ...(patch.media !== undefined ? { media: patch.media } : {}),
    ...(patch.featured !== undefined ? { featured: patch.featured } : {}),
  };
  if (Object.keys(listingPatch).length) await updateListing(tx, tenantId, listingId, listingPatch, actorUserId);
  await tx.programDetails.update({ where: { listingId }, data: programData(patch) });
  return (await getProgram(tx, tenantId, listingId))!;
}

const programInclude = {
  program: { include: { classes: { where: { isActive: true }, orderBy: { startDate: "asc" as const } } } },
} satisfies Prisma.ListingInclude;

export function getProgram(tx: Tx, tenantId: string, listingId: string) {
  return tx.listing.findFirst({ where: { id: listingId, tenantId, type: "course", deletedAt: null }, include: programInclude });
}

export function listPrograms(tx: Tx, tenantId: string, q: { publishedOnly?: boolean; category?: string } = {}) {
  return tx.listing.findMany({
    where: { tenantId, type: "course", deletedAt: null, ...(q.publishedOnly ? { status: "published" } : { status: { not: "archived" } }), ...(q.category ? { program: { category: q.category } } : {}) },
    include: programInclude,
    orderBy: [{ featured: "desc" }, { program: { position: "asc" } }, { createdAt: "asc" }],
    take: 300,
  });
}

/** Fiche publique : formation publiée + classes ouvertes et leurs places restantes. */
export async function getPublicProgramBySlug(tx: Tx, tenantId: string, slug: string) {
  const listing = await tx.listing.findFirst({ where: { tenantId, slug, type: "course", status: "published", deletedAt: null }, include: programInclude });
  if (!listing?.program) return null;
  const seats = await classSeats(tx, tenantId, listing.program.classes.map((c) => c.id));
  return { ...listing, classes: listing.program.classes.map((c) => ({ ...c, remaining: Math.max(0, c.capacity - (seats.get(c.id) ?? 0)) })) };
}

// ============================================================================
// CLASSES
// ============================================================================

export interface ClassInput {
  listingId: string;
  name: string;
  teacherUserId?: string | null;
  room?: string | null;
  schedule?: (MinuteRange & { weekday: number })[];
  startDate: string;
  endDate: string;
  capacity: number;
}

async function assertTeacher(tx: Tx, tenantId: string, userId: string | null | undefined) {
  if (!userId) return;
  const m = await tx.tenantUser.findFirst({ where: { tenantId, userId, status: "ACTIVE" }, select: { id: true } });
  if (!m) throw new EducationError("Cet enseignant ne fait pas partie de l'équipe.");
}

function normalizeSchedule(schedule: ClassInput["schedule"]) {
  if (!schedule) return [];
  if (schedule.length > 30 || schedule.some((s) => !int(s.weekday, 0, 6))) throw new EducationError("Emploi du temps invalide.");
  return [0, 1, 2, 3, 4, 5, 6].flatMap((d) => normalizeRanges(schedule.filter((s) => s.weekday === d)).map((r) => ({ weekday: d, startMinute: r.startMinute, endMinute: r.endMinute })));
}

function assertClassDates(startDate: string, endDate: string) {
  if (!isIsoDate(startDate) || !isIsoDate(endDate)) throw new EducationError("Dates de la classe invalides.");
  if (startDate > endDate) throw new EducationError("La date de fin précède la date de début.");
}

export async function createClass(tx: Tx, tenantId: string, input: ClassInput) {
  const program = await tx.programDetails.findFirst({ where: { listingId: input.listingId, tenantId }, select: { listingId: true } });
  if (!program) throw new EducationError("Formation introuvable.");
  const name = text(input.name, 80);
  if (!name) throw new EducationError("Nommez la classe.");
  if (!int(input.capacity, 1, 500)) throw new EducationError("Capacité : entre 1 et 500 élèves.");
  assertClassDates(input.startDate, input.endDate);
  await assertTeacher(tx, tenantId, input.teacherUserId);
  return tx.classGroup.create({
    data: { tenantId, listingId: input.listingId, name, teacherUserId: input.teacherUserId ?? null, room: opt(input.room, 40), schedule: normalizeSchedule(input.schedule), startDate: dateOnly(input.startDate), endDate: dateOnly(input.endDate), capacity: input.capacity },
  });
}

export async function updateClass(tx: Tx, tenantId: string, classGroupId: string, patch: Partial<Omit<ClassInput, "listingId">> & { isActive?: boolean }) {
  const locked = await tx.$queryRaw<{ startDate: Date; endDate: Date }[]>`SELECT "startDate", "endDate" FROM "ClassGroup" WHERE "id" = ${classGroupId} AND "tenantId" = ${tenantId} FOR UPDATE`;
  if (!locked[0]) throw new EducationError("Classe introuvable.");
  if (patch.name !== undefined && !text(patch.name, 80)) throw new EducationError("Nommez la classe.");
  if (patch.capacity !== undefined) {
    if (!int(patch.capacity, 1, 500)) throw new EducationError("Capacité : entre 1 et 500 élèves.");
    const enrolled = (await classSeats(tx, tenantId, [classGroupId])).get(classGroupId) ?? 0;
    if (patch.capacity < enrolled) throw new EducationError(`La classe compte déjà ${enrolled} inscrits.`);
  }
  if (patch.startDate !== undefined || patch.endDate !== undefined) assertClassDates(patch.startDate ?? isoOf(locked[0].startDate), patch.endDate ?? isoOf(locked[0].endDate));
  if (patch.teacherUserId !== undefined) await assertTeacher(tx, tenantId, patch.teacherUserId);
  return tx.classGroup.update({
    where: { id: classGroupId },
    data: {
      ...(patch.name !== undefined ? { name: text(patch.name, 80) } : {}),
      ...(patch.teacherUserId !== undefined ? { teacherUserId: patch.teacherUserId } : {}),
      ...(patch.room !== undefined ? { room: opt(patch.room, 40) } : {}),
      ...(patch.schedule !== undefined ? { schedule: normalizeSchedule(patch.schedule) } : {}),
      ...(patch.startDate !== undefined ? { startDate: dateOnly(patch.startDate) } : {}),
      ...(patch.endDate !== undefined ? { endDate: dateOnly(patch.endDate) } : {}),
      ...(patch.capacity !== undefined ? { capacity: patch.capacity } : {}),
      ...(patch.isActive !== undefined ? { isActive: !!patch.isActive } : {}),
    },
  });
}

/** Effectif actif par classe. */
async function classSeats(tx: Tx, tenantId: string, classIds: string[]) {
  if (!classIds.length) return new Map<string, number>();
  const rows = await tx.enrollmentDetails.groupBy({ by: ["classGroupId"], where: { tenantId, classGroupId: { in: classIds }, active: true }, _count: { _all: true } });
  return new Map(rows.map((r) => [r.classGroupId!, r._count._all]));
}

/** Classes visibles par l'acteur : toutes (gestion) ou seulement les siennes (enseignant). */
export async function listClasses(tx: Tx, tenantId: string, scope: AcademicScope, q: { listingId?: string; activeOnly?: boolean } = {}) {
  const classes = await tx.classGroup.findMany({
    where: { tenantId, ...(scope.all ? {} : { teacherUserId: scope.userId ?? "__none__" }), ...(q.listingId ? { listingId: q.listingId } : {}), ...(q.activeOnly ? { isActive: true } : {}) },
    include: { program: { include: { listing: { select: { id: true, title: true, slug: true } } } }, teacher: { select: { id: true, fullName: true, email: true } } },
    orderBy: [{ isActive: "desc" }, { startDate: "asc" }, { name: "asc" }],
  });
  const seats = await classSeats(tx, tenantId, classes.map((c) => c.id));
  return classes.map((c) => ({ ...c, enrolled: seats.get(c.id) ?? 0 }));
}

/** Classe accessible à l'acteur, sinon refus (un enseignant n'ouvre que SES classes). */
async function scopedClass(tx: Tx, tenantId: string, classGroupId: string, scope: AcademicScope) {
  const c = await tx.classGroup.findFirst({ where: { id: classGroupId, tenantId } });
  if (!c || (!scope.all && (!scope.userId || c.teacherUserId !== scope.userId))) throw new EducationError("Classe introuvable.");
  return c;
}

/** Fiche de classe : liste d'appel (élèves à inscription active), évaluations. */
export async function getClassRoster(tx: Tx, tenantId: string, classGroupId: string, scope: AcademicScope) {
  const c = await scopedClass(tx, tenantId, classGroupId, scope);
  const [enrollments, assessments, program] = await Promise.all([
    tx.enrollmentDetails.findMany({ where: { tenantId, classGroupId, active: true }, include: { student: { select: { id: true, firstName: true, lastName: true, birthDate: true } } }, orderBy: [{ student: { lastName: "asc" } }, { student: { firstName: "asc" } }] }),
    tx.assessment.findMany({ where: { tenantId, classGroupId }, include: { grades: true }, orderBy: [{ date: "desc" }, { createdAt: "desc" }] }),
    tx.listing.findFirst({ where: { id: c.listingId, tenantId }, select: { id: true, title: true } }),
  ]);
  return { classGroup: c, program, students: enrollments.map((e) => e.student), assessments };
}

// ============================================================================
// ÉLÈVES ET RESPONSABLES
// ============================================================================

export interface StudentInput {
  firstName: string;
  lastName: string;
  birthDate?: string | null;
  notes?: string | null;
}

function assertStudent(i: StudentInput) {
  if (!text(i.firstName, 80) || !text(i.lastName, 80)) throw new EducationError("Prénom et nom de l'élève requis.");
  if (i.birthDate != null && i.birthDate !== "") {
    if (!isIsoDate(i.birthDate) || i.birthDate > new Date().toISOString().slice(0, 10) || i.birthDate < "1920-01-01") throw new EducationError("Date de naissance invalide.");
  }
}

/** Élève rattaché à son responsable ; le même enfant (nom, prénom, naissance) n'est jamais créé deux fois. */
export async function upsertStudent(tx: Tx, tenantId: string, guardianId: string, relation: string, input: StudentInput) {
  if (!includes(GUARDIAN_RELATIONS, relation)) throw new EducationError("Lien avec l'élève inconnu.");
  assertStudent(input);
  const guardian = await tx.customer.findFirst({ where: { id: guardianId, tenantId }, select: { id: true } });
  if (!guardian) throw new EducationError("Responsable introuvable.");
  const firstName = text(input.firstName, 80);
  const lastName = text(input.lastName, 80);
  const birthDate = input.birthDate ? dateOnly(input.birthDate) : null;
  const existing = await tx.student.findFirst({ where: { tenantId, guardianId, firstName: { equals: firstName, mode: "insensitive" }, lastName: { equals: lastName, mode: "insensitive" } } });
  if (existing && (!birthDate || !existing.birthDate || existing.birthDate.getTime() === birthDate.getTime())) {
    return existing.birthDate || !birthDate ? existing : tx.student.update({ where: { id: existing.id }, data: { birthDate } });
  }
  return tx.student.create({ data: { tenantId, guardianId, guardianRelation: relation, firstName, lastName, birthDate, notes: opt(input.notes, 500) } });
}

export async function updateStudent(tx: Tx, tenantId: string, studentId: string, patch: Partial<StudentInput>) {
  const s = await tx.student.findFirst({ where: { id: studentId, tenantId } });
  if (!s) throw new EducationError("Élève introuvable.");
  assertStudent({ firstName: patch.firstName ?? s.firstName, lastName: patch.lastName ?? s.lastName, birthDate: patch.birthDate });
  return tx.student.update({
    where: { id: studentId },
    data: {
      ...(patch.firstName !== undefined ? { firstName: text(patch.firstName, 80) } : {}),
      ...(patch.lastName !== undefined ? { lastName: text(patch.lastName, 80) } : {}),
      ...(patch.birthDate !== undefined ? { birthDate: patch.birthDate ? dateOnly(patch.birthDate) : null } : {}),
      ...(patch.notes !== undefined ? { notes: opt(patch.notes, 500) } : {}),
    },
  });
}

/** Lien personnel de l'espace famille (créé à la première inscription). */
export async function ensureFamilyAccess(tx: Tx, tenantId: string, customerId: string) {
  const existing = await tx.familyAccess.findFirst({ where: { customerId, tenantId } });
  return existing ?? tx.familyAccess.create({ data: { customerId, tenantId } });
}

/** Révoque un lien (partagé par erreur) : l'ancien cesse immédiatement de fonctionner. */
export async function rotateFamilyToken(tx: Tx, tenantId: string, customerId: string) {
  await ensureFamilyAccess(tx, tenantId, customerId);
  return tx.familyAccess.update({ where: { customerId }, data: { accessToken: crypto.randomUUID() } });
}

export async function rotateStudentToken(tx: Tx, tenantId: string, studentId: string) {
  const { count } = await tx.student.updateMany({ where: { id: studentId, tenantId }, data: { accessToken: crypto.randomUUID() } });
  if (!count) throw new EducationError("Élève introuvable.");
  return tx.student.findFirstOrThrow({ where: { id: studentId, tenantId } });
}

export function listStudents(tx: Tx, tenantId: string, q: { search?: string; take?: number } = {}) {
  const s = text(q.search, 60);
  return tx.student.findMany({
    where: {
      tenantId,
      ...(s ? { OR: [{ firstName: { contains: s, mode: "insensitive" } }, { lastName: { contains: s, mode: "insensitive" } }, { guardian: { phone: { contains: s.replace(/\s/g, "") } } }, { guardian: { lastName: { contains: s, mode: "insensitive" } } }] } : {}),
    },
    include: { guardian: { select: { id: true, firstName: true, lastName: true, phone: true, email: true } }, enrollments: { where: { active: true }, include: { classGroup: { select: { id: true, name: true } } } } },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    take: q.take ?? 300,
  });
}

// ============================================================================
// INSCRIPTIONS ET ÉCHÉANCES
// ============================================================================

export interface InstallmentInput {
  label: string;
  dueDate: string;
  amount: number;
}

/**
 * Plan par défaut : frais d'inscription à l'inscription, puis la scolarité (après
 * remise) en N mensualités à partir du début de la classe (la dernière absorbe l'arrondi).
 */
export function defaultInstallmentPlan(input: { registrationFee: number; tuition: number; discountAmount: number; count: number; firstDueDate: string; enrollmentDate: string }): InstallmentInput[] {
  const plan: InstallmentInput[] = [];
  const fee = Math.max(0, input.registrationFee - Math.max(0, input.discountAmount - input.tuition));
  const tuition = Math.max(0, input.tuition - input.discountAmount);
  if (fee > 0) plan.push({ label: "Frais d'inscription", dueDate: input.enrollmentDate, amount: fee });
  if (tuition > 0) {
    const n = Math.max(1, Math.min(12, input.count));
    const base = Math.floor(tuition / n);
    const [y, m, d] = input.firstDueDate.split("-").map(Number) as [number, number, number];
    for (let k = 0; k < n; k++) {
      const due = new Date(Date.UTC(y, m - 1 + k, 1));
      const last = new Date(Date.UTC(due.getUTCFullYear(), due.getUTCMonth() + 1, 0)).getUTCDate();
      due.setUTCDate(Math.min(d, last));
      plan.push({ label: n === 1 ? "Scolarité" : `Scolarité ${k + 1}/${n}`, dueDate: isoOf(due), amount: k === n - 1 ? tuition - base * (n - 1) : base });
    }
  }
  return plan;
}

function assertPlan(plan: InstallmentInput[], total: number) {
  if (plan.length > 24) throw new EducationError("24 échéances au maximum.");
  for (const p of plan) {
    if (!text(p.label, 60)) throw new EducationError("Chaque échéance a un libellé.");
    if (!isIsoDate(p.dueDate)) throw new EducationError("Date d'échéance invalide.");
    if (!int(p.amount, 1, 100_000_000)) throw new EducationError("Montant d'échéance invalide.");
  }
  const sum = plan.reduce((s, p) => s + p.amount, 0);
  if (sum !== total) throw new EducationError(`Les échéances totalisent ${sum} FCFA au lieu de ${total} FCFA.`);
}

async function writePlan(tx: Tx, tenantId: string, reservationId: string, plan: InstallmentInput[]) {
  await tx.enrollmentInstallment.deleteMany({ where: { tenantId, reservationId } });
  const sorted = [...plan].sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  if (sorted.length) await tx.enrollmentInstallment.createMany({ data: sorted.map((p, i) => ({ tenantId, reservationId, position: i + 1, label: text(p.label, 60), dueDate: dateOnly(p.dueDate), amount: p.amount })) });
}

/** Place dans une classe, sous verrou : jamais plus d'inscrits que de places. */
async function takeSeat(tx: Tx, tenantId: string, classGroupId: string, listingId: string, reservationId: string | null) {
  const locked = await tx.$queryRaw<{ capacity: number; listingId: string; isActive: boolean }[]>`SELECT "capacity", "listingId", "isActive" FROM "ClassGroup" WHERE "id" = ${classGroupId} AND "tenantId" = ${tenantId} FOR UPDATE`;
  const c = locked[0];
  if (!c) throw new EducationError("Classe introuvable.");
  if (c.listingId !== listingId) throw new EducationError("Cette classe n'appartient pas à la formation choisie.");
  if (!c.isActive) throw new EducationError("Cette classe est fermée.");
  const taken = await tx.enrollmentDetails.count({ where: { tenantId, classGroupId, active: true, ...(reservationId ? { reservationId: { not: reservationId } } : {}) } });
  if (taken >= c.capacity) throw new EducationError("Cette classe est complète.");
}

export interface EnrollInput {
  listingId: string;
  classGroupId?: string | null;
  /** Élève existant, ou nouvel élève rattaché au responsable. */
  studentId?: string | null;
  student?: StudentInput | null;
  guardianId?: string | null;
  guardian?: CustomerInput | null;
  relation?: string;
  discountAmount?: number;
  discountReason?: string | null;
  /** Plan d'échéances saisi par l'équipe ; sinon plan par défaut de la formation. */
  installments?: InstallmentInput[] | null;
  note?: string | null;
  channel: "web" | "dashboard";
  actor: Actor;
}

/**
 * Inscription (équipe ou demande en ligne). Montant = frais + scolarité de la fiche −
 * remise motivée (équipe uniquement). En ligne : demande « à confirmer », sans remise.
 */
export async function enrollStudent(tx: Tx, tenantId: string, input: EnrollInput) {
  const fromWeb = input.channel === "web";
  const listing = await tx.listing.findFirst({ where: { id: input.listingId, tenantId, type: "course", deletedAt: null }, include: { program: true } });
  if (!listing?.program) throw new EducationError("Formation introuvable.");
  if (fromWeb) {
    if (listing.status !== "published") throw new EducationError("Cette formation n'est pas ouverte aux inscriptions.");
    if (!(await getEducationSettings(tx, tenantId)).onlineEnrollment) throw new EducationError("Les inscriptions en ligne sont fermées : contactez l'établissement.");
    if (input.discountAmount || input.installments || input.studentId || input.guardianId) throw new EducationError("Demande invalide.");
  }
  if (listing.price == null) throw new EducationError("Scolarité sur devis : fixez d'abord le tarif de la formation.");
  const registrationFee = listing.program.registrationFee;
  const tuition = listing.price;
  const discountAmount = input.discountAmount ?? 0;
  if (!int(discountAmount, 0, registrationFee + tuition)) throw new EducationError("Remise invalide.");
  const discountReason = opt(input.discountReason, 200);
  if (discountAmount > 0 && !discountReason) throw new EducationError("Motivez la remise (bourse, fratrie, accord…).");
  const total = registrationFee + tuition - discountAmount;

  // Responsable et élève.
  let guardianId = input.guardianId ?? null;
  if (guardianId) {
    if (!(await tx.customer.findFirst({ where: { id: guardianId, tenantId }, select: { id: true } }))) throw new EducationError("Responsable introuvable.");
  } else {
    if (!input.guardian?.firstName?.trim() || !input.guardian.phone?.trim()) throw new EducationError("Nom et téléphone du responsable requis.");
    guardianId = (await resolveOrCreateCustomer(tx, tenantId, input.guardian)).id;
  }
  let student;
  if (input.studentId) {
    student = await tx.student.findFirst({ where: { id: input.studentId, tenantId, guardianId } });
    if (!student) throw new EducationError("Élève introuvable pour ce responsable.");
  } else {
    if (!input.student) throw new EducationError("Renseignez l'élève.");
    student = await upsertStudent(tx, tenantId, guardianId, input.relation ?? "parent", input.student);
  }
  if (await tx.enrollmentDetails.count({ where: { tenantId, studentId: student.id, listingId: listing.id, active: true } })) {
    throw new EducationError(`${student.firstName} est déjà inscrit(e) à cette formation.`);
  }

  let classGroup = null;
  if (input.classGroupId) {
    await takeSeat(tx, tenantId, input.classGroupId, listing.id, null);
    classGroup = await tx.classGroup.findFirstOrThrow({ where: { id: input.classGroupId, tenantId } });
  }
  const reservation = await createReservation(tx, tenantId, {
    listingId: listing.id,
    requestedStartAt: new Date(Date.now() + 60_000),
    customerId: guardianId,
    customerNote: input.note ?? null,
    channel: input.channel,
    moduleKey: ENROLLMENTS_MODULE,
    pricing: "none",
    actor: input.actor,
  });
  await tx.reservation.update({
    where: { id: reservation.id },
    data: { totalAmount: total, unitPrice: tuition, ...(classGroup ? { startAt: classGroup.startDate, endAt: classGroup.endDate } : {}) },
  });
  await tx.enrollmentDetails.create({ data: { reservationId: reservation.id, tenantId, studentId: student.id, listingId: listing.id, classGroupId: classGroup?.id ?? null, registrationFee, tuition, discountAmount, discountReason } });

  const today = await tenantToday(tx, tenantId);
  const plan = input.installments ?? defaultInstallmentPlan({ registrationFee, tuition, discountAmount, count: listing.program.defaultInstallments, firstDueDate: classGroup && isoOf(classGroup.startDate) > today ? isoOf(classGroup.startDate) : today, enrollmentDate: today });
  assertPlan(plan, total);
  await writePlan(tx, tenantId, reservation.id, plan);
  await ensureFamilyAccess(tx, tenantId, guardianId);
  if (!fromWeb && classGroup) await transitionReservationStatus(tx, tenantId, { reservationId: reservation.id, toStatus: "confirmed", actor: input.actor, note: `Inscription en ${classGroup.name}` });
  return (await getEnrollment(tx, tenantId, reservation.id))!;
}

async function lockEnrollment(tx: Tx, tenantId: string, reservationId: string) {
  const r = await tx.$queryRaw<{ status: string }[]>`SELECT "status" FROM "Reservation" WHERE "id" = ${reservationId} AND "tenantId" = ${tenantId} AND "moduleKey" = ${ENROLLMENTS_MODULE} FOR UPDATE`;
  if (!r[0]) throw new ReservationNotFoundError();
  return r[0].status;
}

/** Affecte (ou change) la classe ; confirme une demande en ligne. */
export async function assignClass(tx: Tx, tenantId: string, reservationId: string, classGroupId: string, actor: Actor) {
  const status = await lockEnrollment(tx, tenantId, reservationId);
  if (status !== "requested" && status !== "confirmed") throw new EducationError("Cette inscription n'est plus en cours.");
  const e = await tx.enrollmentDetails.findFirstOrThrow({ where: { reservationId, tenantId } });
  if (e.classGroupId === classGroupId && status === "confirmed") return (await getEnrollment(tx, tenantId, reservationId))!;
  await takeSeat(tx, tenantId, classGroupId, e.listingId, reservationId);
  const c = await tx.classGroup.findFirstOrThrow({ where: { id: classGroupId, tenantId } });
  await tx.enrollmentDetails.update({ where: { reservationId }, data: { classGroupId } });
  await tx.reservation.update({ where: { id: reservationId }, data: { startAt: c.startDate, endAt: c.endDate } });
  if (status === "requested") await transitionReservationStatus(tx, tenantId, { reservationId, toStatus: "confirmed", actor, note: `Inscription confirmée en ${c.name}` });
  return (await getEnrollment(tx, tenantId, reservationId))!;
}

/**
 * Remise et/ou nouveau plan d'échéances. Le total recalculé ne descend jamais sous ce
 * qui a déjà été encaissé (sinon : annuler d'abord l'encaissement, avec motif).
 */
export async function setEnrollmentPlan(tx: Tx, tenantId: string, reservationId: string, input: { discountAmount?: number; discountReason?: string | null; installments?: InstallmentInput[] | null }) {
  const status = await lockEnrollment(tx, tenantId, reservationId);
  if (status !== "requested" && status !== "confirmed") throw new EducationError("Cette inscription n'est plus en cours.");
  const e = await tx.enrollmentDetails.findFirstOrThrow({ where: { reservationId, tenantId }, include: { classGroup: true } });
  const discountAmount = input.discountAmount ?? e.discountAmount;
  if (!int(discountAmount, 0, e.registrationFee + e.tuition)) throw new EducationError("Remise invalide.");
  const discountReason = input.discountAmount !== undefined ? opt(input.discountReason, 200) : e.discountReason;
  if (discountAmount > 0 && !discountReason) throw new EducationError("Motivez la remise (bourse, fratrie, accord…).");
  const total = e.registrationFee + e.tuition - discountAmount;
  const paid = (await tx.reservationPayment.findMany({ where: { tenantId, reservationId, voidedAt: null }, select: { amount: true } })).reduce((s, p) => s + p.amount, 0);
  if (total < paid) throw new EducationError(`Déjà encaissé : ${paid} FCFA. Le total ne peut pas descendre en dessous.`);
  const program = await tx.programDetails.findFirstOrThrow({ where: { listingId: e.listingId, tenantId } });
  const today = await tenantToday(tx, tenantId);
  const plan = input.installments ?? defaultInstallmentPlan({ registrationFee: e.registrationFee, tuition: e.tuition, discountAmount, count: program.defaultInstallments, firstDueDate: e.classGroup && isoOf(e.classGroup.startDate) > today ? isoOf(e.classGroup.startDate) : today, enrollmentDate: today });
  assertPlan(plan, total);
  await tx.enrollmentDetails.update({ where: { reservationId }, data: { discountAmount, discountReason: discountAmount > 0 ? discountReason : null } });
  await tx.reservation.update({ where: { id: reservationId }, data: { totalAmount: total } });
  await writePlan(tx, tenantId, reservationId, plan);
  return (await getEnrollment(tx, tenantId, reservationId))!;
}

/** Abandon / désinscription motivée. Les encaissements déjà reçus restent au journal. */
export async function withdrawEnrollment(tx: Tx, tenantId: string, reservationId: string, actor: Actor, reason: string) {
  const why = text(reason, 300);
  if (!why) throw new EducationError("Indiquez le motif.");
  const status = await lockEnrollment(tx, tenantId, reservationId);
  if (status !== "requested" && status !== "confirmed") throw new EducationError("Cette inscription n'est plus en cours.");
  await transitionReservationStatus(tx, tenantId, { reservationId, toStatus: "canceled", actor, note: why });
  return (await getEnrollment(tx, tenantId, reservationId))!;
}

/** Fin de formation (année terminée, diplôme…). */
export async function completeEnrollment(tx: Tx, tenantId: string, reservationId: string, actor: Actor) {
  const status = await lockEnrollment(tx, tenantId, reservationId);
  if (status !== "confirmed") throw new EducationError("Seule une inscription confirmée peut être clôturée.");
  await transitionReservationStatus(tx, tenantId, { reservationId, toStatus: "completed", actor, note: "Formation terminée" });
  return (await getEnrollment(tx, tenantId, reservationId))!;
}

export async function recordEnrollmentPayment(tx: Tx, tenantId: string, input: { reservationId: string; amount: number; method: RecordPaymentInput["method"]; reference?: string | null; paidAt?: Date; actorUserId: string | null }) {
  const status = await lockEnrollment(tx, tenantId, input.reservationId);
  if (status === "canceled") throw new EducationError("Inscription annulée : aucun encaissement ne peut y être ajouté.");
  return recordReservationPayment(tx, tenantId, { ...input, kind: "other" });
}

export async function voidEnrollmentPayment(tx: Tx, tenantId: string, paymentId: string, reason: string) {
  const p = await tx.reservationPayment.findFirst({ where: { id: paymentId, tenantId, reservation: { moduleKey: ENROLLMENTS_MODULE } }, select: { id: true } });
  if (!p) throw new EducationError("Encaissement introuvable.");
  return voidReservationPayment(tx, tenantId, paymentId, reason);
}

export type InstallmentState = "paid" | "partial" | "due" | "overdue";
export interface InstallmentView {
  id: string;
  position: number;
  label: string;
  dueDate: string;
  amount: number;
  covered: number;
  state: InstallmentState;
}

/** Affectation des encaissements réels aux échéances, dans l'ordre (jamais saisie à la main). */
export function allocateInstallments(installments: { id: string; position: number; label: string; dueDate: Date; amount: number }[], payments: { amount: number; voidedAt: Date | null }[], today: string): InstallmentView[] {
  let pool = payments.filter((p) => !p.voidedAt).reduce((s, p) => s + p.amount, 0);
  return [...installments]
    .sort((a, b) => a.position - b.position)
    .map((i) => {
      const covered = Math.min(i.amount, pool);
      pool -= covered;
      const dueDate = isoOf(i.dueDate);
      const state: InstallmentState = covered >= i.amount ? "paid" : dueDate < today ? "overdue" : covered > 0 ? "partial" : "due";
      return { id: i.id, position: i.position, label: i.label, dueDate, amount: i.amount, covered, state };
    });
}

const enrollmentInclude = {
  listing: { select: { id: true, title: true, slug: true, program: { select: { category: true, level: true, durationLabel: true } } } },
  customer: { select: { id: true, firstName: true, lastName: true, phone: true, email: true } },
  enrollment: { include: { student: true, classGroup: { select: { id: true, name: true, room: true, startDate: true, endDate: true, teacherUserId: true } }, installments: { orderBy: { position: "asc" as const } } } },
  payments: { orderBy: { paidAt: "asc" as const } },
  history: { orderBy: { createdAt: "asc" as const } },
} satisfies Prisma.ReservationInclude;

export function getEnrollment(tx: Tx, tenantId: string, reservationId: string) {
  return tx.reservation.findFirst({ where: { id: reservationId, tenantId, moduleKey: ENROLLMENTS_MODULE }, include: enrollmentInclude });
}

export function listEnrollments(tx: Tx, tenantId: string, q: { status?: string[]; listingId?: string; classGroupId?: string; search?: string; take?: number } = {}) {
  const s = text(q.search, 60);
  return tx.reservation.findMany({
    where: {
      tenantId,
      moduleKey: ENROLLMENTS_MODULE,
      ...(q.status ? { status: { in: q.status } } : {}),
      ...(q.listingId ? { listingId: q.listingId } : {}),
      ...(q.classGroupId ? { enrollment: { classGroupId: q.classGroupId } } : {}),
      ...(s ? { OR: [{ reference: { contains: s, mode: "insensitive" } }, { enrollment: { student: { OR: [{ firstName: { contains: s, mode: "insensitive" } }, { lastName: { contains: s, mode: "insensitive" } }] } } }, { customer: { phone: { contains: s.replace(/\s/g, "") } } }] } : {}),
    },
    include: enrollmentInclude,
    orderBy: { createdAt: "desc" },
    take: q.take ?? 300,
  });
}

/** Échéances en retard (inscriptions en cours), pour les relances. */
export async function overdueInstallments(tx: Tx, tenantId: string, now = new Date()) {
  const today = await tenantToday(tx, tenantId, now);
  const rows = await tx.reservation.findMany({
    where: { tenantId, moduleKey: ENROLLMENTS_MODULE, status: { in: ["requested", "confirmed"] }, enrollment: { installments: { some: { dueDate: { lt: dateOnly(today) } } } } },
    include: enrollmentInclude,
  });
  return rows
    .map((r) => {
      const late = allocateInstallments(r.enrollment?.installments ?? [], r.payments, today).filter((i) => i.state === "overdue");
      return { reservation: r, late, amount: late.reduce((s, i) => s + i.amount - i.covered, 0) };
    })
    .filter((x) => x.late.length)
    .sort((a, b) => b.amount - a.amount);
}

// ============================================================================
// PRÉSENCES
// ============================================================================

async function enrolledStudentIds(tx: Tx, tenantId: string, classGroupId: string) {
  return new Set((await tx.enrollmentDetails.findMany({ where: { tenantId, classGroupId, active: true }, select: { studentId: true } })).map((e) => e.studentId));
}

/** Appel d'une séance : uniquement les élèves inscrits, jamais une date future ou hors période. */
export async function recordAttendance(tx: Tx, tenantId: string, input: { classGroupId: string; sessionDate: string; entries: { studentId: string; status: string; note?: string | null }[]; scope: AcademicScope }) {
  const c = await scopedClass(tx, tenantId, input.classGroupId, input.scope);
  if (!isIsoDate(input.sessionDate)) throw new EducationError("Date de séance invalide.");
  if (input.sessionDate > (await tenantToday(tx, tenantId))) throw new EducationError("On ne fait pas l'appel d'une séance à venir.");
  if (input.sessionDate < isoOf(c.startDate) || input.sessionDate > isoOf(c.endDate)) throw new EducationError("Cette date est hors de la période de la classe.");
  if (!input.entries.length || input.entries.length > 500) throw new EducationError("Liste d'appel vide.");
  const enrolled = await enrolledStudentIds(tx, tenantId, c.id);
  for (const e of input.entries) {
    if (!enrolled.has(e.studentId)) throw new EducationError("Un élève de la liste n'est pas inscrit dans cette classe.");
    if (!includes(ATTENDANCE_STATUSES, e.status)) throw new EducationError("Statut de présence inconnu.");
  }
  const sessionDate = dateOnly(input.sessionDate);
  for (const e of input.entries) {
    await tx.attendanceRecord.upsert({
      where: { classGroupId_studentId_sessionDate: { classGroupId: c.id, studentId: e.studentId, sessionDate } },
      create: { tenantId, classGroupId: c.id, studentId: e.studentId, sessionDate, status: e.status, note: opt(e.note, 200), recordedBy: input.scope.userId },
      update: { status: e.status, note: opt(e.note, 200), recordedBy: input.scope.userId, recordedAt: new Date() },
    });
  }
  return tx.attendanceRecord.findMany({ where: { tenantId, classGroupId: c.id, sessionDate } });
}

export async function getAttendanceSheet(tx: Tx, tenantId: string, classGroupId: string, sessionDate: string, scope: AcademicScope) {
  const c = await scopedClass(tx, tenantId, classGroupId, scope);
  if (!isIsoDate(sessionDate)) throw new EducationError("Date de séance invalide.");
  return tx.attendanceRecord.findMany({ where: { tenantId, classGroupId: c.id, sessionDate: dateOnly(sessionDate) } });
}

/** Absences non justifiées par élève (classe), avec le seuil d'alerte de l'établissement. */
export async function absenceSummary(tx: Tx, tenantId: string, classGroupId: string, scope: AcademicScope) {
  const c = await scopedClass(tx, tenantId, classGroupId, scope);
  const rows = await tx.attendanceRecord.groupBy({ by: ["studentId", "status"], where: { tenantId, classGroupId: c.id }, _count: { _all: true } });
  const out = new Map<string, Record<AttendanceStatus, number>>();
  for (const r of rows) {
    const m = out.get(r.studentId) ?? { present: 0, absent: 0, late: 0, excused: 0 };
    m[r.status as AttendanceStatus] = r._count._all;
    out.set(r.studentId, m);
  }
  return { threshold: (await getEducationSettings(tx, tenantId)).absenceAlert, byStudent: out };
}

// ============================================================================
// ÉVALUATIONS ET NOTES
// ============================================================================

export async function createAssessment(tx: Tx, tenantId: string, input: { classGroupId: string; title: string; date: string; coefficient?: number; maxScore?: number; scope: AcademicScope }) {
  const c = await scopedClass(tx, tenantId, input.classGroupId, input.scope);
  const title = text(input.title, 120);
  if (!title) throw new EducationError("Intitulé de l'évaluation requis.");
  if (!isIsoDate(input.date)) throw new EducationError("Date invalide.");
  const coefficient = input.coefficient ?? 1;
  if (!(typeof coefficient === "number" && coefficient > 0 && coefficient <= 20 && Math.round(coefficient * 100) === coefficient * 100)) throw new EducationError("Coefficient invalide (0,01 à 20).");
  const maxScore = input.maxScore ?? (await getEducationSettings(tx, tenantId)).gradeScale;
  if (!int(maxScore, 1, 1000)) throw new EducationError("Barème invalide.");
  return tx.assessment.create({ data: { tenantId, classGroupId: c.id, title, date: dateOnly(input.date), coefficient: new Prisma.Decimal(coefficient), maxScore, createdBy: input.scope.userId } });
}

async function scopedAssessment(tx: Tx, tenantId: string, assessmentId: string, scope: AcademicScope) {
  const a = await tx.assessment.findFirst({ where: { id: assessmentId, tenantId } });
  if (!a) throw new EducationError("Évaluation introuvable.");
  await scopedClass(tx, tenantId, a.classGroupId, scope).catch(() => {
    throw new EducationError("Évaluation introuvable.");
  });
  return a;
}

/**
 * Saisie des notes : élèves inscrits seulement, note entre 0 et le barème (vérifié aussi
 * en base). Une évaluation publiée ne se corrige plus que par la gestion académique.
 */
export async function recordGrades(tx: Tx, tenantId: string, input: { assessmentId: string; entries: { studentId: string; score?: number | null; absent?: boolean; comment?: string | null }[]; scope: AcademicScope }) {
  const a = await scopedAssessment(tx, tenantId, input.assessmentId, input.scope);
  if (a.publishedAt && !input.scope.all) throw new EducationError("Notes déjà publiées : seule l'administration peut les corriger.");
  const enrolled = await enrolledStudentIds(tx, tenantId, a.classGroupId);
  for (const e of input.entries) {
    if (!enrolled.has(e.studentId)) throw new EducationError("Un élève de la liste n'est pas inscrit dans cette classe.");
    if (!e.absent && !(typeof e.score === "number" && e.score >= 0 && e.score <= a.maxScore && Math.round(e.score * 100) === e.score * 100)) throw new EducationError(`Note invalide : entre 0 et ${a.maxScore}.`);
  }
  for (const e of input.entries) {
    const data = { score: e.absent ? null : new Prisma.Decimal(e.score!), absent: !!e.absent, comment: opt(e.comment, 300), recordedBy: input.scope.userId };
    await tx.grade.upsert({ where: { assessmentId_studentId: { assessmentId: a.id, studentId: e.studentId } }, create: { tenantId, assessmentId: a.id, studentId: e.studentId, ...data }, update: data });
  }
  return tx.grade.findMany({ where: { tenantId, assessmentId: a.id } });
}

/** Publication : les notes deviennent visibles des élèves et des familles. */
export async function publishAssessment(tx: Tx, tenantId: string, assessmentId: string, scope: AcademicScope) {
  const a = await scopedAssessment(tx, tenantId, assessmentId, scope);
  if (a.publishedAt) return a;
  if (!(await tx.grade.count({ where: { tenantId, assessmentId } }))) throw new EducationError("Aucune note saisie : rien à publier.");
  return tx.assessment.update({ where: { id: assessmentId }, data: { publishedAt: new Date() } });
}

export interface ReportLine {
  classGroupId: string;
  className: string;
  assessments: { id: string; title: string; date: string; coefficient: number; maxScore: number; score: number | null; absent: boolean; comment: string | null }[];
  /** Moyenne pondérée ramenée au barème de l'établissement ; null sans note. */
  average: number | null;
}

/** Bulletin d'un élève. `publishedOnly` : vue élève / famille (jamais de note non publiée). */
export async function studentReport(tx: Tx, tenantId: string, studentId: string, opts: { publishedOnly: boolean }): Promise<{ scale: number; lines: ReportLine[] }> {
  const scale = (await getEducationSettings(tx, tenantId)).gradeScale;
  const enrollments = await tx.enrollmentDetails.findMany({ where: { tenantId, studentId, classGroupId: { not: null }, reservation: { status: { in: ["requested", "confirmed", "completed"] } } }, include: { classGroup: true } });
  const lines: ReportLine[] = [];
  for (const e of enrollments) {
    const c = e.classGroup!;
    const assessments = await tx.assessment.findMany({ where: { tenantId, classGroupId: c.id, ...(opts.publishedOnly ? { publishedAt: { not: null } } : {}) }, include: { grades: { where: { studentId } } }, orderBy: { date: "asc" } });
    let weighted = 0;
    let weights = 0;
    const rows = assessments.map((a) => {
      const g = a.grades[0];
      const score = g?.score != null ? Number(g.score) : null;
      const coefficient = Number(a.coefficient);
      if (score != null) {
        weighted += (score / a.maxScore) * scale * coefficient;
        weights += coefficient;
      }
      return { id: a.id, title: a.title, date: isoOf(a.date), coefficient, maxScore: a.maxScore, score, absent: g?.absent ?? false, comment: g?.comment ?? null };
    });
    lines.push({ classGroupId: c.id, className: c.name, assessments: rows, average: weights ? Math.round((weighted / weights) * 100) / 100 : null });
  }
  return { scale, lines };
}

// ============================================================================
// ESPACES FAMILLE ET ÉLÈVE (jetons personnels)
// ============================================================================

/** Espace famille : SES enfants, leurs inscriptions, échéances, reçus, présences, notes publiées. */
export async function getFamilyPortal(tx: Tx, tenantId: string, accessToken: string) {
  const access = await tx.familyAccess.findFirst({ where: { accessToken, tenantId }, include: { customer: { select: { id: true, firstName: true, lastName: true } } } });
  if (!access) return null;
  const today = await tenantToday(tx, tenantId);
  const students = await tx.student.findMany({ where: { tenantId, guardianId: access.customerId }, orderBy: { firstName: "asc" } });
  const enrollments = await tx.reservation.findMany({ where: { tenantId, moduleKey: ENROLLMENTS_MODULE, customerId: access.customerId }, include: enrollmentInclude, orderBy: { createdAt: "desc" } });
  const children = [];
  for (const s of students) {
    const mine = enrollments.filter((r) => r.enrollment?.studentId === s.id);
    const attendance = await tx.attendanceRecord.groupBy({ by: ["status"], where: { tenantId, studentId: s.id }, _count: { _all: true } });
    children.push({
      student: { id: s.id, firstName: s.firstName, lastName: s.lastName, accessToken: s.accessToken },
      enrollments: mine.map((r) => ({
        id: r.id,
        reference: r.reference,
        status: r.status,
        program: r.listing?.title ?? "",
        className: r.enrollment?.classGroup?.name ?? null,
        totalAmount: r.totalAmount ?? 0,
        discountAmount: r.enrollment?.discountAmount ?? 0,
        installments: allocateInstallments(r.enrollment?.installments ?? [], r.payments, today),
        receipts: r.payments.filter((p) => !p.voidedAt).map((p) => ({ receiptNumber: p.receiptNumber, amount: p.amount, method: p.method, paidAt: p.paidAt })),
      })),
      attendance: Object.fromEntries(attendance.map((a) => [a.status, a._count._all])) as Partial<Record<AttendanceStatus, number>>,
      report: await studentReport(tx, tenantId, s.id, { publishedOnly: true }),
    });
  }
  return { guardian: access.customer, children };
}

/** Espace élève : ses classes, emploi du temps, présences et notes publiées (pas de finances). */
export async function getStudentPortal(tx: Tx, tenantId: string, accessToken: string) {
  const s = await tx.student.findFirst({ where: { accessToken, tenantId } });
  if (!s) return null;
  const enrollments = await tx.enrollmentDetails.findMany({ where: { tenantId, studentId: s.id, active: true }, include: { classGroup: { include: { teacher: { select: { fullName: true } } } }, reservation: { select: { listing: { select: { title: true } } } } } });
  const recent = await tx.attendanceRecord.findMany({ where: { tenantId, studentId: s.id }, orderBy: { sessionDate: "desc" }, take: 30 });
  return {
    student: { id: s.id, firstName: s.firstName, lastName: s.lastName },
    classes: enrollments.map((e) => ({ program: e.reservation.listing?.title ?? "", className: e.classGroup?.name ?? null, room: e.classGroup?.room ?? null, teacher: e.classGroup?.teacher?.fullName ?? null, schedule: (e.classGroup?.schedule ?? []) as unknown as (MinuteRange & { weekday: number })[] })),
    attendance: recent.map((a) => ({ date: isoOf(a.sessionDate), status: a.status })),
    report: await studentReport(tx, tenantId, s.id, { publishedOnly: true }),
  };
}

// ============================================================================
// TABLEAU DE BORD
// ============================================================================

export async function educationOverview(tx: Tx, tenantId: string, now = new Date()) {
  const today = await tenantToday(tx, tenantId, now);
  const monthStart = dateOnly(`${today.slice(0, 7)}-01`);
  const [active, pending, classes, collected, absentToday, overdue] = await Promise.all([
    tx.enrollmentDetails.count({ where: { tenantId, active: true, reservation: { status: "confirmed" } } }),
    tx.reservation.count({ where: { tenantId, moduleKey: ENROLLMENTS_MODULE, status: "requested" } }),
    listClasses(tx, tenantId, { userId: null, all: true }, { activeOnly: true }),
    tx.reservationPayment.aggregate({ where: { tenantId, voidedAt: null, paidAt: { gte: monthStart }, reservation: { moduleKey: ENROLLMENTS_MODULE } }, _sum: { amount: true } }),
    tx.attendanceRecord.count({ where: { tenantId, sessionDate: dateOnly(today), status: "absent" } }),
    overdueInstallments(tx, tenantId, now),
  ]);
  const capacity = classes.reduce((s, c) => s + c.capacity, 0);
  return {
    today,
    activeEnrollments: active,
    pendingRequests: pending,
    classes: classes.length,
    fillRate: capacity ? Math.round((classes.reduce((s, c) => s + c.enrolled, 0) / capacity) * 100) : 0,
    collectedThisMonth: collected._sum.amount ?? 0,
    absentToday,
    overdueCount: overdue.length,
    overdueAmount: overdue.reduce((s, o) => s + o.amount, 0),
    weekAhead: addDays(today, 7),
  };
}
