import { z } from "zod";

/**
 * Générateur de description de champ à partir d'un schéma Zod — voir docs/12 §12.2,
 * « Les formulaires doivent être générés à partir des schémas des sections autant que
 * possible. ». Module VOLONTAIREMENT générique : il ne connaît AUCUN nom de champ
 * propre à l'e-commerce ou à un template précis (voir la consigne du 20 septembre 2026,
 * « ne code aucun réglage propre à Maison Almadies ») — il inspecte uniquement la FORME
 * du schéma (`ZodString`/`ZodNumber`/`ZodEnum`/`ZodArray`/`ZodObject`/...), ce qui lui
 * permet de fonctionner identiquement pour les 23 sections e-commerce déjà livrées ET
 * pour n'importe quel schéma de section d'un futur secteur (immobilier, hôtellerie...).
 *
 * Le seul endroit où ce module "devine" un peu au-delà de la forme pure est la
 * traduction française des noms de champs (`FIELD_LABELS`/`WORD_LABELS` ci-dessous) :
 * un dictionnaire de termes ANGLAIS COURANTS de développement web (title, media, href,
 * ids...), pas des réglages propres à une entreprise — un champ inconnu retombe
 * proprement sur une mise en forme automatique du nom (jamais un plantage).
 */

export type FieldKind =
  | "text"
  | "textarea"
  | "url"
  | "email"
  | "color"
  | "number"
  | "boolean"
  | "enum"
  | "id-list"
  | "array-object"
  | "object"
  | "unsupported";

export interface FieldDescriptor {
  /** Nom technique du champ (clé de l'objet parent). */
  name: string;
  /** Libellé humain en français, dérivé du nom (voir humanizeFieldName). */
  label: string;
  kind: FieldKind;
  required: boolean;
  defaultValue?: unknown;
  enumOptions?: string[];
  min?: number;
  max?: number;
  /** Pour "array-object" : description des champs de CHAQUE élément du tableau. */
  itemFields?: FieldDescriptor[];
  /** Pour "object" : description des champs imbriqués. */
  fields?: FieldDescriptor[];
}

/** Libellés de noms de champs COMPLETS (les plus lisibles) — termes de développement
 *  web génériques, applicables à n'importe quel secteur. */
