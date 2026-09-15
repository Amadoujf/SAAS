import "server-only";
import {
  getOrCreateDraftVersion,
  publishScheduledVersion,
  publishVersion,
  withTenant,
  writeAuditLog,
  type PublishVersionOptions,
} from "@yamacommerce/database";
import { checkPublishReadiness, type PublishReadinessReport } from "@yamacommerce/publishing";
import { LockAcquisitionError, withLock, type DistributedLock } from "@yamacommerce/queue";
import type { SectionInstance } from "@yamacommerce/templates";
import { buildPublishReadinessInput, type DraftPageForPublish } from "./readiness-resolver";
import { extractMediaAssetIdFromUrl } from "./media-url-ref";
import type { MediaRepository } from "@/lib/media/media-repository";

/**
 * Pipeline de publication ATOMIQUE — voir docs/12 §12.3, « PUBLICATION ATOMIQUE » (les
 * 12 étapes) et « SÉCURITÉ ET FIABILITÉ ». Point d'entrée UNIQUE pour "Publier
 * maintenant" ET pour la promotion d'une publication programmée (voir
 * schedule-pipeline.ts `promoteScheduledPublish`, qui appelle cette même fonction avec
 * `scheduledVersionId` renseigné) — pas deux chemins de code différents pour le même
 * effet final, seule la SOURCE (brouillon courant vs version programmée précise)
 * change (voir `publishScheduledVersion`, @yamacommerce/database, pour pourquoi ces
 * deux sources ne peuvent pas partager un seul appel de registre).
 *
 * Ordre des opérations :
 *  1. `withLock` — refuse immédiatement si une publication est déjà en cours pour ce
 *     site (voir `LockAcquisitionError`, mappé sur `already_in_progress`).
 *  2. `withTenant` — ouvre la SEULE transaction RLS qui lira/écrira l'état de ce tenant.
 *  3. Résout `PublishReadinessInput` (voir readiness-resolver.ts) et calcule le rapport
 *     via `checkPublishReadiness` (module pur, @yamacommerce/publishing) — bloque ici,
 *     AVANT tout effet de bord, si `canPublish` est faux.
 *  4. Promeut publics les médias non-documents réellement référencés (jamais les
 *     documents sensibles, jamais une démarque) — voir setPublic sur MediaRepository.
 *  5. `publishVersion()`/`publishScheduledVersion()` — fige la nouvelle version,
 *     archive l'ancienne, gère le brouillon suivant.
 *  6. `writeAuditLog()` dans la MÊME transaction — l'écriture d'audit fait partie de
 *     l'atomicité de la publication, pas une étape séparée pouvant échouer isolément.
 *  7. Après COMMIT réussi de la transaction : invalide le cache public de CE seul
 *     tenant (`invalidateSiteCache`) — jamais avant, une invalidation puis un rollback
 *     laisserait le cache pointer vers rien de cohérent.
 *
 * La VÉRIFICATION de permission ("site.publish") reste la responsabilité de
 * l'appelant (Server Action / route) — cette fonction ne connaît pas la session, comme
 * le reste de `@yamacommerce/database` ne la connaît pas non plus.
 */
export interface PublishSiteDeps {
  lock: DistributedLock;
  mediaRepository: MediaRepository;
  /** Injecté plutôt qu'appelé directement (`invalidateSiteCache`, voir cache.ts) :
   *  `revalidateTag` exige un contexte de requête Next.js réel, absent des tests
   *  unitaires du pipeline (voir publish-pipeline.test.ts, qui passe un no-op) — les
   *  VRAIS appelants (Server Actions, routes) passent toujours `invalidateSiteCache`. */
  invalidateCache: (tenantId: string) => void;
}

export interface PublishSiteInput {
  tenantId: string;
  tenantSiteId: string;
  /** `null` uniquement pour une promotion SYSTÈME sans utilisateur responsable
   *  identifiable — en pratique toujours renseigné, y compris pour une promotion
   *  programmée (voir `requestedByUserId`, schedule-pipeline.ts). */
  actorUserId: string | null;
  publishMessage?: string;
  domainUsed?: string | null;
  restoredFromVersionId?: string;
  restoreJustification?: string;
  /** Renseigné UNIQUEMENT par `promoteScheduledPublish` (schedule-pipeline.ts) : publie
   *  cette version "scheduled" précise via `publishScheduledVersion()` au lieu du
   *  brouillon courant. */
  scheduledVersionId?: string;
}

