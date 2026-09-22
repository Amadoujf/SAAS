import { NextResponse } from "next/server";
import { withSuperAdminAccess } from "@yamacommerce/database";
import { requireSuperAdmin } from "@/lib/domains/require-super-admin";

/**
 * Statistiques de facturation SaaS calculées depuis les données RÉELLES — voir
 * docs/14-facturation-saas-abonnements.md, « jamais un chiffre inventé ». MRR :
 * abonnements ACTIVE/GRACE_PERIOD uniquement (encore payants, même en grâce) ;
 * l'équivalent mensuel d'un cycle YEARLY est `priceYearly / 12` (arrondi), ce qui
 * SOUS-estime légèrement un MRR réel calculé au prorata exact du jour dans le cycle —
 * approximation standard assumée, jamais présentée comme un calcul au prorata.
 */
export async function GET() {
  const admin = await requireSuperAdmin();
  if (!admin) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });

  const [active, byStatus, canceledLast30Days] = await withSuperAdminAccess(async (tx) => {
    const active = await tx.tenantSubscription.findMany({
      where: { status: { in: ["ACTIVE", "GRACE_PERIOD"] } },
      include: { plan: { select: { priceMonthly: true, priceYearly: true } } },
    });

    const statuses = ["PENDING", "TRIALING", "ACTIVE", "GRACE_PERIOD", "PAST_DUE", "SUSPENDED", "CANCELED", "EXPIRED"] as const;
    const byStatus = await Promise.all(
      statuses.map(async (status) => [status, await tx.tenantSubscription.count({ where: { status } })] as const),
    );

    const canceledLast30Days = await tx.subscriptionEvent.count({
      where: { type: "canceled", createdAt: { gte: new Date(Date.now() - 30 * 86_400_000) } },
    });

    return [active, Object.fromEntries(byStatus), canceledLast30Days] as const;
  });

  const mrrXOF = active.reduce((sum, sub) => {
    return sum + (sub.billingCycle === "YEARLY" ? Math.round(sub.plan.priceYearly / 12) : sub.plan.priceMonthly);
  }, 0);

  const statusCounts = byStatus as Record<string, number>;
  const activeCount = (statusCounts.ACTIVE ?? 0) + (statusCounts.GRACE_PERIOD ?? 0);
  const churnRate30d = activeCount > 0 ? Math.round((canceledLast30Days / activeCount) * 1000) / 10 : 0;

  return NextResponse.json({
    mrrXOF,
    arrXOF: mrrXOF * 12,
    activeSubscriptions: activeCount,
    byStatus,
    canceledLast30Days,
    churnRate30dPercent: churnRate30d,
  });
}
