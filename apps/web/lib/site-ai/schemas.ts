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

/** Archétypes de page : des STRUCTURES différentes (sections, rythme, hiérarchie), pas
 *  des variantes de couleurs. Détail et composition : archetypes.ts. */
export const ARCHETYPE_KEYS = ["galerie", "atelier", "maison", "vitrine", "magazine", "marche"] as const;
export const FONT_PAIR_OPTIONS = ["editorial", "couture", "moderne", "neutre"] as const;
export const SHAPE_OPTIONS = ["sharp", "soft", "round"] as const;

export const directionSchema = z.object({
  name: z.string().max(40).describe("Nom court et évocateur de la direction"),
  pitch: z.string().max(220).describe("Pourquoi elle convient à cette entreprise, en une ou deux phrases"),
  archetype: z.enum(ARCHETYPE_KEYS).describe("Structure de la page d'accueil (voir la liste des archétypes)"),
  style: z.enum(STYLE_KEYS).describe("Style de base (en-tête, pied de page, détails)"),
  typography: z.enum(FONT_PAIR_OPTIONS).describe("Paire typographique"),
  shape: z.enum(SHAPE_OPTIONS).describe("Formes : angles vifs, arrondis doux ou formes rondes"),
  palette: z.object({ primary: hex, accent: hex, background: hex }),
  animation: z.enum(ANIMATION_LEVELS),
  heroProductId: z.string().describe("Produit photographié mis en scène à l'ouverture, ou chaîne vide"),
  signatureProductId: z.string().describe("Pièce phare (archétype maison), ou chaîne vide"),
  featuredProductIds: z.array(z.string()).max(10).describe("Produits photographiés mis en avant, dans l'ordre"),
  copy: z.object({
    heroEyebrow: z.string().max(60),
    heroTitle: z.string().max(70).describe("Titre d'ouverture (souvent le nom de l'entreprise ou une phrase courte)"),
    heroTitleAccent: z.string().max(50).describe("Suite du titre mise en valeur, ou chaîne vide"),
    heroSubtitle: z.string().max(200),
    ctaLabel: z.string().max(28),
    manifesto: z.string().max(160).describe("Une phrase qui dit ce que fait l'entreprise, d'après SA description"),
    manifestoBody: z.string().max(400).describe("Deux ou trois phrases concrètes, d'après la description fournie"),
    selectionTitle: z.string().max(60),
    storyTitle: z.string().max(80),
    closingTitle: z.string().max(80).describe("Invitation finale, sobre"),
    closingText: z.string().max(200),
  }),
  storySteps: z
    .array(z.object({ productId: z.string(), title: z.string().max(60), body: z.string().max(220) }))
    .max(4)
    .describe("Une étape par produit photographié : ce qui le distingue, d'après SA description uniquement"),
});

export const directionsOutputSchema = z.object({
  directions: z.array(directionSchema).length(3).describe("Trois directions sur trois archétypes DIFFÉRENTS"),
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

export type ArchetypeKey = (typeof ARCHETYPE_KEYS)[number];
