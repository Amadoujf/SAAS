import type { DesignTokens } from "@yamacommerce/design-tokens";

/**
 * Template « Résidences » (immobilier), d'après la maquette approuvée : bleu nuit
 * profond, sable et laiton, titres à empattements, grandes photographies. Une agence
 * garde toujours SON nom, SON logo et SES couleurs (voir `applyBranding`).
 */
export const RESIDENCES_TOKENS: DesignTokens = {
  colors: {
    primary: "#13294B",
    secondary: "#1C5D7A",
    background: "#FFFFFF",
    surface: "#F6F3EE",
    surfaceMuted: "#ECE6DC",
    textPrimary: "#111B2E",
    textSecondary: "#465068",
    textMuted: "#6A7288",
    border: "#E5DFD5",
    success: "#157A4A",
    danger: "#B4382C",
    warning: "#9A5B08",
    accentPrimary: "#A57C45",
    accentSecondary: "#1C5D7A",
    leather: "#8A6236",
    champagne: "#EFE3CC",
    overlay: "rgba(10, 20, 40, 0.55)",
    mutedSurface: "#13294B",
  },
  typography: {
    headingFont: "var(--font-tpl-serif), Georgia, serif",
    bodyFont: "var(--font-tpl-sans), system-ui, sans-serif",
    headingSizes: { xs: "1rem", sm: "1.25rem", md: "1.5rem", lg: "1.875rem", xl: "2.25rem", "2xl": "3rem", "3xl": "3.75rem", "4xl": "4.5rem" },
    bodySizes: { xs: "0.75rem", sm: "0.8125rem", md: "0.9375rem", lg: "1.0625rem", xl: "1.25rem" },
  },
  spacing: { scale: ["0px", "4px", "8px", "12px", "16px", "24px", "32px", "48px", "64px", "96px"] },
  borders: { width: "1px", color: "#E5DFD5" },
  radii: { sm: "4px", md: "8px", lg: "14px", full: "9999px" },
  shadows: { sm: "0 1px 2px rgba(19,41,75,0.06)", md: "0 10px 24px rgba(19,41,75,0.10)", lg: "0 24px 50px rgba(19,41,75,0.18)" },
  layout: { contentMaxWidth: "1320px" },
  buttonStyle: { shape: "rounded", size: "md", variant: "solid" },
  cardStyle: { radius: "lg", shadow: "sm", border: false },
  headerStyle: { variant: "transparent-on-hero", height: "76px" },
  footerStyle: { variant: "expanded" },
  formStyle: { inputRadius: "lg", inputBorderStyle: "solid" },
  animation: { level: "dynamic", durations: { fast: 150, base: 300, slow: 700 }, easing: { standard: "cubic-bezier(0.22, 1, 0.36, 1)", decelerate: "cubic-bezier(0, 0, 0.2, 1)", accelerate: "cubic-bezier(0.4, 0, 1, 1)" } },
};

export const ESTATE_TEMPLATES = [{ slug: "residences", name: "Résidences", tagline: "Immobilier de prestige", tokens: RESIDENCES_TOKENS }];
