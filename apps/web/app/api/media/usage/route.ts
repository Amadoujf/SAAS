import { NextResponse } from "next/server";
import { summarizeQuotaUsage } from "@yamacommerce/storage";
import { realMediaDeps, realMediaRepository } from "@/lib/media/real-media-context";
import { requireTenantPermission } from "@/lib/tenant-permissions";
import { getCurrentTenantMembership } from "@/lib/current-tenant";

/** Utilisation RÉELLE du quota du tenant courant (formule active) — voir
 *  `app/api/demo-media/usage/route.ts` pour l'équivalent démonstration. */
export async function GET() {
  const membership = await getCurrentTenantMembership();
  if (!membership) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  const actor = await requireTenantPermission(membership.tenantId, "products.view");
  if (!actor) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const deps = await realMediaDeps(membership.tenantId);
  const usage = await realMediaRepository().getUsageSnapshot(membership.tenantId, monthStart);
  const summary = summarizeQuotaUsage(deps.quotaConfig, usage);
  return NextResponse.json({ usage, quota: deps.quotaConfig, summary });
}
