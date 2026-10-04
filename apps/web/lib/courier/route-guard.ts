import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { resolveActiveTenant } from "@/lib/rendering/resolve-public-site";
import { isCourierTenant } from "./courier-context";
import { CourierPublicError } from "./public-pipeline";

/** Société de livraison du domaine appelé, ou `null` — jamais les données d'un autre. */
export async function courierTenantOf(request: NextRequest) {
  const active = await resolveActiveTenant(request.headers.get("host") ?? "");
  if (active.status !== "ok" || !(await isCourierTenant(active.tenantId))) return null;
  return active.tenantId;
}

export const notFoundCourier = () => NextResponse.json({ error: "Société de livraison introuvable." }, { status: 404 });

export function courierErrorResponse(error: unknown, fallback: string) {
  if (error instanceof CourierPublicError) return NextResponse.json({ error: error.message }, { status: error.status });
  // eslint-disable-next-line no-console
  console.error("[courier]", error);
  return NextResponse.json({ error: fallback }, { status: 500 });
}
