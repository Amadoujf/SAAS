import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { withSuperAdminAccess, withTenant, confirmSubscriptionPaymentSuccess, writeAuditLog } from "@yamacommerce/database";
import { isSameOriginRequest } from "@/lib/domains/same-origin";
import { requireSuperAdmin } from "@/lib/domains/require-super-admin";

const bodySchema = z.object({
  planId: z.string().min(1),
  billingCycle: z.enum(["MONTHLY", "YEARLY"]),
  amountXOF: z.number().int().nonnegative(),
  justification: z.string().min(10, "Une justification détaillée est obligatoire pour une prolongation manuelle."),
});

/**
 * Prolongation manuelle avec justification OBLIGATOIRE — voir docs/14-facturation-
 * saas-abonnements.md. Passe par `confirmSubscriptionPaymentSuccess` — LA MÊME
 * fonction qu'un webhook Chariow réel — jamais une seconde branche de calcul de
 * renouvellement : un paiement reçu hors ligne (virement, espèces) suit exactement la
 * même formule (jours prépayés conservés, jamais un temps déjà écoulé compté comme
 * payé). `provider: "manual"`, `providerSaleId` généré ici (aucune vente Chariow
 * réelle ne peut jamais entrer en collision avec cet espace de noms).
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
    const result = await withTenant(subscription.tenantId, (tx) =>
      confirmSubscriptionPaymentSuccess(tx, subscription.tenantId, {
        subscriptionId: subscription.id,
        provider: "manual",
        providerSaleId: `manual_admin_${randomUUID()}`,
        planId: parsed.data.planId,
        billingCycle: parsed.data.billingCycle,
        amountXOF: parsed.data.amountXOF,
        currency: "XOF",
        actor: { actorType: "super_admin", actorUserId: admin.userId, justification: parsed.data.justification },
      }),
    );

    await withSuperAdminAccess((tx) =>
      writeAuditLog(tx, {
        tenantId: subscription.tenantId,
        actorUserId: admin.userId,
        actorType: "super_admin",
        action: "billing.subscription_manually_extended",
        entityType: "TenantSubscription",
        entityId: subscription.id,
        metadata: { justification: parsed.data.justification, amountXOF: parsed.data.amountXOF, billingCycle: parsed.data.billingCycle },
      }),
    );

    return NextResponse.json({ subscription: result.subscription, outcome: result.outcome });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Échec de la prolongation manuelle." },
      { status: 400 },
    );
  }
}
