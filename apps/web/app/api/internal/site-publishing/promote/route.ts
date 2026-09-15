import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { notificationsQueue, QUEUE_NAMES } from "@yamacommerce/queue";
import { promoteScheduledPublish } from "@/lib/publishing/schedule-pipeline";
import { realPublishSiteDeps } from "@/lib/publishing/real-deps";

/**
 * Route interne appelée UNIQUEMENT par `apps/worker` (voir docs/12 §12.3, «
 * PUBLICATION PROGRAMMÉE ») à l'échéance d'une publication programmée — jamais par un
 * navigateur. `revalidateTag` (voir cache.ts) exige un contexte de requête Next.js
 * réel, absent du process `apps/worker` : passer par CETTE route (plutôt que
 * dupliquer la logique de publication dans le worker) est ce qui permet au worker de
 * déclencher une invalidation de cache correcte sans jamais importer de code Next.js.
 *
 * Authentification par secret partagé (`INTERNAL_WORKER_SECRET`) — jamais de session
 * utilisateur ici, cette route n'est accessible qu'au réseau interne/au worker.
 */
const bodySchema = z.object({
  tenantId: z.string().min(1),
  tenantSiteId: z.string().min(1),
  versionId: z.string().min(1),
  scheduledAtIso: z.string().min(1),
  requestedByUserId: z.string().min(1),
});

export async function POST(request: NextRequest) {
  const expectedSecret = process.env.INTERNAL_WORKER_SECRET;
  const providedSecret = request.headers.get("x-internal-secret");
  if (!expectedSecret || providedSecret !== expectedSecret) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Corps de requête invalide.", issues: parsed.error.issues }, { status: 400 });
  }

  const result = await promoteScheduledPublish(parsed.data, realPublishSiteDeps());

  // Notification du propriétaire — voir docs/12 §12.3, « NOTIFICATIONS » : succès
  // (lien + numéro de version) ou échec (message compréhensible, jamais les détails
  // techniques). Enqueue toujours (voir la file "notifications", déjà câblée mais
  // dont l'envoi réel reste un TODO Phase 2, comme `emailsWorker`) — jamais bloquant
  // pour la réponse à `apps/worker`.
  if (result.outcome === "published") {
    await notificationsQueue.add(QUEUE_NAMES.notifications, {
      tenantId: parsed.data.tenantId,
      channel: "internal",
      templateType: "site_published",
      recipient: parsed.data.requestedByUserId,
      variables: { versionNumber: result.versionNumber, wasScheduled: true },
    });
  } else if (result.outcome === "blocked" || result.outcome === "permission_revoked") {
    await notificationsQueue.add(QUEUE_NAMES.notifications, {
      tenantId: parsed.data.tenantId,
      channel: "internal",
      templateType: "site_publish_failed",
      recipient: parsed.data.requestedByUserId,
      variables: { reason: result.outcome },
    });
  }

  if (result.outcome === "published") {
    return NextResponse.json({ outcome: result.outcome, versionNumber: result.versionNumber });
  }
  if (result.outcome === "already_handled") {
    return NextResponse.json({ outcome: result.outcome });
  }
  if (result.outcome === "already_in_progress") {
    // Retryable : le worker doit réessayer (voir backoff BullMQ sur la file
    // `site-publishing`) — un verrou déjà détenu est temporaire par nature.
    return NextResponse.json({ outcome: result.outcome }, { status: 409 });
  }
  if (result.outcome === "permission_revoked") {
    return NextResponse.json({ outcome: result.outcome }, { status: 200 }); // définitif, pas de retry.
  }
  return NextResponse.json({ outcome: result.outcome, report: result.report }, { status: 200 }); // "blocked", définitif.
}