const FIELD_LABELS: Record<string, string> = {
  title: "Titre",
  subtitle: "Sous-titre",
  eyebrow: "Surtitre",
  description: "Description",
  body: "Texte",
  statement: "Déclaration",
  intro: "Introduction",
  html: "Contenu HTML",
  media: "Média",
  url: "Lien",
  alt: "Texte alternatif",
  ctaLabel: "Texte du bouton",
  ctaHref: "Lien du bouton",
  buttonLabel: "Texte du bouton",
  buttonHref: "Lien du bouton",
  videoUrl: "Lien de la vidéo",
  posterUrl: "Image d'aperçu",
  avatarUrl: "Photo",
  displayCount: "Nombre affiché",
  categoryIds: "Catégories associées",
  productIds: "Produits associés",
  promoCodeIds: "Codes promo associés",
  designerIds: "Créateurs associés",
  phoneNumber: "Numéro de téléphone",
  defaultMessage: "Message par défaut",
  showMap: "Afficher la carte",
  isPreorder: "Précommande activée",
  piecesRemaining: "Pièces restantes",
  preorderReleaseDate: "Date de sortie",
  collectionNumber: "Numéro de collection",
  detailMedia: "Média détaillé",
  quickCategories: "Raccourcis de catégories",
  searchPlaceholder: "Texte indicatif de recherche",
  author: "Auteur",
  quote: "Citation",
  rating: "Note",
  productPurchased: "Produit acheté",
  logos: "Logos",
  images: "Images",
  image: "Image",
  icon: "Icône",
  items: "Éléments",
  question: "Question",
  answer: "Réponse",
  address: "Adresse",
  phone: "Téléphone",
  email: "Courriel",
  value: "Valeur",
  label: "Libellé",
  href: "Lien",
  stats: "Statistiques",
  regions: "Régions",
  region: "Région",
  craft: "Savoir-faire",
  name: "Nom",
  x: "Position horizontale (%)",
  y: "Position verticale (%)",
  hotspots: "Points d'intérêt",
  designerId: "Créateur",
  productId: "Produit",
  // Termes génériques de systèmes de design (palette/typographie/boutons/cartes/
  // en-tête/pied de page/formulaires) — voir @yamacommerce/design-tokens, le socle
  // commun à TOUS les templates et secteurs, pas un vocabulaire propre à un client.
  primary: "Couleur principale",
  secondary: "Couleur secondaire",
  background: "Arrière-plan",
  surface: "Surface",
  surfaceMuted: "Surface atténuée",
  textPrimary: "Texte principal",
  textSecondary: "Texte secondaire",
  textMuted: "Texte atténué",
  border: "Bordure",
  success: "Succès",
  danger: "Danger",
  warning: "Avertissement",
  accentPrimary: "Accent principal",
  accentSecondary: "Accent secondaire",
  leather: "Ton cuir",
  champagne: "Ton champagne",
  overlay: "Voile (overlay)",
  mutedSurface: "Surface neutre sur fond sombre",
  headingFont: "Police des titres",
  bodyFont: "Police du texte",
  headingSizes: "Tailles de titres",
  bodySizes: "Tailles de texte",
  shape: "Forme",
  size: "Taille",
  variant: "Variante",
  radius: "Arrondi",
  shadow: "Ombre",
  height: "Hauteur",
  inputRadius: "Arrondi des champs",
  inputBorderStyle: "Style de bordure des champs",
  level: "Niveau",
  logoUrl: "Logo",
  faviconUrl: "Favicon",
  // Champs FIXES de `SectionStyleOverride`/`SectionSpacingValues`/
  // `SectionAnimationDetail` (voir @yamacommerce/templates) — le MÊME contrat pour
  // toutes les sections et tous les secteurs, jamais un réglage propre à un template.
  colorPrimary: "Couleur principale",
  colorSecondary: "Couleur secondaire",
  colorBackground: "Couleur d'arrière-plan",
  colorTextPrimary: "Couleur du texte principal",
  colorTextSecondary: "Couleur du texte secondaire",
  headingSize: "Taille des titres",
  bodySize: "Taille du texte",
  textAlign: "Alignement du texte",
  borderColor: "Couleur de bordure",
  borderWidth: "Épaisseur de bordure",
  maxWidth: "Largeur maximale",
  marginTop: "Marge supérieure",
  marginBottom: "Marge inférieure",
  paddingX: "Espacement horizontal",
  paddingY: "Espacement vertical",
  durationMs: "Durée (ms)",
  delayMs: "Délai (ms)",
  hoverEffect: "Effet au survol",
  // Sections immersives (octobre 2026).
  titleAccent: "Mot mis en valeur",
  primaryCtaLabel: "Bouton principal — texte",
  primaryCtaHref: "Bouton principal — lien",
  secondaryCtaLabel: "Bouton secondaire — texte",
  secondaryCtaHref: "Bouton secondaire — lien",
  subjectImage: "Image du sujet (détourée de préférence)",
  subjectAlt: "Description de l'image du sujet",
  subjectStyle: "Présentation du sujet",
  focalX: "Point focal horizontal (%)",
  focalY: "Point focal vertical (%)",
  layers: "Éléments de la scène (détourés)",
  imageUrl: "Image",
  imageAlt: "Description de l'image",
  depth: "Profondeur (0 = fond, 1 = premier plan)",
  offsetX: "Décalage horizontal (%)",
  offsetY: "Décalage vertical (%)",
  scale: "Échelle",
  rotate: "Rotation (degrés)",
  arriveFrom: "Arrivée depuis",
  mobileImage: "Image de remplacement sur mobile",
  backgroundColor: "Couleur de fond",
  backgroundImage: "Image de fond",
  lighting: "Éclairage",
  scrollEffect: "Effet au défilement",
  floating: "Flottement léger",
  intensity: "Intensité des animations",
  source: "Contenus présentés",
  listingIds: "Fiches associées",
  showPrice: "Afficher le prix",
  autoplay: "Défilement automatique",
  intervalSeconds: "Intervalle (secondes)",
  backdrop: "Arrière-plan",
  badge: "Étiquette",
  accentColor: "Couleur d'accent",
  steps: "Étapes",
  focusX: "Cadrage horizontal (%)",
  focusY: "Cadrage vertical (%)",
  zoom: "Zoom sur le détail",
  imageStyle: "Présentation des visuels",
  overrides: "Habillage par élément (visuel détouré, couleur)",
  recordId: "Produit ou fiche",
  objectScale: "Taille de l'objet",
};

