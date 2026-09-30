import { NextResponse, type NextRequest } from "next/server";
import { isSameOriginRequest } from "@/lib/domains/same-origin";
import { getOrCreateVisitorToken } from "@/lib/storefront/visitor-session";
import { lookupTracking } from "@/lib/courier/public-pipeline";
import { courierErrorResponse, courierTenantOf, notFoundCourier } from "@/lib/courier/route-guard";

/** Retrouver un suivi par référence + téléphone. */
export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Origine refusée." }, { status: 403 });
  const tenantId = await courierTenantOf(request);
  if (!tenantId) return notFoundCourier();
  try {
    return NextResponse.json({ data: await lookupTracking(tenantId, await getOrCreateVisitorToken(), await request.json().catch(() => null)) });
  } catch (error) {
    return courierErrorResponse(error, "Action impossible pour le moment. Appelez-nous.");
  }
}
