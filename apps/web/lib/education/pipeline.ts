import "server-only";
import { z } from "zod";
import {
  withTenant,
  getStorefrontCustomization,
  saveStorefrontContent,
  updateTenantBranding,
  assignClass,
  completeEnrollment,
  createAssessment,
  createClass,
  createProgram,
  deleteListing,
  enrollStudent,
  publishAssessment,
  recordAttendance,
  recordEnrollmentPayment,
  recordGrades,
  rotateFamilyToken,
  rotateStudentToken,
  setEnrollmentPlan,
  setListingStatus,
  setMediaAssetPublic,
  updateClass,
  updateEducationSettings,
  updateProgram,
  updateStudent,
  voidEnrollmentPayment,
  withdrawEnrollment,
  ATTENDANCE_STATUSES,
  EducationError,
  GUARDIAN_RELATIONS,
  InvalidListingInputError,
  InvalidListingTransitionError,
  InvalidReservationTransitionError,
  MANUAL_PAYMENT_METHODS,
  PROGRAM_AUDIENCES,
  PROGRAM_CATEGORIES,
  PROGRAM_FORMATS,
  ReservationNotFoundError,
  ReservationUnavailableError,
  TravelError,
} from "@yamacommerce/database";
import type { Permission } from "@yamacommerce/auth";
import type { Prisma } from "@yamacommerce/database";
import { parseHomeContent } from "@/lib/storefront/home-content";
import { getCurrentTenantMembership } from "@/lib/current-tenant";
import { requireTenantPermission } from "@/lib/tenant-permissions";
import { checkImage } from "@/lib/media/image-refs";
import { getTenantModuleKeys, isEducation } from "@/lib/modules/tenant-modules";
import type { PlannedNotification } from "@/lib/orders/notify";
import { scopeOf } from "./guard";
import { dispatchEducationNotifications, planEducationNotifications } from "./notify";

/**
 * Actions de l'établissement (tableau de bord). Chaque action revérifie côté serveur la
 * permission précise du membre ; un enseignant n'agit que sur SES classes (portée
 * vérifiée dans le registre) ; la RLS isole l'établissement ; montants, capacités,
 * barèmes et échéances sont calculés et contrôlés par le registre et la base.
 */

export type ActionResult<T = unknown> = { ok: true; data: T } | { ok: false; status: number; error: string };

async function context(permission: Permission) {
  const membership = await getCurrentTenantMembership();
  if (!membership) return null;
  if (!isEducation(await getTenantModuleKeys(membership.tenantId))) return null;
  const actor = await requireTenantPermission(membership.tenantId, permission);
  if (!actor) return null;
  return { tenantId: membership.tenantId, userId: actor.userId, scope: scopeOf(membership.permissions, actor), actorType: (membership.roleName === "OWNER" ? "owner" : "employee") as "owner" | "employee" };
}

const DENIED = { ok: false as const, status: 403, error: "Action non autorisée." };

function toError(error: unknown): { ok: false; status: number; error: string } {
  if (
    error instanceof EducationError ||
    error instanceof TravelError ||
    error instanceof InvalidListingInputError ||
    error instanceof InvalidListingTransitionError ||
    error instanceof InvalidReservationTransitionError ||
    error instanceof ReservationNotFoundError ||
    error instanceof ReservationUnavailableError
  )
    return { ok: false, status: 409, error: error.message };
  if (error instanceof Error && error.message.startsWith("Image")) return { ok: false, status: 400, error: error.message };
  // Contraintes de la base (barème, inscription active unique…) : message générique, jamais de détail SQL.
  // eslint-disable-next-line no-console
  console.error("[education]", error);
  return { ok: false, status: 400, error: "Action impossible pour le moment." };
}

const firstIssue = (error: z.ZodError) => {
  const issue = error.issues[0];
  return issue ? `${issue.path.join(" › ") || "Formulaire"} : ${issue.message}` : "Données invalides.";
};
const bad = (error: z.ZodError) => Promise.resolve({ ok: false as const, status: 400, error: firstIssue(error) });

