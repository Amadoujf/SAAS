import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { isSameOriginRequest } from "@/lib/domains/same-origin";
import {
  assign,
  complete,
  deskEnroll,
  enrollmentPayment,
  newAssessment,
  publishGrades,
  removeProgram,
  renewFamilyLink,
  renewStudentLink,
  saveAttendance,
  saveClass,
  saveEducationHome,
  saveGrades,
  savePlan,
  saveProgram,
  saveSettings,
  saveStudent,
  setProgramPublished,
  voidPayment,
  withdraw,
} from "@/lib/education/pipeline";

const id = z.string().uuid();
const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("save_program"), listingId: id.nullable(), program: z.unknown() }),
  z.object({ action: z.literal("publish"), listingId: id, publish: z.boolean() }),
  z.object({ action: z.literal("delete_program"), listingId: id }),
  z.object({ action: z.literal("save_class"), classGroupId: id.nullable(), classGroup: z.unknown() }),
  z.object({ action: z.literal("attendance"), attendance: z.unknown() }),
  z.object({ action: z.literal("new_assessment"), assessment: z.unknown() }),
  z.object({ action: z.literal("grades"), grades: z.unknown() }),
  z.object({ action: z.literal("publish_grades"), assessmentId: id }),
  z.object({ action: z.literal("enroll"), enrollment: z.unknown() }),
  z.object({ action: z.literal("assign_class"), reservationId: id, classGroupId: id }),
  z.object({ action: z.literal("plan"), reservationId: id, plan: z.unknown() }),
  z.object({ action: z.literal("withdraw"), reservationId: id, reason: z.string().max(300) }),
  z.object({ action: z.literal("complete"), reservationId: id }),
  z.object({ action: z.literal("payment"), payment: z.unknown() }),
  z.object({ action: z.literal("void_payment"), paymentId: id, reason: z.string().max(300) }),
  z.object({ action: z.literal("save_student"), studentId: id, student: z.unknown() }),
  z.object({ action: z.literal("renew_family_link"), customerId: id }),
  z.object({ action: z.literal("renew_student_link"), studentId: id }),
  z.object({ action: z.literal("settings"), settings: z.unknown() }),
  z.object({ action: z.literal("save_home"), home: z.unknown() }),
]);

/** Actions de l'établissement — permission (et portée enseignant) vérifiées par action dans le pipeline. */
export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Origine refusée." }, { status: 403 });
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  const b = parsed.data;
  const result =
    b.action === "save_program" ? await saveProgram(b.listingId, b.program)
    : b.action === "publish" ? await setProgramPublished(b.listingId, b.publish)
    : b.action === "delete_program" ? await removeProgram(b.listingId)
    : b.action === "save_class" ? await saveClass(b.classGroupId, b.classGroup)
    : b.action === "attendance" ? await saveAttendance(b.attendance)
    : b.action === "new_assessment" ? await newAssessment(b.assessment)
    : b.action === "grades" ? await saveGrades(b.grades)
    : b.action === "publish_grades" ? await publishGrades(b.assessmentId)
    : b.action === "enroll" ? await deskEnroll(b.enrollment)
    : b.action === "assign_class" ? await assign(b.reservationId, b.classGroupId)
    : b.action === "plan" ? await savePlan(b.reservationId, b.plan)
    : b.action === "withdraw" ? await withdraw(b.reservationId, b.reason)
    : b.action === "complete" ? await complete(b.reservationId)
    : b.action === "payment" ? await enrollmentPayment(b.payment)
    : b.action === "void_payment" ? await voidPayment(b.paymentId, b.reason)
    : b.action === "save_student" ? await saveStudent(b.studentId, b.student)
    : b.action === "renew_family_link" ? await renewFamilyLink(b.customerId)
    : b.action === "renew_student_link" ? await renewStudentLink(b.studentId)
    : b.action === "settings" ? await saveSettings(b.settings)
    : await saveEducationHome(b.home);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ data: result.data });
}
