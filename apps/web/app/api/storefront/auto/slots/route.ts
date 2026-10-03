import { NextResponse, type NextRequest } from "next/server";
import { publicTestDriveSlots } from "@/lib/auto/public-pipeline";
import { autoErrorResponse, autoTenantOf, notFoundAuto } from "@/lib/auto/route-guard";

/** Créneaux d'essai d'un véhicule pour une date (recalculés à chaque appel). */
export async function GET(request: NextRequest) {
  const tenantId = await autoTenantOf(request);
  if (!tenantId) return notFoundAuto();
  const p = request.nextUrl.searchParams;
  try {
    const data = await publicTestDriveSlots(tenantId, { listingId: p.get("vehicule") ?? "", date: p.get("date") ?? "" });
    return NextResponse.json({ data }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return autoErrorResponse(error, "Créneaux indisponibles pour le moment.");
  }
}
