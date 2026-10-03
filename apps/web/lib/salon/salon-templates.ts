import type { DesignTokens } from "@yamacommerce/design-tokens";

/**
 * Template « Écrin » (salons de coiffure, instituts, barbiers, spas) : encre aubergine,
 * rose poudré, laiton ; titres Didone en italique, images en arche, « la carte » des
 * soins présentée comme un menu (durée, prix). Un salon garde toujours SON nom, SON
 * logo et SES couleurs (voir `applyBranding`).
 */
export const ECRIN_TOKENS: DesignTokens = {
  colors: {
    primary: "#2A1621",
    secondary: "#8E4E5E",
    background: "#FBF6F2",
    surface: "#F5EAE4",
    surfaceMuted: "#EEDDD5",
    textPrimary: "#23141B",
    textSecondary: "#5A4650",
    textMuted: "#86737C",
    border: "#EAD9D0",
    success: "#2F7A55",
    danger: "#A73A3A",
    warning: "#94620F",
    accentPrimary: "#A24D63",
    accentSecondary: "#A7864F",
    leather: "#7A4A3A",
    champagne: "#F2E3CF",
    overlay: "rgba(42, 22, 33, 0.5)",
    mutedSurface: "#2A1621",
  },
  typography: {
    headingFont: "var(--font-tpl-didone), Didot, Georgia, serif",
    bodyFont: "var(--font-tpl-sans), system-ui, sans-serif",
    headingSizes: { xs: "1rem", sm: "1.25rem", md: "1.5rem", lg: "1.875rem", xl: "2.375rem", "2xl": "3.125rem", "3xl": "4rem", "4xl": "5.25rem" },
    bodySizes: { xs: "0.75rem", sm: "0.8125rem", md: "0.9375rem", lg: "1.0625rem", xl: "1.25rem" },
  },
  spacing: { scale: ["0px", "4px", "8px", "12px", "16px", "24px", "32px", "48px", "64px", "96px"] },
  borders: { width: "1px", color: "#EAD9D0" },
  radii: { sm: "8px", md: "14px", lg: "28px", full: "9999px" },
  shadows: { sm: "0 1px 2px rgba(42,22,33,0.06)", md: "0 14px 30px rgba(42,22,33,0.10)", lg: "0 30px 70px rgba(42,22,33,0.18)" },
  layout: { contentMaxWidth: "1280px" },
  buttonStyle: { shape: "pill", size: "md", variant: "solid" },
  cardStyle: { radius: "lg", shadow: "sm", border: false },
  headerStyle: { variant: "solid", height: "76px" },
  footerStyle: { variant: "expanded" },
  formStyle: { inputRadius: "md", inputBorderStyle: "solid" },
  animation: { level: "discreet", durations: { fast: 150, base: 300, slow: 700 }, easing: { standard: "cubic-bezier(0.22, 1, 0.36, 1)", decelerate: "cubic-bezier(0, 0, 0.2, 1)", accelerate: "cubic-bezier(0.4, 0, 1, 1)" } },
};

export const SALON_TEMPLATES = [{ slug: "ecrin", name: "Écrin", tagline: "Salon et institut", tokens: ECRIN_TOKENS }];
