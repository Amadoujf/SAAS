import "server-only";
import {
  cancelScheduledPublish,
  getOrCreateDraftVersion,
  scheduleVersionPublish,
  withTenant,
  writeAuditLog,
} from "@yamacommerce/database";
import { hasPermission } from "@yamacommerce/auth";
import {
  checkPublishReadiness,
  resolveScheduledPublishUtc,
  type PublishReadinessReport,
} from "@yamacommerce/publishing";
import { QUEUE_NAMES, sitePublishingQueue, type SitePublishingJobData } from "@yamacommerce/queue";
import type { SectionInstance } from "@yamacommerce/templates";
import { buildPublishReadinessInput, type DraftPageForPublish } from "./readiness-resolver";
import { publishSite, type PublishSiteDeps, type PublishSiteResult } from "./publish-pipeline";
import type { MediaRepository } from "@/lib/media/media-repository";

/**
 * Publication PROGRAMMÉE — voir docs/12 §12.3, « PUBLICATION PROGRAMMÉE ». Deux
 * moitiés bien séparées :
 *  - `scheduleSitePublish` : côté web, au moment où l'utilisateur choisit "Programmer"
 *    — valide, marque la version "scheduled", enqueue un job BullMQ dont le `jobId`
 *    est l'id de la VERSION elle-même (première ligne de défense contre une double
 *    programmation, voir @yamacommerce/queue `queues.ts`).
 *  - `promoteScheduledPublish` : côté worker (voir apps/worker, via la route interne
 *    `app/api/internal/site-publishing/promote`), à l'échéance — revérifie tout
 *    (permission, abonnement, tenant…) plutôt que de faire confiance à l'état capturé
 *    au moment de la programmation, PUIS publie via `publishSite({ scheduledVersionId
 *    })` — EXACTEMENT le même verrou/transaction/audit/cache que "Publier maintenant"
 *    (voir publish-pipeline.ts).
 */

export interface ScheduleSitePublishInput {
  tenantId: string;
  tenantSiteId: string;
  requestedByUserId: string;
  scheduledDateTimeLocal: string;
  timeZone?: string;
  publishMessage?: string;
}

export type ScheduleSitePublishResult =
  | { outcome: "scheduled"; versionId: string; scheduledAtUtc: Date }
  | { outcome: "blocked"; report: PublishReadinessReport };

