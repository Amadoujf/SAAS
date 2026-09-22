
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { isValidSenegalRegion } from "@yamacommerce/database";
import { isSameOriginRequest } from "@/lib/domains/same-origin";
import { resolveActiveTenant } from "@/lib/rendering/resolve-public-site";
import { getOrCreateVisitorToken } from "@/lib/storefront/visitor-session";
import { checkoutAction } from "@/lib/storefront/checkout-pipeline";

const addressSchema = z.object({
  label: z.string().nullable().optional(),
  region: z.string().refine(isValidSenegalRegion, { message: "Région sénégalaise invalide." }),
  department: z.string().nullable().optional(),
  commune: z.string().nullable().optional(),
  neighborhood: z.string().nullable().optional(),
  street: z.string().nullable().optional(),
  geoLat: z.number().nullable().optional(),
  geoLng: z.number().nullable().optional(),
});

const checkoutSchema = z.object({
  customer: z.object({
    firstName: z.string().min(1),
    lastName: z.string().nullable().optional(),
    phone: z.string().nullable().optional(),
    email: z.string().email().nullable().optional(),
  }),
  deliveryMethod: z.enum(["delivery", "pickup"]),
  deliveryZoneId: z.string().nullable().optional(),
  deliveryAddress: addressSchema.nullable().optional(),
  paymentMethod: z.enum(["cod", "online"]),
  promoCode: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

/**
 * Checkout storefront PUBLIC — voir `checkout-pipeline.ts`. Aucun prix/total n'est
 * JAMAIS accepté depuis ce corps de requête : uniquement des CHOIX (livraison,
 * paiement, code promo, coordonnées) — tout montant est recalculé côté serveur par
 * `convertCartToOrder`.
 */
export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Origine refusée." }, { status: 403 });
  const host = request.headers.get("host") ?? "";
  const active = await resolveActiveTenant(host);
  if (active.status !== "ok") return NextResponse.json({ error: "Boutique introuvable." }, { status: 404 });

  const parsed = checkoutSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Corps de requête invalide." }, { status: 400 });

  const visitorToken = await getOrCreateVisitorToken();
  try {
    const result = await checkoutAction(active.tenantId, active.tenantName, visitorToken, host, parsed.data);
    if (result === null) return NextResponse.json({ error: "Boutique indisponible pour la commande." }, { status: 404 });
    return NextResponse.json({ order: result });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erreur." }, { status: 400 });
  }
}
