import "server-only";
import { z } from "zod";
import {
  withTenant,
  bookDeparture,
  cancelReservationByCustomer,
  getTravelBookingByToken,
  AvailabilityFullError,
  InvalidReservationTransitionError,
  ReservationNotFoundError,
  ReservationUnavailableError,
  TravelError,
} from "@yamacommerce/database";
import { RedisRateLimiter, redisConnection } from "@yamacommerce/queue";

const limiter = new RedisRateLimiter(redisConnection);

export class TravelBookingError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
  }
}

const name = z.string().trim().min(1, "Indiquez le prénom et le nom de chaque voyageur.").max(80);

export const travelBookingSchema = z.object({
  slug: z.string().min(1).max(120),
  departureId: z.string().uuid("Choisissez une date de départ."),
  travelers: z
    .array(
      z.object({
        firstName: name,
        lastName: name,
        birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
        passportNumber: z.string().trim().max(20).optional().or(z.literal("")),
      }),
    )
    .min(1, "Ajoutez au moins un voyageur.")
    .max(9, "Au-delà de 9 voyageurs, contactez l'agence pour un devis de groupe."),
  phone: z.string().trim().min(6, "Indiquez votre téléphone.").max(20),
  email: z.string().trim().email("E-mail invalide.").max(200).optional().or(z.literal("")),
  note: z.string().trim().max(600).optional().default(""),
});

/**
 * Réservation depuis le site public : voyage PUBLIÉ de cette agence uniquement, départ
 * à venir et ouvert, places prises atomiquement, montant recalculé par le serveur (le
 * navigateur n'envoie aucun prix). Fréquence limitée par visiteur. La réservation est
 * « à confirmer » : l'agence rappelle le client et indique comment régler l'acompte.
 */
export async function submitTravelBooking(tenantId: string, clientKey: string, raw: unknown) {
  const parsed = travelBookingSchema.safeParse(raw);
  if (!parsed.success) throw new TravelBookingError(parsed.error.issues[0]?.message ?? "Formulaire incomplet.");
  const input = parsed.data;
  const rate = await limiter.consume(`travel-booking:${tenantId}:${clientKey}`, 5, 30 * 60_000);
  if (!rate.allowed) throw new TravelBookingError("Trop de demandes envoyées. Réessayez un peu plus tard ou appelez l'agence.", 429);
  try {
    return await withTenant(tenantId, async (tx) => {
      const listing = await tx.listing.findFirst({ where: { tenantId, slug: input.slug, type: "travel_package", status: "published", deletedAt: null }, select: { id: true } });
      if (!listing) throw new TravelBookingError("Ce voyage n'est plus proposé.", 404);
      const lead = input.travelers[0]!;
      const booking = await bookDeparture(tx, tenantId, {
        listingId: listing.id,
        availabilityId: input.departureId,
        travelers: input.travelers.map((t) => ({
          firstName: t.firstName,
          lastName: t.lastName,
          birthDate: t.birthDate ? new Date(`${t.birthDate}T00:00:00.000Z`) : null,
          passportNumber: t.passportNumber || null,
        })),
        contact: { firstName: lead.firstName, lastName: lead.lastName, phone: input.phone, email: input.email || undefined },
        customerNote: input.note || null,
        channel: "web",
        actor: { userId: null, type: "customer" },
      });
      return { reference: booking.reference, accessToken: booking.accessToken };
    });
  } catch (error) {
    if (error instanceof TravelBookingError) throw error;
    if (error instanceof AvailabilityFullError) throw new TravelBookingError(error.message, 409);
    if (error instanceof ReservationUnavailableError || error instanceof TravelError) throw new TravelBookingError(error.message);
    throw error;
  }
}

/** Le voyageur retrouve SA réservation par son jeton (jamais une autre, jamais celle d'une autre agence). */
export function getTravelBookingForGuest(tenantId: string, token: string) {
  if (!/^[0-9a-f-]{36}$/.test(token)) return Promise.resolve(null);
  return withTenant(tenantId, (tx) => getTravelBookingByToken(tx, tenantId, token));
}

/** Annulation en ligne : seulement avant le départ ET tant qu'aucun paiement n'a été
 *  enregistré — au-delà, le remboursement se traite avec l'agence. */
export async function cancelTravelBookingAsGuest(tenantId: string, token: string) {
  if (!/^[0-9a-f-]{36}$/.test(token)) throw new TravelBookingError("Réservation introuvable.", 404);
  try {
    await withTenant(tenantId, async (tx) => {
      const booking = await getTravelBookingByToken(tx, tenantId, token);
      if (!booking) throw new ReservationNotFoundError();
      if (booking.payments.some((p) => !p.voidedAt)) {
        throw new TravelBookingError("Un paiement a déjà été enregistré : contactez l'agence pour annuler et convenir du remboursement.", 409);
      }
      await cancelReservationByCustomer(tx, tenantId, token);
    });
  } catch (error) {
    if (error instanceof TravelBookingError) throw error;
    if (error instanceof ReservationNotFoundError) throw new TravelBookingError("Réservation introuvable.", 404);
    if (error instanceof ReservationUnavailableError || error instanceof InvalidReservationTransitionError) {
      throw new TravelBookingError("Cette réservation ne peut plus être annulée en ligne : contactez l'agence.", 409);
    }
    throw error;
  }
}
