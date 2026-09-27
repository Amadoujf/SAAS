import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { resolveActiveTenant } from "@/lib/rendering/resolve-public-site";
import { isSalonTenant } from "./salon-context";
import { SalonPublicError } from "./public-pipeline";

/** Salon du domaine appelé, ou réponse 404 — jamais les données d'un autre salon. */
export async function salonTenantOf(request: NextRequest) {
  const active = await resolveActiveTenant(request.headers.get("host") ?? "");
  if (active.status !== "ok" || !(await isSalonTenant(active.tenantId))) return null;
  return active.tenantId;
}

export const notFoundSalon = () => NextResponse.json({ error: "Salon introuvable." }, { status: 404 });

export function salonErrorResponse(error: unknown, fallback: string) {
  if (error instanceof SalonPublicError) return NextResponse.json({ error: error.message }, { status: error.status });
  // eslint-disable-next-line no-console
  console.error("[salon]", error);
  return NextResponse.json({ error: fallback }, { status: 500 });
}
