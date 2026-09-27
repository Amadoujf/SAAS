import { NextResponse, type NextRequest } from "next/server";
import { isSameOriginRequest } from "@/lib/domains/same-origin";
import { cancelHotelStayAsGuest } from "@/lib/hotel/public-pipeline";
import { hotelErrorResponse, hotelTenantOf, notFoundHotel } from "@/lib/hotel/route-guard";

/** Annulation par le client de SON séjour (jeton), dans le délai de l'établissement. */
export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Origine refusée." }, { status: 403 });
  const tenantId = await hotelTenantOf(request);
  if (!tenantId) return notFoundHotel();
  const body = (await request.json().catch(() => null)) as { token?: unknown } | null;
  try {
    await cancelHotelStayAsGuest(tenantId, typeof body?.token === "string" ? body.token : "");
    return NextResponse.json({ data: { ok: true } });
  } catch (error) {
    return hotelErrorResponse(error, "Annulation impossible pour le moment. Appelez l'établissement.");
  }
}