type Tx = Parameters<Parameters<typeof withTenant>[1]>[0];
type Ctx = NonNullable<Awaited<ReturnType<typeof context>>>;
const run = async <T>(permission: Permission, fn: (ctx: Ctx, tx: Tx) => Promise<T>): Promise<ActionResult<T>> => {
  const ctx = await context(permission);
  if (!ctx) return DENIED;
  try {
    return { ok: true, data: await withTenant(ctx.tenantId, (tx) => fn(ctx, tx)) };
  } catch (error) {
    return toError(error);
  }
};
const actorOf = (ctx: Ctx) => ({ userId: ctx.userId, type: ctx.actorType });

const runNotified = async <T>(permission: Permission, fn: (ctx: Ctx, tx: Tx) => Promise<{ data: T; planned: PlannedNotification[] }>): Promise<ActionResult<T>> => {
  const r = await run(permission, fn);
  if (!r.ok) return r;
  const ctx = await context(permission);
  if (ctx) await dispatchEducationNotifications(ctx.tenantId, r.data.planned);
  return { ok: true, data: r.data.data };
};

async function ownImages(tx: Tx, tenantId: string, urls: string[]) {
  const ids = new Set<string>();
  for (const url of urls) {
    const problem = checkImage(url, ids);
    if (problem) throw new Error(problem.startsWith("Image") ? problem : `Image : ${problem}`);
  }
  if (ids.size && (await tx.mediaAsset.count({ where: { tenantId, id: { in: [...ids] }, status: "READY" } })) !== ids.size) throw new Error("Image introuvable dans votre médiathèque.");
  for (const id of ids) await setMediaAssetPublic(tx, tenantId, id, true);
}

const text = (max: number) => z.string().trim().max(max);
const optionalText = (max: number) => z.string().trim().max(max).nullable().optional().transform((v) => (v ? v : null));
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide.");
const customerSchema = z.object({ firstName: text(80).min(1, "Prénom requis."), lastName: optionalText(80), phone: text(30).min(6, "Téléphone requis."), email: z.string().trim().email("E-mail invalide.").max(160).nullable().optional().or(z.literal("")).transform((v) => v || null) });
const slotSchema = z.object({ weekday: z.number().int().min(0).max(6), startMinute: z.number().int().min(0).max(1439), endMinute: z.number().int().min(1).max(1440) });
const installmentSchema = z.object({ label: text(60).min(1), dueDate: isoDate, amount: z.number().int().min(1) });

// --- Formations -----------------------------------------------------------------------

export const programSchema = z.object({
  title: text(120).min(1, "Intitulé requis."),
  summary: optionalText(300),
  description: optionalText(4000),
  tuition: z.number().int().min(0).max(100_000_000).nullable(),
  registrationFee: z.number().int().min(0).max(10_000_000).default(0),
  defaultInstallments: z.number().int().min(1).max(12).default(1),
  category: z.enum(PROGRAM_CATEGORIES),
  level: optionalText(40),
  format: z.enum(PROGRAM_FORMATS),
  durationLabel: optionalText(40),
  audience: z.enum(PROGRAM_AUDIENCES),
  featured: z.boolean().default(false),
  media: z.array(z.object({ url: z.string().max(300), alt: z.string().trim().max(160).optional(), demo: z.boolean().optional() })).max(12).default([]),
  publish: z.boolean().optional(),
});

export const saveProgram = (listingId: string | null, raw: unknown) => {
  const p = programSchema.safeParse(raw);
  if (!p.success) return bad(p.error);
  const { publish, media, ...input } = p.data;
  return run(listingId ? "listings.edit" : "listings.create", async (ctx, tx) => {
    await ownImages(tx, ctx.tenantId, media.map((m) => m.url));
    const cleanMedia = media.map((m) => ({ url: m.url, alt: m.alt ?? "", ...(m.demo && m.url.startsWith("/demo-templates/") ? { demo: true } : {}) }));
    const prog = listingId ? await updateProgram(tx, ctx.tenantId, listingId, { ...input, media: cleanMedia }, ctx.userId) : await createProgram(tx, ctx.tenantId, { ...input, media: cleanMedia }, ctx.userId);
    if (publish !== undefined) {
      const to = publish ? "published" : "draft";
      if (prog.status !== to) await setListingStatus(tx, ctx.tenantId, prog.id, to, ctx.userId);
    }
    return { id: prog.id };
  });
};

