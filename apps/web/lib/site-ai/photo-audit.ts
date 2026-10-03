import type { CatalogProduct, SiteAiContext } from "./types";

/**
 * Bilan photographique, calculé sans IA : ce qui est disponible, ce qui manque, et la
 * présentation adaptée. L'assistant n'invente jamais l'apparence d'un produit : sans
 * photo, un produit n'est pas mis en scène ; avec des photos classiques (fond visible),
 * la présentation « photo » encadrée est retenue — jamais le mode « détouré ».
 */
export interface PhotoAudit {
  withImage: number;
  withoutImage: string[];
  lowResolution: string[];
  /** Assez de photos pour un carrousel en arc (4 produits illustrés au moins). */
  canShowcase: boolean;
  /** Une grande photographie d'ambiance est disponible (médiathèque ou produit). */
  hasHeroImage: boolean;
  advice: string[];
}

const MIN_WIDTH = 900;

export function auditPhotos(context: Pick<SiteAiContext, "products" | "libraryImages" | "logoUrl">): PhotoAudit {
  const illustrated = context.products.filter((p) => p.imageUrl);
  const withoutImage = context.products.filter((p) => !p.imageUrl).map((p) => p.name);
  const lowResolution = illustrated.filter((p) => p.imageWidth !== null && p.imageWidth < MIN_WIDTH).map((p) => p.name);
  const heroCandidates = [...context.libraryImages.filter((i) => (i.width ?? MIN_WIDTH) >= 1200), ...illustrated.filter((p) => (p.imageWidth ?? MIN_WIDTH) >= 1200)];
  const advice: string[] = [];
  if (!context.logoUrl) advice.push("Ajoutez votre logo : il apparaîtra dans l'en-tête et donnera tout de suite une identité au site.");
  if (withoutImage.length) {
    advice.push(`${withoutImage.length} produit${withoutImage.length > 1 ? "s n'ont" : " n'a"} pas de photo (${list(withoutImage)}) : ${withoutImage.length > 1 ? "ils ne sont pas mis" : "il n'est pas mis"} en avant tant qu'une vraie photo manque.`);
  }
  if (lowResolution.length) advice.push(`Photos trop petites pour un affichage plein écran : ${list(lowResolution)}. Une photo d'au moins 1 200 px de large rendra mieux.`);
  if (heroCandidates.length === 0) advice.push("Aucune grande photo d'ambiance : l'accueil s'ouvre sur votre nom et votre message. Une photo de vos produits en situation (lumière naturelle, fond simple) permettrait une ouverture plus immersive.");
  if (illustrated.length < 4) advice.push("Moins de 4 produits photographiés : le carrousel reste simple. Ajoutez des photos pour une présentation en arc.");
  return { withImage: illustrated.length, withoutImage, lowResolution, canShowcase: illustrated.length >= 4, hasHeroImage: heroCandidates.length > 0, advice };
}

function list(names: string[]): string {
  const shown = names.slice(0, 3).join(", ");
  return names.length > 3 ? `${shown}…` : shown;
}

/** Produits illustrés, dans l'ordre demandé, en ne gardant que ceux de l'entreprise. */
export function pickIllustrated(products: CatalogProduct[], ids: string[], max: number): CatalogProduct[] {
  const byId = new Map(products.map((p) => [p.id, p]));
  const chosen = ids.map((id) => byId.get(id)).filter((p): p is CatalogProduct => Boolean(p?.imageUrl));
  const unique = [...new Map(chosen.map((p) => [p.id, p])).values()];
  return unique.slice(0, max);
}
