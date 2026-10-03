import { decryptSecret, withTenant } from "@yamacommerce/database";
import { CashOnDeliveryAdapter } from "./adapters/cod.adapter";
import { PayDunyaAdapter, type PayDunyaCredentials } from "./adapters/paydunya.adapter";
import type { PaymentProviderAdapter, PaymentProviderName } from "./types";

/**
 * Point d'entrée UNIQUE pour obtenir un adaptateur de paiement configuré pour un tenant.
 * Le reste de l'application ne doit jamais instancier un adaptateur directement — voir
 * l'ajustement obligatoire #1 (interface indépendante du prestataire) et #4 (chaque
 * entreprise connecte son propre compte marchand).
 */
export async function resolveProviderForTenant(
  tenantId: string,
  provider: PaymentProviderName,
  tenantDisplayName: string,
): Promise<PaymentProviderAdapter> {
  if (provider === "cod") {
    return new CashOnDeliveryAdapter();
  }

  // `PaymentProviderConfig` a une policy RLS Pattern A (voir la migration RLS
  // initiale) — le client Prisma NU (sans contexte tenant) ne peut RIEN y lire,
  // même le propriétaire d'un tenant réel. Corrigé à l'étape 2 (clients/panier/
  // commandes/livraison) : c'était un bug latent jamais exercé avant que
  // `processPaymentWebhook` ne soit réellement invoqué de bout en bout (voir
  // `webhook-processor.test.ts`, qui l'a révélé).
  const config = await withTenant(tenantId, (tx) =>
    tx.paymentProviderConfig.findUnique({ where: { tenantId_provider: { tenantId, provider } } }),
  );

  if (!config || !config.isEnabled) {
    throw new Error(`Le moyen de paiement "${provider}" n'est pas activé pour ce tenant.`);
  }

  if (provider === "paydunya") {
    const credentials = decryptCredentials<PayDunyaCredentials>(config);
    return new PayDunyaAdapter({
      credentials,
      mode: config.mode === "live" ? "live" : "sandbox",
      storeName: tenantDisplayName,
    });
  }

  throw new Error(
    `Prestataire "${provider}" pas encore câblé (voir docs/09-plan-developpement.md, Phase 2).`,
  );
}

/**
 * Résout le SEUL prestataire en ligne activé pour ce tenant (jamais "cod", qui n'a
 * pas de ligne `PaymentProviderConfig`) — voir `apps/web/lib/storefront/
 * checkout-pipeline.ts`, étape 2 : le checkout ne doit jamais deviner/forcer un
 * prestataire, ni simuler un succès s'il n'y en a aucun de configuré. La sélection
 * entre PLUSIEURS prestataires en ligne actifs à la fois (ex. PayDunya ET PayTech)
 * est hors périmètre de cette étape — le premier trouvé est utilisé.
 */
/** Prestataires de paiement EN LIGNE (redirection vers une page de paiement sécurisée). */
export const ONLINE_PROVIDERS: PaymentProviderName[] = ["paydunya", "paytech"];

export async function resolveEnabledOnlineProvider(tenantId: string): Promise<PaymentProviderName | null> {
  const config = await withTenant(tenantId, (tx) =>
    // Seuls les VRAIS prestataires en ligne : le paiement à la livraison et les numéros
    // Wave / Orange Money (encaissements manuels vérifiés par l'entreprise) sont exclus,
    // sinon ils pourraient masquer PayDunya quand les deux sont activés.
    tx.paymentProviderConfig.findFirst({ where: { tenantId, isEnabled: true, provider: { in: ONLINE_PROVIDERS } }, orderBy: { provider: "asc" } }),
  );
  return (config?.provider as PaymentProviderName | undefined) ?? null;
}

function decryptCredentials<T extends Record<string, string>>(config: {
  credentialsCiphertext: string | null;
  credentialsIv: string | null;
  credentialsAuthTag: string | null;
}): T {
  if (!config.credentialsCiphertext || !config.credentialsIv || !config.credentialsAuthTag) {
    throw new Error(
      "Identifiants de compte marchand manquants pour ce prestataire — configuration incomplète.",
    );
  }
  const plaintext = decryptSecret({
    ciphertext: config.credentialsCiphertext,
    iv: config.credentialsIv,
    authTag: config.credentialsAuthTag,
  });
  return JSON.parse(plaintext) as T;
}
