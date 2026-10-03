import { NextResponse, type NextRequest } from "next/server";
import { staffAvailability } from "@/lib/salon/pipeline";

/** Horaires libres pour l'équipe (prise de rendez-vous au comptoir ou au téléphone). */
export async function GET(request: NextRequest) {
  const p = request.nextUrl.searchParams;
  const listingId = p.get("listingId") ?? "";
  if (!/^[0-9a-f-]{36}$/.test(listingId)) return NextResponse.json({ error: "Prestation invalide." }, { status: 400 });
  const staff = p.get("staffId");
  const result = await staffAvailability({ listingId, date: p.get("date") ?? "", staffId: staff && /^[0-9a-f-]{36}$/.test(staff) ? staff : null });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ data: result.data }, { headers: { "cache-control": "no-store" } });
}
