import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { resolveActiveTenant } from "@/lib/rendering/resolve-public-site";
import { isEducationTenant } from "./education-context";
import { EducationPublicError } from "./public-pipeline";

/** Établissement du domaine appelé, ou `null` — jamais les données d'un autre. */
export async function educationTenantOf(request: NextRequest) {
  const active = await resolveActiveTenant(request.headers.get("host") ?? "");
  if (active.status !== "ok" || !(await isEducationTenant(active.tenantId))) return null;
  return active.tenantId;
}

export const notFoundEducation = () => NextResponse.json({ error: "Établissement introuvable." }, { status: 404 });

export function educationErrorResponse(error: unknown, fallback: string) {
  if (error instanceof EducationPublicError) return NextResponse.json({ error: error.message }, { status: error.status });
  // eslint-disable-next-line no-console
  console.error("[education]", error);
  return NextResponse.json({ error: fallback }, { status: 500 });
}
