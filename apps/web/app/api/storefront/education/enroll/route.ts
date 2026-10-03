import { NextResponse, type NextRequest } from "next/server";
import { isSameOriginRequest } from "@/lib/domains/same-origin";
import { getOrCreateVisitorToken } from "@/lib/storefront/visitor-session";
import { submitEnrollment } from "@/lib/education/public-pipeline";
import { educationErrorResponse, educationTenantOf, notFoundEducation } from "@/lib/education/route-guard";

/** Demande d'inscription en ligne (montant calculé par le serveur, rien n'est payé en ligne). */
export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Origine refusée." }, { status: 403 });
  const tenantId = await educationTenantOf(request);
  if (!tenantId) return notFoundEducation();
  try {
    return NextResponse.json({ data: await submitEnrollment(tenantId, await getOrCreateVisitorToken(), await request.json().catch(() => null)) });
  } catch (error) {
    return educationErrorResponse(error, "Envoi impossible pour le moment. Appelez l'établissement.");
  }
}
