import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { isSameOriginRequest } from "@/lib/domains/same-origin";
import { getCurrentTenantMembership } from "@/lib/current-tenant";
import { requireTenantPermission } from "@/lib/tenant-permissions";
import { createBillingCheckout } from "@/lib/billing/checkout-pipeline";

const bodySchema = z.object({
  planId: z.string().min(1),
  billingCycle: z.enum(["MONTHLY", "YEARLY"]),
});

/**
 * Crée une session de paiement Chariow pour l'abonnement SaaS du tenant courant —
 * voir docs/14-facturation-saas-abonnements.md. `tenantId` vient TOUJOURS de la
 * session serveur (`getCurrentTenantMembership`), jamais du corps de la requête —
 * un client ne doit jamais pouvoir désigner un autre tenant que le sien. Réservée au
 * propriétaire (`settings.subscription`) ; à ne pas confondre avec
 * `/api/storefront/checkout`, public, pour les commandes clientes.
 */
export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Origine refusée." }, { status: 403 });

  const membership = await getCurrentTenantMembership();
  if (!membership) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });

  const actor = await requireTenantPermission(membership.tenantId, "settings.subscription");
  if (!actor) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });

  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Corps de requête invalide." }, { status: 400 });

  try {
    const result = await createBillingCheckout({
      tenantId: membership.tenantId,
      planId: parsed.data.planId,
      billingCycle: parsed.data.billingCycle,
      customer: { name: membership.tenantName },
      host: request.headers.get("host") ?? "app.yamacommerce.ai",
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Échec de la création de la session de paiement." },
      { status: 400 },
    );
  }
}
