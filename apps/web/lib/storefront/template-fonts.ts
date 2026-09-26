import localFont from "next/font/local";

/**
 * Polices des TEMPLATES de boutique (jamais l'identité YamaCommerce). `preload: false` :
 * aucun préchargement sur les boutiques qui ne les utilisent pas — le navigateur ne
 * télécharge une police que si une règle CSS de la page l'emploie réellement.
 */
export const templateSerif = localFont({
  src: [
    { path: "../../app/fonts/newsreader-variable-latin.woff2", weight: "200 800", style: "normal" },
    { path: "../../app/fonts/newsreader-variable-italic-latin.woff2", weight: "200 800", style: "italic" },
  ],
  variable: "--font-tpl-serif",
  display: "swap",
  preload: false,
  fallback: ["Georgia", "serif"],
});

export const templateDidone = localFont({
  src: [
    { path: "../../app/fonts/bodoni-moda-variable-latin.woff2", weight: "400 900", style: "normal" },
    { path: "../../app/fonts/bodoni-moda-variable-italic-latin.woff2", weight: "400 900", style: "italic" },
  ],
  variable: "--font-tpl-didone",
  display: "swap",
  preload: false,
  fallback: ["Didot", "Georgia", "serif"],
});

export const templateSans = localFont({
  src: "../../app/fonts/inter-variable-latin.woff2",
  weight: "100 900",
  variable: "--font-tpl-sans",
  display: "swap",
  preload: false,
  fallback: ["system-ui", "sans-serif"],
});

export const templateFontVariables = `${templateSerif.variable} ${templateDidone.variable} ${templateSans.variable}`;
