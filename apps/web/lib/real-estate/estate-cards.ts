import type { Prisma } from "@yamacommerce/database";
import { DEAL_TYPE_LABELS, PROPERTY_TYPE_LABELS, formatPropertyPrice, propertyFacts } from "./labels";
import type { EstateCard } from "@/components/estate/property-card";

type ListingWithProperty = Prisma.ListingGetPayload<{ include: { property: true } }>;

export function placeOf(location: Prisma.JsonValue | null) {
  const loc = (location ?? {}) as { commune?: string; neighborhood?: string };
  return [loc.neighborhood, loc.commune].filter(Boolean).join(", ") || null;
}

/** Données d'affichage d'un bien (carte, carrousel) — jamais l'adresse exacte. */
export function toEstateCard(l: ListingWithProperty): EstateCard {
  const media = (Array.isArray(l.media) ? l.media : []) as { url?: string; alt?: string }[];
  return {
    slug: l.slug,
    title: l.title,
    summary: l.summary,
    imageUrl: media[0]?.url ?? null,
    imageAlt: media[0]?.alt || l.title,
    price: formatPropertyPrice(l.price, l.priceUnit),
    deal: DEAL_TYPE_LABELS[l.property?.dealType ?? "sale"] ?? "",
    type: PROPERTY_TYPE_LABELS[l.property?.propertyType ?? ""] ?? "Bien",
    facts: l.property ? propertyFacts(l.property) : "",
    place: placeOf(l.location),
  };
}
