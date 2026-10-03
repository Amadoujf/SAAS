import { NextResponse, type NextRequest } from "next/server";
import { isSameOriginRequest } from "@/lib/domains/same-origin";
import { getOrCreateVisitorToken } from "@/lib/storefront/visitor-session";
import { submitTableBooking } from "@/lib/restaurant/public-pipeline";
import { notFoundRestaurant, restaurantErrorResponse, restaurantTenantOf } from "@/lib/restaurant/route-guard";

/** Réservation d'une table depuis le site public. */
export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Origine refusée." }, { status: 403 });
  const tenantId = await restaurantTenantOf(request);
  if (!tenantId) return notFoundRestaurant();
  try {
    const r = await submitTableBooking(tenantId, await getOrCreateVisitorToken(), await request.json().catch(() => null));
    return NextResponse.json({ data: { reference: r.reference, url: `/ma-table/${r.accessToken}` } });
  } catch (error) {
    return restaurantErrorResponse(error, "Réservation impossible pour le moment. Appelez le restaurant.");
  }
}
