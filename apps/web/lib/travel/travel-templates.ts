import type { DesignTokens } from "@yamacommerce/design-tokens";

/**
 * Template « Horizons » (voyage) : bleu de nuit profond, corail de coucher de soleil,
 * lagon, papier sable ; titres à empattements, grandes images plein cadre, tableau des
 * départs comme élément signature. Une agence garde toujours SON nom, SON logo et SES
 * couleurs (voir `applyBranding`).
 */
export const HORIZONS_TOKENS: DesignTokens = {
  colors: {
    primary: "#16233F",
    secondary: "#1F6F78",
    background: "#FBF7F1",
    surface: "#F3ECE1",
    surfaceMuted: "#EAE0D1",
    textPrimary: "#141B2D",
    textSecondary: "#434B60",
    textMuted: "#6A7085",
    border: "#E4D9C8",
    success: "#1C7A52",
    danger: "#B8402F",
    warning: "#9A5B08",
    accentPrimary: "#D9603A",
    accentSecondary: "#1F6F78",
    leather: "#8A5A36",
    champagne: "#F1E2C8",
    overlay: "rgba(12, 18, 34, 0.55)",
    mutedSurface: "#16233F",
  },
  typography: {
    headingFont: "var(--font-tpl-serif), Georgia, serif",
    bodyFont: "var(--font-tpl-sans), system-ui, sans-serif",
    headingSizes: { xs: "1rem", sm: "1.25rem", md: "1.5rem", lg: "1.875rem", xl: "2.375rem", "2xl": "3.125rem", "3xl": "4rem", "4xl": "5rem" },
    bodySizes: { xs: "0.75rem", sm: "0.8125rem", md: "0.9375rem", lg: "1.0625rem", xl: "1.25rem" },
  },
  spacing: { scale: ["0px", "4px", "8px", "12px", "16px", "24px", "32px", "48px", "64px", "96px"] },
  borders: { width: "1px", color: "#E4D9C8" },
  radii: { sm: "6px", md: "12px", lg: "20px", full: "9999px" },
  shadows: { sm: "0 1px 2px rgba(22,35,63,0.06)", md: "0 12px 28px rgba(22,35,63,0.10)", lg: "0 28px 60px rgba(22,35,63,0.18)" },
  layout: { contentMaxWidth: "1320px" },
  buttonStyle: { shape: "pill", size: "md", variant: "solid" },
  cardStyle: { radius: "lg", shadow: "sm", border: false },
  headerStyle: { variant: "transparent-on-hero", height: "76px" },
  footerStyle: { variant: "expanded" },
  formStyle: { inputRadius: "md", inputBorderStyle: "solid" },
  animation: { level: "dynamic", durations: { fast: 150, base: 320, slow: 800 }, easing: { standard: "cubic-bezier(0.22, 1, 0.36, 1)", decelerate: "cubic-bezier(0, 0, 0.2, 1)", accelerate: "cubic-bezier(0.4, 0, 1, 1)" } },
};

export const TRAVEL_TEMPLATES = [{ slug: "horizons", name: "Horizons", tagline: "Agence de voyage", tokens: HORIZONS_TOKENS }];
