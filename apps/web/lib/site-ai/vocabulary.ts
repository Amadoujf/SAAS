/** Vocabulaire du studio selon le métier (utilisable côté navigateur). */
export type StudioMode = "commerce" | "restaurant" | "automobile";

export interface StudioVocabulary {
  /** « produits », « plats », « véhicules ». */
  items: string;
  item: string;
  /** Nom de l'ensemble : « catalogue », « carte », « stock ». */
  catalog: string;
  groups: string;
  manageHref: string;
  illustrated: (n: number) => string;
  question: string;
  activityPlaceholder: string;
  audiencePlaceholder: string;
  cta: string;
  suggestions: string[];
}

const COMMON = ["Une typographie plus moderne.", "Des formes plus arrondies.", "Plus d'espace entre les sections.", "Réduis les animations sur téléphone."];

export const STUDIO_VOCABULARY: Record<StudioMode, StudioVocabulary> = {
  commerce: {
    items: "produits",
    item: "produit",
    catalog: "catalogue",
    groups: "catégorie",
    manageHref: "/dashboard/produits",
    illustrated: (n) => `photographié${n > 1 ? "s" : ""}`,
    question: "Que vendez-vous, et qu'est-ce qui vous rend différent ?",
    activityPlaceholder: "Ex. : céramiques tournées à la main dans notre atelier de Ngor, émaux inspirés de l'océan.",
    audiencePlaceholder: "Ex. : amateurs de décoration, cadeaux de mariage",
    cta: "Découvrir la collection",
    suggestions: ["Mets mes nouveautés en premier.", "Fais une version plus luxueuse.", "Ajoute une galerie de mes produits.", "Ajoute un récit qui présente mes pièces.", ...COMMON],
  },
  restaurant: {
    items: "plats",
    item: "plat",
    catalog: "carte",
    groups: "rubrique",
    manageHref: "/dashboard/carte",
    illustrated: () => "en photo",
    question: "Que servez-vous, et qu'est-ce qui rend votre cuisine différente ?",
    activityPlaceholder: "Ex. : dibiterie à Ouakam, agneau grillé au feu de bois, thiéboudienne le vendredi, ouvert tard.",
    audiencePlaceholder: "Ex. : familles le week-end, bureaux du quartier à midi",
    cta: "Voir la carte",
    suggestions: ["Mets mes plats signature en avant.", "Une ambiance plus chaleureuse.", "Ajoute une galerie de mes plats.", "Ajoute un récit qui présente mes plats.", ...COMMON],
  },
  automobile: {
    items: "véhicules",
    item: "véhicule",
    catalog: "stock",
    groups: "carrosserie",
    manageHref: "/dashboard/vehicules",
    illustrated: () => "en photo",
    question: "Que vendez-vous, et qu'est-ce qui distingue votre concession ?",
    activityPlaceholder: "Ex. : occasions contrôlées en atelier, importation sur commande depuis la Belgique, reprise de votre véhicule.",
    audiencePlaceholder: "Ex. : familles, entreprises, premiers acheteurs",
    cta: "Voir les véhicules",
    suggestions: ["Mets mes véhicules vedettes en avant.", "Une ambiance plus technique.", "Ajoute une galerie de mes véhicules.", "Ajoute un récit qui présente mon stock.", ...COMMON],
  },
};

export const vocabularyOf = (mode: StudioMode | undefined) => STUDIO_VOCABULARY[mode ?? "commerce"];
