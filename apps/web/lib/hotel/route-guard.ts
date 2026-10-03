import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { resolveActiveTenant } from "@/lib/rendering/resolve-public-site";
import { isHotelTenant } from "./hotel-context";
import { HotelPublicError } from "./public-pipeline";

/** Établissement du domaine appelé, ou `null` — jamais les données d'un autre. */
export async function hotelTenantOf(request: NextRequest) {
  const active = await resolveActiveTenant(request.headers.get("host") ?? "");
  if (active.status !== "ok" || !(await isHotelTenant(active.tenantId))) return null;
  return active.tenantId;
}

export const notFoundHotel = () => NextResponse.json({ error: "Établissement introuvable." }, { status: 404 });

export function hotelErrorResponse(error: unknown, fallback: string) {
  if (error instanceof HotelPublicError) return NextResponse.json({ error: error.message }, { status: error.status });
  // eslint-disable-next-line no-console
  console.error("[hotel]", error);
  return NextResponse.json({ error: fallback }, { status: 500 });
}