export const setProgramPublished = (listingId: string, publish: boolean) =>
  run("listings.publish", (ctx, tx) => setListingStatus(tx, ctx.tenantId, listingId, publish ? "published" : "draft", ctx.userId).then(() => null));

export const removeProgram = (listingId: string) =>
  run("listings.delete", async (ctx, tx) => {
    if (await tx.enrollmentDetails.count({ where: { tenantId: ctx.tenantId, listingId, active: true } })) throw new EducationError("Des élèves sont inscrits à cette formation : clôturez ou annulez leurs inscriptions d'abord.");
    await deleteListing(tx, ctx.tenantId, listingId, ctx.userId);
    return null;
  });

// --- Classes --------------------------------------------------------------------------

const classSchema = z.object({
  listingId: z.string().uuid(),
  name: text(80).min(1, "Nom requis."),
  teacherUserId: z.string().uuid().nullable().optional(),
  room: optionalText(40),
  schedule: z.array(slotSchema).max(30).default([]),
  startDate: isoDate,
  endDate: isoDate,
  capacity: z.number().int().min(1).max(500),
  isActive: z.boolean().optional(),
});

export const saveClass = (classGroupId: string | null, raw: unknown) => {
  const p = classSchema.safeParse(raw);
  if (!p.success) return bad(p.error);
  return run("academics.manage", async (ctx, tx) => {
    if (classGroupId) {
      const { listingId: _ignored, ...patch } = p.data;
      return { id: (await updateClass(tx, ctx.tenantId, classGroupId, patch)).id };
    }
    return { id: (await createClass(tx, ctx.tenantId, p.data)).id };
  });
};

// --- Présences et notes (enseignant : ses classes uniquement) ------------------------

const attendanceSchema = z.object({ classGroupId: z.string().uuid(), sessionDate: isoDate, entries: z.array(z.object({ studentId: z.string().uuid(), status: z.enum(ATTENDANCE_STATUSES), note: optionalText(200) })).min(1).max(500) });

export const saveAttendance = (raw: unknown) => {
  const p = attendanceSchema.safeParse(raw);
  if (!p.success) return bad(p.error);
  return run("academics.record", async (ctx, tx) => ({ count: (await recordAttendance(tx, ctx.tenantId, { ...p.data, scope: ctx.scope })).length }));
};

const assessmentSchema = z.object({ classGroupId: z.string().uuid(), title: text(120).min(1, "Intitulé requis."), date: isoDate, coefficient: z.number().min(0.01).max(20).default(1), maxScore: z.number().int().min(1).max(1000).optional() });

export const newAssessment = (raw: unknown) => {
  const p = assessmentSchema.safeParse(raw);
  if (!p.success) return bad(p.error);
  return run("academics.record", async (ctx, tx) => ({ id: (await createAssessment(tx, ctx.tenantId, { ...p.data, scope: ctx.scope })).id }));
};

const gradesSchema = z.object({ assessmentId: z.string().uuid(), entries: z.array(z.object({ studentId: z.string().uuid(), score: z.number().min(0).max(1000).nullable().optional(), absent: z.boolean().default(false), comment: optionalText(300) })).min(1).max(500) });

export const saveGrades = (raw: unknown) => {
  const p = gradesSchema.safeParse(raw);
  if (!p.success) return bad(p.error);
  return run("academics.record", async (ctx, tx) => ({ count: (await recordGrades(tx, ctx.tenantId, { ...p.data, scope: ctx.scope })).length }));
};