/** Traduction MOT PAR MOT (repli quand le nom complet n'a pas d'entrée dédiée). */
const WORD_LABELS: Record<string, string> = {
  title: "titre",
  label: "libellé",
  href: "lien",
  url: "lien",
  media: "média",
  description: "description",
  count: "nombre",
  display: "affichage",
  ids: "associés",
  id: "identifiant",
  cta: "bouton",
  button: "bouton",
  poster: "aperçu",
  video: "vidéo",
  avatar: "photo",
  phone: "téléphone",
  number: "numéro",
  message: "message",
  default: "par défaut",
  show: "afficher",
  map: "carte",
  pieces: "pièces",
  remaining: "restantes",
  preorder: "précommande",
  release: "sortie",
  date: "date",
  detail: "détail",
  quick: "raccourci",
  categories: "catégories",
  category: "catégorie",
  search: "recherche",
  placeholder: "texte indicatif",
  is: "",
};

function splitCamelCase(name: string): string[] {
  return name
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((word) => word.toLowerCase());
}

/** Dérive un libellé français lisible à partir d'un nom de champ technique — jamais
 *  d'échec : un nom totalement inconnu retombe sur ses mots capitalisés. */
export function humanizeFieldName(name: string): string {
  if (FIELD_LABELS[name]) return FIELD_LABELS[name];
  const words = splitCamelCase(name);
  const translated = words.map((word) => WORD_LABELS[word] ?? word).filter(Boolean);
  if (translated.length === 0) return name;
  return translated[0]!.charAt(0).toUpperCase() + translated[0]!.slice(1) + " " + translated.slice(1).join(" ");
}

interface Unwrapped {
  schema: z.ZodTypeAny;
  required: boolean;
  defaultValue?: unknown;
}

function unwrap(schema: z.ZodTypeAny): Unwrapped {
  let required = true;
  let defaultValue: unknown;
  let current = schema;
  for (;;) {
    if (current instanceof z.ZodDefault) {
      defaultValue = current._def.defaultValue();
      required = false;
      current = current._def.innerType;
      continue;
    }
    if (current instanceof z.ZodOptional) {
      required = false;
      current = current.unwrap();
      continue;
    }
    if (current instanceof z.ZodNullable) {
      current = current.unwrap();
      continue;
    }
    // Règle de validation personnalisée (`.refine`) : le champ garde la forme de son
    // schéma interne (chaîne, nombre…), la règle reste appliquée à l'enregistrement.
    if (current instanceof z.ZodEffects) {
      current = current.innerType();
      continue;
    }
    break;
  }
  return { schema: current, required, defaultValue };
}

const TEXTAREA_FIELD_NAMES = new Set([
  "body",
  "description",
  "subtitle",
  "quote",
  "intro",
  "html",
  "answer",
  "statement",
  "defaultMessage",
  "craft",
]);

