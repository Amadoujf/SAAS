import type { ArchetypeKey } from "./schemas";
import type { SiteFrame } from "@/lib/storefront/store-templates";

/**
 * Archétypes de page d'accueil : chacun est une STRUCTURE (suite de sections du registre,
 * hiérarchie, rythme) pensée pour un type de marque — pas une variante de couleurs.
 * Trois directions proposées = trois archétypes différents. Les sections sont remplies
 * exclusivement avec les données de l'entreprise (compile.ts).
 */

export type SlotKind =
  | "immersive_hero"
  | "classic_hero"
  | "catalog_search"
  | "showcase"
  | "story"
  | "manifesto"
  | "heritage"
  | "signature"
  | "lookbook"
  | "gallery"
  | "featured"
  | "new_arrivals"
  | "categories"
  | "closing"
  | "collection_hero"
  | "lineup"
  | "marquee"
  | "brand_story";

export interface Slot {
  id: string;
  kind: SlotKind;
  variant: string;
}

export interface Archetype {
  label: string;
  /** Pour qui, en une phrase (consigne du modèle et fiche de la direction). */
  description: string;
  /** Plan de la page, en mots simples, affiché sur la carte de la direction. */
  outline: string[];
  slots: Slot[];
  /** Cadre de page imposé par la structure (en-tête, cartes produits, pied de page) :
   *  une ouverture « studio » n'est jamais servie avec l'en-tête d'une autre direction. */
  frame?: SiteFrame;
  /** Réglages suggérés quand la direction n'en précise pas (mode simulé). */
  suggested: { typography: "editorial" | "couture" | "moderne" | "neutre"; shape: "sharp" | "soft" | "round"; animation: "discreet" | "dynamic" | "immersive" };
}

