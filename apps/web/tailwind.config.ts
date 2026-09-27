import type { Config } from "tailwindcss";

/**
 * Configuration Tailwind. Deux familles de couleurs strictement séparées :
 * - `yc-*` : identité Y-COM (plateforme + dashboard), variables `--yc-*`.
 * - `brand` et les `var(--color-*)` arbitraires : design tokens d'une entreprise,
 *   actifs uniquement sous `SiteShell`/`StoreShell` (voir app/globals.css).
 */
const rgb = (name: string) => `rgb(var(${name}) / <alpha-value>)`;

const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "var(--color-brand, #0F766E)",
          foreground: "var(--color-brand-foreground, #ffffff)",
        },
        yc: {
          night: {
            950: rgb("--yc-night-950"),
            900: rgb("--yc-night-900"),
            800: rgb("--yc-night-800"),
            700: rgb("--yc-night-700"),
            600: rgb("--yc-night-600"),
          },
          ivory: { 50: rgb("--yc-ivory-50"), 100: rgb("--yc-ivory-100"), 200: rgb("--yc-ivory-200") },
          ink: { DEFAULT: rgb("--yc-ink"), soft: rgb("--yc-ink-soft") },
          cyan: { DEFAULT: rgb("--yc-cyan"), strong: rgb("--yc-cyan-strong") },
          electric: rgb("--yc-electric"),
          violet: rgb("--yc-violet"),
          success: rgb("--yc-success"),
          warning: rgb("--yc-warning"),
          danger: rgb("--yc-danger"),
          paper: { DEFAULT: rgb("--yc-paper"), deep: rgb("--yc-paper-deep") },
          sand: rgb("--yc-sand"),
          navy: { DEFAULT: rgb("--yc-navy"), ink: rgb("--yc-navy-ink") },
          royal: { DEFAULT: rgb("--yc-royal"), strong: rgb("--yc-royal-strong") },
        },
      },
      fontFamily: {
        display: ["var(--font-yc-display)", "ui-sans-serif", "system-ui", "sans-serif"],
        editorial: ["var(--font-yc-serif)", "Georgia", "Cambria", "serif"],
        ui: ["var(--font-yc-ui)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      borderRadius: { yc: "var(--yc-radius)", "yc-sm": "var(--yc-radius-sm)", "yc-lg": "var(--yc-radius-lg)" },
      boxShadow: { yc: "var(--yc-shadow-card)", "yc-float": "var(--yc-shadow-float)" },
      transitionTimingFunction: { yc: "cubic-bezier(0.22, 1, 0.36, 1)" },
    },
  },
  plugins: [],
};

export default config;
