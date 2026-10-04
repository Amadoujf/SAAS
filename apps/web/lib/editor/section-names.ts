import type { SectionKey } from "@yamacommerce/templates";

/** Noms lisibles des sections dans l'éditeur (jamais la clé technique). */
export const SECTION_NAMES: Record<SectionKey, string> = {
  hero: "Bannière d'accueil",
  categories: "Catégories",
  featured_products: "Produits en vedette",
  new_arrivals: "Nouveautés",
  promotions: "Promotion",
  benefits: "Avantages",
  testimonials: "Témoignages",
  brands: "Marques",
  gallery: "Galerie",
  video: "Vidéo",
  newsletter: "Lettre d'information",
  faq: "Questions fréquentes",
  cta: "Appel à l'action",
  contact: "Contact",
  whatsapp: "WhatsApp",
  custom_content: "Contenu libre",
  brand_manifesto: "Manifeste",
  signature_product: "Pièce signature",
  heritage: "Savoir-faire",
  lookbook: "Lookbook",
  designers: "Créateurs",
  provenance: "Provenance",
  catalog_search: "Recherche du catalogue",
  immersive_hero: "Hero immersif",
  immersive_showcase: "Carrousel immersif",
  scroll_story: "Récit au défilement",
  collection_hero: "Ouverture de collection",
  product_lineup: "Pièces de la collection",
  marquee: "Bandeau défilant",
  brand_story: "Récit de marque",
};

/** Libellés des choix proposés dans les formulaires de l'éditeur (valeurs techniques
 *  des listes déroulantes). Générique : aucun terme propre à une entreprise. */
export const ENUM_LABELS: Record<string, string> = {
  stage: "Scène", centered: "Centré", architectural: "Grande photographie",
  depth: "Profondeur", stack: "Pile", arc: "Objets en arc", focus: "Détails", sequence: "Une image par étape", timeline: "Étapes jalonnées", product: "Objet mis en scène",
  photo: "Photographie (cadre arrondi)",
  top: "Du haut", bottom: "Du bas", left: "De la gauche", right: "De la droite", none: "Aucun",
  halo: "Halo", spotlight: "Projecteur", ambient: "Ambiante",
  assemble: "Assemblage", separate: "Séparation", parallax: "Parallaxe", zoom: "Zoom",
  subtle: "Subtile", balanced: "Équilibrée", bold: "Marquée",
  products: "Produits du catalogue", listings: "Fiches (biens, offres…)", manual: "Contenus saisis à la main",
  tinted: "Teinté", neutral: "Neutre", dark: "Sombre",
  cutout: "Détouré (fond transparent)", framed: "Photographie encadrée",
  discreet: "Discret", dynamic: "Dynamique", immersive: "Immersif", inherit: "Hériter du site",
  fade: "Fondu", slide: "Glissement", scale: "Agrandissement",
  up: "Vers le haut", down: "Vers le bas", lift: "Soulèvement", glow: "Lueur",
};
