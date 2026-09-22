import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { isSameOriginRequest } from "@/lib/domains/same-origin";
import { resolveActiveTenant } from "@/lib/rendering/resolve-public-site";
import { getOrCreateVisitorToken } from "@/lib/storefront/visitor-session";
import { getCartAction, addCartItemAction } from "@/lib/storefront/cart-pipeline";

const addItemSchema = z.object({
  productVariantId: z.string().min(1),
  quantity: z.number().int().positive().max(999),
});

/**
 * Panier storefront PUBLIC — voir `cart-pipeline.ts`. Résolution du tenant via le
 * Host (jamais `getCurrentTenantMembership`, réservé au dashboard) — même garde que
 * `/catalogue`/`/p/[slug]` (`resolveActiveTenant`), pour hériter des mêmes
 * protections domaine/tenant suspendu.
 */
export async function GET(request: NextRequest) {
  const host = request.headers.get("host") ?? "";
  const active = await resolveActiveTenant(host);
  if (active.status !== "ok") return NextResponse.json({ error: "Boutique introuvable." }, { status: 404 });

  const visitorToken = await getOrCreateVisitorToken();
  const cart = await getCartAction(active.tenantId, visitorToken);
  if (cart === null) return NextResponse.json({ error: "Panier indisponible pour cette boutique." }, { status: 404 });
  return NextResponse.json({ cart });
}

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Origine refusée." }, { status: 403 });
  const host = request.headers.get("host") ?? "";
  const active = await resolveActiveTenant(host);
  if (active.status !== "ok") return NextResponse.json({ error: "Boutique introuvable." }, { status: 404 });

  const parsed = addItemSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Corps de requête invalide." }, { status: 400 });

  const visitorToken = await getOrCreateVisitorToken();
  try {
    const cart = await addCartItemAction(active.tenantId, visitorToken, parsed.data);
    if (cart === null) return NextResponse.json({ error: "Panier indisponible pour cette boutique." }, { status: 404 });
    return NextResponse.json({ cart });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erreur." }, { status: 400 });
  }
}
