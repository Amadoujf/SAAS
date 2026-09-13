/** @type {import('next').NextConfig} */
const nextConfig = {
  // Les packages du monorepo sont écrits en TypeScript source (pas de build séparé en
  // Phase 0) : Next.js doit donc les transpiler lui-même — voir docs/10-structure-dossiers.md.
  transpilePackages: [
    "@yamacommerce/auth",
    "@yamacommerce/database",
    "@yamacommerce/design-tokens",
    "@yamacommerce/domains",
    "@yamacommerce/payments",
    "@yamacommerce/queue",
    "@yamacommerce/templates",
  ],
  experimental: {
    // Prisma Client (moteur natif) ne doit pas être bundlé par Webpack pour les Server
    // Components / Route Handlers.
    serverComponentsExternalPackages: ["@prisma/client"],
  },
  images: {
    // Domaines d'images utilisés par les données de démonstration (voir
    // apps/web/lib/demo/luxury-minimal-template.ts). En production, chaque tenant
    // héberge ses médias sur Cloudflare R2 (voir docs/03) — à ajouter ici le moment venu.
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "picsum.photos" },
    ],
  },
};

export default nextConfig;
