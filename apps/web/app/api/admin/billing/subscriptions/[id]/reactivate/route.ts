import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { withSuperAdminAccess, withTenant, reactivateSubscriptionWithoutPayment, writeAuditLog } from "@yamacommerce/database";
import { isSameOriginRequest } from "@/lib/domains/same-origin";
import { requireSuperAdmin } from "@/lib/domains/require-super-admin";

const bodySchema = z.object({
  justification: z.string().min(10, "Une justification détaillée est obligatoire pour une réactivation manuelle."),
});

/**
 * Réactivation SANS paiement (suspension prononcée par erreur, litige résolu à
 * l'amiable) — voir docs/14-facturation-saas-abonnements.md. Ne prolonge JAMAIS la
 * période (voir `reactivateSubscriptionWithoutPayment`) : pour un paiement réellement
 * reçu hors ligne, utiliser `/extend` à la place, qui applique la vraie formule de
 * renouvellement.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Origine refusée." }, { status: 403 });
  const admin = await requireSuperAdmin();
  if (!admin) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Corps de requête invalide." }, { status: 400 });
  }

  const subscription = await withSuperAdminAccess((tx) => tx.tenantSubscription.findUniqueOrThrow({ where: { id: params.id } }));

  try {
    const updated = await withTenant(subscription.tenantId, (tx) =>
      reactivateSubscriptionWithoutPayment(tx, subscription.tenantId, subscription.id, {
        actorUserId: admin.userId,
        justification: parsed.data.justification,
      }),
    );

    await withSuperAdminAccess((tx) =>
      writeAuditLog(tx, {
        tenantId: subscription.tenantId,
        actorUserId: admin.userId,
        actorType: "super_admin",
        action: "billing.subscription_reactivated_by_admin",
        entityType: "TenantSubscription",
        entityId: subscription.id,
        metadata: { justification: parsed.data.justification },
      }),
    );

    return NextResponse.json({ subscription: updated });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Échec de la réactivation." },
      { status: 400 },
    );
  }
}