/** Publication : les notes deviennent visibles ; chaque famille concernée est prévenue (journal honnête). */
export const publishGrades = (assessmentId: string) =>
  runNotified("academics.record", async (ctx, tx) => {
    const a = await publishAssessment(tx, ctx.tenantId, assessmentId, ctx.scope);
    const students = (await tx.grade.findMany({ where: { tenantId: ctx.tenantId, assessmentId }, select: { studentId: true } })).map((g) => g.studentId);
    const enrollments = await tx.enrollmentDetails.findMany({ where: { tenantId: ctx.tenantId, classGroupId: a.classGroupId, studentId: { in: students }, active: true }, select: { reservationId: true } });
    const planned: PlannedNotification[] = [];
    for (const e of enrollments) planned.push(...(await planEducationNotifications(tx, ctx.tenantId, e.reservationId, "grades_published")));
    return { data: null, planned };
  });

// --- Inscriptions ------------------------------------------------------------------------

const enrollSchema = z.object({
  listingId: z.string().uuid(),
  classGroupId: z.string().uuid().nullable().optional(),
  guardianId: z.string().uuid().nullable().optional(),
  guardian: customerSchema.nullable().optional(),
  studentId: z.string().uuid().nullable().optional(),
  student: z.object({ firstName: text(80).min(1, "Prénom de l'élève requis."), lastName: text(80).min(1, "Nom de l'élève requis."), birthDate: isoDate.nullable().optional().or(z.literal("")).transform((v) => v || null) }).nullable().optional(),
  relation: z.enum(GUARDIAN_RELATIONS).default("parent"),
  discountAmount: z.number().int().min(0).default(0),
  discountReason: optionalText(200),
  installments: z.array(installmentSchema).max(24).nullable().optional(),
  note: optionalText(600),
});

export const deskEnroll = (raw: unknown) => {
  const p = enrollSchema.safeParse(raw);
  if (!p.success) return bad(p.error);
  if (!p.data.guardianId && !p.data.guardian) return Promise.resolve({ ok: false as const, status: 400, error: "Choisissez ou saisissez le responsable." });
  return runNotified("reservations.update_status", async (ctx, tx) => {
    const e = await enrollStudent(tx, ctx.tenantId, { ...p.data, guardian: p.data.guardian ?? null, student: p.data.student ?? null, installments: p.data.installments ?? null, channel: "dashboard", actor: actorOf(ctx) });
    return { data: { id: e.id }, planned: e.status === "confirmed" ? await planEducationNotifications(tx, ctx.tenantId, e.id, "enrollment_confirmed") : [] };
  });
};

export const assign = (reservationId: string, classGroupId: string) =>
  runNotified("reservations.update_status", async (ctx, tx) => {
    const before = await tx.reservation.findFirst({ where: { id: reservationId, tenantId: ctx.tenantId }, select: { status: true } });
    const e = await assignClass(tx, ctx.tenantId, reservationId, classGroupId, actorOf(ctx));
    return { data: null, planned: before?.status === "requested" && e.status === "confirmed" ? await planEducationNotifications(tx, ctx.tenantId, reservationId, "enrollment_confirmed") : [] };
  });

const planSchema = z.object({ discountAmount: z.number().int().min(0).optional(), discountReason: optionalText(200), installments: z.array(installmentSchema).max(24).nullable().optional() });

export const savePlan = (reservationId: string, raw: unknown) => {
  const p = planSchema.safeParse(raw);
  if (!p.success) return bad(p.error);
  return run("reservations.update_status", (ctx, tx) => setEnrollmentPlan(tx, ctx.tenantId, reservationId, p.data).then(() => null));
};

export const withdraw = (reservationId: string, reason: string) => run("reservations.cancel", (ctx, tx) => withdrawEnrollment(tx, ctx.tenantId, reservationId, actorOf(ctx), reason).then(() => null));
export const complete = (reservationId: string) => run("reservations.update_status", (ctx, tx) => completeEnrollment(tx, ctx.tenantId, reservationId, actorOf(ctx)).then(() => null));

const paymentSchema = z.object({ reservationId: z.string().uuid(), amount: z.number().int().min(1), method: z.enum(MANUAL_PAYMENT_METHODS), reference: optionalText(80) });

