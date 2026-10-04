import { NextResponse } from "next/server";
import { isInternalCallAuthorized } from "@/lib/internal-secret";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { MAX_QUICK_ATTEMPTS, nextDnsCheckDelayMs, shouldContinueQuickRetries } from "@yamacommerce/domains";
import { QUEUE_NAMES, domainDnsCheckQueue } from "@yamacommerce/queue";
import { checkDomainDnsAndAdvance } from "@/lib/domains/dns-check-pipeline";
import { realDnsCheckDeps } from "@/lib/domains/real-deps";

/**
 * Route interne appelée par `apps/worker` — voir docs/13, « DÉTECTION DNS ». Même
 * raison qu'`app/api/internal/site-publishing/promote` : c'est ICI, dans le
 * contexte Next.js, que vit `invalidateSiteCache` (voir dns-check-pipeline.ts), pas
 * dans le process worker. C'est AUSSI ici qu'est décidée la RE-PROGRAMMATION de la
 * tentative suivante (délai progressif, voir dns-check-schedule.ts) — le worker
 * reste un simple déclencheur, jamais porteur de cette logique métier.
 */
const bodySchema = z.object({
  tenantId: z.string().min(1),
  domainId: z.string().min(1),
  attempt: z.number().int().min(1),
});

export async function POST(request: NextRequest) {
  if (!isInternalCallAuthorized(request.headers.get("x-internal-secret"))) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Corps de requête invalide." }, { status: 400 });
  }
  const { tenantId, domainId, attempt } = parsed.data;

  const outcome = await checkDomainDnsAndAdvance(tenantId, domainId, realDnsCheckDeps());

  const stillPending = outcome === "pending_dns" || outcome === "verifying" || outcome === "ssl_pending";
  if (stillPending && shouldContinueQuickRetries(attempt)) {
    const nextAttempt = attempt + 1;
    await domainDnsCheckQueue.add(
      QUEUE_NAMES.domainDnsCheck,
      { tenantId, domainId, attempt: nextAttempt },
      { delay: nextDnsCheckDelayMs(nextAttempt), jobId: `${domainId}-${nextAttempt}` },
    );
  } else if (stillPending && attempt >= MAX_QUICK_ATTEMPTS) {
    // « Arrête les vérifications inutiles » : bascule sur le balayage périodique lent
    // plutôt que de continuer à réessayer en boucle serrée — voir
    // listDomainsNeedingRecheck (@yamacommerce/database), consulté séparément par
    // un job planifié (voir apps/worker).
  }

  return NextResponse.json({ outcome, attempt });
}
