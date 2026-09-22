import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { isSameOriginRequest } from "@/lib/domains/same-origin";
import { resolveActiveTenant } from "@/lib/rendering/resolve-public-site";
import { getOrCreateVisitorToken } from "@/lib/storefront/visitor-session";
import { updateCartItemQuantityAction, removeCartItemAction } from "@/lib/storefront/cart-pipeline";

const updateSchema = z.object({ quantity: z.number().int().min(0).max(999) });

export async function PATCH(request: NextRequest, { params }: { params: { itemId: string } }) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Origine refusée." }, { status: 403 });
  const host = request.headers.get("host") ?? "";
  const active = await resolveActiveTenant(host);
  if (active.status !== "ok") return NextResponse.json({ error: "Boutique introuvable." }, { status: 404 });

  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Corps de requête invalide." }, { status: 400 });

  const visitorToken = await getOrCreateVisitorToken();
  try {
    const cart = await updateCartItemQuantityAction(active.tenantId, visitorToken, params.itemId, parsed.data.quantity);
    if (cart === null) return NextResponse.json({ error: "Panier indisponible pour cette boutique." }, { status: 404 });
    return NextResponse.json({ cart });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erreur." }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { itemId: string } }) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Origine refusée." }, { status: 403 });
  const host = request.headers.get("host") ?? "";
  const active = await resolveActiveTenant(host);
  if (active.status !== "ok") return NextResponse.json({ error: "Boutique introuvable." }, { status: 404 });

  const visitorToken = await getOrCreateVisitorToken();
  try {
    const cart = await removeCartItemAction(active.tenantId, visitorToken, params.itemId);
    if (cart === null) return NextResponse.json({ error: "Panier indisponible pour cette boutique." }, { status: 404 });
    return NextResponse.json({ cart });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erreur." }, { status: 400 });
  }
}
