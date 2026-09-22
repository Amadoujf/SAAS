import "server-only";
import { withTenant, getOrCreateSubscription } from "@yamacommerce/database";
import { resolveSaasBillingProvider, reserveOrReuseCheckoutSession } from "@yamacommerce/billing";

/**
 * Couche métier du checkout de facturation SaaS — voir
 * docs/14-facturation-saas-abonnements.md. Initié UNIQUEMENT depuis le dashboard par
 * le propriétaire (`settings.subscription`, voir `require-billing-permission.ts`),
 * JAMAIS depuis le storefront public — à ne pas confondre avec
 * `apps/web/lib/storefront/checkout-pipeline.ts` (paiement d'une commande cliente).
 *
 * Contrairement au checkout storefront, la création de la session hébergée auprès du
 * prestataire est TOUJOURS répétée pour une session réutilisée (double clic) plutôt
 * que mise en cache : `createCheckoutSession` ne fait qu'ouvrir une page de paiement
 * (aucun effet financier), la répéter est sans risque — contrairement à
 * `createPayment` côté commande, qui initie une VRAIE transaction chez le
 * prestataire et ne doit donc jamais être rejoué inutilement.
 */
export interface CreateBillingCheckoutInput {
  tenantId: string;
  planId: string;
  billingCycle: "MONTHLY" | "YEARLY";
  customer: { name: string; phone?: string; email?: string };
  host: string;
}

export interface BillingCheckoutResult {
  checkoutUrl: string;
  internalReference: string;
}

export async function createBillingCheckout(input: CreateBillingCheckoutInput): Promise<BillingCheckoutResult> {
  const provider = resolveSaasBillingProvider();

  const { session, plan } = await withTenant(input.tenantId, async (tx) => {
    const plan = await tx.subscriptionPlan.findFirst({ where: { id: input.planId, status: "PUBLISHED" } });
    if (!plan) throw new Error("Formule introuvable ou non publiée.");

    const subscription = await getOrCreateSubscription(tx, input.tenantId, input.planId);
    const amountXOF = input.billingCycle === "YEARLY" ? plan.priceYearly : plan.priceMonthly;

    const { session, reused } = await reserveOrReuseCheckoutSession(tx, {
      tenantId: input.tenantId,
      subscriptionId: subscription.id,
      planId: input.planId,
      billingCycle: input.billingCycle,
      provider: provider.name,
      amountXOF,
    });

    if (!reused) {
      await tx.subscriptionEvent.create({
        data: {
          tenantId: input.tenantId,
          subscriptionId: subscription.id,
          type: "checkout_created",
          actorType: "tenant_owner",
          payloadSnapshot: { planId: input.planId, billingCycle: input.billingCycle, amountXOF },
        },
      });
    }

    return { session, plan };
  });

  const providerProductId =
    input.billingCycle === "YEARLY" ? plan.chariowYearlyProductId : plan.chariowMonthlyProductId;

  const result = await provider.createCheckoutSession({
    internalReference: session.internalReference,
    tenantId: input.tenantId,
    subscriptionId: session.subscriptionId ?? "",
    planId: input.planId,
    billingCycle: input.billingCycle,
    amountXOF: session.amountXOF,
    currency: "XOF",
    description: `Formule ${plan.name} — ${input.billingCycle === "YEARLY" ? "annuel" : "mensuel"}`,
    customer: input.customer,
    returnUrl: `https://${input.host}/dashboard/facturation/retour?ref=${session.internalReference}`,
    cancelUrl: `https://${input.host}/dashboard/facturation`,
    callbackUrl: `https://${input.host}/api/webhooks/chariow`,
    providerProductId,
  });

  await withTenant(input.tenantId, (tx) =>
    tx.billingCheckoutSession.updateMany({
      where: { id: session.id, tenantId: input.tenantId },
      data: { providerCheckoutId: result.providerCheckoutId },
    }),
  );

  return { checkoutUrl: result.checkoutUrl, internalReference: session.internalReference };
}
