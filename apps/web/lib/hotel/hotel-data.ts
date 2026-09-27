import "server-only";
import { withTenant, listRoomTypes, searchAvailability } from "@yamacommerce/database";

export interface RoomCardData {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  price: number | null;
  maxAdults: number;
  maxChildren: number;
  bedSummary: string;
  sizeM2: number | null;
  amenities: string[];
  minNights: number;
  images: { url: string; alt: string; demo: boolean }[];
}

const mediaOf = (media: unknown) =>
  (Array.isArray(media) ? media : []).filter((m): m is { url: string; alt?: string; demo?: boolean } => !!m && typeof (m as { url?: unknown }).url === "string").map((m) => ({ url: m.url, alt: m.alt ?? "", demo: m.demo === true }));

export async function loadRoomTypes(tenantId: string): Promise<RoomCardData[]> {
  const types = await withTenant(tenantId, (tx) => listRoomTypes(tx, tenantId, { publishedOnly: true }));
  return types
    .filter((t) => t.roomType && t.roomType.rooms.some((r) => r.isActive))
    .map((t) => ({
      id: t.id,
      slug: t.slug,
      title: t.title,
      summary: t.summary,
      price: t.price,
      maxAdults: t.roomType!.maxAdults,
      maxChildren: t.roomType!.maxChildren,
      bedSummary: t.roomType!.bedSummary,
      sizeM2: t.roomType!.sizeM2,
      amenities: t.roomType!.amenities,
      minNights: t.roomType!.minNights,
      images: mediaOf(t.media).map((m) => ({ ...m, alt: m.alt || t.title })),
    }));
}

export interface SearchQuery {
  arrival: string;
  departure: string;
  adults: number;
  children: number;
}

/** Disponibilité réelle pour des dates : par type, chambres libres et prix total calculé. */
export async function searchRooms(tenantId: string, q: SearchQuery) {
  return withTenant(tenantId, (tx) => searchAvailability(tx, tenantId, { ...q, public: true }));
}
