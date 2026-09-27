import { NextResponse, type NextRequest } from "next/server";
import { isSameOriginRequest } from "@/lib/domains/same-origin";
import { resolveActiveTenant } from "@/lib/rendering/resolve-public-site";
import { getOrCreateVisitorToken } from "@/lib/storefront/visitor-session";
import { submitTravelBooking, TravelBookingError } from "@/lib/travel/public-pipeline";
import { isTravelTenant } from "@/lib/travel/travel-context";

/** Réservation d'un départ depuis le site public de l'agence. */
export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Origine refusée." }, { status: 403 });
  const active = await resolveActiveTenant(request.headers.get("host") ?? "");
  if (active.status !== "ok" || !(await isTravelTenant(active.tenantId))) return NextResponse.json({ error: "Agence introuvable." }, { status: 404 });
  try {
    const result = await submitTravelBooking(active.tenantId, await getOrCreateVisitorToken(), await request.json().catch(() => null));
    return NextResponse.json({ data: { reference: result.reference, url: `/reservation/${result.accessToken}` } });
  } catch (error) {
    if (error instanceof TravelBookingError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: "Réservation impossible pour le moment. Appelez l'agence." }, { status: 500 });
  }
}
