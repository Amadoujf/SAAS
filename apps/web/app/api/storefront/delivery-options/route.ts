import { NextResponse, type NextRequest } from "next/server";
import { isValidSenegalRegion } from "@yamacommerce/database";
import { resolveActiveTenant } from "@/lib/rendering/resolve-public-site";
import { getOrCreateVisitorToken } from "@/lib/storefront/visitor-session";
import { getDeliveryQuote } from "@/lib/storefront/order-pipeline";

/** Devis de livraison calculé côté serveur à partir du panier réel. */
export async function GET(request: NextRequest) {
  const active = await resolveActiveTenant(request.headers.get("host") ?? "");
  if (active.status !== "ok") return NextResponse.json({ error: "Boutique introuvable." }, { status: 404 });
  const region = request.nextUrl.searchParams.get("region");
  if (region && !isValidSenegalRegion(region)) return NextResponse.json({ error: "Région invalide." }, { status: 400 });
  const quote = await getDeliveryQuote(active.tenantId, await getOrCreateVisitorToken(), region);
  if (!quote) return NextResponse.json({ error: "Indisponible." }, { status: 404 });
  return NextResponse.json({ quote });
}
