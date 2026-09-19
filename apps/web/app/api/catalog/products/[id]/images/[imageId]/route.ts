import { NextResponse, type NextRequest } from "next/server";
import { isSameOriginRequest } from "@/lib/domains/same-origin";
import { getCurrentTenantMembership } from "@/lib/current-tenant";
import { removeProductImageAction } from "@/lib/catalog/product-pipeline";

export async function DELETE(request: NextRequest, { params }: { params: { id: string; imageId: string } }) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Origine refusée." }, { status: 403 });
  const membership = await getCurrentTenantMembership();
  if (!membership) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });

  try {
    const result = await removeProductImageAction(membership.tenantId, params.imageId);
    if (result === null) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erreur." }, { status: 400 });
  }
}
