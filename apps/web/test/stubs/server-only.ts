// Stub pour les tests Vitest : le vrai paquet `server-only` lève toujours une erreur
// hors du bundler Next.js (il n'active la condition d'export "react-server" que lors
// d'un build serveur réel). En test, `lib/rendering/resolve-tenant-site.ts` doit rester
// importable normalement — voir l'alias dans vitest.config.ts.
export {};
