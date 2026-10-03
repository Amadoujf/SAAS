import { NextResponse, type NextRequest } from "next/server";
import { isSameOriginRequest } from "@/lib/domains/same-origin";
import { getOrCreateVisitorToken } from "@/lib/storefront/visitor-session";
import { submitTestDrive } from "@/lib/auto/public-pipeline";
import { autoErrorResponse, autoTenantOf, notFoundAuto } from "@/lib/auto/route-guard";

/** Réservation d'un essai depuis le site public de la concession. */
export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Origine refusée." }, { status: 403 });
  const tenantId = await autoTenantOf(request);
  if (!tenantId) return notFoundAuto();
  try {
    const r = await submitTestDrive(tenantId, await getOrCreateVisitorToken(), await request.json().catch(() => null));
    return NextResponse.json({ data: { reference: r.reference, url: `/mon-essai/${r.accessToken}` } });
  } catch (error) {
    return autoErrorResponse(error, "Réservation impossible pour le moment. Appelez le showroom.");
  }
}
