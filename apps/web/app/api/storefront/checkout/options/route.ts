import { NextResponse, type NextRequest } from "next/server";
import { resolveActiveTenant } from "@/lib/rendering/resolve-public-site";
import { getOrCreateVisitorToken } from "@/lib/storefront/visitor-session";
import { getCheckoutOptions } from "@/lib/storefront/order-pipeline";

export async function GET(request: NextRequest) {
  const active = await resolveActiveTenant(request.headers.get("host") ?? "");
  if (active.status !== "ok") return NextResponse.json({ error: "Boutique introuvable." }, { status: 404 });
  const options = await getCheckoutOptions(active.tenantId, await getOrCreateVisitorToken());
  if (!options) return NextResponse.json({ error: "Commande indisponible pour cette boutique." }, { status: 404 });
  return NextResponse.json(options);
}
