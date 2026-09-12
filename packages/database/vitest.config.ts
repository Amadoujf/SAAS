import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
    setupFiles: ["./vitest.setup.ts"],
    // Les tests d'isolation multi-tenant frappent une vraie base PostgreSQL : ils ne
    // doivent pas tourner en parallèle avec d'autres suites qui manipuleraient les mêmes
    // tables de test.
    fileParallelism: false,
    testTimeout: 20_000,
  },
});
