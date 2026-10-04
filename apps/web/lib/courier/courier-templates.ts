import type { DesignTokens } from "@yamacommerce/design-tokens";

/**
 * Template « Trajet » (sociétés de livraison et coursiers) : encre de nuit, jaune signal,
 * béton clair ; titres grotesques serrés, chiffres de suivi lisibles de loin. Élément
 * signature : le tracé pointillé du trajet, du point de retrait au point de remise, qui
 * relie les étapes. Une société garde toujours SON nom, SON logo et SES couleurs.
 */
export const TRAJET_TOKENS: DesignTokens = {
  colors: {
    primary: "#101820",
    secondary: "#FFD23F",
    background: "#F2F1EC",
    surface: "#FFFFFF",
    surfaceMuted: "#E4E2DA",
    textPrimary: "#101820",
    textSecondary: "#3A434C",
    textMuted: "#6A737C",
    border: "#D9D6CC",
    success: "#1E7A46",
    danger: "#B3261E",
    warning: "#9A5B00",
    accentPrimary: "#FFD23F",
    accentSecondary: "#FF6B3D",
    leather: "#1F2A33",
    champagne: "#FAF9F5",
    overlay: "rgba(16, 24, 32, 0.6)",
    mutedSurface: "#1B2630",
  },
  typography: {
    headingFont: "var(--font-tpl-grotesk), var(--font-tpl-sans), system-ui, sans-serif",
    bodyFont: "var(--font-tpl-sans), system-ui, sans-serif",
    headingSizes: { xs: "1rem", sm: "1.25rem", md: "1.5rem", lg: "1.875rem", xl: "2.375rem", "2xl": "3.125rem", "3xl": "4rem", "4xl": "5.25rem" },
    bodySizes: { xs: "0.75rem", sm: "0.8125rem", md: "0.9375rem", lg: "1.0625rem", xl: "1.25rem" },
  },
  spacing: { scale: ["0px", "4px", "8px", "12px", "16px", "24px", "32px", "48px", "64px", "96px"] },
  borders: { width: "1px", color: "#D9D6CC" },
  radii: { sm: "6px", md: "12px", lg: "20px", full: "9999px" },
  shadows: { sm: "0 1px 2px rgba(16,24,32,0.08)", md: "0 12px 28px rgba(16,24,32,0.12)", lg: "0 28px 60px rgba(16,24,32,0.22)" },
  layout: { contentMaxWidth: "1240px" },
  buttonStyle: { shape: "pill", size: "md", variant: "solid" },
  cardStyle: { radius: "lg", shadow: "sm", border: true },
  headerStyle: { variant: "solid", height: "64px" },
  footerStyle: { variant: "expanded" },
  formStyle: { inputRadius: "md", inputBorderStyle: "solid" },
  animation: { level: "discreet", durations: { fast: 140, base: 240, slow: 560 }, easing: { standard: "cubic-bezier(0.22, 1, 0.36, 1)", decelerate: "cubic-bezier(0, 0, 0.2, 1)", accelerate: "cubic-bezier(0.4, 0, 1, 1)" } },
};

export const COURIER_TEMPLATES = [{ slug: "trajet", name: "Trajet", tagline: "Livraison, coursiers, colis avec paiement à la livraison", tokens: TRAJET_TOKENS }];
