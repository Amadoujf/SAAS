import { NextResponse, type NextRequest } from "next/server";
import { isSameOriginRequest } from "@/lib/domains/same-origin";
import { saveSiteSettings } from "@/lib/storefront/site-settings-pipeline";

/** Enregistre la personnalisation de la boutique (« Mon site »). */
export async function PUT(request: NextRequest) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Origine refusée." }, { status: 403 });
  const result = await saveSiteSettings(await request.json().catch(() => null));
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ data: { saved: true } });
}
