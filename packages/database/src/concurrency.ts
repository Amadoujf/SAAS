import type { Prisma } from "@prisma/client";

/**
 * CORRECTION DE STABILISATION — bogue réel trouvé en exécutant la suite réelle sur
 * GitHub Actions (jamais reproduit localement) : `getOrCreateActiveCart`,
 * `getOrCreateSubscription` et `resolveOrCreateCustomer` utilisaient toutes le même
 * idiome — `create()` dans un `try`, capture de la violation de contrainte unique
 * (un concurrent a gagné la course), puis une nouvelle requête sur le MÊME `tx` dans
 * le `catch` pour relire le gagnant. Ce motif est CASSÉ sous PostgreSQL réel : dès
 * qu'UNE instruction échoue dans une transaction, PostgreSQL abandonne TOUTE la
 * transaction ("current transaction is aborted, commands ignored until end of
 * transaction block", 25P02) — la relecture dans le `catch` échoue donc à son tour,
 * jamais seulement l'instruction fautive. Fonctionnait par hasard tant qu'aucun test
 * n'exerçait réellement la branche `catch` sous une vraie concurrence.
 *
 * Un `SAVEPOINT` avant la tentative de création, annulé (`ROLLBACK TO SAVEPOINT`) en
 * cas d'échec, résout cela : seules les instructions depuis le point de sauvegarde
 * sont annulées, la transaction reste utilisable pour la relecture qui suit. C'est
 * l'idiome PostgreSQL standard pour "tenter une écriture qui peut violer une
 * contrainte, puis se rattraper dans la même transaction" — jamais un `upsert` (voir
 * la même correction dans customer-registry.ts : non garanti atomique par tous les
 * connecteurs Prisma) ni un `create()` nu suivi d'une relecture sans filet.
 */
export async function createOrRecoverFromConflict<T>(
  tx: Prisma.TransactionClient,
  create: () => Promise<T>,
  refetchWinner: () => Promise<T | null>,
): Promise<T> {
  await tx.$executeRaw`SAVEPOINT create_or_recover_from_conflict`;
  try {
    return await create();
  } catch (error) {
    await tx.$executeRaw`ROLLBACK TO SAVEPOINT create_or_recover_from_conflict`;
    const winner = await refetchWinner();
    if (!winner) throw error;
    return winner;
  }
}