/** Décrit un champ unique — utilisé récursivement pour les objets/tableaux imbriqués. */
export function describeField(name: string, rawSchema: z.ZodTypeAny): FieldDescriptor {
  const { schema, required, defaultValue } = unwrap(rawSchema);
  const label = humanizeFieldName(name);
  const base = { name, label, required, defaultValue };

  if (schema instanceof z.ZodString) {
    const isUrl = schema._def.checks?.some((check) => check.kind === "url") ?? false;
    const isEmail = schema._def.checks?.some((check) => check.kind === "email") ?? false;
    const isColor = /color/i.test(name);
    // Référence d'image (URL absolue OU chemin de la médiathèque) : même champ « lien »
    // que les URL, donc même bouton Médiathèque — jamais pour un texte alternatif.
    const isImageRef = /(^image$|image$|imageurl$)/i.test(name) && !/alt$/i.test(name);
    if (isColor) return { ...base, kind: "color" };
    if (isUrl || isImageRef) return { ...base, kind: "url" };
    if (isEmail) return { ...base, kind: "email" };
    if (TEXTAREA_FIELD_NAMES.has(name)) return { ...base, kind: "textarea" };
    return { ...base, kind: "text" };
  }

  if (schema instanceof z.ZodNumber) {
    const minCheck = schema._def.checks?.find((check) => check.kind === "min") as
      | { value: number }
      | undefined;
    const maxCheck = schema._def.checks?.find((check) => check.kind === "max") as
      | { value: number }
      | undefined;
    return { ...base, kind: "number", min: minCheck?.value, max: maxCheck?.value };
  }

  if (schema instanceof z.ZodBoolean) {
    return { ...base, kind: "boolean" };
  }

  if (schema instanceof z.ZodEnum) {
    return { ...base, kind: "enum", enumOptions: schema.options as string[] };
  }

  if (schema instanceof z.ZodArray) {
    const { schema: element } = unwrap(schema._def.type as z.ZodTypeAny);
    const min = schema._def.minLength?.value;
    const max = schema._def.maxLength?.value;
    if (element instanceof z.ZodString) {
      // Convention utilisée par toutes les sections e-commerce ET compatible avec
      // n'importe quel futur secteur : un tableau de chaînes nommé "...Ids" référence
      // des éléments métier externes (catalogue, base tenant) — édité comme une simple
      // liste d'identifiants, jamais comme un vrai sélecteur de catalogue ici (voir la
      // limite assumée : pas d'accès catalogue en direct dans l'éditeur).
      return { ...base, kind: "id-list", min, max };
    }
    if (element instanceof z.ZodObject) {
      return {
        ...base,
        kind: "array-object",
        min,
        max,
        itemFields: describeObjectSchema(element),
      };
    }
    return { ...base, kind: "unsupported" };
  }

  if (schema instanceof z.ZodObject) {
    return { ...base, kind: "object", fields: describeObjectSchema(schema) };
  }

  return { ...base, kind: "unsupported" };
}

/** Décrit tous les champs d'un schéma d'objet Zod, dans l'ordre de déclaration. */
export function describeObjectSchema(schema: z.ZodObject<z.ZodRawShape>): FieldDescriptor[] {
  return Object.entries(schema.shape).map(([name, fieldSchema]) =>
    describeField(name, fieldSchema as z.ZodTypeAny),
  );
}

/** Construit une valeur "vide" plausible pour un champ, utilisée quand on ajoute un
 *  nouvel élément à un tableau d'objets (ex. "Ajouter un élément" dans "benefits"). */
export function emptyValueForField(field: FieldDescriptor): unknown {
  switch (field.kind) {
    case "text":
    case "textarea":
    case "url":
    case "email":
    case "color":
      return "";
    case "number":
      return field.min ?? 0;
    case "boolean":
      return false;
    case "enum":
      return field.enumOptions?.[0] ?? "";
    case "id-list":
      return [];
    case "array-object":
      return [];
    case "object":
      return Object.fromEntries((field.fields ?? []).map((f) => [f.name, emptyValueForField(f)]));
    default:
      return undefined;
  }
}
