import type { ArchetypeKey } from "./schemas";

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
  | "closing";

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
  /** Réglages suggérés quand la direction n'en précise pas (mode simulé). */
  suggested: { typography: "editorial" | "couture" | "moderne" | "neutre"; shape: "sharp" | "soft" | "round"; animation: "discreet" | "dynamic" | "immersive" };
}

export const ARCHETYPES: Record<ArchetypeKey, Archetype> = {
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
