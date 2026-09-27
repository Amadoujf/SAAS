/**
 * Contenus du carrousel immersif — module PUR (sans serveur), partagé par le site public
 * et l'aperçu de l'éditeur. Le serveur fournit un « réservoir » des produits et fiches
 * PUBLIÉS de l'entreprise (voir resolve-catalog-content.ts) ; la sélection affichée est
 * calculée ici à partir des réglages de la section, identiquement des deux côtés.
 */

/** Clé réservée du contenu résolu qui porte le réservoir (jamais un identifiant de section). */
export const SHOWCASE_POOL_KEY = "__showcase_pool__";

export interface ShowcaseItem {
  id: string;
  title: string;
  subtitle?: string;
  imageUrl?: string;
  imageAlt?: string;
  /** Lien vers la vraie fiche ; absent = élément présenté sans lien (aucune page publique). */
  href?: string;
  /** Prix déjà formaté (« 45 000 FCFA », « 650 000 FCFA / mois ») ; absent = sans prix. */
  priceLabel?: string;
  badge?: string;
  accentColor?: string;
}

export interface ShowcasePool {
  products: ShowcaseItem[];
  listings: ShowcaseItem[];
}

export interface ShowcaseSelectionParams {
  source: "products" | "listings" | "manual";
  productIds?: string[];
  listingIds?: string[];
  items: { title: string; subtitle?: string; imageUrl: string; imageAlt?: string; href?: string; badge?: string; accentColor?: string }[];
  displayCount: number;
  showPrice: boolean;
}

export function isShowcasePool(value: unknown): value is ShowcasePool {
  return typeof value === "object" && value !== null && Array.isArray((value as ShowcasePool).products) && Array.isArray((value as ShowcasePool).listings);
}

/** Éléments à présenter : sélection explicite (ordre du commerçant), sinon les plus
 *  récents ; contenus manuels tels quels. Le prix n'apparaît que si demandé. */
export function selectShowcaseItems(params: ShowcaseSelectionParams, pool: ShowcasePool | undefined): ShowcaseItem[] {
  let items: ShowcaseItem[];
  if (params.source === "manual") {
    items = params.items.map((it, i) => ({ id: `manuel-${i}`, title: it.title, subtitle: it.subtitle, imageUrl: it.imageUrl, imageAlt: it.imageAlt, href: it.href, badge: it.badge, accentColor: it.accentColor }));
  } else {
    const all = (params.source === "products" ? pool?.products : pool?.listings) ?? [];
    const ids = params.source === "products" ? params.productIds : params.listingIds;
    if (ids?.length) {
      const byId = new Map(all.map((it) => [it.id, it]));
      items = ids.map((id) => byId.get(id)).filter((it): it is ShowcaseItem => !!it);
    } else {
      items = all;
    }
  }
  return items.slice(0, params.displayCount).map((it) => (params.showPrice ? it : { ...it, priceLabel: undefined }));
}

const nf = new Intl.NumberFormat("fr-FR");
const fcfa = (n: number) => `${nf.format(n).replace(/ | /g, " ")} FCFA`;
const UNIT_SUFFIX: Record<string, string> = { per_month: " / mois", per_night: " / nuit", per_person: " / pers.", per_session: " / séance" };

/** Prix d'une fiche selon son unité ; `undefined` si aucun prix n'est communiqué. */
export function formatListingPrice(price: number | null, priceUnit: string): string | undefined {
  if (price == null) return undefined;
  if (priceUnit === "on_request") return "Prix sur demande";
  return `${fcfa(price)}${UNIT_SUFFIX[priceUnit] ?? ""}`;
}

export function formatProductPrice(price: number): string {
  return fcfa(price);
}
