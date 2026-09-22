import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { withSuperAdminAccess, type SubscriptionStatus } from "@yamacommerce/database";
import { requireSuperAdmin } from "@/lib/domains/require-super-admin";

const VALID_STATUSES = new Set<string>([
  "PENDING",
  "TRIALING",
  "ACTIVE",
  "GRACE_PERIOD",
  "PAST_DUE",
  "SUSPENDED",
  "CANCELED",
  "EXPIRED",
]);

/** Recherche/filtrage global des abonnements — voir docs/14-facturation-saas-
 *  abonnements.md, « Super Admin : recherche d'abonnements ». */
export async function GET(request: NextRequest) {
  const admin = await requireSuperAdmin();
  if (!admin) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });

  const query = request.nextUrl.searchParams.get("query")?.trim();
  const statusParam = request.nextUrl.searchParams.get("status");
  const status = statusParam && VALID_STATUSES.has(statusParam) ? (statusParam as SubscriptionStatus) : undefined;

  const subscriptions = await withSuperAdminAccess((tx) =>
    tx.tenantSubscription.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(query ? { tenant: { name: { contains: query, mode: "insensitive" } } } : {}),
      },
      include: { tenant: { select: { id: true, name: true, slug: true } }, plan: { select: { id: true, name: true } } },
      orderBy: { currentPeriodEnd: "asc" },
      take: 100,
    }),
  );

  return NextResponse.json({ subscriptions });
}
