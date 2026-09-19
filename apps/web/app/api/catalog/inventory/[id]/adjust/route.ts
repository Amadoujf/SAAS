import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { InsufficientStockError } from "@yamacommerce/database";
import { isSameOriginRequest } from "@/lib/domains/same-origin";
import { getCurrentTenantMembership } from "@/lib/current-tenant";
import { adjustStockAction } from "@/lib/catalog/stock-pipeline";

const bodySchema = z.object({
  type: z.enum(["in", "out", "adjustment", "transfer", "return"]),
  quantity: z.number().int().positive(),
  reason: z.string().nullable().optional(),
  referenceType: z.string().nullable().optional(),
  referenceId: z.string().nullable().optional(),
});

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Origine refusée." }, { status: 403 });
  const membership = await getCurrentTenantMembership();
  if (!membership) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Corps de requête invalide." }, { status: 400 });

  try {
    const movement = await adjustStockAction(membership.tenantId, { inventoryItemId: params.id, ...parsed.data });
    if (movement === null) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
    return NextResponse.json({ movement });
  } catch (error) {
    if (error instanceof InsufficientStockError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erreur." }, { status: 400 });
  }
}
