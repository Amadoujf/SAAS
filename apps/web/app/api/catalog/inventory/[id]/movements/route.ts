import { NextResponse } from "next/server";
import { getCurrentTenantMembership } from "@/lib/current-tenant";
import { listStockMovementsAction } from "@/lib/catalog/stock-pipeline";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const membership = await getCurrentTenantMembership();
  if (!membership) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });

  try {
    const movements = await listStockMovementsAction(membership.tenantId, params.id);
    if (movements === null) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
    return NextResponse.json({ movements });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erreur." }, { status: 400 });
  }
}
