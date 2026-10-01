import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { isSameOriginRequest } from "@/lib/domains/same-origin";
import { getCurrentTenantMembership } from "@/lib/current-tenant";
import { assignSizeGuide } from "@/lib/catalog/size-guide-pipeline";

const schema = z.object({ kind: z.enum(["category", "product"]), id: z.string().uuid(), sizeGuideId: z.string().uuid().nullable() });

/** Rattache (ou détache) un guide à une catégorie ou à un produit. */
export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Origine refusée." }, { status: 403 });
  const membership = await getCurrentTenantMembership();
  if (!membership) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Demande invalide." }, { status: 400 });
  const result = await assignSizeGuide(membership.tenantId, { kind: parsed.data.kind, id: parsed.data.id }, parsed.data.sizeGuideId);
  return result.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: result.error }, { status: result.status });
}
