import { NextResponse, type NextRequest } from "next/server";
import { isSameOriginRequest } from "@/lib/domains/same-origin";
import { driverAction } from "@/lib/courier/public-pipeline";
import { courierErrorResponse, courierTenantOf, notFoundCourier } from "@/lib/courier/route-guard";

/** Action d'un livreur (lien personnel) : prise en charge, en route, remise, échec, retour. */
export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Origine refusée." }, { status: 403 });
  const tenantId = await courierTenantOf(request);
  if (!tenantId) return notFoundCourier();
  const body = (await request.json().catch(() => null)) as { token?: unknown; action?: unknown } | null;
  try {
    await driverAction(tenantId, typeof body?.token === "string" ? body.token : "", body?.action);
    return NextResponse.json({ data: { ok: true } });
  } catch (error) {
    return courierErrorResponse(error, "Action impossible pour le moment. Appelez le bureau.");
  }
}
