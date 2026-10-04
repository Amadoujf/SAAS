import { NextResponse, type NextRequest } from "next/server";
import { isSameOriginRequest } from "@/lib/domains/same-origin";
import { cancelTestDriveForGuest } from "@/lib/auto/public-pipeline";
import { autoErrorResponse, autoTenantOf, notFoundAuto } from "@/lib/auto/route-guard";

/** Annulation d'un essai par le client (jeton de SON essai uniquement). */
export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Origine refusée." }, { status: 403 });
  const tenantId = await autoTenantOf(request);
  if (!tenantId) return notFoundAuto();
  const body = (await request.json().catch(() => null)) as { token?: unknown } | null;
  try {
    await cancelTestDriveForGuest(tenantId, typeof body?.token === "string" ? body.token : "");
    return NextResponse.json({ data: { ok: true } });
  } catch (error) {
    return autoErrorResponse(error, "Annulation impossible pour le moment. Appelez le showroom.");
  }
}
