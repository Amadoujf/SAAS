import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { OrderOperationError } from "@yamacommerce/database";
import { isSameOriginRequest } from "@/lib/domains/same-origin";
import { resolveActiveTenant } from "@/lib/rendering/resolve-public-site";
import { getOrCreateVisitorToken } from "@/lib/storefront/visitor-session";
import { lookupGuestOrder } from "@/lib/storefront/order-pipeline";

const body = z.object({ orderNumber: z.string().trim().min(5).max(40), phone: z.string().trim().min(6).max(20) });

/** Suivi invité : numéro de commande + téléphone. Réponse identique quel que soit le
 *  champ erroné (aucune énumération), fréquence limitée par visiteur. */
export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Origine refusée." }, { status: 403 });
  const active = await resolveActiveTenant(request.headers.get("host") ?? "");
  if (active.status !== "ok") return NextResponse.json({ error: "Boutique introuvable." }, { status: 404 });
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Indiquez le numéro de commande et votre téléphone." }, { status: 400 });
  try {
    const found = await lookupGuestOrder(active.tenantId, await getOrCreateVisitorToken(), parsed.data.orderNumber, parsed.data.phone);
    if (!found) return NextResponse.json({ error: "Aucune commande ne correspond à ces informations." }, { status: 404 });
    return NextResponse.json({ url: `/commande/${found.orderId}?token=${found.accessToken}` });
  } catch (error) {
    const status = error instanceof OrderOperationError ? 429 : 400;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erreur." }, { status });
  }
}
