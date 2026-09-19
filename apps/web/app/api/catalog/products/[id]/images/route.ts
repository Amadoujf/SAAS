import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { isSameOriginRequest } from "@/lib/domains/same-origin";
import { getCurrentTenantMembership } from "@/lib/current-tenant";
import { addProductImageAction, reorderProductImagesAction } from "@/lib/catalog/product-pipeline";

const addSchema = z.object({
  mediaAssetId: z.string().min(1),
  url: z.string().url(),
  altText: z.string().nullable().optional(),
  variantId: z.string().nullable().optional(),
});

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Origine refusée." }, { status: 403 });
  const membership = await getCurrentTenantMembership();
  if (!membership) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });

  const parsed = addSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Corps de requête invalide." }, { status: 400 });

  try {
    const image = await addProductImageAction(membership.tenantId, { productId: params.id, ...parsed.data });
    if (image === null) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
    return NextResponse.json({ image });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erreur." }, { status: 400 });
  }
}

const reorderSchema = z.object({ orderedImageIds: z.array(z.string()).min(1) });

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Origine refusée." }, { status: 403 });
  const membership = await getCurrentTenantMembership();
  if (!membership) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });

  const parsed = reorderSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Corps de requête invalide." }, { status: 400 });

  const result = await reorderProductImagesAction(membership.tenantId, params.id, parsed.data.orderedImageIds);
  if (result === null) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  return NextResponse.json(result);
}
