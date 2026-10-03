import "server-only";
import { z } from "zod";
import {
  withTenant,
  advanceCourierJob,
  completeCourierReturn,
  createCourierJob,
  deliverCourierJob,
  failCourierJob,
  getCourierSpace,
  getCourierTracking,
  normalizeSenegalPhone,
  quoteCourierFee,
  CourierError,
} from "@yamacommerce/database";
import { RedisRateLimiter, redisConnection } from "@yamacommerce/queue";
import { dispatchCourierNotifications, planCourierNotifications, type CourierEvent } from "./notify";

const limiter = new RedisRateLimiter(redisConnection);
const TOKEN_RE = /^[0-9a-f-]{36}$/;

export class CourierPublicError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
  }
}

const wrap = async <T>(fn: () => Promise<T>): Promise<T> => {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof CourierError) throw new CourierPublicError(error.message, 409);
    throw error;
  }
};

/** Estimation publique : tarif calculé par le serveur (zone + format). */
export async function publicQuote(tenantId: string, raw: unknown) {
  const p = z.object({ zoneId: z.string().uuid(), size: z.enum(["small", "medium", "large"]) }).safeParse(raw);
  if (!p.success) throw new CourierPublicError("Choisissez la zone et le format.");
  const q = await wrap(() => withTenant(tenantId, (tx) => quoteCourierFee(tx, tenantId, p.data)));
  return { fee: q.fee };
}

export const requestSchema = z.object({
  senderName: z.string().trim().min(1, "Indiquez votre nom ou celui de votre boutique.").max(80),
  senderPhone: z.string().trim().min(6, "Indiquez votre téléphone.").max(20),
  senderEmail: z.string().trim().email("E-mail invalide.").max(160).optional().or(z.literal("")).default(""),
  pickupAddress: z.string().trim().min(3, "Indiquez l'adresse de retrait.").max(200),
  pickupCommune: z.string().trim().max(60).optional().default(""),
  recipientName: z.string().trim().min(1, "Indiquez le nom du destinataire.").max(80),
  recipientPhone: z.string().trim().min(6, "Indiquez le téléphone du destinataire.").max(20),
  dropoffAddress: z.string().trim().min(3, "Indiquez l'adresse de livraison.").max(200),
  zoneId: z.string().uuid("Choisissez la zone de livraison."),
  size: z.enum(["small", "medium", "large"]),
  packageDescription: z.string().trim().min(2, "Décrivez le colis.").max(160),
  codAmount: z.number().int().min(0).max(10_000_000).default(0),
  feePaidBy: z.enum(["sender", "recipient"]),
  instructions: z.string().trim().max(300).optional().default(""),
  scheduledDate: z.string().max(10).optional().default(""),
  consent: z.literal(true, { errorMap: () => ({ message: "Confirmez que le colis ne contient rien d'interdit ni de dangereux." }) }),
});

/** Demande de course en ligne : l'expéditeur reçoit son lien de suivi ; aucun paiement en ligne. */
export async function submitCourierRequest(tenantId: string, clientKey: string, raw: unknown) {
  const parsed = requestSchema.safeParse(raw);
  if (!parsed.success) throw new CourierPublicError(parsed.error.issues[0]?.message ?? "Formulaire incomplet.");
  const i = parsed.data;
  const rate = await limiter.consume(`courier-req:${tenantId}:${clientKey}`, 8, 30 * 60_000);
  if (!rate.allowed) throw new CourierPublicError("Trop de demandes envoyées. Réessayez plus tard ou appelez-nous.", 429);
  const r = await wrap(() =>
    withTenant(tenantId, async (tx) => {
      const job = await createCourierJob(tx, tenantId, {
        sender: { firstName: i.senderName, phone: i.senderPhone, email: i.senderEmail || null },
        pickupName: i.senderName,
        pickupPhone: i.senderPhone,
        pickupAddress: i.pickupAddress,
        pickupCommune: i.pickupCommune || null,
        recipientName: i.recipientName,
        recipientPhone: i.recipientPhone,
        dropoffAddress: i.dropoffAddress,
        zoneId: i.zoneId,
        size: i.size,
        packageDescription: i.packageDescription,
        codAmount: i.codAmount,
        feePaidBy: i.feePaidBy,
        instructions: i.instructions || null,
        scheduledDate: i.scheduledDate || null,
        channel: "web",
        actor: { type: "customer" },
      });
      return { senderToken: job.senderToken, reference: job.reference, planned: await planCourierNotifications(tx, tenantId, job.id, "courier_job_created") };
    }),
  );
  await dispatchCourierNotifications(tenantId, r.planned);
  return { senderToken: r.senderToken, reference: r.reference };
}

