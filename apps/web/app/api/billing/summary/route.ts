import { NextResponse } from "next/server";
import { withTenant, withSuperAdminAccess, resolveEffectiveLimit, type QuotaResourceKey } from "@yamacommerce/database";
import { getCurrentTenantMembership } from "@/lib/current-tenant";
import { requireTenantPermission } from "@/lib/tenant-permissions";

const QUOTA_KEYS: QuotaResourceKey[] = ["products", "employees", "domains"];

/**
 * Données de la page « Abonnement et facturation » — voir
 * docs/14-facturation-saas-abonnements.md. Les quotas affichés réutilisent
 * EXACTEMENT `resolveEffectiveLimit` (même fonction que l'application serveur des
 * quotas, voir `subscription-usage.ts`) — jamais un second calcul divergent qui
 * pourrait afficher un chiffre différent de celui réellement appliqué.
 */
export async function GET() {
  const membership = await getCurrentTenantMembership();
  if (!membership) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });

  const actor = await requireTenantPermission(membership.tenantId, "settings.subscription");
  if (!actor) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });

  const [subscriptionRow, payments, usage] = await withTenant(membership.tenantId, async (tx) => {
    const subscriptionRow = await tx.tenantSubscription.findUnique({
      where: { tenantId: membership.tenantId },
      include: { plan: true },
    });

    const payments = await tx.subscriptionPayment.findMany({
      where: { tenantId: membership.tenantId },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    const usageEntries = await Promise.all(
      QUOTA_KEYS.map(async (key) => {
        const limit = await resolveEffectiveLimit(tx, membership.tenantId, key);
        const used =
          key === "products"
            ? await tx.product.count({ where: { tenantId: membership.tenantId, deletedAt: null } })
            : key === "employees"
              ? await tx.tenantUser.count({ where: { tenantId: membership.tenantId, status: { in: ["INVITED", "ACTIVE"] } } })
              : await tx.domain.count({ where: { tenantId: membership.tenantId, lifecycleStatus: { not: "REMOVED" } } });
        return [key, { used, limit }] as const;
      }),
    );

    return [subscriptionRow, payments, Object.fromEntries(usageEntries)] as const;
  });

  const publishedPlans = await withSuperAdminAccess((tx) =>
    tx.subscriptionPlan.findMany({ where: { status: "PUBLISHED" }, orderBy: { priceMonthly: "asc" } }),
  );

  const daysRemaining = subscriptionRow
    ? Math.max(0, Math.ceil((subscriptionRow.currentPeriodEnd.getTime() - Date.now()) / 86_400_000))
    : null;

  return NextResponse.json({
    subscription: subscriptionRow
      ? {
          status: subscriptionRow.status,
          billingCycle: subscriptionRow.billingCycle,
          renewalMode: subscriptionRow.renewalMode,
          currentPeriodStart: subscriptionRow.currentPeriodStart,
          currentPeriodEnd: subscriptionRow.currentPeriodEnd,
          graceEndsAt: subscriptionRow.graceEndsAt,
          daysRemaining,
          planId: subscriptionRow.planId,
          planName: subscriptionRow.plan.name,
        }
      : null,
    plans: publishedPlans.map((plan) => ({
      id: plan.id,
      name: plan.name,
      currency: plan.currency,
      priceMonthly: plan.priceMonthly,
      priceYearly: plan.priceYearly,
      trialDays: plan.trialDays,
      maxProducts: plan.maxProducts,
      maxEmployees: plan.maxEmployees,
      maxShops: plan.maxShops,
      storageMB: plan.storageMB,
      maxCustomDomains: plan.maxCustomDomains,
      includedModuleKeys: plan.includedModuleKeys,
      features: plan.features,
    })),
    usage,
    payments: payments.map((payment) => ({
      id: payment.id,
      provider: payment.provider,
      amountXOF: payment.amountXOF,
      currency: payment.currency,
      status: payment.status,
      createdAt: payment.createdAt,
      confirmedAt: payment.confirmedAt,
    })),
  });
}
