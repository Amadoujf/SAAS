import "server-only";
import { z } from "zod";
import { withTenant, enrollStudent, getFamilyPortal, getStudentPortal, isIsoDate, EducationError, ReservationUnavailableError } from "@yamacommerce/database";
import { RedisRateLimiter, redisConnection } from "@yamacommerce/queue";
import { dispatchEducationNotifications, planEducationNotifications } from "./notify";

const limiter = new RedisRateLimiter(redisConnection);
const TOKEN_RE = /^[0-9a-f-]{36}$/;

export class EducationPublicError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
  }
}

export const enrollmentSchema = z.object({
  listingId: z.string().uuid(),
  classGroupId: z.string().uuid().optional().nullable(),
  relation: z.enum(["parent", "guardian", "self"]),
  guardianFirstName: z.string().trim().min(1, "Indiquez votre prénom.").max(80),
  guardianLastName: z.string().trim().max(80).optional().default(""),
  phone: z.string().trim().min(6, "Indiquez votre téléphone.").max(20),
  email: z.string().trim().email("E-mail invalide.").max(160).optional().or(z.literal("")).default(""),
  studentFirstName: z.string().trim().max(80).optional().default(""),
  studentLastName: z.string().trim().max(80).optional().default(""),
  birthDate: z.string().refine((v) => v === "" || isIsoDate(v), "Date de naissance invalide.").optional().default(""),
  note: z.string().trim().max(600).optional().default(""),
  consent: z.literal(true, { errorMap: () => ({ message: "Acceptez d'être recontacté par l'établissement." }) }),
});

/**
 * Demande d'inscription en ligne : formation publiée de CET établissement, montant calculé
 * par le serveur (frais + scolarité de la fiche), jamais de remise ni de prix venus du
 * navigateur. Rien n'est payé en ligne : la famille reçoit son espace personnel.
 */
export async function submitEnrollment(tenantId: string, clientKey: string, raw: unknown) {
  const parsed = enrollmentSchema.safeParse(raw);
  if (!parsed.success) throw new EducationPublicError(parsed.error.issues[0]?.message ?? "Formulaire incomplet.");
  const i = parsed.data;
  const self = i.relation === "self";
  const studentFirstName = self ? i.guardianFirstName : i.studentFirstName;
  const studentLastName = self ? i.guardianLastName : i.studentLastName;
  if (!studentFirstName || !studentLastName) throw new EducationPublicError("Indiquez le prénom et le nom de l'élève.");
  const rate = await limiter.consume(`edu-enroll:${tenantId}:${clientKey}`, 5, 30 * 60_000);
  if (!rate.allowed) throw new EducationPublicError("Trop de demandes envoyées. Réessayez plus tard ou appelez l'établissement.", 429);
  try {
    const r = await withTenant(tenantId, async (tx) => {
      const e = await enrollStudent(tx, tenantId, {
        listingId: i.listingId,
        classGroupId: i.classGroupId ?? null,
        guardian: { firstName: i.guardianFirstName, lastName: i.guardianLastName || null, phone: i.phone, email: i.email || null },
        student: { firstName: studentFirstName, lastName: studentLastName, birthDate: i.birthDate || null },
        relation: i.relation,
        note: i.note || null,
        channel: "web",
        actor: { userId: null, type: "customer" },
      });
      const access = await tx.familyAccess.findFirstOrThrow({ where: { tenantId, customerId: e.customerId } });
      const planned = await planEducationNotifications(tx, tenantId, e.id, "enrollment_request_received");
      return { reference: e.reference, familyToken: access.accessToken, planned };
    });
    await dispatchEducationNotifications(tenantId, r.planned);
    return { reference: r.reference, familyToken: r.familyToken };
  } catch (error) {
    if (error instanceof EducationError || error instanceof ReservationUnavailableError) throw new EducationPublicError(error.message, 409);
    throw error;
  }
}

export function getFamilyForGuest(tenantId: string, token: string) {
  if (!TOKEN_RE.test(token)) return Promise.resolve(null);
  return withTenant(tenantId, (tx) => getFamilyPortal(tx, tenantId, token));
}

export function getStudentForGuest(tenantId: string, token: string) {
  if (!TOKEN_RE.test(token)) return Promise.resolve(null);
  return withTenant(tenantId, (tx) => getStudentPortal(tx, tenantId, token));
}
