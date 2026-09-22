import { ManualBillingAdapter } from "./adapters/manual.adapter";
import { ChariowBillingAdapter } from "./adapters/chariow.adapter";
import type { SaasBillingProvider, SaasBillingProviderName } from "./types";

/**
 * Point d'entrée UNIQUE pour obtenir un adaptateur de facturation SaaS configuré.
 * Contrairement à `@yamacommerce/payments` `resolveProviderForTenant`, AUCUN
 * paramètre tenant : la plateforme est TOUJOURS le même marchand, un seul
 * prestataire actif à la fois pour TOUS les tenants — voir docs/14.
 *
 * Lit UNIQUEMENT des variables d'environnement, jamais une valeur DB : le secret
 * Chariow ne doit jamais pouvoir atteindre le navigateur ni transiter par une requête
 * qu'un bug RLS pourrait exposer. Le mapping formule -> produit Chariow, LUI, reste
 * en base (`SubscriptionPlan.chariowMonthlyProductId`/`chariowYearlyProductId`) : ce
 * n'est pas un secret.
 */
export function resolveSaasBillingProvider(): SaasBillingProvider {
  const providerName = (process.env.SAAS_BILLING_PROVIDER ?? "manual") as SaasBillingProviderName;

  if (providerName === "manual") {
    return new ManualBillingAdapter();
  }

  if (providerName === "chariow") {
    const secretKey = process.env.CHARIOW_SECRET_KEY;
    const apiBaseUrl = process.env.CHARIOW_API_BASE_URL ?? "https://api.chariow.com";
    const webhookSecret = process.env.CHARIOW_WEBHOOK_SECRET;
    if (!secretKey || !webhookSecret) {
      throw new Error(
        "Facturation SaaS : CHARIOW_SECRET_KEY et CHARIOW_WEBHOOK_SECRET doivent être renseignés pour utiliser Chariow.",
      );
    }
    return new ChariowBillingAdapter({ secretKey, apiBaseUrl, webhookSecret });
  }

  throw new Error(`Facturation SaaS : prestataire "${providerName}" inconnu (voir SAAS_BILLING_PROVIDER).`);
}
