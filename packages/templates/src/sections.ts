import { z } from "zod";
import { animationLevelSchema } from "@yamacommerce/design-tokens";

/**
 * Catalogue des sections réutilisables — voir docs/09-plan-developpement.md, Phase 1,
 * et la demande de validation du 13 septembre 2026 (« moteur de sections »).
 *
 * Ce module définit CE QU'EST une section (clé, variantes visuelles, schéma de
 * paramètres) — le rendu React réel (comment une section s'affiche) est le sujet de
 * l'étape suivante (« moteur de rendu des templates »), volontairement pas construit
 * ici pour respecter l'ordre demandé.
 */

export const SECTION_KEYS = [
  "hero",
  "categories",
  "featured_products",
  "new_arrivals",
  "promotions",
  "benefits",
  "testimonials",
  "brands",
  "gallery",
  "video",
  "newsletter",
  "faq",
  "cta",
  "contact",
  "whatsapp",
  "custom_content",
] as const;

export type SectionKey = (typeof SECTION_KEYS)[number];

export function isSectionKey(value: string): value is SectionKey {
  return (SECTION_KEYS as readonly string[]).includes(value);
}

const mediaSchema = z.object({ url: z.string().url(), alt: z.string().optional() });

/** Schéma de paramètres propre à chaque section — validé à la création/modification
 *  d'une instance de section dans un template, jamais laissé libre. */
export const sectionParamSchemas = {
  hero: z.object({
    eyebrow: z.string().optional(),
    title: z.string().min(1),
    subtitle: z.string().optional(),
    media: mediaSchema,
    ctaLabel: z.string().optional(),
    ctaHref: z.string().optional(),
  }),
  categories: z.object({
    title: z.string().optional(),
    categoryIds: z.array(z.string()).min(1),
    displayCount: z.number().int().min(1).max(12).default(6),
  }),
  featured_products: z.object({
    title: z.string().optional(),
    productIds: z.array(z.string()).optional(), // vide = sélection automatique (top ventes)
    displayCount: z.number().int().min(1).max(24).default(8),
  }),
  new_arrivals: z.object({
    title: z.string().optional(),
    displayCount: z.number().int().min(1).max(24).default(8),
  }),
  promotions: z.object({
    title: z.string().optional(),
    promoCodeIds: z.array(z.string()).optional(),
    media: mediaSchema.optional(),
  }),
  benefits: z.object({
    items: z
      .array(z.object({ icon: z.string(), title: z.string(), description: z.string().optional() }))
      .min(1)
      .max(6),
  }),
  testimonials: z.object({
    items: z
      .array(
        z.object({
          author: z.string(),
          quote: z.string(),
          avatarUrl: z.string().optional(),
          rating: z.number().min(1).max(5).optional(),
        }),
      )
      .min(1),
  }),
  brands: z.object({
    logos: z.array(mediaSchema).min(1),
  }),
  gallery: z.object({
    title: z.string().optional(),
    images: z.array(mediaSchema).min(1),
  }),
  video: z.object({
    title: z.string().optional(),
    videoUrl: z.string().url(),
    posterUrl: z.string().optional(),
  }),
  newsletter: z.object({
    title: z.string().optional(),
    description: z.string().optional(),
  }),
  faq: z.object({
    items: z.array(z.object({ question: z.string(), answer: z.string() })).min(1),
  }),
  cta: z.object({
    title: z.string().min(1),
    description: z.string().optional(),
    buttonLabel: z.string(),
    buttonHref: z.string(),
  }),
  contact: z.object({
    address: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().email().optional(),
    showMap: z.boolean().default(false),
  }),
  whatsapp: z.object({
    phoneNumber: z.string(),
    defaultMessage: z.string().optional(),
  }),
  // Contenu libre : le HTML est assaini côté moteur de rendu (étape suivante), jamais
  // injecté tel quel — ce schéma ne fait que garantir la présence d'une chaîne.
  custom_content: z.object({
    html: z.string(),
  }),
} as const satisfies Record<SectionKey, z.ZodTypeAny>;

/** Variantes visuelles disponibles par section — voir docs/12 (« plusieurs variantes
 *  visuelles »). Le moteur de rendu (étape suivante) fournira un composant par variante. */
export const sectionVariants: Record<SectionKey, readonly string[]> = {
  hero: ["fullbleed", "split", "centered"],
  categories: ["grid", "carousel"],
  featured_products: ["grid", "carousel", "masonry"],
  new_arrivals: ["grid", "carousel"],
  promotions: ["banner", "split"],
  benefits: ["icons-row", "cards"],
  testimonials: ["carousel", "grid"],
  brands: ["marquee", "grid"],
  gallery: ["grid", "masonry", "carousel"],
  video: ["fullwidth", "framed"],
  newsletter: ["inline", "banner"],
  faq: ["accordion", "two-column"],
  cta: ["banner", "split"],
  contact: ["split", "centered"],
  whatsapp: ["floating-button", "inline-banner"],
  custom_content: ["default"],
};

export function isValidVariant(sectionKey: SectionKey, variant: string): boolean {
  return sectionVariants[sectionKey].includes(variant);
}

export function validateSectionParams(sectionKey: SectionKey, params: unknown): unknown {
  return sectionParamSchemas[sectionKey].parse(params);
}

/**
 * Une instance de section au sein d'une page de template : référence le type de
 * section, sa variante, ses paramètres (validés séparément via
 * `validateSectionParams`, le schéma ici reste `unknown` car il dépend de
 * `sectionKey`), son ordre, son état d'activation et un éventuel override d'animation
 * — voir « chaque section doit avoir ... un état désactivé, un ordre d'affichage ».
 */
export const sectionInstanceSchema = z.object({
  id: z.string(),
  sectionKey: z.enum(SECTION_KEYS),
  variant: z.string(),
  params: z.record(z.unknown()),
  order: z.number().int(),
  isEnabled: z.boolean().default(true),
  /** "inherit" = suit le niveau d'animation du site ; sinon override ponctuel. */
  animationOverride: z
    .union([z.literal("inherit"), z.literal("none"), animationLevelSchema])
    .default("inherit"),
  /** Variante spécifique pour l'affichage mobile — absente = même variante que desktop. */
  mobileVariant: z.string().optional(),
});

export type SectionInstance = z.infer<typeof sectionInstanceSchema>;

/**
 * Valide une instance de section de bout en bout : clé connue, variante compatible
 * avec cette clé, et paramètres conformes au schéma de cette section.
 */
export function validateSectionInstance(raw: unknown): SectionInstance {
  const instance = sectionInstanceSchema.parse(raw);
  if (!isValidVariant(instance.sectionKey, instance.variant)) {
    throw new Error(
      `Variante "${instance.variant}" invalide pour la section "${instance.sectionKey}". ` +
        `Variantes disponibles : ${sectionVariants[instance.sectionKey].join(", ")}.`,
    );
  }
  validateSectionParams(instance.sectionKey, instance.params);
  return instance;
}
