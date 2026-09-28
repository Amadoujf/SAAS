import { NextResponse, type NextRequest } from "next/server";
import { isSameOriginRequest } from "@/lib/domains/same-origin";
import { getOrCreateVisitorToken } from "@/lib/storefront/visitor-session";
import { submitRestaurantOrder } from "@/lib/restaurant/public-pipeline";
import { notFoundRestaurant, restaurantErrorResponse, restaurantTenantOf } from "@/lib/restaurant/route-guard";

/** Commande depuis le site public ou le QR code d'une table. */
export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Origine refusée." }, { status: 403 });
  const tenantId = await restaurantTenantOf(request);
  if (!tenantId) return notFoundRestaurant();
  try {
    const r = await submitRestaurantOrder(tenantId, await getOrCreateVisitorToken(), await request.json().catch(() => null));
    return NextResponse.json({ data: { number: r.number, url: `/ma-commande/${r.accessToken}` } });
  } catch (error) {
    return restaurantErrorResponse(error, "Commande impossible pour le moment. Appelez le restaurant.");
  }
}
