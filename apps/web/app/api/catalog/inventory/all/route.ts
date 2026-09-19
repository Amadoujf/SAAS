import { NextResponse } from "next/server";
import { getCurrentTenantMembership } from "@/lib/current-tenant";
import { listAllInventoryItemsAction } from "@/lib/catalog/stock-pipeline";

/** Vue d'ensemble du stock — voir docs/08 §8.2, `/dashboard/stocks`. */
export async function GET() {
  const membership = await getCurrentTenantMembership();
  if (!membership) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });

  const items = await listAllInventoryItemsAction(membership.tenantId);
  if (items === null) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  return NextResponse.json({ items });
}
