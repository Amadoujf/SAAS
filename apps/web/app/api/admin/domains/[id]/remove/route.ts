import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { removeDomain, withSuperAdminAccess, writeAuditLog } from "@yamacommerce/database";
import { isSameOriginRequest } from "@/lib/domains/same-origin";
import { requireSuperAdmin } from "@/lib/domains/require-super-admin";
import { invalidateSiteCache } from "@/lib/publishing/cache";
import { realDnsCheckDeps } from "@/lib/domains/real-deps";

/** Retrait par un Super Admin — voir docs/13, « INTERFACE SUPER ADMIN » : « Retirer
 *  avec justification ». Contrairement au retrait par le client lui-même (voir
 *  DELETE /api/domains/[id]), la justification est ICI un champ OBLIGATOIRE. */
const bodySchema = z.object({ justification: z.string().min(10) });

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Origine refusée." }, { status: 403 });
  const admin = await requireSuperAdmin();
  if (!admin) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });

  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Une justification d'au moins 10 caractères est obligatoire." },
      { status: 400 },
    );
  }

  const tenantId = await withSuperAdminAccess(async (tx) => {
    const domain = await tx.domain.findUniqueOrThrow({ where: { id: params.id } });
    await removeDomain(tx, domain.tenantId, params.id);
    // Défense en profondeur — voir docs/13, revue du 18 septembre 2026 : le statut
    // REMOVED bloque déjà la résolution publique, mais ne révoque rien côté
    // fournisseur réel (Caddy garde un certificat déjà émis en cache).
    await realDnsCheckDeps().domainProvider.revokeDomain(domain.domain);
    await writeAuditLog(tx, {
      tenantId: domain.tenantId,
      actorUserId: admin.userId,
      actorType: "super_admin",
      action: "domain.removed_by_admin",
      entityType: "Domain",
      entityId: params.id,
      metadata: { justification: parsed.data.justification },
    });
    return domain.tenantId;
  });

  invalidateSiteCache(tenantId);
  return NextResponse.json({ ok: true });
}
