import { NextResponse, type NextRequest } from "next/server";
import { publicCalendar } from "@/lib/hotel/public-pipeline";
import { hotelErrorResponse, hotelTenantOf, notFoundHotel } from "@/lib/hotel/route-guard";

/** Chambres libres et prix de chaque nuit d'un type (recalculés à chaque appel). */
export async function GET(request: NextRequest) {
  const tenantId = await hotelTenantOf(request);
  if (!tenantId) return notFoundHotel();
  const p = request.nextUrl.searchParams;
  try {
    const days = await publicCalendar(tenantId, { type: p.get("type") ?? "", from: p.get("from") ?? "" });
    return NextResponse.json({ data: days }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return hotelErrorResponse(error, "Calendrier indisponible pour le moment.");
  }
}