export type PublishSiteResult =
  | { outcome: "published"; versionNumber: number | null; publishedAt: Date }
  | { outcome: "blocked"; report: PublishReadinessReport }
  | { outcome: "already_in_progress" }
  /** Uniquement possible avec `scheduledVersionId` : la version n'est déjà plus
   *  "scheduled" (déjà publiée ou annulée par un appel précédent) — voir
   *  `publishScheduledVersion`. */
  | { outcome: "already_handled" };

const PUBLISH_LOCK_TTL_MS = 60_000;

function lockKeyForSite(tenantSiteId: string): string {
  return `site-publish:${tenantSiteId}`;
}

export async function publishSite(
  input: PublishSiteInput,
  deps: PublishSiteDeps,
): Promise<PublishSiteResult> {
  try {
    return await withLock(deps.lock, lockKeyForSite(input.tenantSiteId), PUBLISH_LOCK_TTL_MS, () =>
      runPublishTransaction(input, deps),
    );
  } catch (error) {
    if (error instanceof LockAcquisitionError) {
      return { outcome: "already_in_progress" };
    }
    throw error;
  }
}

async function runPublishTransaction(
  input: PublishSiteInput,
  deps: PublishSiteDeps,
): Promise<PublishSiteResult> {
  const result = await withTenant(input.tenantId, async (tx) => {
    const sourceRows = input.scheduledVersionId
      ? (
          await tx.tenantSiteVersion.findUnique({
            where: { id: input.scheduledVersionId },
            include: { pages: true },
          })
        )?.pages
      : (await getOrCreateDraftVersion(tx, input.tenantId, input.tenantSiteId)).pages;

    if (!sourceRows) {
      return { outcome: "already_handled" as const };
    }

    const sourcePages: DraftPageForPublish[] = sourceRows.map((page) => ({
      id: page.id,
      slug: page.slug,
      title: page.title,
      isHome: page.isHome,
      blocks: page.blocks as unknown as SectionInstance[],
    }));

    const readinessInput = await buildPublishReadinessInput(
      tx,
      input.tenantId,
      input.tenantSiteId,
      sourcePages,
      { mediaRepository: deps.mediaRepository },
    );
    const report = checkPublishReadiness(readinessInput);
    if (!report.canPublish) {
      return { outcome: "blocked" as const, report };
    }

    for (const reference of readinessInput.mediaReferences) {
      if (reference.isSensitiveDocument) continue; // jamais promu, voir la garde ci-dessus.
      const assetId = extractMediaAssetIdFromUrl(reference.url);
      if (!assetId) continue; // média externe.
      await deps.mediaRepository.setPublic(input.tenantId, assetId, true);
    }

    const publishOptions: PublishVersionOptions = {
      publishMessage: input.publishMessage,
      domainUsed: input.domainUsed ?? null,
      restoredFromVersionId: input.restoredFromVersionId,
      restoreJustification: input.restoreJustification,
    };

    const publishResult = input.scheduledVersionId
      ? await publishScheduledVersion(
          tx,
          input.tenantId,
          input.tenantSiteId,
          input.scheduledVersionId,
          publishOptions,
        )
      : await publishVersion(tx, input.tenantId, input.tenantSiteId, publishOptions);

    if (!publishResult) {
      return { outcome: "already_handled" as const };
    }
    const { published } = publishResult;

    await writeAuditLog(tx, {
      tenantId: input.tenantId,
      actorUserId: input.actorUserId,
      actorType: input.actorUserId === null ? "system" : "owner",
      action: "site.published",
      entityType: "TenantSiteVersion",
      entityId: published.id,
      metadata: {
        versionNumber: published.versionNumber,
        wasScheduled: published.wasScheduled,
        restoredFromVersionId: published.restoredFromVersionId,
      },
    });

    return {
      outcome: "published" as const,
      versionNumber: published.versionNumber,
      publishedAt: published.publishedAt!,
    };
  });

  if (result.outcome === "published") {
    deps.invalidateCache(input.tenantId);
  }
  return result;
}