/** Retrouver un suivi : référence + téléphone (expéditeur ou destinataire), jamais l'un sans l'autre. */
export async function lookupTracking(tenantId: string, clientKey: string, raw: unknown) {
  const p = z.object({ reference: z.string().trim().max(20), phone: z.string().trim().max(20) }).safeParse(raw);
  if (!p.success) throw new CourierPublicError("Référence et téléphone requis.");
  const rate = await limiter.consume(`courier-lookup:${tenantId}:${clientKey}`, 10, 15 * 60_000);
  if (!rate.allowed) throw new CourierPublicError("Trop de recherches. Réessayez dans quelques minutes.", 429);
  const phone = normalizeSenegalPhone(p.data.phone);
  const reference = p.data.reference.toUpperCase().replace(/\s/g, "");
  if (!phone) throw new CourierPublicError("Téléphone invalide.");
  const j = await withTenant(tenantId, (tx) => tx.courierJob.findFirst({ where: { tenantId, reference }, include: { sender: { select: { phone: true } } } }));
  if (!j) throw new CourierPublicError("Aucune course ne correspond.", 404);
  if (j.recipientPhone === phone) return { token: j.recipientToken };
  if (j.pickupPhone === phone || j.sender.phone === phone) return { token: j.senderToken };
  throw new CourierPublicError("Aucune course ne correspond.", 404);
}

export function getTrackingForGuest(tenantId: string, token: string) {
  if (!TOKEN_RE.test(token)) return Promise.resolve(null);
  return withTenant(tenantId, (tx) => getCourierTracking(tx, tenantId, token));
}

export function getDriverSpace(tenantId: string, token: string) {
  if (!TOKEN_RE.test(token)) return Promise.resolve(null);
  return withTenant(tenantId, (tx) => getCourierSpace(tx, tenantId, token));
}

const driverActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("picked_up"), jobId: z.string().uuid() }),
  z.object({ action: z.literal("in_transit"), jobId: z.string().uuid() }),
  z.object({ action: z.literal("delivered"), jobId: z.string().uuid(), proof: z.union([z.object({ type: z.literal("code"), code: z.string().max(4) }), z.object({ type: z.literal("name"), name: z.string().max(80) })]), collectedAmount: z.number().int().min(0) }),
  z.object({ action: z.literal("failed"), jobId: z.string().uuid(), reason: z.string().max(200) }),
  z.object({ action: z.literal("returned"), jobId: z.string().uuid() }),
]);

/** Action d'un livreur par son lien personnel : uniquement sur SES courses (vérifié par le registre). */
export async function driverAction(tenantId: string, token: string, raw: unknown) {
  if (!TOKEN_RE.test(token)) throw new CourierPublicError("Lien invalide.", 404);
  const p = driverActionSchema.safeParse(raw);
  if (!p.success) throw new CourierPublicError("Action invalide.");
  const rate = await limiter.consume(`courier-driver:${tenantId}:${token}`, 60, 10 * 60_000);
  if (!rate.allowed) throw new CourierPublicError("Trop d'actions en peu de temps. Patientez un instant.", 429);
  const a = p.data;
  const planned = await wrap(() =>
    withTenant(tenantId, async (tx) => {
      const d = await tx.deliverer.findFirst({ where: { accessToken: token, tenantId, isActive: true } });
      if (!d) throw new CourierPublicError("Lien invalide ou désactivé.", 404);
      const actor = { type: "deliverer" as const, delivererId: d.id };
      let event: CourierEvent | null = null;
      if (a.action === "picked_up" || a.action === "in_transit") {
        await advanceCourierJob(tx, tenantId, a.jobId, a.action, actor);
        if (a.action === "in_transit") event = "courier_job_on_the_way";
      } else if (a.action === "delivered") {
        await deliverCourierJob(tx, tenantId, a.jobId, { proof: a.proof, collectedAmount: a.collectedAmount, actor });
        event = "courier_job_delivered";
      } else if (a.action === "failed") {
        await failCourierJob(tx, tenantId, a.jobId, a.reason, actor);
        event = "courier_job_failed";
      } else {
        await completeCourierReturn(tx, tenantId, a.jobId, actor);
      }
      return event ? planCourierNotifications(tx, tenantId, a.jobId, event) : [];
    }),
  );
  await dispatchCourierNotifications(tenantId, planned);
}
