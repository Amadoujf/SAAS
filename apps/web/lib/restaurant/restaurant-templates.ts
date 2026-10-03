import type { DesignTokens } from "@yamacommerce/design-tokens";

/**
 * Template « Braise » (restaurants, grillades, maquis, fast-food, cafés) : charbon
 * chaud, safran, piment ; titres grotesques très gras, carte dense et lisible, barre de
 * commande toujours à portée du pouce comme élément signature. Un restaurant garde
 * toujours SON nom, SON logo et SES couleurs.
 */
export const BRAISE_TOKENS: DesignTokens = {
  colors: {
    primary: "#1C1714",
    secondary: "#D2452B",
    background: "#FBF6EE",
    surface: "#F3EADB",
    surfaceMuted: "#E9DCC6",
    textPrimary: "#1C1714",
    textSecondary: "#524640",
    textMuted: "#7D7068",
    border: "#E6D8C2",
    success: "#2F7A45",
    danger: "#B3261E",
    warning: "#9A6200",
    accentPrimary: "#F2A516",
    accentSecondary: "#D2452B",
    leather: "#6B3F24",
    champagne: "#F8E3B0",
    overlay: "rgba(20, 15, 12, 0.55)",
    mutedSurface: "#2A221D",
  },
  typography: {
    headingFont: "var(--font-tpl-grotesk), system-ui, sans-serif",
    bodyFont: "var(--font-tpl-sans), system-ui, sans-serif",
    headingSizes: { xs: "1rem", sm: "1.25rem", md: "1.5rem", lg: "1.875rem", xl: "2.375rem", "2xl": "3.125rem", "3xl": "4rem", "4xl": "5.5rem" },
    bodySizes: { xs: "0.75rem", sm: "0.8125rem", md: "0.9375rem", lg: "1.0625rem", xl: "1.25rem" },
  },
  spacing: { scale: ["0px", "4px", "8px", "12px", "16px", "24px", "32px", "48px", "64px", "96px"] },
  borders: { width: "1px", color: "#E6D8C2" },
  radii: { sm: "6px", md: "12px", lg: "20px", full: "9999px" },
  shadows: { sm: "0 1px 2px rgba(28,23,20,0.08)", md: "0 12px 28px rgba(28,23,20,0.12)", lg: "0 28px 64px rgba(28,23,20,0.22)" },
  layout: { contentMaxWidth: "1240px" },
  buttonStyle: { shape: "pill", size: "md", variant: "solid" },
  cardStyle: { radius: "lg", shadow: "sm", border: false },
  headerStyle: { variant: "solid", height: "68px" },
  footerStyle: { variant: "expanded" },
  formStyle: { inputRadius: "md", inputBorderStyle: "solid" },
  animation: { level: "discreet", durations: { fast: 140, base: 260, slow: 600 }, easing: { standard: "cubic-bezier(0.22, 1, 0.36, 1)", decelerate: "cubic-bezier(0, 0, 0.2, 1)", accelerate: "cubic-bezier(0.4, 0, 1, 1)" } },
};

export const RESTAURANT_TEMPLATES = [{ slug: "braise", name: "Braise", tagline: "Restaurant, grillades et vente à emporter", tokens: BRAISE_TOKENS }];
