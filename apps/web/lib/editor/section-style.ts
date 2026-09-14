import type { DesignTokens } from "@yamacommerce/design-tokens";
import type { SectionSpacingValues, SectionStyleOverride } from "@yamacommerce/templates";

/**
 * Traduit une `SectionStyleOverride` (voir @yamacommerce/templates) en variables CSS —
 * voir apps/web/lib/design-tokens-to-css.ts pour la convention de nommage réutilisée
 * ici À L'IDENTIQUE. Poser ce style sur un conteneur enveloppant UNE section suffit à
 * la personnaliser : ses composants internes consomment déjà ces mêmes variables,
 * aucun n'a besoin d'être modifié (voir la note de tête de section-renderer.tsx).
 *
 * `headingSize`/`bodySize`/`radius`/`shadow` référencent une clé de l'échelle de
 * `tokens` (jamais une valeur figée) — résolus ICI, au moment du rendu, avec les
 * tokens EFFECTIFS de ce site (donc cohérents si ces tokens changent plus tard).
 */
export function styleOverrideToCssVars(
  override: SectionStyleOverride | undefined,
  tokens: DesignTokens,
): React.CSSProperties {
  if (!override) return {};
  const vars: Record<string, string> = {};

  if (override.colorPrimary) vars["--color-primary"] = override.colorPrimary;
  if (override.colorSecondary) vars["--color-secondary"] = override.colorSecondary;
  if (override.colorBackground) vars["--color-background"] = override.colorBackground;
  if (override.colorTextPrimary) vars["--color-text-primary"] = override.colorTextPrimary;
  if (override.colorTextSecondary) vars["--color-text-secondary"] = override.colorTextSecondary;
  if (override.headingFont) vars["--font-heading"] = override.headingFont;
  if (override.bodyFont) vars["--font-body"] = override.bodyFont;

  if (override.headingSize) {
    const value = tokens.typography.headingSizes[override.headingSize];
    for (const key of ["xs", "sm", "md", "lg", "xl", "2xl", "3xl", "4xl"] as const) {
      vars[`--text-heading-${key}`] = value;
    }
  }
  if (override.bodySize) {
    const value = tokens.typography.bodySizes[override.bodySize];
    for (const key of ["xs", "sm", "md", "lg", "xl"] as const) {
      vars[`--text-body-${key}`] = value;
    }
  }

  if (override.borderColor) vars["--border-color"] = override.borderColor;
  if (override.borderWidth) vars["--border-width"] = override.borderWidth;
  if (override.radius) {
    vars["--card-radius"] = override.radius === "none" ? "0px" : tokens.radii[override.radius];
  }
  if (override.shadow) {
    vars["--card-shadow"] = override.shadow === "none" ? "none" : tokens.shadows[override.shadow];
  }
  if (override.maxWidth) vars["--content-max-width"] = override.maxWidth;

  const style = vars as React.CSSProperties;
  if (override.textAlign) style.textAlign = override.textAlign;
  return style;
}

export function hasStyleOverride(override: SectionStyleOverride | undefined): boolean {
  return Boolean(override && Object.keys(override).length > 0);
}

/** Marge/espacement d'UN point de rupture, en style inline. */
export function spacingValuesToStyle(values: SectionSpacingValues | undefined): React.CSSProperties {
  if (!values) return {};
  const style: React.CSSProperties = {};
  if (values.marginTop) style.marginTop = values.marginTop;
  if (values.marginBottom) style.marginBottom = values.marginBottom;
  if (values.paddingY) {
    style.paddingTop = values.paddingY;
    style.paddingBottom = values.paddingY;
  }
  if (values.paddingX) {
    style.paddingLeft = values.paddingX;
    style.paddingRight = values.paddingX;
  }
  return style;
}

function toCssDeclarations(values: SectionSpacingValues): string {
  const style = spacingValuesToStyle(values);
  return Object.entries(style)
    .map(([prop, value]) => `${prop.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}: ${value};`)
    .join(" ");
}

/**
 * Génère les règles `@media` (points de rupture Tailwind déjà utilisés partout
 * ailleurs dans ce projet : 640px, 1024px) pour un espacement par section — c'est ce
 * qui rend "réglages distincts pour ordinateur/tablette/téléphone" réel, aussi bien sur
 * le site publié que dans l'aperçu de l'éditeur : depuis le 21 septembre 2026, l'aperçu
 * est un VRAI document dans un `<iframe>` séparé (voir `PreviewFrameApp`), avec un VRAI
 * viewport — ces règles s'y déclenchent donc exactement comme pour un vrai visiteur,
 * sans mécanisme de "forçage" séparé (l'ancien `forcePreviewViewport`, retiré).
 */
export function spacingOverrideToMediaCss(
  className: string,
  spacing: {
    desktop?: SectionSpacingValues;
    tablet?: SectionSpacingValues;
    mobile?: SectionSpacingValues;
  },
): string {
  const rules: string[] = [];
  if (spacing.mobile) rules.push(`.${className} { ${toCssDeclarations(spacing.mobile)} }`);
  if (spacing.tablet) {
    rules.push(`@media (min-width: 640px) { .${className} { ${toCssDeclarations(spacing.tablet)} } }`);
  }
  if (spacing.desktop) {
    rules.push(`@media (min-width: 1024px) { .${className} { ${toCssDeclarations(spacing.desktop)} } }`);
  }
  return rules.join("\n");
}

/** Nom de classe CSS stable et valide dérivé d'un identifiant de section quelconque. */
export function spacingClassNameForSection(sectionId: string): string {
  return `sec-space-${sectionId.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
}

const HOVER_EFFECT_CLASS: Record<"none" | "lift" | "zoom" | "glow", string> = {
  none: "",
  lift: "transition-transform duration-300 hover:-translate-y-1",
  zoom: "transition-transform duration-300 hover:scale-[1.01]",
  glow: "transition-shadow duration-300 hover:shadow-[0_0_40px_-8px_var(--color-primary)]",
};

/** Classe Tailwind pour l'effet de survol posé sur le CONTENEUR de la section dans son
 *  ensemble — voir @yamacommerce/templates `SectionAnimationDetail.hoverEffect` et la
 *  limite assumée : n'affecte pas les survols déjà propres à des éléments internes
 *  (ex. une carte produit a son propre effet de survol, inchangé). */
export function hoverEffectClassName(hoverEffect: "none" | "lift" | "zoom" | "glow" | undefined): string {
  return HOVER_EFFECT_CLASS[hoverEffect ?? "none"];
}
