import type { DesignTokens } from "@yamacommerce/design-tokens";

/**
 * Template « Préau » (écoles privées, centres de formation, cours de langues, soutien
 * scolaire) : papier crème, encre bleu nuit, vert tableau, ocre de craie ; titres en
 * serif éditoriale, chiffres nets. Élément signature : la marge rouge et les lignes du
 * cahier, et l'emploi du temps en grille. Un établissement garde toujours SON nom, SON
 * logo et SES couleurs.
 */
export const PREAU_TOKENS: DesignTokens = {
  colors: {
    primary: "#1C2A4A",
    secondary: "#2F5D50",
    background: "#F6F1E6",
    surface: "#FFFCF5",
    surfaceMuted: "#EDE5D3",
    textPrimary: "#1C2A4A",
    textSecondary: "#3F4A63",
    textMuted: "#6B7285",
    border: "#DDD3BE",
    success: "#2F6B3F",
    danger: "#B3261E",
    warning: "#8F5A00",
    accentPrimary: "#D8A327",
    accentSecondary: "#C9433A",
    leather: "#2F5D50",
    champagne: "#FBF6EA",
    overlay: "rgba(20, 28, 48, 0.55)",
    mutedSurface: "#243560",
  },
  typography: {
    headingFont: "var(--font-tpl-serif), Georgia, serif",
    bodyFont: "var(--font-tpl-sans), system-ui, sans-serif",
    headingSizes: { xs: "1rem", sm: "1.25rem", md: "1.5rem", lg: "1.875rem", xl: "2.375rem", "2xl": "3rem", "3xl": "3.75rem", "4xl": "5rem" },
    bodySizes: { xs: "0.75rem", sm: "0.8125rem", md: "0.9375rem", lg: "1.0625rem", xl: "1.25rem" },
  },
  spacing: { scale: ["0px", "4px", "8px", "12px", "16px", "24px", "32px", "48px", "64px", "96px"] },
  borders: { width: "1px", color: "#DDD3BE" },
  radii: { sm: "4px", md: "8px", lg: "14px", full: "9999px" },
  shadows: { sm: "0 1px 2px rgba(28,42,74,0.08)", md: "0 12px 28px rgba(28,42,74,0.10)", lg: "0 28px 60px rgba(28,42,74,0.18)" },
  layout: { contentMaxWidth: "1240px" },
  buttonStyle: { shape: "rounded", size: "md", variant: "solid" },
  cardStyle: { radius: "md", shadow: "sm", border: true },
  headerStyle: { variant: "solid", height: "68px" },
  footerStyle: { variant: "expanded" },
  formStyle: { inputRadius: "md", inputBorderStyle: "solid" },
  animation: { level: "discreet", durations: { fast: 140, base: 240, slow: 560 }, easing: { standard: "cubic-bezier(0.22, 1, 0.36, 1)", decelerate: "cubic-bezier(0, 0, 0.2, 1)", accelerate: "cubic-bezier(0.4, 0, 1, 1)" } },
};

export const EDUCATION_TEMPLATES = [{ slug: "preau", name: "Préau", tagline: "École, centre de formation, cours de langues", tokens: PREAU_TOKENS }];
