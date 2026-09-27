import "server-only";
import { z } from "zod";
import { withTenant, requestPropertyVisit, cancelReservationByCustomer, VISIT_MODULE, ReservationUnavailableError, ReservationNotFoundError, InvalidListingInputError, InvalidReservationTransitionError } from "@yamacommerce/database";
import { RedisRateLimiter, redisConnection } from "@yamacommerce/queue";

const limiter = new RedisRateLimiter(redisConnection);

export class VisitRequestError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
  }
}

export const visitRequestSchema = z.object({
  slug: z.string().min(1).max(120),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choisissez une date."),
  time: z.string().regex(/^(0[8-9]|1[0-8]):(00|30)$/, "Choisissez un horaire entre 8 h et 18 h 30."),
  firstName: z.string().trim().min(1, "Indiquez votre prénom.").max(80),
  lastName: z.string().trim().max(80).optional().default(""),
  phone: z.string().trim().min(6, "Indiquez votre téléphone.").max(20),
  email: z.string().trim().email("E-mail invalide.").max(200).optional().or(z.literal("")),
  message: z.string().trim().max(600).optional().default(""),
});

/**
 * Demande de visite depuis le site public : bien PUBLIÉ de cette agence uniquement,
 * date dans le futur (heure de Dakar = UTC, toute l'année), fréquence limitée par
 * visiteur. La visite est « à confirmer » : l'agence rappelle le client.
 */
export async function submitVisitRequest(tenantId: string, clientKey: string, raw: unknown) {
  const parsed = visitRequestSchema.safeParse(raw);
  if (!parsed.success) throw new VisitRequestError(parsed.error.issues[0]?.message ?? "Formulaire incomplet.");
  const input = parsed.data;
  const preferredAt = new Date(`${input.date}T${input.time}:00.000Z`);
  if (Number.isNaN(preferredAt.getTime()) || preferredAt.getTime() < Date.now() + 60 * 60_000) {
    throw new VisitRequestError("Choisissez une date à venir (au moins une heure à l'avance).");
  }
  if (preferredAt.getTime() > Date.now() + 180 * 86_400_000) throw new VisitRequestError("Choisissez une date dans les six prochains mois.");
  const rate = await limiter.consume(`visit-request:${tenantId}:${clientKey}`, 5, 30 * 60_000);
  if (!rate.allowed) throw new VisitRequestError("Trop de demandes envoyées. Réessayez un peu plus tard ou appelez l'agence.", 429);
  try {
    return await withTenant(tenantId, async (tx) => {
      const listing = await tx.listing.findFirst({ where: { tenantId, slug: input.slug, type: "property", status: "published", deletedAt: null }, select: { id: true } });
      if (!listing) throw new VisitRequestError("Ce bien n'est plus disponible.", 404);
      const visit = await requestPropertyVisit(tx, tenantId, {
        listingId: listing.id,
        preferredAt,
        customer: { firstName: input.firstName, lastName: input.lastName || undefined, phone: input.phone, email: input.email || undefined },
        message: input.message || null,
        channel: "web",
        actor: { userId: null, type: "customer" },
      });
      return { reference: visit.reference, accessToken: visit.accessToken };
    });
  } catch (error) {
    if (error instanceof VisitRequestError) throw error;
    if (error instanceof ReservationUnavailableError || error instanceof InvalidListingInputError) throw new VisitRequestError(error.message);
    throw error;
  }
}

/** Le visiteur retrouve SA demande par son jeton (jamais une autre, jamais celle d'une autre agence). */
export function getVisitForGuest(tenantId: string, token: string) {
  if (!/^[0-9a-f-]{36}$/.test(token)) return Promise.resolve(null);
  return withTenant(tenantId, async (tx) => {
    const visit = await tx.reservation.findFirst({
      where: { tenantId, accessToken: token, moduleKey: VISIT_MODULE },
      include: { listing: { select: { title: true, slug: true, media: true } } },
    });
    return visit;
  });
}

export async function cancelVisitAsGuest(tenantId: string, token: string) {
  if (!/^[0-9a-f-]{36}$/.test(token)) throw new VisitRequestError("Demande introuvable.", 404);
  try {
    await withTenant(tenantId, async (tx) => {
      const visit = await tx.reservation.findFirst({ where: { tenantId, accessToken: token, moduleKey: VISIT_MODULE }, select: { id: true } });
      if (!visit) throw new ReservationNotFoundError();
      await cancelReservationByCustomer(tx, tenantId, token);
    });
  } catch (error) {
    if (error instanceof ReservationNotFoundError) throw new VisitRequestError("Demande introuvable.", 404);
    if (error instanceof ReservationUnavailableError || error instanceof InvalidReservationTransitionError) throw new VisitRequestError("Cette visite ne peut plus être annulée en ligne : appelez l'agence.", 409);
    throw error;
  }
}
