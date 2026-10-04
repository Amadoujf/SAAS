import { NextResponse, type NextRequest } from "next/server";
import { publicSlots } from "@/lib/salon/public-pipeline";
import { notFoundSalon, salonErrorResponse, salonTenantOf } from "@/lib/salon/route-guard";

/** Horaires libres d'une prestation un jour donné (recalculés à chaque appel, jamais mis en cache). */
export async function GET(request: NextRequest) {
  const tenantId = await salonTenantOf(request);
  if (!tenantId) return notFoundSalon();
  const p = request.nextUrl.searchParams;
  try {
    const slots = await publicSlots(tenantId, { service: p.get("service") ?? "", date: p.get("date") ?? "", staff: p.get("staff") });
    return NextResponse.json({ data: slots }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return salonErrorResponse(error, "Horaires indisponibles pour le moment.");
  }
}
