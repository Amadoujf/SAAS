/** @type {import('next').NextConfig} */
const nextConfig = {
  // Les packages du monorepo sont écrits en TypeScript source (pas de build séparé en
  // Phase 0) : Next.js doit donc les transpiler lui-même — voir docs/10-structure-dossiers.md.
  transpilePackages: [
    "@yamacommerce/auth",
    "@yamacommerce/database",
    "@yamacommerce/domains",
    "@yamacommerce/payments",
    "@yamacommerce/queue",
  ],
  experimental: {
    // Prisma Client (moteur natif) ne doit pas être bundlé par Webpack pour les Server
    // Components / Route Handlers.
    serverComponentsExternalPackages: ["@prisma/client"],
  },
};

export default nextConfig;
