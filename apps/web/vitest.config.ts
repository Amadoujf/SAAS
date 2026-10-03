import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

/**
 * Configuration Vitest pour apps/web — distincte de la config Next.js (qui gère le
 * build/dev réel) : ce fichier ne sert qu'aux tests unitaires/composants du moteur de
 * rendu (voir components/sections, components/render-template-page.tsx) et aux tests
 * d'intégration DB de lib/rendering (isolation multi-tenant).
 */
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["**/*.test.{ts,tsx}"],
    exclude: ["node_modules", ".next"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      "server-only": path.resolve(__dirname, "./test/stubs/server-only.ts"),
      "next/font/local": path.resolve(__dirname, "./test/stubs/next-font-local.ts"),
    },
  },
});
