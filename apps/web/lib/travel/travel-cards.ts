import type { Prisma } from "@yamacommerce/database";
import type { TripCardData } from "@/components/travel/trip-card";
import type { BoardRow } from "@/components/travel/departures-board";
import { TRIP_TYPE_LABELS, durationLabel, formatShortDate, formatTripPrice, seatsLabel } from "./labels";

type TripWithDetails = Prisma.ListingGetPayload<{ include: { travel: true; availabilities: true } }>;

export function destinationOf(t: { destinationCountry: string; destinationCity: string | null } | null | undefined) {
  if (!t) return "";
  return t.destinationCity ? `${t.destinationCity}, ${t.destinationCountry}` : t.destinationCountry;
}

export function mediaOf(media: Prisma.JsonValue) {
  return ((Array.isArray(media) ? media : []) as { url?: string; alt?: string }[]).filter((m): m is { url: string; alt?: string } => !!m.url);
}

/** Prix « à partir de » : le plus bas entre la fiche et ses départs ouverts à venir. */
export function fromPrice(t: TripWithDetails) {
  const prices = [t.price, ...t.availabilities.filter((a) => a.status === "open").map((a) => a.priceOverride ?? t.price)].filter((p): p is number => p != null);
  if (!prices.length) return formatTripPrice(null, "on_request");
  return `Dès ${formatTripPrice(Math.min(...prices), t.priceUnit)}`;
}

export function toTripCard(t: TripWithDetails): TripCardData {
  const media = mediaOf(t.media);
  const next = t.availabilities.find((a) => a.status === "open" && a.reservedCount < a.capacity);
  return {
    slug: t.slug,
    title: t.title,
    type: TRIP_TYPE_LABELS[t.travel?.tripType ?? ""] ?? "Voyage",
    destination: destinationOf(t.travel),
    duration: t.travel ? durationLabel(t.travel.durationDays, t.travel.durationNights) : "",
    price: fromPrice(t),
    nextDeparture: next ? formatShortDate(next.startAt) : null,
    imageUrl: media[0]?.url ?? null,
    imageAlt: media[0]?.alt || t.title,
  };
}

const monthFmt = new Intl.DateTimeFormat("fr-FR", { month: "short", timeZone: "UTC" });

export function toBoardRows(departures: { id: string; startAt: Date; capacity: number; reservedCount: number; status: string; priceOverride: number | null; listing: { slug: string; title: string; price: number | null; priceUnit?: string } }[], trips: Map<string, TripWithDetails>): BoardRow[] {
  return departures.map((d) => {
    const trip = trips.get(d.listing.slug);
    return {
      id: d.id,
      slug: d.listing.slug,
      day: String(d.startAt.getUTCDate()).padStart(2, "0"),
      month: monthFmt.format(d.startAt).replace(".", ""),
      title: d.listing.title,
      destination: destinationOf(trip?.travel),
      duration: trip?.travel ? durationLabel(trip.travel.durationDays, trip.travel.durationNights) : "",
      seats: seatsLabel(d.capacity, d.reservedCount, d.status),
      price: formatTripPrice(d.priceOverride ?? d.listing.price, trip?.priceUnit ?? "per_person"),
    };
  });
}
