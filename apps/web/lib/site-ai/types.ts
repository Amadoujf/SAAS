/**
 * Données fournies à l'assistant de création de site — UNIQUEMENT celles de
 * l'entreprise courante, déjà chargées sous isolation (voir context.ts). Aucun prix,
 * stock ou caractéristique n'est modifiable par l'assistant : ils ne sont transmis que
 * pour le choix et la présentation des produits.
 */

export interface CatalogProduct {
  id: string;
  /** Adresse publique de la fiche (/p/{slug}). */
  slug: string;
  name: string;
  category: string | null;
  /** Prix déjà formaté, en lecture seule. */
  priceLabel: string;
  description: string | null;
  createdAt: string;
  imageUrl: string | null;
  imageAlt: string | null;
  /** Largeur de l'image principale si connue (médiathèque), pour juger de sa qualité. */
  imageWidth: number | null;
  imageCount: number;
}

export interface CatalogCategory {
  id: string;
  name: string;
  slug: string;
  productCount: number;
  /** Un visuel existe (image de la catégorie ou produit photographié). */
  hasVisual: boolean;
}

export interface SiteBrief {
  activity: string;
  audience: string;
  /** Styles souhaités, parmi une liste courte (voir STYLE_WORDS). */
  styles: string[];
  likes: string;
}

export const STYLE_WORDS = ["épuré", "chaleureux", "luxueux", "coloré", "artisanal", "moderne", "naturel", "audacieux"] as const;

export interface SiteAiContext {
  tenantName: string;
  sectorKey: string;
  /** « restaurant » : les « produits » sont les plats de la carte ; les liens mènent à la
   *  carte et à la réservation ; le style de base reste celui du secteur (Braise). */
  mode?: "commerce" | "restaurant" | "automobile" | "education";
  logoUrl: string | null;
  products: CatalogProduct[];
  categories: CatalogCategory[];
  /** Images de la médiathèque (hors produits), utilisables pour une grande photographie. */
  libraryImages: { url: string; alt: string | null; width: number | null }[];
}

/** Identité du site (source unique : « Mon site »), telle que l'assistant peut la proposer. */
export interface SiteIdentity {
  style: string;
  primaryColor: string | null;
  accentColor: string | null;
  backgroundColor: string | null;
  /** Paire typographique (lib/storefront/brand-kit.ts) ; absente = celle du style. */
  fontPair?: string | null;
  /** Formes (angles, arrondis) ; absentes = celles du style. */
  shape?: string | null;
  /** Cadre de page (en-tête, cartes, pied de page) ; absent = celui du style. */
  frame?: "editorial" | "sculptural" | "studio" | null;
}

export interface SiteMotion {
  level: "discreet" | "dynamic" | "immersive";
  mobile: "same" | "reduced" | "none";
}
