import "server-only";
import { withTenant, listVehicles, getPublicVehicleBySlug, vehicleFacets, type VehicleFilters } from "@yamacommerce/database";

export interface VehicleCardData {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  description: string | null;
  price: number | null;
  featured: boolean;
  make: string;
  model: string;
  version: string | null;
  year: number;
  mileageKm: number;
  fuel: string;
  transmission: string;
  bodyType: string;
  color: string | null;
  engine: string | null;
  seats: number | null;
  condition: string;
  features: string[];
  negotiable: boolean;
  stockStatus: string;
  images: { url: string; alt: string; demo: boolean }[];
}

const mediaOf = (media: unknown) =>
  (Array.isArray(media) ? media : []).filter((m): m is { url: string; alt?: string; demo?: boolean } => !!m && typeof (m as { url?: unknown }).url === "string").map((m) => ({ url: m.url, alt: m.alt ?? "", demo: m.demo === true }));

type Row = Awaited<ReturnType<typeof listVehicles>>[number];

export function toCard(l: Row): VehicleCardData {
  const v = l.vehicle!;
  return {
    id: l.id,
    slug: l.slug,
    title: l.title,
    summary: l.summary,
    description: l.description,
    price: l.price,
    featured: l.featured,
    make: v.make,
    model: v.model,
    version: v.version,
    year: v.year,
    mileageKm: v.mileageKm,
    fuel: v.fuel,
    transmission: v.transmission,
    bodyType: v.bodyType,
    color: v.color,
    engine: v.engine,
    seats: v.seats,
    condition: v.condition,
    features: v.features,
    negotiable: v.negotiable,
    stockStatus: v.stockStatus,
    images: mediaOf(l.media).map((m) => ({ ...m, alt: m.alt || l.title })),
  };
}

export async function loadVehicles(tenantId: string, filters: Omit<VehicleFilters, "publicOnly"> = {}) {
  const rows = await withTenant(tenantId, (tx) => listVehicles(tx, tenantId, { ...filters, publicOnly: true }));
  return rows.map(toCard);
}

export async function loadVehicle(tenantId: string, slug: string) {
  const row = await withTenant(tenantId, (tx) => getPublicVehicleBySlug(tx, tenantId, slug));
  return row ? toCard(row) : null;
}

export function loadFacets(tenantId: string) {
  return withTenant(tenantId, (tx) => vehicleFacets(tx, tenantId));
}

/** Filtres lus dans l'adresse (liens partageables) — valeurs inconnues ignorées. */
export function filtersFromSearch(sp: Record<string, string | string[] | undefined>): Omit<VehicleFilters, "publicOnly"> {
  const one = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string).slice(0, 60) : undefined);
  const num = (k: string) => {
    const n = Number(one(k));
    return Number.isInteger(n) && n > 0 ? n : undefined;
  };
  const sort = one("tri");
  return {
    make: one("marque") || undefined,
    fuel: one("carburant") || undefined,
    bodyType: one("carrosserie") || undefined,
    transmission: one("boite") || undefined,
    priceMax: num("prix_max"),
    yearMin: num("annee_min"),
    search: one("q") || undefined,
    ...(one("stock") === "arrivage" ? { stock: ["incoming"] } : one("stock") === "disponible" ? { stock: ["available"] } : {}),
    sort: sort === "price_asc" || sort === "price_desc" || sort === "year_desc" || sort === "km_asc" ? sort : "recent",
  };
}
