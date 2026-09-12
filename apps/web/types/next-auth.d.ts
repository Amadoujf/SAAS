import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      isSuperAdmin: boolean;
    } & DefaultSession["user"];
  }

  interface User {
    id: string;
    isSuperAdmin: boolean;
  }
}

// Pas d'augmentation de `next-auth/jwt` ici : ce module ne fait que ré-exporter
// `@auth/core/jwt` (`export * from "@auth/core/jwt"`), et son interface `JWT` étend
// `Record<string, unknown>` — une augmentation de "next-auth/jwt" ne fusionne pas de
// façon fiable avec l'interface réellement déclarée dans "@auth/core/jwt" à travers un
// monorepo pnpm (résolution stricte des node_modules). Les champs custom du token
// (`userId`, `isSuperAdmin`) sont donc lus avec un contrôle `typeof` explicite dans
// `lib/auth.ts` plutôt que via un typage statique fragile.