export async function scheduleSitePublish(
  input: ScheduleSitePublishInput,
  deps: { mediaRepository: MediaRepository },
): Promise<ScheduleSitePublishResult> {
  const scheduledAtUtc = resolveScheduledPublishUtc(input.scheduledDateTimeLocal, input.timeZone);

  const result = await withTenant(input.tenantId, async (tx) => {
    const draft = await getOrCreateDraftVersion(tx, input.tenantId, input.tenantSiteId);
    const draftPages: DraftPageForPublish[] = draft.pages.map((page) => ({
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
      draftPages,
      { mediaRepository: deps.mediaRepository },
    );
    const report = checkPublishReadiness(readinessInput);
    if (!report.canPublish) {
      return { outcome: "blocked" as const, report };
    }

    await scheduleVersionPublish(tx, draft.id, scheduledAtUtc);
    await writeAuditLog(tx, {
      tenantId: input.tenantId,
      actorUserId: input.requestedByUserId,
      actorType: "owner",
      action: "site.publish_scheduled",
      entityType: "TenantSiteVersion",
      entityId: draft.id,
      metadata: { scheduledAtUtc: scheduledAtUtc.toISOString(), publishMessage: input.publishMessage ?? null },
    });

    return { outcome: "scheduled" as const, versionId: draft.id, scheduledAtUtc };
  });

  if (result.outcome === "scheduled") {
    const delayMs = Math.max(0, result.scheduledAtUtc.getTime() - Date.now());
    const jobData: SitePublishingJobData = {
      tenantId: input.tenantId,
      tenantSiteId: input.tenantSiteId,
      versionId: result.versionId,
      scheduledAtIso: result.scheduledAtUtc.toISOString(),
      requestedByUserId: input.requestedByUserId,
    };
    await sitePublishingQueue.add(QUEUE_NAMES.sitePublishing, jobData, {
      jobId: result.versionId,
      delay: delayMs,
    });
  }

  return result;
}

/** Annule une publication programmée — repasse la version en brouillon normal ET
 *  retire le job BullMQ correspondant (voir `jobId: versionId`), pour qu'il ne se
 *  déclenche jamais après coup. */
export async function cancelSitePublishSchedule(
  tenantId: string,
  versionId: string,
  cancelledByUserId: string,
): Promise<void> {
  await withTenant(tenantId, async (tx) => {
    await cancelScheduledPublish(tx, versionId);
    await writeAuditLog(tx, {
      tenantId,
      actorUserId: cancelledByUserId,
      actorType: "owner",
      action: "site.publish_schedule_cancelled",
      entityType: "TenantSiteVersion",
      entityId: versionId,
    });
  });

  const job = await sitePublishingQueue.getJob(versionId);
  if (job) await job.remove();
}

export type PromoteScheduledPublishResult =
  | { outcome: "published"; versionNumber: number | null }
  | { outcome: "already_handled" } // idempotence : plus "scheduled" (déjà publiée/annulée).
  | { outcome: "permission_revoked" }
  | { outcome: "blocked"; report: PublishReadinessReport }
  | { outcome: "already_in_progress" };

/**
 * Exécutée par le worker BullMQ (via la route interne, voir apps/worker) à l'échéance
 * d'une publication programmée. « Vérifie de nouveau les permissions et conditions » :
 * l'adhésion et la permission "site.publish" de l'utilisateur qui a programmé sont
 * revérifiées ICI, pas seulement au moment de la programmation — un rôle peut avoir
 * changé entre-temps.
 */
export async function promoteScheduledPublish(
  job: SitePublishingJobData,
  deps: PublishSiteDeps,
): Promise<PromoteScheduledPublishResult> {
  const stillScheduled = await withTenant(job.tenantId, (tx) =>
    tx.tenantSiteVersion.findUnique({ where: { id: job.versionId } }),
  );
  if (!stillScheduled || stillScheduled.status !== "scheduled") {
    return { outcome: "already_handled" };
  }

  const permissionOk = await withTenant(job.tenantId, async (tx) => {
    const membership = await tx.tenantUser.findFirst({
      where: { tenantId: job.tenantId, userId: job.requestedByUserId },
      include: { role: true },
    });
    return (
      membership !== null &&
      membership.status === "ACTIVE" &&
      hasPermission(membership.role.permissions, "site.publish")
    );
  });
  if (!permissionOk) {
    await withTenant(job.tenantId, async (tx) => {
      await cancelScheduledPublish(tx, job.versionId);
      await writeAuditLog(tx, {
        tenantId: job.tenantId,
        actorUserId: job.requestedByUserId,
        actorType: "system",
        action: "site.publish_schedule_permission_revoked",
        entityType: "TenantSiteVersion",
        entityId: job.versionId,
      });
    });
    return { outcome: "permission_revoked" };
  }

  const publishResult: PublishSiteResult = await publishSite(
    {
      tenantId: job.tenantId,
      tenantSiteId: job.tenantSiteId,
      actorUserId: job.requestedByUserId,
      scheduledVersionId: job.versionId,
    },
    deps,
  );

  if (publishResult.outcome === "published") {
    return { outcome: "published", versionNumber: publishResult.versionNumber };
  }
  if (publishResult.outcome === "already_in_progress") {
    return { outcome: "already_in_progress" };
  }
  if (publishResult.outcome === "already_handled") {
    return { outcome: "already_handled" };
  }
  return { outcome: "blocked", report: publishResult.report };
}
