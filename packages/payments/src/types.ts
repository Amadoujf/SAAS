/**
 * Interface commune à tous les prestataires de paiement — voir docs/03-architecture-technique.md
 * §3.4 et l'ajustement obligatoire #1 de la Phase 0.
 *
 * RÈGLE STRICTE : aucun code métier (commandes, factures, dashboard) ne doit jamais
 * importer `PayDunyaAdapter` ou `PayTechAdapter` directement. Il doit uniquement
 * dépendre de `PaymentProviderAdapter` et obtenir une instance via
 * `resolveProviderForTenant()` (voir registry.ts). Changer de prestataire pour un
 * tenant est alors une opération de configuration (table `PaymentProviderConfig`),
 * jamais une modification de code.
 */

export type PaymentProviderName =
  "paydunya" | "paytech" | "cod" | "wave_direct" | "orange_money_direct";

export interface CreatePaymentInput {
  /** Clé d'idempotence générée par l'appelant AVANT tout appel au prestataire — voir
   *  docs/07-parcours-paiement-facture.md#71-étapes-détaillées, étape 1. */
  idempotencyKey: string;
  orderId: string;
  tenantId: string;
  amount: number; // FCFA, entier
  currency: "XOF";
  description: string;
  customer: { name: string; phone?: string; email?: string };
  /** URL vers laquelle le client est redirigé après paiement — affichage de courtoisie
   *  uniquement, ne doit jamais servir à valider le paiement (voir doc 07 §7.2 étape 3). */
  returnUrl: string;
  cancelUrl: string;
  /** URL de callback serveur à serveur (IPN / webhook) fournie par la plateforme. */
  callbackUrl: string;
}

export interface CreatePaymentResult {
  /** Identifiant de transaction côté prestataire (ex. token PayDunya). */
  providerTransactionId: string;
  /** URL hébergée par le prestataire où le client saisit ses informations de paiement. */
  checkoutUrl: string;
  raw: unknown;
}

export interface VerifyWebhookInput {
  /** En-têtes bruts de la requête HTTP entrante, pour validation de signature. */
  headers: Record<string, string | string[] | undefined>;
  /** Corps brut (avant parsing JSON) — nécessaire pour certains schémas de signature HMAC. */
  rawBody: string;
}

export interface VerifiedWebhookEvent {
  /** Identifiant unique de l'événement côté prestataire — clé d'idempotence webhook. */
  eventId: string;
  providerTransactionId: string;
  status: "succeeded" | "failed" | "pending";
  amount: number;
  currency: string;
  raw: unknown;
}

export interface RefundInput {
  providerTransactionId: string;
  amount: number;
  reason: string;
}

export interface RefundResult {
  providerRefundId: string;
  status: "succeeded" | "pending" | "failed";
  raw: unknown;
}

export interface PaymentProviderAdapter {
  readonly name: PaymentProviderName;

  /** Crée une intention/facture de paiement chez le prestataire. */
  createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult>;

  /**
   * Vérifie l'authenticité d'une notification serveur à serveur (IPN/webhook) et
   * retourne l'état vérifié. DOIT rejeter (throw) si la signature est invalide — ne
   * jamais retourner un statut "succeeded" sans validation cryptographique réussie.
   */
  verifyWebhook(input: VerifyWebhookInput): Promise<VerifiedWebhookEvent>;

  /** Interroge activement le prestataire pour confirmer l'état d'une transaction
   *  (utilisé par la relance des traitements échoués — voir webhook-processor.ts). */
  getStatus(providerTransactionId: string): Promise<VerifiedWebhookEvent>;

  refund(input: RefundInput): Promise<RefundResult>;
}

/** Identifiants déchiffrés d'un compte marchand tenant, jamais journalisés en clair. */
export interface MerchantCredentials {
  [key: string]: string;
}
