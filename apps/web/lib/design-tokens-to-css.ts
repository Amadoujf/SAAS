import type { DesignTokens } from "@yamacommerce/design-tokens";

/**
 * Convertit un `DesignTokens` résolu (template + surcharge tenant, voir
 * `resolveEffectiveDesignTokens` dans @yamacommerce/database) en variables CSS
 * personnalisées. Les composants de section consomment ces variables
 * (`var(--color-primary)`, etc.) plutôt que les valeurs brutes — c'est ce qui permet à
 * un même composant de rendre différemment selon le thème effectif du tenant, sans
 * jamais exécuter de code fourni par le client (uniquement des chaînes CSS).
 */
export function designTokensToCssVariables(tokens: DesignTokens): Record<string, string> {
  return {
    "--color-primary": tokens.colors.primary,
    "--color-secondary": tokens.colors.secondary,
    "--color-background": tokens.colors.background,
    "--color-surface": tokens.colors.surface,
    "--color-surface-muted": tokens.colors.surfaceMuted,
    "--color-text-primary": tokens.colors.textPrimary,
    "--color-text-secondary": tokens.colors.textSecondary,
    "--color-text-muted": tokens.colors.textMuted,
    "--color-border": tokens.colors.border,
    "--color-success": tokens.colors.success,
    "--color-danger": tokens.colors.danger,
    "--color-warning": tokens.colors.warning,
    "--color-accent-primary": tokens.colors.accentPrimary,
    "--color-accent-secondary": tokens.colors.accentSecondary,
    "--color-leather": tokens.colors.leather,
    "--color-champagne": tokens.colors.champagne,
    "--color-overlay": tokens.colors.overlay,
    "--color-muted-surface": tokens.colors.mutedSurface,

    "--font-heading": tokens.typography.headingFont,
    "--font-body": tokens.typography.bodyFont,
    "--text-heading-xs": tokens.typography.headingSizes.xs,
    "--text-heading-sm": tokens.typography.headingSizes.sm,
    "--text-heading-md": tokens.typography.headingSizes.md,
    "--text-heading-lg": tokens.typography.headingSizes.lg,
    "--text-heading-xl": tokens.typography.headingSizes.xl,
    "--text-heading-2xl": tokens.typography.headingSizes["2xl"],
    "--text-heading-3xl": tokens.typography.headingSizes["3xl"],
    "--text-heading-4xl": tokens.typography.headingSizes["4xl"],
    "--text-body-xs": tokens.typography.bodySizes.xs,
    "--text-body-sm": tokens.typography.bodySizes.sm,
    "--text-body-md": tokens.typography.bodySizes.md,
    "--text-body-lg": tokens.typography.bodySizes.lg,
    "--text-body-xl": tokens.typography.bodySizes.xl,

    "--border-width": tokens.borders.width,
    "--border-color": tokens.borders.color,

    "--radius-sm": tokens.radii.sm,
    "--radius-md": tokens.radii.md,
    "--radius-lg": tokens.radii.lg,
    "--radius-full": tokens.radii.full,

    "--shadow-sm": tokens.shadows.sm,
    "--shadow-md": tokens.shadows.md,
    "--shadow-lg": tokens.shadows.lg,

    "--content-max-width": tokens.layout.contentMaxWidth,

    "--button-radius": radiusFor(tokens.buttonStyle.shape, tokens.radii),
    "--button-padding-x": BUTTON_SIZE[tokens.buttonStyle.size].paddingX,
    "--button-padding-y": BUTTON_SIZE[tokens.buttonStyle.size].paddingY,
    "--button-font-size": BUTTON_SIZE[tokens.buttonStyle.size].fontSize,

    "--card-radius":
      tokens.cardStyle.radius === "sm"
        ? tokens.radii.sm
        : tokens.cardStyle.radius === "md"
          ? tokens.radii.md
          : tokens.radii.lg,
    "--card-shadow":
      tokens.cardStyle.shadow === "none" ? "none" : tokens.shadows[tokens.cardStyle.shadow],

    "--header-height": tokens.headerStyle.height,

    "--input-radius":
      tokens.formStyle.inputRadius === "sm"
        ? tokens.radii.sm
        : tokens.formStyle.inputRadius === "md"
          ? tokens.radii.md
          : tokens.radii.lg,

    "--motion-duration-fast": `${tokens.animation.durations.fast}ms`,
    "--motion-duration-base": `${tokens.animation.durations.base}ms`,
    "--motion-duration-slow": `${tokens.animation.durations.slow}ms`,
    "--motion-easing-standard": tokens.animation.easing.standard,
  };
}

/** `buttonStyle.size` n'avait jusqu'ici aucun effet visuel — corrigé pour la refonte
 *  du 16 septembre 2026 (« lisibilité des prix et boutons »). */
const BUTTON_SIZE: Record<
  DesignTokens["buttonStyle"]["size"],
  { paddingX: string; paddingY: string; fontSize: string }
> = {
  sm: { paddingX: "1rem", paddingY: "0.5rem", fontSize: "0.875rem" },
  md: { paddingX: "1.5rem", paddingY: "0.75rem", fontSize: "0.9375rem" },
  lg: { paddingX: "2.25rem", paddingY: "1.0625rem", fontSize: "1.0625rem" },
};

function radiusFor(shape: "square" | "rounded" | "pill", radii: DesignTokens["radii"]): string {
  if (shape === "square") return "0px";
  if (shape === "pill") return radii.full;
  return radii.md;
}

/** Rend un style inline prêt à être posé sur un conteneur racine (`<div style={...}>`). */
export function designTokensToStyle(tokens: DesignTokens): React.CSSProperties {
  return designTokensToCssVariables(tokens) as React.CSSProperties;
}
