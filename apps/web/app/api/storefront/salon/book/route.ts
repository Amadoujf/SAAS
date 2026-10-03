import { NextResponse, type NextRequest } from "next/server";
import { isSameOriginRequest } from "@/lib/domains/same-origin";
import { getOrCreateVisitorToken } from "@/lib/storefront/visitor-session";
import { submitSalonBooking } from "@/lib/salon/public-pipeline";
import { notFoundSalon, salonErrorResponse, salonTenantOf } from "@/lib/salon/route-guard";

/** Prise de rendez-vous depuis le site public du salon. */
export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Origine refusée." }, { status: 403 });
  const tenantId = await salonTenantOf(request);
  if (!tenantId) return notFoundSalon();
  try {
    const r = await submitSalonBooking(tenantId, await getOrCreateVisitorToken(), await request.json().catch(() => null));
    return NextResponse.json({ data: { reference: r.reference, url: `/rdv/${r.accessToken}` } });
  } catch (error) {
    return salonErrorResponse(error, "Rendez-vous impossible pour le moment. Appelez le salon.");
  }
}
