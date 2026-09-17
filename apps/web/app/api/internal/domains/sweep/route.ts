import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { withSuperAdminAccess, listDomainsNeedingRecheck } from "@yamacommerce/database";
import { QUEUE_NAMES, domainDnsCheckQueue } from "@yamacommerce/queue";

/**
 * Balayage périodique — voir docs/13, « DÉTECTION DNS » : « Relance périodiquement
 * les domaines mal configurés ». Déclenché par un job BullMQ RÉPÉTABLE (voir
 * apps/worker), séparé de la chaîne de tentatives rapides (dns-check-schedule.ts) :
 * celle-ci s'arrête après `MAX_QUICK_ATTEMPTS`, ce balayage reprend ensuite le relais
 * à un rythme beaucoup plus lent, indéfiniment, jusqu'à ce que le domaine soit vérifié
 * ou retiré par le client.
 */
export async function POST(request: NextRequest) {
  const expectedSecret = process.env.INTERNAL_WORKER_SECRET;
  const providedSecret = request.headers.get("x-internal-secret");
  if (!expectedSecret || providedSecret !== expectedSecret) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const staleBefore = new Date(Date.now() - 15 * 60 * 1000);
  const domainIds = await withSuperAdminAccess((tx) => listDomainsNeedingRecheck(tx, staleBefore));

  for (const domainId of domainIds) {
    const domain = await withSuperAdminAccess((tx) => tx.domain.findUniqueOrThrow({ where: { id: domainId } }));
    await domainDnsCheckQueue.add(
      QUEUE_NAMES.domainDnsCheck,
      { tenantId: domain.tenantId, domainId, attempt: 1 },
      { jobId: `sweep-${domainId}-${Date.now()}` },
    );
  }

  return NextResponse.json({ enqueued: domainIds.length });
}
