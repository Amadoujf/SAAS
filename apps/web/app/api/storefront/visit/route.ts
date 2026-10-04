import { NextResponse, type NextRequest } from "next/server";
import { isSameOriginRequest } from "@/lib/domains/same-origin";
import { resolveActiveTenant } from "@/lib/rendering/resolve-public-site";
import { getOrCreateVisitorToken } from "@/lib/storefront/visitor-session";
import { submitVisitRequest, VisitRequestError } from "@/lib/real-estate/public-pipeline";
import { isEstateTenant } from "@/lib/real-estate/estate-context";

/** Demande de visite d'un bien depuis le site public de l'agence. */
export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Origine refusée." }, { status: 403 });
  const active = await resolveActiveTenant(request.headers.get("host") ?? "");
  if (active.status !== "ok" || !(await isEstateTenant(active.tenantId))) return NextResponse.json({ error: "Agence introuvable." }, { status: 404 });
  try {
    const result = await submitVisitRequest(active.tenantId, await getOrCreateVisitorToken(), await request.json().catch(() => null));
    return NextResponse.json({ data: { reference: result.reference, url: `/visite/${result.accessToken}` } });
  } catch (error) {
    if (error instanceof VisitRequestError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: "Envoi impossible pour le moment. Appelez l'agence." }, { status: 500 });
  }
}
