import type { DesignTokens } from "./schema";

/**
 * Jeu de tokens neutre de référence. Chaque template définit ses PROPRES tokens
 * (voir docs/12 §12.5, une direction artistique = un jeu de valeurs) ; celui-ci sert de
 * filet de sécurité (template sans tokens complets) et de base pour les tests.
 */
export const DEFAULT_DESIGN_TOKENS: DesignTokens = {
  colors: {
    primary: "#0F766E",
    secondary: "#F59E0B",
    background: "#FFFFFF",
    surface: "#F8FAFC",
    surfaceMuted: "#F1F5F9",
    textPrimary: "#0F172A",
    textSecondary: "#334155",
    textMuted: "#64748B",
    border: "#E2E8F0",
    success: "#16A34A",
    danger: "#DC2626",
    warning: "#D97706",
  },
  typography: {
    headingFont: "'Sora', sans-serif",
    bodyFont: "'Inter', sans-serif",
    headingSizes: {
      xs: "1rem",
      sm: "1.25rem",
      md: "1.5rem",
      lg: "2rem",
      xl: "2.5rem",
      "2xl": "3rem",
      "3xl": "3.75rem",
      "4xl": "4.5rem",
    },
    bodySizes: { xs: "0.75rem", sm: "0.875rem", md: "1rem", lg: "1.125rem", xl: "1.25rem" },
  },
  spacing: {
    scale: ["0px", "4px", "8px", "12px", "16px", "24px", "32px", "48px", "64px", "96px"],
  },
  borders: { width: "1px", color: "#E2E8F0" },
  radii: { sm: "4px", md: "8px", lg: "16px", full: "9999px" },
  shadows: {
    sm: "0 1px 2px rgba(15, 23, 42, 0.06)",
    md: "0 4px 12px rgba(15, 23, 42, 0.10)",
    lg: "0 12px 32px rgba(15, 23, 42, 0.16)",
  },
  layout: { contentMaxWidth: "1280px" },
  buttonStyle: { shape: "rounded", size: "md", variant: "solid" },
  cardStyle: { radius: "md", shadow: "sm", border: true },
  headerStyle: { variant: "solid", height: "72px" },
  footerStyle: { variant: "expanded" },
  formStyle: { inputRadius: "md", inputBorderStyle: "solid" },
  animation: {
    level: "dynamic",
    durations: { fast: 150, base: 250, slow: 400 },
    easing: {
      standard: "cubic-bezier(0.4, 0, 0.2, 1)",
      decelerate: "cubic-bezier(0, 0, 0.2, 1)",
      accelerate: "cubic-bezier(0.4, 0, 1, 1)",
    },
  },
};
