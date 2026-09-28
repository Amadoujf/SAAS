import { NextResponse, type NextRequest } from "next/server";
import { isSameOriginRequest } from "@/lib/domains/same-origin";
import { getOrCreateVisitorToken } from "@/lib/storefront/visitor-session";
import { submitVehicleLead } from "@/lib/auto/public-pipeline";
import { autoErrorResponse, autoTenantOf, notFoundAuto } from "@/lib/auto/route-guard";

/** Demande d'information, de reprise, de financement ou d'importation sur commande. */
export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Origine refusée." }, { status: 403 });
  const tenantId = await autoTenantOf(request);
  if (!tenantId) return notFoundAuto();
  try {
    await submitVehicleLead(tenantId, await getOrCreateVisitorToken(), await request.json().catch(() => null));
    return NextResponse.json({ data: { ok: true } });
  } catch (error) {
    return autoErrorResponse(error, "Envoi impossible pour le moment. Appelez le showroom.");
  }
}
