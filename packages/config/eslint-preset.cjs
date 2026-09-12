/**
 * Préréglage ESLint partagé (packages non-Next.js : database, payments, queue, auth, worker).
 * L'application web utilise `eslint-config-next` directement (voir apps/web/.eslintrc.json).
 */
module.exports = {
  root: true,
  env: { node: true, es2022: true },
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
  },
  plugins: ["@typescript-eslint"],
  extends: ["eslint:recommended", "plugin:@typescript-eslint/recommended"],
  rules: {
    "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    "@typescript-eslint/no-explicit-any": "warn",
    "no-console": ["warn", { allow: ["warn", "error", "info"] }],
  },
  ignorePatterns: ["dist", "node_modules", "**/*.js", "!eslint-preset.cjs"],
};
