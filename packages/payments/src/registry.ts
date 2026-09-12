import { decryptSecret, prisma } from "@yamacommerce/database";
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

  const config = await prisma.paymentProviderConfig.findUnique({
    where: { tenantId_provider: { tenantId, provider } },
  });

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
