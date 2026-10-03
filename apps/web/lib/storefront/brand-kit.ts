import type { DesignTokens } from "@yamacommerce/design-tokens";

/**
 * Kit de marque d'un site : typographie et formes, choisies dans des listes FERMÉES
 * (jamais une police ou une valeur libre). Appliqué par-dessus le style de base, comme
 * les couleurs (voir `applyBranding`), dans l'aperçu comme sur le site publié.
 * Toutes les polices sont auto-hébergées (lib/storefront/template-fonts.ts).
 */

export const FONT_PAIRS = {
  editorial: {
    label: "Éditorial",
    description: "Titres à empattements, texte net : magazine, artisanat, maison.",
    headingFont: "var(--font-tpl-serif), Georgia, serif",
    bodyFont: "var(--font-tpl-sans), system-ui, sans-serif",
    scale: 1,
  },
  couture: {
    label: "Couture",
    description: "Didone très contrastée, texte à empattements : luxe, mode, joaillerie.",
    headingFont: "var(--font-tpl-didone), Didot, Georgia, serif",
    bodyFont: "var(--font-tpl-serif), Georgia, serif",
    scale: 1.12,
  },
  moderne: {
    label: "Moderne",
    description: "Grotesque expressive : marque jeune, énergique, design.",
    headingFont: "var(--font-tpl-grotesk), system-ui, sans-serif",
    bodyFont: "var(--font-tpl-sans), system-ui, sans-serif",
    scale: 0.94,
  },
  neutre: {
    label: "Neutre",
    description: "Une seule famille sans empattements : sobre, technique, grand catalogue.",
    headingFont: "var(--font-tpl-sans), system-ui, sans-serif",
    bodyFont: "var(--font-tpl-sans), system-ui, sans-serif",
    scale: 0.9,
  },
} as const;

export const SHAPES = {
  sharp: { label: "Angles vifs", radii: { sm: "0px", md: "0px", lg: "0px" }, button: "square", card: "none" },
  soft: { label: "Arrondis doux", radii: { sm: "4px", md: "8px", lg: "14px" }, button: "rounded", card: "md" },
  round: { label: "Formes rondes", radii: { sm: "10px", md: "18px", lg: "28px" }, button: "pill", card: "lg" },
} as const;

export type FontPairKey = keyof typeof FONT_PAIRS;
export type ShapeKey = keyof typeof SHAPES;
export const FONT_PAIR_KEYS = Object.keys(FONT_PAIRS) as FontPairKey[];
export const SHAPE_KEYS = Object.keys(SHAPES) as ShapeKey[];

export function isFontPair(value: unknown): value is FontPairKey {
  return typeof value === "string" && value in FONT_PAIRS;
}
export function isShape(value: unknown): value is ShapeKey {
  return typeof value === "string" && value in SHAPES;
}

function scaleSize(value: string, factor: number): string {
  const m = /^([\d.]+)rem$/.exec(value);
  return m ? `${Math.round(Number(m[1]) * factor * 1000) / 1000}rem` : value;
}

export function applyBrandKit(tokens: DesignTokens, kit: { fontPair?: unknown; shape?: unknown }): DesignTokens {
  let next = tokens;
  if (isFontPair(kit.fontPair)) {
    const pair = FONT_PAIRS[kit.fontPair];
    const sizes = Object.fromEntries(
      Object.entries(tokens.typography.headingSizes).map(([k, v]) => [k, ["2xl", "3xl", "4xl"].includes(k) ? scaleSize(v, pair.scale) : v]),
    ) as DesignTokens["typography"]["headingSizes"];
    next = { ...next, typography: { ...next.typography, headingFont: pair.headingFont, bodyFont: pair.bodyFont, headingSizes: sizes } };
  }
  if (isShape(kit.shape)) {
    const shape = SHAPES[kit.shape];
    next = {
      ...next,
      radii: { ...next.radii, ...shape.radii },
      buttonStyle: { ...next.buttonStyle, shape: shape.button },
      cardStyle: { ...next.cardStyle, radius: shape.card === "none" ? "sm" : shape.card },
      formStyle: { ...next.formStyle, inputRadius: shape.card === "none" ? "sm" : shape.card },
    };
  }
  return next;
}
