import { NextResponse, type NextRequest } from "next/server";
import { deskAvailability } from "@/lib/hotel/pipeline";

/** Chambres libres par type et prix pour des dates (réception). */
export async function GET(request: NextRequest) {
  const p = request.nextUrl.searchParams;
  const n = (k: string, d: number) => (Number.isInteger(Number(p.get(k))) ? Number(p.get(k)) : d);
  const result = await deskAvailability({ arrival: p.get("arrival") ?? "", departure: p.get("departure") ?? "", adults: n("adults", 1), children: n("children", 0) });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ data: result.data }, { headers: { "cache-control": "no-store" } });
}
