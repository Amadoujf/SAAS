import { NextResponse, type NextRequest } from "next/server";
import { isSameOriginRequest } from "@/lib/domains/same-origin";
import { getCurrentTenantMembership } from "@/lib/current-tenant";
import { loadSizeGuides, saveSizeGuide } from "@/lib/catalog/size-guide-pipeline";
import { guideSchema } from "@/lib/catalog/size-guide-schema";


export async function GET() {
  const membership = await getCurrentTenantMembership();
  if (!membership) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  const data = await loadSizeGuides(membership.tenantId);
  if (!data) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Origine refusée." }, { status: 403 });
  const membership = await getCurrentTenantMembership();
  if (!membership) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  const parsed = guideSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Guide invalide." }, { status: 400 });
  const result = await saveSizeGuide(membership.tenantId, null, parsed.data);
  return result.ok ? NextResponse.json({ guide: result.data }) : NextResponse.json({ error: result.error }, { status: result.status });
}
