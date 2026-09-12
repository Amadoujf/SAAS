import type { Config } from "tailwindcss";

/**
 * Configuration Tailwind de base. Le thème par entreprise (couleurs de marque, mode
 * clair/sombre par défaut — voir Tenant.branding) sera appliqué via des variables CSS
 * injectées au niveau du layout tenant, pas en dupliquant cette configuration — voir
 * docs/02-architecture-fonctionnelle.md#24-modèles-de-site-par-secteur.
 */
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
      },
    },
  },
  plugins: [],
};

export default config;
