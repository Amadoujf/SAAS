import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { isSameOriginRequest } from "@/lib/domains/same-origin";
import { getCurrentTenantMembership } from "@/lib/current-tenant";
import { createProductAction, listProductsForTenant } from "@/lib/catalog/product-pipeline";

const productSchema = z.object({
  categoryId: z.string().nullable().optional(),
  name: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().nullable().optional(),
  shortDescription: z.string().nullable().optional(),
  sku: z.string().nullable().optional(),
  brand: z.string().nullable().optional(),
  basePrice: z.number().int().nonnegative(),
  compareAtPrice: z.number().int().nonnegative().nullable().optional(),
  costPrice: z.number().int().nonnegative().nullable().optional(),
  taxRate: z.number().nonnegative().optional(),
  tags: z.array(z.string()).optional(),
});

export async function GET(request: NextRequest) {
  const membership = await getCurrentTenantMembership();
  if (!membership) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });

  const { searchParams } = request.nextUrl;
  const status = searchParams.get("status");
  const categoryId = searchParams.get("categoryId");
  const search = searchParams.get("search");

  const products = await listProductsForTenant(membership.tenantId, {
    ...(status ? { status: status as "DRAFT" | "PUBLISHED" | "ARCHIVED" } : {}),
    ...(categoryId ? { categoryId } : {}),
    ...(search ? { search } : {}),
  });
  if (products === null) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  return NextResponse.json({ products });
}

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Origine refusée." }, { status: 403 });
  const membership = await getCurrentTenantMembership();
  if (!membership) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });

  const parsed = productSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Corps de requête invalide." }, { status: 400 });

  const product = await createProductAction(membership.tenantId, parsed.data);
  if (product === null) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  return NextResponse.json({ product });
}
