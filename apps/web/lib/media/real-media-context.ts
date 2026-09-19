import "server-only";
import { withTenant } from "@yamacommerce/database";
import { quotaConfigFromMB } from "@yamacommerce/storage";
import { PrismaMediaRepository } from "./prisma-media-repository";
import { storageProvider } from "./storage-config";
import type { UploadPipelineDeps } from "./upload-pipeline";

/**
 * Dépendances RÉELLES de la médiathèque (PostgreSQL + fournisseur de stockage
 * configuré, voir storage-config.ts) — voir « conserve exactement la même interface
 * pour PostgreSQL, BullMQ et R2 » : seul ce fichier change entre la démonstration
 * (voir demo-media-context.ts, `InMemoryMediaRepository` + quota codé en dur) et la
 * production. Première utilisation réelle de `storageProvider()`/
 * `PrismaMediaRepository`/routes `/api/media/*` — jusqu'ici seulement testées, jamais
 * exposées à un utilisateur authentifié (voir la revue du 18 septembre 2026,
 * « images de la médiathèque »).
 */
const repository = new PrismaMediaRepository();

/** Quota RÉEL de CE tenant (formule active) — jamais une limite codée en dur (voir
 *  demo-media-context.ts `DEMO_QUOTA`, qui ne convient qu'à la démonstration). Un
 *  tenant sans abonnement actif est traité comme la formule la plus restrictive
 *  ("Essentiel") plutôt que de bloquer l'import avec une erreur peu claire. */
export async function realMediaDeps(tenantId: string): Promise<UploadPipelineDeps> {
  const plan = await withTenant(tenantId, async (tx) => {
    const subscription = await tx.subscription.findUnique({ where: { tenantId }, include: { plan: true } });
    if (subscription) return subscription.plan;
    return tx.plan.findFirst({ where: { name: "Essentiel" } });
  });

  const quotaConfig = plan
    ? quotaConfigFromMB({
        storageMB: plan.storageMB,
        maxImageFileMB: plan.maxImageFileMB,
        maxVideoFileMB: plan.maxVideoFileMB,
        maxDocumentFileMB: plan.maxDocumentFileMB,
        maxMediaFileCount: plan.maxMediaFileCount,
        monthlyUploadMB: plan.monthlyUploadMB,
      })
    : quotaConfigFromMB({
        storageMB: 100,
        maxImageFileMB: 5,
        maxVideoFileMB: 50,
        maxDocumentFileMB: 5,
        maxMediaFileCount: 100,
        monthlyUploadMB: 100,
      });

  return { repository, storage: storageProvider(), quotaConfig };
}

export function realMediaRepository(): PrismaMediaRepository {
  return repository;
}
