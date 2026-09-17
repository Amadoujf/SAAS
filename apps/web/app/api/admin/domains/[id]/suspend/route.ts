import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { suspendDomain, withSuperAdminAccess, writeAuditLog } from "@yamacommerce/database";
import { isSameOriginRequest } from "@/lib/domains/same-origin";
import { requireSuperAdmin } from "@/lib/domains/require-super-admin";

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Origine refusée." }, { status: 403 });
  const admin = await requireSuperAdmin();
  if (!admin) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });

  await withSuperAdminAccess(async (tx) => {
    const domain = await tx.domain.findUniqueOrThrow({ where: { id: params.id } });
    await suspendDomain(tx, params.id);
    // `tenantId` du domaine, pas `null` : le tenant doit voir cette intervention dans
    // son propre historique d'événements (voir docs/13, « Historique des
    // événements ») — voir la note de audit-log-registry.ts sur "action strictement
    // plateforme" (ce n'en est pas une : elle concerne CE tenant précis).
    await writeAuditLog(tx, {
      tenantId: domain.tenantId,
      actorUserId: admin.userId,
      actorType: "super_admin",
      action: "domain.suspended_by_admin",
      entityType: "Domain",
      entityId: params.id,
    });
  });
  return NextResponse.json({ ok: true });
}
