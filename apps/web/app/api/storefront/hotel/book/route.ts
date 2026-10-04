import { NextResponse, type NextRequest } from "next/server";
import { isSameOriginRequest } from "@/lib/domains/same-origin";
import { getOrCreateVisitorToken } from "@/lib/storefront/visitor-session";
import { submitHotelBooking } from "@/lib/hotel/public-pipeline";
import { hotelErrorResponse, hotelTenantOf, notFoundHotel } from "@/lib/hotel/route-guard";

/** Réservation d'un séjour depuis le site public de l'établissement. */
export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Origine refusée." }, { status: 403 });
  const tenantId = await hotelTenantOf(request);
  if (!tenantId) return notFoundHotel();
  try {
    const r = await submitHotelBooking(tenantId, await getOrCreateVisitorToken(), await request.json().catch(() => null));
    return NextResponse.json({ data: { reference: r.reference, url: `/sejour/${r.accessToken}` } });
  } catch (error) {
    return hotelErrorResponse(error, "Réservation impossible pour le moment. Appelez l'établissement.");
  }
}
