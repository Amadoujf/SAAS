/** Libellés français de l'immobilier — partagés par le dashboard et le site public. */

export const PROPERTY_TYPE_LABELS: Record<string, string> = {
  apartment: "Appartement",
  house: "Maison",
  villa: "Villa",
  land: "Terrain",
  commercial: "Local commercial",
  office: "Bureau",
};

export const DEAL_TYPE_LABELS: Record<string, string> = { sale: "À vendre", rent: "À louer" };

export const AMENITY_LABELS: Record<string, string> = {
  pool: "Piscine",
  garden: "Jardin",
  parking: "Parking",
  guard: "Gardiennage",
  air_conditioning: "Climatisation",
  sea_view: "Vue mer",
  generator: "Groupe électrogène",
  elevator: "Ascenseur",
  terrace: "Terrasse",
  furnished_kitchen: "Cuisine équipée",
};

export const LISTING_STATUS_LABELS: Record<string, { label: string; tone: "neutral" | "info" | "success" | "warning" | "danger" }> = {
  draft: { label: "Brouillon", tone: "neutral" },
  published: { label: "En ligne", tone: "success" },
  unavailable: { label: "Indisponible", tone: "warning" },
  archived: { label: "Archivé", tone: "neutral" },
};

export const VISIT_STATUS_LABELS: Record<string, { label: string; tone: "neutral" | "info" | "success" | "warning" | "danger" }> = {
  requested: { label: "À confirmer", tone: "warning" },
  confirmed: { label: "Confirmée", tone: "info" },
  completed: { label: "Effectuée", tone: "success" },
  canceled: { label: "Annulée", tone: "neutral" },
  no_show: { label: "Absent", tone: "danger" },
};

export const RENT_METHOD_LABELS: Record<string, string> = {
  cash: "Espèces",
  wave: "Wave",
  orange_money: "Orange Money",
  bank_transfer: "Virement",
  check: "Chèque",
};

const fcfa = (n: number) => `${new Intl.NumberFormat("fr-FR").format(n).replace(/ | /g, " ")} FCFA`;

/** « 650 000 000 FCFA », « 450 000 FCFA / mois » ou « Prix sur demande ». */
export function formatPropertyPrice(price: number | null, priceUnit: string) {
  if (price == null || priceUnit === "on_request") return "Prix sur demande";
  return priceUnit === "per_month" ? `${fcfa(price)} / mois` : fcfa(price);
}

/** Caractéristiques courtes pour une carte : « 5 ch. · 4 sdb · 420 m² ». */
export function propertyFacts(p: { bedrooms: number | null; bathrooms: number | null; surfaceM2: number | null; landSurfaceM2?: number | null; propertyType: string }) {
  const facts: string[] = [];
  if (p.bedrooms != null && p.propertyType !== "land") facts.push(`${p.bedrooms} ch.`);
  if (p.bathrooms != null && p.propertyType !== "land") facts.push(`${p.bathrooms} sdb`);
  if (p.surfaceM2) facts.push(`${new Intl.NumberFormat("fr-FR").format(p.surfaceM2)} m²`);
  else if (p.landSurfaceM2) facts.push(`${new Intl.NumberFormat("fr-FR").format(p.landSurfaceM2)} m² de terrain`);
  return facts.join(" · ");
}
