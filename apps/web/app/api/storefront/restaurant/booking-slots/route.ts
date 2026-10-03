import { NextResponse, type NextRequest } from "next/server";
import { publicBookingSlots } from "@/lib/restaurant/public-pipeline";
import { notFoundRestaurant, restaurantErrorResponse, restaurantTenantOf } from "@/lib/restaurant/route-guard";

/** Créneaux d'une date pour N couverts (recalculés à chaque appel). */
export async function GET(request: NextRequest) {
  const tenantId = await restaurantTenantOf(request);
  if (!tenantId) return notFoundRestaurant();
  const p = request.nextUrl.searchParams;
  try {
    const data = await publicBookingSlots(tenantId, { date: p.get("date") ?? "", party: Number(p.get("couverts") ?? "2") });
    return NextResponse.json({ data }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return restaurantErrorResponse(error, "Créneaux indisponibles pour le moment.");
  }
}
