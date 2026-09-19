import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { isSameOriginRequest } from "@/lib/domains/same-origin";
import { getCurrentTenantMembership } from "@/lib/current-tenant";
import { createVariantAction } from "@/lib/catalog/product-pipeline";

const variantSchema = z.object({
  name: z.string().min(1),
  sku: z.string().nullable().optional(),
  price: z.number().int().nonnegative(),
  costPrice: z.number().int().nonnegative().nullable().optional(),
  barcode: z.string().nullable().optional(),
  weightGrams: z.number().int().nonnegative().nullable().optional(),
  volumeCm3: z.number().int().nonnegative().nullable().optional(),
  attributes: z.record(z.string()).optional(),
});

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Origine refusée." }, { status: 403 });
  const membership = await getCurrentTenantMembership();
  if (!membership) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });

  const parsed = variantSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Corps de requête invalide." }, { status: 400 });

  try {
    const variant = await createVariantAction(membership.tenantId, params.id, parsed.data);
    if (variant === null) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
    return NextResponse.json({ variant });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erreur." }, { status: 400 });
  }
}
