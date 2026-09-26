import type { DesignTokens } from "@yamacommerce/design-tokens";

/**
 * Templates boutique « Sunu Marché » (grand catalogue chaleureux, univers et sélection)
 * et « Atelier Naya » (mode éditoriale, grand titre Didone, compositions asymétriques),
 * d'après les maquettes approuvées. Les noms sont ceux des maquettes : une entreprise
 * garde toujours SON nom, SON logo et SES couleurs (voir `applyBranding`).
 */
const EASING = { standard: "cubic-bezier(0.22, 1, 0.36, 1)", decelerate: "cubic-bezier(0, 0, 0.2, 1)", accelerate: "cubic-bezier(0.4, 0, 1, 1)" };

export const SUNU_MARCHE_TOKENS: DesignTokens = {
  colors: {
    primary: "#10224F",
    secondary: "#1D3FB0",
    background: "#FFFFFF",
    surface: "#F7F5F1",
    surfaceMuted: "#EFEBE4",
    textPrimary: "#121A33",
    textSecondary: "#4A5169",
    textMuted: "#6C7389",
    border: "#E6E2DA",
    success: "#157A4A",
    danger: "#C0362C",
    warning: "#A15C07",
    accentPrimary: "#C0362C",
    accentSecondary: "#1D3FB0",
    leather: "#9A5A2E",
    champagne: "#F2E6CF",
    overlay: "rgba(16, 34, 79, 0.45)",
    mutedSurface: "#10224F",
  },
  typography: {
    headingFont: "var(--font-tpl-serif), Georgia, serif",
    bodyFont: "var(--font-tpl-sans), system-ui, sans-serif",
    headingSizes: { xs: "1rem", sm: "1.25rem", md: "1.5rem", lg: "1.875rem", xl: "2.25rem", "2xl": "3rem", "3xl": "3.75rem", "4xl": "4.5rem" },
    bodySizes: { xs: "0.75rem", sm: "0.8125rem", md: "0.9375rem", lg: "1.0625rem", xl: "1.25rem" },
  },
  spacing: { scale: ["0px", "4px", "8px", "12px", "16px", "24px", "32px", "48px", "64px", "96px"] },
  borders: { width: "1px", color: "#E6E2DA" },
  radii: { sm: "4px", md: "6px", lg: "10px", full: "9999px" },
  shadows: { sm: "0 1px 2px rgba(16,34,79,0.06)", md: "0 8px 20px rgba(16,34,79,0.08)", lg: "0 20px 44px rgba(16,34,79,0.14)" },
  layout: { contentMaxWidth: "1320px" },
  buttonStyle: { shape: "rounded", size: "md", variant: "solid" },
  cardStyle: { radius: "sm", shadow: "none", border: false },
  headerStyle: { variant: "solid", height: "72px" },
  footerStyle: { variant: "expanded" },
  formStyle: { inputRadius: "lg", inputBorderStyle: "solid" },
  animation: { level: "dynamic", durations: { fast: 150, base: 300, slow: 600 }, easing: EASING },
};

export const ATELIER_NAYA_TOKENS: DesignTokens = {
  colors: {
    primary: "#15110D",
    secondary: "#8C6A3F",
    background: "#F4ECE0",
    surface: "#EDE3D4",
    surfaceMuted: "#E4D8C6",
    textPrimary: "#15110D",
    textSecondary: "#4B4036",
    textMuted: "#6F6254",
    border: "#D8CBB8",
    success: "#3D6B3F",
    danger: "#A23A2A",
    warning: "#8C5A12",
    accentPrimary: "#8C6A3F",
    accentSecondary: "#15110D",
    leather: "#7A4E2A",
    champagne: "#E9D9B8",
    overlay: "rgba(21, 17, 13, 0.4)",
    mutedSurface: "#15110D",
  },
  typography: {
    headingFont: "var(--font-tpl-didone), Didot, Georgia, serif",
    bodyFont: "var(--font-tpl-serif), Georgia, serif",
    headingSizes: { xs: "1rem", sm: "1.25rem", md: "1.625rem", lg: "2rem", xl: "2.75rem", "2xl": "3.5rem", "3xl": "4.5rem", "4xl": "6rem" },
    bodySizes: { xs: "0.75rem", sm: "0.875rem", md: "1rem", lg: "1.125rem", xl: "1.3125rem" },
  },
  spacing: { scale: ["0px", "4px", "8px", "12px", "16px", "24px", "32px", "48px", "64px", "96px"] },
  borders: { width: "1px", color: "#D8CBB8" },
  radii: { sm: "0px", md: "0px", lg: "0px", full: "9999px" },
  shadows: { sm: "none", md: "none", lg: "0 30px 60px rgba(21,17,13,0.18)" },
  layout: { contentMaxWidth: "1400px" },
  buttonStyle: { shape: "square", size: "md", variant: "solid" },
  cardStyle: { radius: "sm", shadow: "none", border: false },
  headerStyle: { variant: "solid", height: "76px" },
  footerStyle: { variant: "expanded" },
  formStyle: { inputRadius: "sm", inputBorderStyle: "solid" },
  animation: { level: "immersive", durations: { fast: 200, base: 450, slow: 900 }, easing: EASING },
};
