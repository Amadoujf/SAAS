import { PrismaClient } from "@prisma/client";

/**
 * Client Prisma singleton.
 *
 * En développement, Next.js recharge les modules à chaud (HMR) : sans singleton global,
 * chaque rechargement créerait une nouvelle instance de PrismaClient et finirait par épuiser
 * les connexions PostgreSQL disponibles. On réutilise donc l'instance via `globalThis`.
 */
const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export * from "@prisma/client";
