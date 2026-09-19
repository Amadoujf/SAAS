import { PrismaClient } from "@prisma/client";

/**
 * Client Prisma élevé (rôle propriétaire, `MIGRATE_DATABASE_URL`), réservé au
 * NETTOYAGE de données de test entre suites — jamais utilisé pour les assertions
 * elles-mêmes, jamais par le code applicatif. Nécessaire depuis que `StockMovement`
 * a perdu les droits UPDATE/DELETE pour le rôle applicatif (immutabilité de
 * l'historique des mouvements, voir la migration
 * `20260925000000_catalog_security_hardening`) : le client de test habituel
 * (`../src/client`, lié à `DATABASE_URL`/`yamacommerce_app`) ne peut plus supprimer
 * ces lignes, même via `withSuperAdminAccess` (qui ne fait que lever la RLS, jamais
 * les droits du rôle Postgres sous-jacent).
 */
export function testOwnerClient(): PrismaClient {
  return new PrismaClient({ datasources: { db: { url: process.env.MIGRATE_DATABASE_URL } } });
}
