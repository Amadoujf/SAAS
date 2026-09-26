import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { OrderOperationError } from "@yamacommerce/database";
import { isSameOriginRequest } from "@/lib/domains/same-origin";
import { resolveActiveTenant } from "@/lib/rendering/resolve-public-site";
import { getOrCreateVisitorToken } from "@/lib/storefront/visitor-session";
import { cancelAsCustomer, reorder, submitProof } from "@/lib/storefront/order-pipeline";

const body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("proof"), token: z.string().min(10), reference: z.string().trim().min(4).max(80) }),
  z.object({ action: z.literal("cancel"), token: z.string().min(10) }),
  z.object({ action: z.literal("reorder"), token: z.string().min(10) }),
]);

/** Actions du client sur SA commande — le jeton d'accès est exigé à chaque appel. */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Origine refusée." }, { status: 403 });
  const active = await resolveActiveTenant(request.headers.get("host") ?? "");
  if (active.status !== "ok") return NextResponse.json({ error: "Boutique introuvable." }, { status: 404 });
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Requête invalide." }, { status: 400 });
  const b = parsed.data;
  try {
    if (b.action === "proof") {
      await submitProof(active.tenantId, params.id, b.token, b.reference);
      return NextResponse.json({ ok: true });
    }
    if (b.action === "cancel") {
      await cancelAsCustomer(active.tenantId, params.id, b.token);
      return NextResponse.json({ ok: true });
    }
    const result = await reorder(active.tenantId, await getOrCreateVisitorToken(), params.id, b.token);
    return NextResponse.json(result);
  } catch (error) {
    const status = error instanceof OrderOperationError ? 409 : 400;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erreur." }, { status });
  }
}
