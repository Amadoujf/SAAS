import type { Prisma } from "@prisma/client";
import { prisma } from "./client";

/**
 * Exécute `fn` dans une transaction où `app.current_tenant_id` est positionné pour la
 * durée de la transaction (paramètre local, réinitialisé automatiquement au commit/rollback).
 * La policy RLS de chaque table filtre sur ce paramètre — voir
 * prisma/migrations/*_enable_row_level_security/migration.sql.
 *
 * C'est le SEUL point d'entrée que doit utiliser le code applicatif pour toute opération
 * scoping à un tenant (dashboard commerçant, site public, API). Ne jamais faire confiance
 * à un `tenantId` fourni par le client sans passer par cette fonction.
 */
export async function withTenant<T>(
  tenantId: string,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  if (!tenantId) {
    throw new Error("withTenant: tenantId manquant — refus d'exécuter une requête non scoped.");
  }
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`;
    await tx.$executeRaw`SELECT set_config('app.is_super_admin', 'false', true)`;
    return fn(tx);
  });
}

/**
 * Variante pour les quelques requêtes légitimement transverses à plusieurs tenants du
 * point de vue d'UN utilisateur (ex. "à quelles entreprises est-ce que j'appartiens ?").
 * La policy RLS de `TenantUser` autorise explicitement `user_id = app.current_user_id`
 * EN PLUS de `tenant_id = app.current_tenant_id` — voir la migration RLS. Cela n'expose
 * jamais les données d'un autre utilisateur : seules les lignes où CET utilisateur est
 * lui-même membre sont visibles.
 */
export async function withUser<T>(
  userId: string,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  if (!userId) {
    throw new Error("withUser: userId manquant — refus d'exécuter une requête non scoped.");
  }
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.current_user_id', ${userId}, true)`;
    await tx.$executeRaw`SELECT set_config('app.is_super_admin', 'false', true)`;
    return fn(tx);
  });
}

/**
 * Exécute `fn` avec un accès cross-tenant explicite, réservé aux opérations Super Admin
 * (voir docs/05-roles-permissions.md#54-impersonation). L'appelant est responsable de
 * vérifier `User.isSuperAdmin` AVANT d'appeler cette fonction et d'écrire l'entrée
 * `AuditLog` correspondante — cette fonction ne fait qu'ouvrir l'accès RLS, elle ne
 * journalise rien elle-même.
 */
export async function withSuperAdminAccess<T>(
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.is_super_admin', 'true', true)`;
    return fn(tx);
  });
}
