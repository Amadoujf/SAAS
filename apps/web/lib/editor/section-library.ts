import { validateSectionInstance, type SectionInstance, type SectionKey } from "@yamacommerce/templates";

/**
 * Bibliothèque de sections de l'éditeur : points de départ NEUTRES (textes indicatifs à
 * remplacer, aucune marque, aucun produit, aucun prix, aucun visuel imposé). Les
 * produits et fiches affichés par le carrousel sont ceux de l'entreprise elle-même.
 * `sectors` ordonne les suggestions : celles du secteur de l'entreprise en premier.
 */
export interface SectionPreset {
  id: string;
  sectionKey: SectionKey;
  variant: string;
  label: string;
  description: string;
  sectors: string[];
  params: Record<string, unknown>;
}

const ALL = ["ecommerce", "fashion", "restaurant", "real_estate", "travel_agency", "automobile", "hospitality", "services", "education", "delivery"];

export const SECTION_PRESETS: SectionPreset[] = [
  {
    id: "hero-scene", sectionKey: "immersive_hero", variant: "stage", label: "Hero immersif — scène",
    description: "Sujet sculptural à droite, éléments détourés qui s'assemblent au défilement.",
    sectors: ["ecommerce", "fashion", "restaurant", "automobile"],
    params: { eyebrow: "Nouveauté", title: "Votre titre principal", subtitle: "Une phrase qui donne envie d'en voir plus.", primaryCtaLabel: "Découvrir", primaryCtaHref: "/catalogue", scrollEffect: "assemble", lighting: "halo" },
  },
  {
    id: "hero-signature", sectionKey: "immersive_hero", variant: "centered", label: "Hero immersif — pièce signature",
    description: "Titre centré, sujet mis en lumière sous le texte.",
    sectors: ["ecommerce", "fashion", "restaurant"],
    params: { title: "Votre pièce signature", subtitle: "Présentez ce qui fait votre réputation.", primaryCtaLabel: "Voir", primaryCtaHref: "/catalogue", lighting: "spotlight", scrollEffect: "zoom" },
  },
  {
    id: "hero-architecture", sectionKey: "immersive_hero", variant: "architectural", label: "Hero immersif — grande photographie",
    description: "Photographie plein cadre révélée, texte en surimpression (lieux, séjours, destinations).",
    sectors: ["real_estate", "hospitality", "travel_agency", "automobile"],
    params: { eyebrow: "À la une", title: "Votre titre principal", subtitle: "Une phrase qui situe le lieu ou l'expérience.", primaryCtaLabel: "Découvrir", primaryCtaHref: "/", scrollEffect: "zoom", lighting: "none" },
  },
  {
    id: "showcase-products", sectionKey: "immersive_showcase", variant: "depth", label: "Carrousel en profondeur — produits",
    description: "Vos produits publiés, le central mis en avant ; prix et lien vers la fiche.",
    sectors: ["ecommerce", "fashion", "restaurant"],
    params: { eyebrow: "Sélection", title: "En vedette", source: "products", showPrice: true },
  },
  {
    id: "showcase-listings", sectionKey: "immersive_showcase", variant: "depth", label: "Carrousel en profondeur — fiches",
    description: "Vos biens, offres, véhicules ou prestations publiés.",
    sectors: ["real_estate", "travel_agency", "automobile", "hospitality", "services", "education"],
    params: { eyebrow: "Sélection", title: "À la une", source: "listings", showPrice: true, ctaLabel: "Voir la fiche" },
  },
  {
    id: "showcase-arc", sectionKey: "immersive_showcase", variant: "arc", label: "Carrousel — objets en arc",
    description: "Vos produits en arc, le central sur un socle lumineux ; l'ambiance prend sa couleur. Idéal avec des visuels détourés.",
    sectors: ["ecommerce", "fashion", "restaurant", "automobile"],
    params: { eyebrow: "La gamme", title: "Choisissez le vôtre", source: "products", showPrice: true, backdrop: "dark", imageStyle: "photo" },
  },
  {
    id: "showcase-manual", sectionKey: "immersive_showcase", variant: "stack", label: "Carrousel — contenus libres",
    description: "Destinations, plats, étapes : images et textes saisis à la main, sans prix.",
    sectors: ALL,
    params: { title: "À découvrir", source: "manual", showPrice: false, items: [] },
  },
  {
    id: "story-focus", sectionKey: "scroll_story", variant: "focus", label: "Récit au défilement — détails",
    description: "Une grande image dont le cadrage glisse de détail en détail (matières, pièces).",
    sectors: ["ecommerce", "fashion", "real_estate", "automobile", "hospitality"],
    params: { title: "Dans le détail", steps: [{ title: "Premier détail", body: "Décrivez-le en une ou deux phrases." }, { title: "Deuxième détail" }, { title: "Troisième détail" }] },
  },
  {
    id: "story-sequence", sectionKey: "scroll_story", variant: "sequence", label: "Récit au défilement — une image par étape",
    description: "Chaque étape a sa photo, en fondu (plats, chambres, lieux).",
    sectors: ["restaurant", "hospitality", "travel_agency", "real_estate"],
    params: { title: "L'expérience", steps: [{ title: "Première étape" }, { title: "Deuxième étape" }, { title: "Troisième étape" }] },
  },
  {
    id: "story-product", sectionKey: "scroll_story", variant: "product", label: "Récit au défilement — objet mis en scène",
    description: "Un produit détouré qui pivote d'étape en étape sur une ambiance colorée : ses atouts, un par un.",
    sectors: ["ecommerce", "fashion", "restaurant", "automobile"],
    params: { title: "Pourquoi il est différent", steps: [{ title: "Premier atout", body: "Décrivez-le en une phrase.", rotate: -12 }, { title: "Deuxième atout", rotate: 8, objectScale: 1.1 }, { title: "Troisième atout", rotate: 0, objectScale: 0.9 }] },
  },
  {
    id: "story-timeline", sectionKey: "scroll_story", variant: "timeline", label: "Récit au défilement — étapes jalonnées",
    description: "Itinéraire, programme, suivi de livraison : une frise qui avance avec la lecture.",
    sectors: ["travel_agency", "education", "delivery", "services"],
    params: { title: "Comment ça se passe", steps: [{ title: "Étape 1" }, { title: "Étape 2" }, { title: "Étape 3" }] },
  },
];

/** Suggestions ordonnées pour un secteur (celles du secteur d'abord). */
export function presetsForSector(sectorKey: string | null | undefined): SectionPreset[] {
  const own = SECTION_PRESETS.filter((p) => sectorKey && p.sectors.includes(sectorKey));
  return [...own, ...SECTION_PRESETS.filter((p) => !own.includes(p))];
}

/** Instance VALIDÉE prête à insérer (identifiant fourni par l'appelant). */
export function instantiatePreset(preset: SectionPreset, id: string): SectionInstance {
  return validateSectionInstance({ id, sectionKey: preset.sectionKey, variant: preset.variant, params: preset.params, order: 0, isEnabled: true });
}
