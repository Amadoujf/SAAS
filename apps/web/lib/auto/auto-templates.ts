import type { DesignTokens } from "@yamacommerce/design-tokens";

/**
 * Template « Piste » (concessions, garages-vendeurs, importateurs) : asphalte, béton
 * clair, orange signal ; titres très gras et serrés, chiffres techniques alignés comme
 * sur un tableau de bord. Élément signature : la fiche technique en bandes numérotées et
 * la ligne d'horizon lumineuse sous chaque véhicule. Une concession garde toujours SON
 * nom, SON logo et SES couleurs.
 */
export const PISTE_TOKENS: DesignTokens = {
  colors: {
    primary: "#0F1215",
    secondary: "#FF5A1F",
    background: "#EDEFF0",
    surface: "#F8F9F9",
    surfaceMuted: "#DDE1E3",
    textPrimary: "#0F1215",
    textSecondary: "#434B52",
    textMuted: "#6D767D",
    border: "#D3D8DB",
    success: "#1F7A4A",
    danger: "#B3261E",
    warning: "#9A5B00",
    accentPrimary: "#FF5A1F",
    accentSecondary: "#FFC21A",
    leather: "#2B3136",
    champagne: "#F1F3F4",
    overlay: "rgba(10, 12, 14, 0.6)",
    mutedSurface: "#1B2025",
  },
  typography: {
    headingFont: "var(--font-tpl-sans), system-ui, sans-serif",
    bodyFont: "var(--font-tpl-sans), system-ui, sans-serif",
    headingSizes: { xs: "1rem", sm: "1.25rem", md: "1.5rem", lg: "1.875rem", xl: "2.375rem", "2xl": "3.125rem", "3xl": "4rem", "4xl": "5.5rem" },
    bodySizes: { xs: "0.75rem", sm: "0.8125rem", md: "0.9375rem", lg: "1.0625rem", xl: "1.25rem" },
  },
  spacing: { scale: ["0px", "4px", "8px", "12px", "16px", "24px", "32px", "48px", "64px", "96px"] },
  borders: { width: "1px", color: "#D3D8DB" },
  radii: { sm: "2px", md: "4px", lg: "8px", full: "9999px" },
  shadows: { sm: "0 1px 2px rgba(15,18,21,0.08)", md: "0 14px 30px rgba(15,18,21,0.12)", lg: "0 30px 70px rgba(15,18,21,0.25)" },
  layout: { contentMaxWidth: "1320px" },
  buttonStyle: { shape: "square", size: "md", variant: "solid" },
  cardStyle: { radius: "sm", shadow: "none", border: true },
  headerStyle: { variant: "solid", height: "64px" },
  footerStyle: { variant: "expanded" },
  formStyle: { inputRadius: "sm", inputBorderStyle: "solid" },
  animation: { level: "discreet", durations: { fast: 140, base: 240, slow: 560 }, easing: { standard: "cubic-bezier(0.22, 1, 0.36, 1)", decelerate: "cubic-bezier(0, 0, 0.2, 1)", accelerate: "cubic-bezier(0.4, 0, 1, 1)" } },
};

export const AUTO_TEMPLATES = [{ slug: "piste", name: "Piste", tagline: "Concession, garage-vendeur et importation", tokens: PISTE_TOKENS }];
