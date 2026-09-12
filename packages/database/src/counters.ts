import type { Prisma } from "@prisma/client";

/**
 * Incrémente atomiquement un compteur nommé (`scope`) pour un tenant et retourne la
 * nouvelle valeur. Base de la numérotation séquentielle des factures/commandes —
 * jamais un simple `COUNT(*)`, qui produirait des doublons sous requêtes concurrentes.
 * `upsert` se traduit en `INSERT ... ON CONFLICT DO UPDATE`, atomique côté PostgreSQL.
 *
 * Doit être appelé à l'intérieur d'une transaction ouverte via `withTenant`.
 */
export async function nextCounterValue(
  tx: Prisma.TransactionClient,
  tenantId: string,
  scope: string,
): Promise<number> {
  const counter = await tx.counter.upsert({
    where: { tenantId_scope: { tenantId, scope } },
    create: { tenantId, scope, value: 1 },
    update: { value: { increment: 1 } },
  });
  return counter.value;
}

/** Numérotation séquentielle par entreprise ET par exercice — voir adjustement #6. */
export function invoiceScope(fiscalYear: number): string {
  return `invoice-${fiscalYear}`;
}

export function orderScope(fiscalYear: number): string {
  return `order-${fiscalYear}`;
}

export function formatInvoiceNumber(fiscalYear: number, value: number): string {
  return `FAC-${fiscalYear}-${String(value).padStart(6, "0")}`;
}

export function formatOrderNumber(fiscalYear: number, value: number): string {
  return `CMD-${fiscalYear}-${String(value).padStart(6, "0")}`;
}
