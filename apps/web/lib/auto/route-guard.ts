import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { resolveActiveTenant } from "@/lib/rendering/resolve-public-site";
import { isAutoTenant } from "./auto-context";
import { AutoPublicError } from "./public-pipeline";

/** Concession du domaine appelé, ou `null` — jamais les données d'une autre. */
export async function autoTenantOf(request: NextRequest) {
  const active = await resolveActiveTenant(request.headers.get("host") ?? "");
  if (active.status !== "ok" || !(await isAutoTenant(active.tenantId))) return null;
  return active.tenantId;
}

export const notFoundAuto = () => NextResponse.json({ error: "Concession introuvable." }, { status: 404 });

export function autoErrorResponse(error: unknown, fallback: string) {
  if (error instanceof AutoPublicError) return NextResponse.json({ error: error.message }, { status: error.status });
  // eslint-disable-next-line no-console
  console.error("[auto]", error);
  return NextResponse.json({ error: fallback }, { status: 500 });
}
