import { NextResponse } from "next/server";
import { getCurrentTenantMembership } from "@/lib/current-tenant";
import { listLowStockItemsAction } from "@/lib/catalog/stock-pipeline";

export async function GET() {
  const membership = await getCurrentTenantMembership();
  if (!membership) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });

  const items = await listLowStockItemsAction(membership.tenantId);
  if (items === null) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  return NextResponse.json({ items });
}
