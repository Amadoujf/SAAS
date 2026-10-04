import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { resolveActiveTenant } from "@/lib/rendering/resolve-public-site";
import { isRestaurantTenant } from "./restaurant-context";
import { RestaurantPublicError } from "./public-pipeline";

/** Restaurant du domaine appelé, ou `null` — jamais les données d'un autre. */
export async function restaurantTenantOf(request: NextRequest) {
  const active = await resolveActiveTenant(request.headers.get("host") ?? "");
  if (active.status !== "ok" || !(await isRestaurantTenant(active.tenantId))) return null;
  return active.tenantId;
}

export const notFoundRestaurant = () => NextResponse.json({ error: "Restaurant introuvable." }, { status: 404 });

export function restaurantErrorResponse(error: unknown, fallback: string) {
  if (error instanceof RestaurantPublicError) return NextResponse.json({ error: error.message }, { status: error.status });
  // eslint-disable-next-line no-console
  console.error("[restaurant]", error);
  return NextResponse.json({ error: fallback }, { status: 500 });
}
