import { z } from "zod";

/**
 * Système de design tokens — voir docs/12-systeme-templates-et-direction-artistique.md
 * §12.8. Un `SiteTemplate` porte un jeu de tokens complet (`defaultDesignTokens`) ; une
 * entreprise ne stocke qu'une SURCHARGE PARTIELLE (`TenantSite.designTokenOverrides`,
 * voir `packages/database/src/templates-registry.ts`) qui ne modifie jamais le
 * template original — seule la fusion calculée à la volée en tient compte.
 */

// Couleur : on valide une chaîne CSS non vide (hex, rgb(), hsl(), var(--...)) plutôt
// qu'un format précis, pour rester compatible avec toutes les directions artistiques
// du §12.5 sans sur-contraindre le schéma.
const colorToken = z.string().min(1);

export const colorsSchema = z.object({
  primary: colorToken,
  secondary: colorToken,
  background: colorToken,
  surface: colorToken,
  surfaceMuted: colorToken,
  textPrimary: colorToken,
  textSecondary: colorToken,
  textMuted: colorToken,
  border: colorToken,
  success: colorToken,
  danger: colorToken,
  warning: colorToken,
});

const fontSizeScale = z.object({
  xs: z.string(),
  sm: z.string(),
  md: z.string(),
  lg: z.string(),
  xl: z.string(),
});

export const typographySchema = z.object({
  headingFont: z.string().min(1),
  bodyFont: z.string().min(1),
  headingSizes: fontSizeScale.extend({
    "2xl": z.string(),
    "3xl": z.string(),
    "4xl": z.string(),
  }),
  bodySizes: fontSizeScale,
});

export const spacingSchema = z.object({
  /** Échelle en unités croissantes, ex. ["0px","4px","8px",...] — voir §12.8. */
  scale: z.array(z.string()).min(8),
});

export const bordersSchema = z.object({
  width: z.string(),
  color: colorToken,
});

export const radiiSchema = z.object({
  sm: z.string(),
  md: z.string(),
  lg: z.string(),
  full: z.string(),
});

export const shadowsSchema = z.object({
  sm: z.string(),
  md: z.string(),
  lg: z.string(),
});

export const layoutSchema = z.object({
  contentMaxWidth: z.string(),
});

export const buttonStyleSchema = z.object({
  shape: z.enum(["square", "rounded", "pill"]),
  size: z.enum(["sm", "md", "lg"]),
  variant: z.enum(["solid", "outline", "ghost"]),
});

export const cardStyleSchema = z.object({
  radius: z.enum(["sm", "md", "lg"]),
  shadow: z.enum(["none", "sm", "md", "lg"]),
  border: z.boolean(),
});

export const headerStyleSchema = z.object({
  variant: z.enum(["solid", "transparent-on-hero", "sticky"]),
  height: z.string(),
});

export const footerStyleSchema = z.object({
  variant: z.enum(["simple", "expanded", "minimal"]),
});

export const formStyleSchema = z.object({
  inputRadius: z.enum(["sm", "md", "lg"]),
  inputBorderStyle: z.enum(["solid", "underline"]),
});

/** Les 3 niveaux d'animation validés — voir docs/12 §12.2. */
export const animationLevelSchema = z.enum(["discreet", "dynamic", "immersive"]);

export const animationSchema = z.object({
  level: animationLevelSchema,
  durations: z.object({
    fast: z.number().int().positive(),
    base: z.number().int().positive(),
    slow: z.number().int().positive(),
  }),
  easing: z.object({
    standard: z.string(),
    decelerate: z.string(),
    accelerate: z.string(),
  }),
});

export const designTokensSchema = z.object({
  colors: colorsSchema,
  typography: typographySchema,
  spacing: spacingSchema,
  borders: bordersSchema,
  radii: radiiSchema,
  shadows: shadowsSchema,
  layout: layoutSchema,
  buttonStyle: buttonStyleSchema,
  cardStyle: cardStyleSchema,
  headerStyle: headerStyleSchema,
  footerStyle: footerStyleSchema,
  formStyle: formStyleSchema,
  animation: animationSchema,
});

export type DesignTokens = z.infer<typeof designTokensSchema>;
export type AnimationLevel = z.infer<typeof animationLevelSchema>;

/** Surcharge partielle à deux niveaux (groupe puis clé) — voir merge.ts. */
export type DesignTokensOverrides = {
  [K in keyof DesignTokens]?: Partial<DesignTokens[K]>;
};

export function parseDesignTokens(value: unknown): DesignTokens {
  return designTokensSchema.parse(value);
}

export function isValidDesignTokens(value: unknown): value is DesignTokens {
  return designTokensSchema.safeParse(value).success;
}
