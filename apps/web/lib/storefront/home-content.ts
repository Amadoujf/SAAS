import { applyBrandKit } from "./brand-kit";
import { z } from "zod";
import type { DesignTokens } from "@yamacommerce/design-tokens";

/**
 * Contenus mis en avant sur l'accueil de la boutique — éditables dans « Mon site ».
 * Tous les textes, prix, boutons et décors sont rendus par l'interface (jamais incrustés
 * dans une image) : ils restent modifiables, animables et lisibles sur mobile.
 *
 * Images : chemin interne (médiathèque `/api/media/…`, visuels de démonstration
 * `/demo-templates/…`) ou URL https — jamais `javascript:` ni `//hôte`. `demo: true`
 * marque un visuel de démonstration, signalé dans « Mon site » pour être remplacé.
 */

const safeHref = z
  .string()
  .trim()
  .max(300)
  .refine((v) => (v.startsWith("/") && !v.startsWith("//")) || /^https:\/\/[^\s]+$/.test(v), "Lien invalide : chemin commençant par « / » ou adresse https.");

const imageUrl = safeHref.nullable();

export const heroSlideSchema = z.object({
  id: z.string().min(1).max(40),
  imageUrl,
  mobileImageUrl: imageUrl.optional().default(null),
  imageAlt: z.string().trim().max(140).default(""),
  demo: z.boolean().default(false),
  eyebrow: z.string().trim().max(60).default(""),
  title: z.string().trim().min(1, "Titre requis.").max(90),
  subtitle: z.string().trim().max(220).default(""),
  ctaLabel: z.string().trim().max(40).default(""),
  ctaHref: safeHref.or(z.literal("")).default(""),
  theme: z.enum(["light", "dark"]).default("dark"),
  /** Produit mis en scène par la diapositive : son nom, son prix et l'aperçu rapide
   *  changent avec le visuel. Vérifié au rendu (produit publié de l'entreprise). */
  productId: z.string().max(60).nullable().default(null),
});

export const collectionSchema = z.object({
  id: z.string().min(1).max(40),
  eyebrow: z.string().trim().max(40).default(""),
  title: z.string().trim().min(1).max(60),
  subtitle: z.string().trim().max(160).default(""),
  imageUrl,
  demo: z.boolean().default(false),
  href: safeHref.or(z.literal("")).default("/catalogue"),
});

export const REASSURANCE_ICONS = ["truck", "box", "card", "leaf", "phone", "shield"] as const;

export const homeContentSchema = z.object({
  announcement: z.object({ text: z.string().trim().min(1).max(120), href: safeHref.or(z.literal("")).default("") }).nullable().default(null),
  hero: z.object({
    autoplaySeconds: z.number().int().min(3).max(15).default(6),
    slides: z.array(heroSlideSchema).min(1, "Au moins une diapositive.").max(6),
  }),
  featuredCategoryIds: z.array(z.string().min(1)).max(8).default([]),
  featuredProductIds: z.array(z.string().min(1)).max(12).default([]),
  collections: z.array(collectionSchema).max(4).default([]),
  reassurance: z
    .array(z.object({ icon: z.enum(REASSURANCE_ICONS), title: z.string().trim().min(1).max(50), text: z.string().trim().max(80).default("") }))
    .max(4)
    .default([]),
});

export type HomeContent = z.infer<typeof homeContentSchema>;
export type HeroSlide = z.infer<typeof heroSlideSchema>;

/** Contenu par défaut d'une entreprise RÉELLE : aucune photo de démonstration (elle
 *  ne représenterait pas ses produits) — un accueil typographique en attendant ses
 *  propres visuels. */
export function defaultHomeContent(tenantName: string): HomeContent {
  return {
    announcement: null,
    hero: {
      autoplaySeconds: 6,
      slides: [{ id: "accueil", imageUrl: null, mobileImageUrl: null, imageAlt: "", demo: false, productId: null, eyebrow: "Bienvenue", title: tenantName, subtitle: "Découvrez notre sélection et commandez en quelques instants.", ctaLabel: "Découvrir le catalogue", ctaHref: "/catalogue", theme: "dark" }],
    },
    featuredCategoryIds: [],
    featuredProductIds: [],
    collections: [],
    reassurance: [
      { icon: "truck", title: "Livraison au Sénégal", text: "Rapide et suivie" },
      { icon: "card", title: "Paiement flexible", text: "Wave, Orange Money ou à la livraison" },
      { icon: "phone", title: "Commande sur mobile", text: "En quelques instants" },
    ],
  };
}

/** Lecture tolérante : un contenu enregistré invalide (schéma plus ancien) ne casse
 *  jamais la boutique — il est remplacé par le contenu par défaut. */
export function parseHomeContent(raw: unknown, tenantName: string): HomeContent {
  if (raw == null) return defaultHomeContent(tenantName);
  const parsed = homeContentSchema.safeParse(raw);
  return parsed.success ? parsed.data : defaultHomeContent(tenantName);
}

// ---------------------------------------------------------------------------
// Couleurs de l'entreprise
// ---------------------------------------------------------------------------

const HEX = /^#[0-9a-fA-F]{6}$/;

function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

export function contrastRatio(a: string, b: string) {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1! + 0.05) / (l2! + 0.05);
}

/** Couleur principale : texte blanc des boutons lisible (WCAG AA, 4,5:1). */
export function validateBrandColor(hex: string): string | null {
  if (!HEX.test(hex)) return "Couleur invalide (format #RRGGBB).";
  if (contrastRatio(hex, "#FFFFFF") < 4.5) return "Couleur trop claire : le texte blanc des boutons ne serait pas lisible. Choisissez une teinte plus foncée.";
  return null;
}

/** Applique les couleurs de l'entreprise par-dessus le template. */
export function applyBranding(
  tokens: DesignTokens,
  branding: { primaryColor?: unknown; accentColor?: unknown; backgroundColor?: unknown; fontPair?: unknown; shape?: unknown },
): DesignTokens {
  const kitted = applyBrandKit(tokens, branding);
  const primary = typeof branding.primaryColor === "string" && HEX.test(branding.primaryColor) ? branding.primaryColor : null;
  const accent = typeof branding.accentColor === "string" && HEX.test(branding.accentColor) ? branding.accentColor : null;
  // Fond : appliqué seulement s'il reste lisible avec le texte du style choisi.
  const background =
    typeof branding.backgroundColor === "string" && HEX.test(branding.backgroundColor) && contrastRatio(branding.backgroundColor, tokens.colors.textPrimary) >= 7
      ? branding.backgroundColor
      : null;
  if (!primary && !accent && !background) return kitted;
  return {
    ...kitted,
    colors: {
      ...kitted.colors,
      ...(primary ? { primary, mutedSurface: primary } : {}),
      ...(accent ? { accentPrimary: accent, secondary: accent } : {}),
      ...(background ? { background } : {}),
    },
  };
}