export const ARCHETYPES: Record<ArchetypeKey, Archetype> = {
  editorial: {
    label: "Éditorial",
    description: "Composition de magazine : photographie dominante qui respire, titres en didone, grands portraits de pièces décalés, citation de la maison. Pour une marque d'images, mode et maison.",
    outline: ["Ouverture photographique, titre en didone", "Les pièces en grands portraits", "Citation de la maison", "Lookbook", "Univers"],
    frame: "editorial",
    slots: [
      { id: "ouverture", kind: "collection_hero", variant: "cover" },
      { id: "pieces", kind: "lineup", variant: "editorial" },
      { id: "maison", kind: "brand_story", variant: "quote" },
      { id: "lookbook", kind: "lookbook", variant: "mosaic" },
      { id: "univers", kind: "categories", variant: "editorial" },
    ],
    suggested: { typography: "couture", shape: "sharp", animation: "dynamic" },
  },
  sculptural: {
    label: "Sculptural",
    description: "La pièce au centre : grande photo pleine largeur en diaporama, très grand titre grotesque, pièces isolées sur socles clairs. Pour des objets forts : maroquinerie, bijoux, design.",
    outline: ["Grande photo de la pièce, grand titre", "Les pièces isolées sur socles", "Le geste de la maison", "Univers"],
    frame: "sculptural",
    slots: [
      { id: "ouverture", kind: "collection_hero", variant: "stage" },
      { id: "pieces", kind: "lineup", variant: "plinth" },
      { id: "geste", kind: "brand_story", variant: "split" },
      { id: "univers", kind: "categories", variant: "grid" },
    ],
    suggested: { typography: "neutre", shape: "sharp", animation: "dynamic" },
  },
  studio: {
    label: "Studio",
    description: "Boutique contemporaine et affirmée : nom de la marque en lettres géantes sur aplat de couleur, bandeau défilant, grille numérotée, aplats. Pour une marque jeune et dynamique.",
    outline: ["Nom géant sur aplat de couleur", "Bandeau défilant", "Grille numérotée des pièces", "Manifeste en aplat", "Bandeau final"],
    frame: "studio",
    slots: [
      { id: "ouverture", kind: "collection_hero", variant: "wordmark" },
      { id: "bandeau", kind: "marquee", variant: "band" },
      { id: "pieces", kind: "lineup", variant: "index" },
      { id: "manifeste", kind: "brand_story", variant: "bold" },
      { id: "fin", kind: "marquee", variant: "outline" },
    ],
    suggested: { typography: "moderne", shape: "sharp", animation: "immersive" },
  },
  galerie: {
    label: "Galerie",
    description: "Épure de galerie : grand titre centré, peu d'éléments, beaucoup d'espace ; les produits comme des œuvres. Pour une marque sûre d'elle, un catalogue court.",
    outline: ["Grand titre centré sur une pièce", "Sélection éditoriale", "Manifeste", "Univers", "Invitation"],
    slots: [
      { id: "hero", kind: "immersive_hero", variant: "centered" },
      { id: "selection", kind: "featured", variant: "editorial" },
      { id: "manifeste", kind: "manifesto", variant: "image-right" },
      { id: "univers", kind: "categories", variant: "grid" },
      { id: "cloture", kind: "closing", variant: "banner" },
    ],
    suggested: { typography: "editorial", shape: "sharp", animation: "discreet" },
  },
  atelier: {
    label: "Atelier",
    description: "Le récit d'un savoir-faire : ouverture en deux colonnes, histoire de la maison, produits racontés un à un. Pour l'artisanat et les créateurs.",
    outline: ["Ouverture texte + photo", "Savoir-faire", "Récit pièce par pièce", "Sélection en mosaïque", "Univers", "Invitation"],
    slots: [
      { id: "hero", kind: "classic_hero", variant: "split" },
      { id: "savoir-faire", kind: "heritage", variant: "image-left" },
      { id: "recit", kind: "story", variant: "sequence" },
      { id: "selection", kind: "featured", variant: "masonry" },
      { id: "univers", kind: "categories", variant: "editorial" },
      { id: "cloture", kind: "closing", variant: "split" },
    ],
    suggested: { typography: "editorial", shape: "soft", animation: "dynamic" },
  },
  maison: {
    label: "Maison",
    description: "Codes du luxe : une pièce signature sur fond sombre, un lookbook, un manifeste ; rythme lent, typographie contrastée. Pour le haut de gamme.",
    outline: ["Ouverture mise en scène", "Pièce signature", "Lookbook", "Manifeste", "Collection"],
    slots: [
      { id: "hero", kind: "immersive_hero", variant: "architectural" },
      { id: "signature", kind: "signature", variant: "dark" },
      { id: "lookbook", kind: "lookbook", variant: "mosaic" },
      { id: "manifeste", kind: "manifesto", variant: "image-left" },
      { id: "selection", kind: "featured", variant: "grid" },
    ],
    suggested: { typography: "couture", shape: "sharp", animation: "dynamic" },
  },
  vitrine: {
    label: "Vitrine vive",
    description: "Énergie et découverte : produit en scène, carrousel interactif, nouveautés en continu. Pour une marque jeune, des arrivages fréquents.",
    outline: ["Produit en scène", "Carrousel interactif", "Nouveautés", "Univers en carrousel", "Invitation"],
    slots: [
      { id: "hero", kind: "immersive_hero", variant: "stage" },
      { id: "vitrine", kind: "showcase", variant: "arc" },
      { id: "nouveautes", kind: "new_arrivals", variant: "carousel" },
      { id: "univers", kind: "categories", variant: "carousel" },
      { id: "cloture", kind: "closing", variant: "banner" },
    ],
    suggested: { typography: "moderne", shape: "round", animation: "immersive" },
  },
  magazine: {
    label: "Magazine",
    description: "Mise en page de magazine : grande image d'ouverture, récit en mouvement, galerie, sélection éditoriale. Pour une marque d'images et d'inspiration.",
    outline: ["Grande image d'ouverture", "Récit en mouvement", "Galerie", "Sélection éditoriale", "Manifeste"],
    slots: [
      { id: "hero", kind: "classic_hero", variant: "fullbleed" },
      { id: "recit", kind: "story", variant: "product" },
      { id: "galerie", kind: "gallery", variant: "masonry" },
      { id: "selection", kind: "featured", variant: "editorial" },
      { id: "manifeste", kind: "manifesto", variant: "image-right" },
    ],
    suggested: { typography: "editorial", shape: "sharp", animation: "dynamic" },
  },
  marche: {
    label: "Marché",
    description: "Efficacité d'un grand magasin : recherche en tête, univers, nouveautés et sélection en grilles nettes. Pour un catalogue large et des achats rapides.",
    outline: ["Recherche en tête", "Univers", "Nouveautés", "Sélection", "Invitation"],
    slots: [
      { id: "hero", kind: "catalog_search", variant: "hero" },
      { id: "univers", kind: "categories", variant: "editorial" },
      { id: "nouveautes", kind: "new_arrivals", variant: "grid" },
      { id: "selection", kind: "featured", variant: "grid" },
      { id: "cloture", kind: "closing", variant: "banner" },
    ],
    suggested: { typography: "neutre", shape: "soft", animation: "discreet" },
  },
};
