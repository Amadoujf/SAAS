import { Prisma } from "@prisma/client";

/**
 * Premier point d'écriture de `AuditLog` dans le projet (voir docs/12 §12.3,
 * "SÉCURITÉ ET FIABILITÉ" : « journal d'audit » et "SUPER ADMIN" : « Toute
 * intervention doit être journalisée. »). Volontairement une fonction unique et
 * étroite plutôt qu'un système d'événements générique : chaque appelant est
 * responsable de choisir une `action` et un `entityType` lisibles au lieu de
 * dériver ces libellés d'un mécanisme central, pour rester simple à auditer.
 *
 * `tenantId: null` = action strictement plateforme (ex. Super Admin agissant hors du
 * contexte d'une entreprise) — la policy RLS d'`AuditLog` doit rester lisible par le
 * tenant concerné et par tout Super Admin, jamais par un autre tenant.
 */
export interface WriteAuditLogInput {
  tenantId: string | null;
  actorUserId: string | null;
  actorType: "super_admin" | "owner" | "employee" | "system" | "customer";
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Prisma.InputJsonValue;
  ipAddress?: string | null;
}

export async function writeAuditLog(tx: Prisma.TransactionClient, input: WriteAuditLogInput) {
  return tx.auditLog.create({
    data: {
      tenantId: input.tenantId,
      actorUserId: input.actorUserId,
      actorType: input.actorType,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      metadata: input.metadata ?? Prisma.JsonNull,
      ipAddress: input.ipAddress ?? null,
    },
  });
}
