import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { verifyPassword } from "@yamacommerce/auth";
import { prisma } from "@yamacommerce/database";

/**
 * Configuration Auth.js (NextAuth v5). Stratégie JWT (pas de session côté base en
 * Phase 0). Le mot de passe est vérifié via bcrypt — voir packages/auth/src/password.ts.
 *
 * Phase 0 : authentification par identifiants uniquement. La 2FA (TOTP) prévue par le
 * cahier des charges (docs/01 §1.5 — Sécurité) sera ajoutée en Phase 1/4 sans changer
 * cette structure (un provider supplémentaire + un champ `twoFactorVerified` dans le JWT).
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/connexion" },
  providers: [
    Credentials({
      name: "Identifiants",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Mot de passe", type: "password" },
      },
      async authorize(credentials) {
        const email = typeof credentials?.email === "string" ? credentials.email : undefined;
        const password =
          typeof credentials?.password === "string" ? credentials.password : undefined;
        if (!email || !password) return null;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) return null;

        const valid = await verifyPassword(password, user.passwordHash);
        if (!valid) return null;

        await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

        return {
          id: user.id,
          email: user.email ?? undefined,
          name: user.fullName,
          isSuperAdmin: user.isSuperAdmin,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.userId = user.id;
        token.isSuperAdmin = user.isSuperAdmin;
      }
      return token;
    },
    async session({ session, token }) {
      // `token` (type JWT de @auth/core) porte un index `Record<string, unknown>` : on
      // ne peut pas garantir statiquement la forme des champs qu'on y a stockés
      // nous-mêmes dans le callback `jwt` ci-dessus, donc on les revalide ici avant de
      // les propager dans la session — jamais de cast aveugle sur un token.
      if (typeof token.userId === "string") {
        session.user.id = token.userId;
      }
      if (typeof token.isSuperAdmin === "boolean") {
        session.user.isSuperAdmin = token.isSuperAdmin;
      }
      return session;
    },
  },
});
