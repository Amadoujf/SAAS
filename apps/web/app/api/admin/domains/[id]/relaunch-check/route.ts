import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { withSuperAdminAccess, writeAuditLog } from "@yamacommerce/database";
import { isSameOriginRequest } from "@/lib/domains/same-origin";
import { requireSuperAdmin } from "@/lib/domains/require-super-admin";
import { checkDomainDnsAndAdvance } from "@/lib/domains/dns-check-pipeline";
import { realDnsCheckDeps } from "@/lib/domains/real-deps";

/** « Diagnostiquer une publication »/« relancer une publication échouée », transposé
 *  aux domaines — voir docs/13, « INTERFACE SUPER ADMIN ». Appelle directement le
 *  pipeline de vérification (jamais rate-limité pour un Super Admin, contrairement
 *  au bouton client « Vérifier maintenant »). */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Origine refusée." }, { status: 403 });
  const admin = await requireSuperAdmin();
  if (!admin) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });

  const tenantId = await withSuperAdminAccess(async (tx) => {
    const domain = await tx.domain.findUniqueOrThrow({ where: { id: params.id } });
    return domain.tenantId;
  });

  const outcome = await checkDomainDnsAndAdvance(tenantId, params.id, realDnsCheckDeps());

  await withSuperAdminAccess((tx) =>
    writeAuditLog(tx, {
      tenantId,
      actorUserId: admin.userId,
      actorType: "super_admin",
      action: "domain.relaunched_by_admin",
      entityType: "Domain",
      entityId: params.id,
      metadata: { outcome },
    }),
  );

  return NextResponse.json({ outcome });
}