export const enrollmentPayment = (raw: unknown) => {
  const p = paymentSchema.safeParse(raw);
  if (!p.success) return bad(p.error);
  return runNotified("reservation_payments.record", async (ctx, tx) => {
    const pay = await recordEnrollmentPayment(tx, ctx.tenantId, { ...p.data, actorUserId: ctx.userId });
    return { data: { receiptNumber: pay.receiptNumber }, planned: await planEducationNotifications(tx, ctx.tenantId, p.data.reservationId, "enrollment_payment_received") };
  });
};

export const voidPayment = (paymentId: string, reason: string) => run("payments.refund", (ctx, tx) => voidEnrollmentPayment(tx, ctx.tenantId, paymentId, reason).then(() => null));

// --- Élèves, liens personnels, réglages ------------------------------------------------

const studentSchema = z.object({ firstName: text(80).min(1), lastName: text(80).min(1), birthDate: isoDate.nullable().optional().or(z.literal("")).transform((v) => v || null), notes: optionalText(500) });

export const saveStudent = (studentId: string, raw: unknown) => {
  const p = studentSchema.safeParse(raw);
  if (!p.success) return bad(p.error);
  return run("customers.edit", (ctx, tx) => updateStudent(tx, ctx.tenantId, studentId, p.data).then(() => null));
};

export const renewFamilyLink = (customerId: string) => run("customers.edit", (ctx, tx) => rotateFamilyToken(tx, ctx.tenantId, customerId).then(() => null));
export const renewStudentLink = (studentId: string) => run("customers.edit", (ctx, tx) => rotateStudentToken(tx, ctx.tenantId, studentId).then(() => null));

const settingsSchema = z.object({ academicYear: text(20).optional(), gradeScale: z.union([z.literal(10), z.literal(20), z.literal(100)]).optional(), absenceAlert: z.number().int().min(1).max(100).optional(), onlineEnrollment: z.boolean().optional() });

export const saveSettings = (raw: unknown) => {
  const p = settingsSchema.safeParse(raw);
  if (!p.success) return bad(p.error);
  return run("academics.manage", (ctx, tx) => updateEducationSettings(tx, ctx.tenantId, p.data).then(() => null));
};

// --- Vitrine (« Mon site ») ------------------------------------------------------------

export const saveEducationHome = (raw: unknown) => {
  const p = z
    .object({
      coverUrl: z.string().trim().max(300).nullable(),
      eyebrow: z.string().trim().max(60),
      title: z.string().trim().min(1, "Donnez un titre.").max(80),
      subtitle: z.string().trim().max(220),
      contactPhone: optionalText(30),
      contactWhatsapp: optionalText(30),
      contactAddress: optionalText(160),
    })
    .safeParse(raw);
  if (!p.success) return bad(p.error);
  const i = p.data;
  return run("settings.branding", async (ctx, tx) => {
    if (i.coverUrl) await ownImages(tx, ctx.tenantId, [i.coverUrl]);
    const current = await getStorefrontCustomization(tx, ctx.tenantId);
    const content = parseHomeContent(current.content, current.tenantName);
    const prev = content.hero.slides[0];
    // Une illustration de démonstration garde sa mention tant qu'on ne la remplace pas.
    const keepDemo = !!prev?.demo && prev.imageUrl === i.coverUrl;
    content.hero.slides = [
      { id: "preau", imageUrl: i.coverUrl, mobileImageUrl: keepDemo ? prev!.mobileImageUrl : null, imageAlt: i.title, demo: keepDemo, productId: null, eyebrow: i.eyebrow, title: i.title, subtitle: i.subtitle, ctaLabel: "Voir les formations", ctaHref: "/formations", theme: "light" },
    ];
    await saveStorefrontContent(tx, ctx.tenantId, content as unknown as Prisma.InputJsonValue, ctx.userId);
    await updateTenantBranding(tx, ctx.tenantId, { contactPhone: i.contactPhone, contactWhatsapp: i.contactWhatsapp, contactAddress: i.contactAddress });
    return null;
  });
};
