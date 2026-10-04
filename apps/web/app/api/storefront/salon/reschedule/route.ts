import { NextResponse, type NextRequest } from "next/server";
import { isSameOriginRequest } from "@/lib/domains/same-origin";
import { getOrCreateVisitorToken } from "@/lib/storefront/visitor-session";
import { rescheduleSalonAppointmentAsGuest } from "@/lib/salon/public-pipeline";
import { notFoundSalon, salonErrorResponse, salonTenantOf } from "@/lib/salon/route-guard";

/** Déplacement par le client de SON rendez-vous vers un horaire proposé. */
export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Origine refusée." }, { status: 403 });
  const tenantId = await salonTenantOf(request);
  if (!tenantId) return notFoundSalon();
  try {
    await rescheduleSalonAppointmentAsGuest(tenantId, await getOrCreateVisitorToken(), await request.json().catch(() => null));
    return NextResponse.json({ data: { ok: true } });
  } catch (error) {
    return salonErrorResponse(error, "Modification impossible pour le moment. Appelez le salon.");
  }
}
