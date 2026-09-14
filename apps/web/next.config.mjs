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
    "@yamacommerce/storage",
    "@yamacommerce/templates",
  ],
  experimental: {
    // Prisma Client (moteur natif) ne doit pas être bundlé par Webpack pour les Server
    // Components / Route Handlers.
    serverComponentsExternalPackages: ["@prisma/client", "sharp"],
  },
  images: {
    // Domaines d'images utilisés par les données de démonstration (voir
    // apps/web/lib/demo/luxury-minimal-template.ts). En production, chaque tenant
    // héberge ses médias sur Cloudflare R2 (voir docs/03) — à ajouter ici le moment venu.
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "picsum.photos" },
      // Médiathèque de démonstration (voir docs/12 §12.2, 21 septembre 2026) : sert ses
      // fichiers depuis l'application elle-même (`/api/demo-media/[id]/file`, voir
      // lib/media/demo-media-context.ts) faute de vrai bucket R2/CDN dans cet
      // environnement — `next/image` exige un allowlist explicite même pour une URL
      // absolue same-origin. Sans port précisé : n'importe quel port local (le serveur
      // de développement peut démarrer sur un port différent d'une session à l'autre).
      // Ne matche jamais une requête réelle en production (aucun déploiement ne sert
      // depuis "localhost").
      { protocol: "http", hostname: "localhost" },
    ],
  },
  async headers() {
    // CSP + frame-ancestors pour les DEUX documents d'aperçu iframe (démonstration ET
    // tenant réel) — voir docs/12 §12.2, « médiathèque R2 » (21 septembre 2026),
    // « CSP adaptée », « frame-ancestors ». `frame-ancestors 'self'` empêche N'IMPORTE
    // QUELLE autre origine d'embarquer ces documents dans SON PROPRE iframe
    // (protection contre le clickjacking de la surface d'aperçu elle-même) — distinct
    // de l'attribut `sandbox` posé par l'éditeur sur SON iframe (voir
    // components/editor/preview-stage.tsx), qui restreint ce que CE DOCUMENT peut
    // faire, pas qui peut l'embarquer.
    //
    // `script-src`/`style-src` autorisent encore 'unsafe-inline'/'unsafe-eval' : Next.js
    // (mode développement en particulier) s'appuie dessus, et une CSP stricte à base de
    // nonces serait un changement d'architecture bien plus large que cette étape — voir
    // le rapport de livraison pour cette limite assumée, documentée plutôt que cachée.
    const PREVIEW_CSP = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' https: data: blob:",
      "media-src 'self' https: data: blob:",
      "font-src 'self' data:",
      "connect-src 'self'",
      "frame-ancestors 'self'",
    ].join("; ");

    const previewHeaders = [
      { key: "Content-Security-Policy", value: PREVIEW_CSP },
      { key: "X-Frame-Options", value: "SAMEORIGIN" }, // repli pour les navigateurs sans support de frame-ancestors
    ];

    return [
      { source: "/demo/editeur-visuel/apercu", headers: previewHeaders },
      { source: "/apercu/:tenantId", headers: previewHeaders },
    ];
  },
};

export default nextConfig;
