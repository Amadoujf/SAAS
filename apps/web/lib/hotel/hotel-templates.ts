import type { DesignTokens } from "@yamacommerce/design-tokens";

/**
 * Template « Palmeraie » (hôtels, lodges, maisons d'hôtes, résidences) : papier sable,
 * vert forêt profond, laiton, terre cuite ; titres à empattements droits, grandes
 * images horizontales, barre de dates (arrivée, départ, voyageurs) comme élément
 * signature. Un établissement garde toujours SON nom, SON logo et SES couleurs.
 */
export const PALMERAIE_TOKENS: DesignTokens = {
  colors: {
    primary: "#1D3A2E",
    secondary: "#B8653F",
    background: "#F7F3EA",
    surface: "#EFE8DA",
    surfaceMuted: "#E5DCC9",
    textPrimary: "#18241D",
    textSecondary: "#46524A",
    textMuted: "#737D74",
    border: "#E0D6C2",
    success: "#2E7A4F",
    danger: "#A63D2F",
    warning: "#946312",
    accentPrimary: "#B8653F",
    accentSecondary: "#A98A55",
    leather: "#7C5536",
    champagne: "#EBDDBE",
    overlay: "rgba(18, 32, 25, 0.5)",
    mutedSurface: "#1D3A2E",
  },
  typography: {
    headingFont: "var(--font-tpl-serif), Georgia, serif",
    bodyFont: "var(--font-tpl-sans), system-ui, sans-serif",
    headingSizes: { xs: "1rem", sm: "1.25rem", md: "1.5rem", lg: "1.875rem", xl: "2.375rem", "2xl": "3.125rem", "3xl": "4rem", "4xl": "5.25rem" },
    bodySizes: { xs: "0.75rem", sm: "0.8125rem", md: "0.9375rem", lg: "1.0625rem", xl: "1.25rem" },
  },
  spacing: { scale: ["0px", "4px", "8px", "12px", "16px", "24px", "32px", "48px", "64px", "96px"] },
  borders: { width: "1px", color: "#E0D6C2" },
  radii: { sm: "4px", md: "8px", lg: "14px", full: "9999px" },
  shadows: { sm: "0 1px 2px rgba(29,58,46,0.06)", md: "0 14px 30px rgba(29,58,46,0.10)", lg: "0 30px 70px rgba(29,58,46,0.18)" },
  layout: { contentMaxWidth: "1320px" },
  buttonStyle: { shape: "rounded", size: "md", variant: "solid" },
  cardStyle: { radius: "md", shadow: "sm", border: false },
  headerStyle: { variant: "solid", height: "76px" },
  footerStyle: { variant: "expanded" },
  formStyle: { inputRadius: "sm", inputBorderStyle: "solid" },
  animation: { level: "discreet", durations: { fast: 150, base: 300, slow: 700 }, easing: { standard: "cubic-bezier(0.22, 1, 0.36, 1)", decelerate: "cubic-bezier(0, 0, 0.2, 1)", accelerate: "cubic-bezier(0.4, 0, 1, 1)" } },
};

export const HOTEL_TEMPLATES = [{ slug: "palmeraie", name: "Palmeraie", tagline: "Hôtel et maison d'hôtes", tokens: PALMERAIE_TOKENS }];
