import { NextResponse, type NextRequest } from "next/server";
import { isSameOriginRequest } from "@/lib/domains/same-origin";
import { cancelSalonAppointmentAsGuest } from "@/lib/salon/public-pipeline";
import { notFoundSalon, salonErrorResponse, salonTenantOf } from "@/lib/salon/route-guard";

/** Annulation par le client de SON rendez-vous (jeton), dans le délai du salon. */
export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Origine refusée." }, { status: 403 });
  const tenantId = await salonTenantOf(request);
  if (!tenantId) return notFoundSalon();
  const body = (await request.json().catch(() => null)) as { token?: unknown } | null;
  try {
    await cancelSalonAppointmentAsGuest(tenantId, typeof body?.token === "string" ? body.token : "");
    return NextResponse.json({ data: { ok: true } });
  } catch (error) {
    return salonErrorResponse(error, "Annulation impossible pour le moment. Appelez le salon.");
  }
}
