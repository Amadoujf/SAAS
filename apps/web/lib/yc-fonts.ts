import localFont from "next/font/local";

/**
 * Typographies YamaCommerce — AUTO-HÉBERGÉES (app/fonts, SIL OFL 1.1). Auparavant
 * `next/font/google`, qui télécharge les polices pendant le build : un build sans
 * accès à Google (CI derrière un proxy, environnement isolé) échouait. Importées
 * UNIQUEMENT par les pages de l'univers YamaCommerce (vitrine, connexion,
 * onboarding, dashboard, documents) : Next.js ne les précharge que sur ces routes,
 * jamais sur les boutiques des entreprises, qui gardent leurs propres polices.
 */
const display = localFont({
  src: "../app/fonts/bricolage-grotesque-600-latin.woff2",
  weight: "600",
  variable: "--font-yc-display",
  display: "swap",
  fallback: ["ui-sans-serif", "system-ui", "sans-serif"],
});
const ui = localFont({
  src: "../app/fonts/inter-variable-latin.woff2",
  weight: "100 900",
  variable: "--font-yc-ui",
  display: "swap",
  fallback: ["ui-sans-serif", "system-ui", "sans-serif"],
});

export const ycFontVariables = `${display.variable} ${ui.variable}`;
