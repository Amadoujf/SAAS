import { NextResponse, type NextRequest } from "next/server";
import { isSameOriginRequest } from "@/lib/domains/same-origin";
import { cancelRestaurantOrderAsGuest } from "@/lib/restaurant/public-pipeline";
import { notFoundRestaurant, restaurantErrorResponse, restaurantTenantOf } from "@/lib/restaurant/route-guard";

/** Le client annule SA commande (jeton), tant que la cuisine ne l'a pas acceptée. */
export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Origine refusée." }, { status: 403 });
  const tenantId = await restaurantTenantOf(request);
  if (!tenantId) return notFoundRestaurant();
  try {
    const body = (await request.json().catch(() => null)) as { token?: unknown } | null;
    await cancelRestaurantOrderAsGuest(tenantId, typeof body?.token === "string" ? body.token : "");
    return NextResponse.json({ data: { ok: true } });
  } catch (error) {
    return restaurantErrorResponse(error, "Annulation impossible pour le moment. Appelez le restaurant.");
  }
}
