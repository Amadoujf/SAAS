import * as z from "zod/v4";

/**
 * Ce que l'IA a le droit de renvoyer — et rien d'autre. Réponses validées contre ces
 * schémas (sortie structurée du fournisseur + revalidation serveur), puis COMPILÉES par
 * la plateforme en sections et réglages existants (compile.ts, operations.ts). Aucun
 * code, aucun HTML, aucune URL libre : seulement des choix parmi des listes fermées,
 * des identifiants de produits de l'entreprise et des textes courts modifiables.
 */

export const STYLE_KEYS = ["sunu-marche", "atelier-naya", "teranga-atelier", "commerce-moderne", "luxury-minimal", "marketplace", "dakar-distribution-pro"] as const;
export const ANIMATION_LEVELS = ["discreet", "dynamic", "immersive"] as const;
export const MOBILE_ANIMATION = ["same", "reduced", "none"] as const;

const hex = z.string().describe("Couleur hexadécimale #RRGGBB");

export const directionSchema = z.object({
  name: z.string().max(40).describe("Nom court et évocateur de la direction"),
  pitch: z.string().max(220).describe("Pourquoi elle convient à cette entreprise, en une ou deux phrases"),
  style: z.enum(STYLE_KEYS).describe("Style de base (typographie, formes, ambiance)"),
  palette: z.object({ primary: hex, accent: hex, background: hex }),
  animation: z.enum(ANIMATION_LEVELS),
  hero: z.object({
    layout: z.enum(["stage", "centered", "architectural"]).describe("stage = sujet mis en scène à côté du texte ; centered = texte centré sur un sujet ; architectural = grande photographie plein cadre"),
    eyebrow: z.string().max(60),
    title: z.string().max(70),
    titleAccent: z.string().max(50).describe("Suite du titre mise en valeur, ou chaîne vide"),
    subtitle: z.string().max(200),
    ctaLabel: z.string().max(28),
    subjectProductId: z.string().describe("Identifiant d'un produit photographié à mettre en scène, ou chaîne vide"),
  }),
  showcase: z.object({
    layout: z.enum(["depth", "stack", "arc"]),
    eyebrow: z.string().max(40),
    title: z.string().max(70),
    productIds: z.array(z.string()).max(10),
  }),
  story: z.object({
    enabled: z.boolean(),
    layout: z.enum(["sequence", "timeline", "product"]),
    eyebrow: z.string().max(40),
    title: z.string().max(80),
    steps: z
      .array(z.object({ productId: z.string(), title: z.string().max(60), body: z.string().max(220) }))
      .max(4)
      .describe("Une étape par produit : ce qui le distingue, d'après SA description uniquement"),
  }),
  showCategories: z.boolean(),
  showProductGrid: z.boolean(),
  order: z.array(z.enum(["hero", "showcase", "story", "categories", "grid"])).describe("Ordre des blocs de la page d'accueil"),
});

export const directionsOutputSchema = z.object({
  directions: z.array(directionSchema).length(3).describe("Trois directions réellement différentes"),
});

export type AiDirection = z.infer<typeof directionSchema>;
export type AiDirectionsOutput = z.infer<typeof directionsOutputSchema>;

/** Champs de texte modifiables par l'assistant (jamais un prix, un stock ou une fiche). */
export const TEXT_FIELDS = ["eyebrow", "title", "titleAccent", "subtitle", "intro", "primaryCtaLabel", "secondaryCtaLabel", "ctaLabel"] as const;
/** Réglages de présentation modifiables par l'assistant. */
export const OPTION_KEYS = ["backdrop", "imageStyle", "lighting", "scrollEffect", "intensity", "autoplay", "intervalSeconds", "displayCount", "showPrice", "objectStyle"] as const;

export const editOperationSchema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("move_section"), sectionId: z.string(), to: z.enum(["first", "last", "before", "after"]), relativeTo: z.string().describe("Section de référence pour before/after, sinon chaîne vide") }),
  z.object({ op: z.literal("set_text"), sectionId: z.string(), field: z.enum(TEXT_FIELDS), value: z.string().max(200) }),
  z.object({ op: z.literal("set_step_text"), sectionId: z.string(), stepIndex: z.number().int(), title: z.string().max(60), body: z.string().max(220) }),
  z.object({ op: z.literal("set_option"), sectionId: z.string(), option: z.enum(OPTION_KEYS), value: z.union([z.string(), z.number(), z.boolean()]) }),
  z.object({ op: z.literal("set_variant"), sectionId: z.string(), variant: z.string() }),
  z.object({ op: z.literal("feature_products"), sectionId: z.string(), strategy: z.enum(["newest", "list"]), productIds: z.array(z.string()).max(12) }),
  z.object({ op: z.literal("set_section_background"), sectionId: z.string(), color: hex }),
  z.object({ op: z.literal("set_colors"), primary: z.string().describe("#RRGGBB ou chaîne vide pour ne pas changer"), accent: z.string(), background: z.string() }),
  z.object({ op: z.literal("set_style"), style: z.enum(STYLE_KEYS) }),
  z.object({ op: z.literal("set_animation"), level: z.enum([...ANIMATION_LEVELS, "unchanged"]), mobile: z.enum([...MOBILE_ANIMATION, "unchanged"]) }),
  z.object({ op: z.literal("remove_section"), sectionId: z.string() }),
]);

export const editOutputSchema = z.object({
  reply: z.string().max(500).describe("Réponse courte à l'entreprise, en français, qui explique la proposition"),
  operations: z.array(editOperationSchema).max(12),
});

export type AiEditOperation = z.infer<typeof editOperationSchema>;
export type AiEditOutput = z.infer<typeof editOutputSchema>;
