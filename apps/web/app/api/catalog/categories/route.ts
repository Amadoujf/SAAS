import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { isSameOriginRequest } from "@/lib/domains/same-origin";
import { getCurrentTenantMembership } from "@/lib/current-tenant";
import { createCategoryAction, listCategoriesForTenant } from "@/lib/catalog/product-pipeline";

const categorySchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  parentId: z.string().nullable().optional(),
  imageUrl: z.string().url().nullable().optional(),
});

export async function GET() {
  const membership = await getCurrentTenantMembership();
  if (!membership) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  const categories = await listCategoriesForTenant(membership.tenantId);
  if (categories === null) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  return NextResponse.json({ categories });
}

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Origine refusée." }, { status: 403 });
  const membership = await getCurrentTenantMembership();
  if (!membership) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });

  const parsed = categorySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Corps de requête invalide." }, { status: 400 });

  const category = await createCategoryAction(membership.tenantId, parsed.data);
  if (category === null) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  return NextResponse.json({ category });
}
