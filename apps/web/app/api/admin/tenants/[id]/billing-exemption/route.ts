import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { withSuperAdminAccess, writeAuditLog } from "@yamacommerce/database";
import { isSameOriginRequest } from "@/lib/domains/same-origin";
import { requireSuperAdmin } from "@/lib/domains/require-super-admin";

const bodySchema = z.object({
  exempt: z.boolean(),
  justification: z.string().min(10, "Une justification détaillée est obligatoire."),
});

/**
 * Dérogation de facturation pour un tenant ANTÉRIEUR à cette étape — voir
 * docs/14-facturation-saas-abonnements.md, correction de stabilisation du 22
 * septembre 2026 : « aucune souscription = accès illimité » ne doit plus jamais être
 * le comportement par défaut ; SEULE cette route (Super Admin, justification
 * obligatoire, tracée) peut accorder une exemption explicite
 * (`Tenant.billingExemptedAt`). Un tenant standard n'a JAMAIS besoin de cette route :
 * il doit passer par un abonnement réel (essai ou souscription).
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Origine refusée." }, { status: 403 });
  const admin = await requireSuperAdmin();
  if (!admin) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Corps de requête invalide." }, { status: 400 });
  }

  const tenant = await withSuperAdminAccess((tx) =>
    tx.tenant.update({
      where: { id: params.id },
      data: { billingExemptedAt: parsed.data.exempt ? new Date() : null },
    }),
  );

  await withSuperAdminAccess((tx) =>
    writeAuditLog(tx, {
      tenantId: tenant.id,
      actorUserId: admin.userId,
      actorType: "super_admin",
      action: parsed.data.exempt ? "billing.tenant_exempted" : "billing.tenant_exemption_revoked",
      entityType: "Tenant",
      entityId: tenant.id,
      metadata: { justification: parsed.data.justification },
    }),
  );

  return NextResponse.json({ tenant });
}
