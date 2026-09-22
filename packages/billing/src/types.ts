/**
 * Interface commune aux prestataires de FACTURATION SAAS (abonnement des entreprises
 * à la plateforme) — voir docs/14-facturation-saas-abonnements.md. À NE JAMAIS
 * confondre avec `@yamacommerce/payments` (paiements des clients finaux sur le site
 * d'une entreprise) : modèles, webhooks et routes séparés, jamais partagés.
 *
 * RÈGLE STRICTE, comme pour `@yamacommerce/payments` : aucun code métier ne doit
 * jamais importer `ChariowBillingAdapter` directement. Il doit uniquement dépendre de
 * `SaasBillingProvider` et obtenir une instance via `resolveSaasBillingProvider()`
 * (voir registry.ts). Changer de prestataire de facturation SaaS est alors une
 * opération de configuration (variables d'environnement), jamais une modification de
 * code métier.
 *
 * Différence structurelle majeure avec `@yamacommerce/payments` : là-bas, CHAQUE
 * TENANT connecte son propre compte marchand (`PaymentProviderConfig`, une ligne par
 * tenant+prestataire). Ici, LA PLATEFORME ELLE-MÊME est le marchand — un seul compte
 * Chariow pour tous les tenants — donc aucune fonction de ce module ne prend un
 * `tenantId` en paramètre pour résoudre des identifiants.
 */

export type SaasBillingProviderName = "chariow" | "manual";

export interface CreateCheckoutSessionInput {
  /** Jeton aléatoire non devinable, déjà généré par l'appelant (voir
   *  `BillingCheckoutSession.internalReference`) — transmis au prestataire via
   *  `custom_metadata` pour corréler le retour du webhook à CETTE session précise. */
  internalReference: string;
  tenantId: string;
  subscriptionId: string;
  planId: string;
  billingCycle: "MONTHLY" | "YEARLY";
  amountXOF: number; // FCFA, entier
  currency: "XOF";
  description: string;
  customer: { name: string; phone?: string; email?: string };
  /** URL vers laquelle le client est redirigé après paiement — affichage de
   *  courtoisie UNIQUEMENT ("paiement en cours de vérification"), ne doit JAMAIS
   *  servir à activer l'abonnement (voir docs/14, « jamais d'accès accordé depuis la
   *  redirection navigateur »). */
  returnUrl: string;
  cancelUrl: string;
  /** URL de callback serveur à serveur (Pulse Chariow). */
  callbackUrl: string;
  /** Identifiant produit Chariow correspondant à la formule+cycle choisis — voir
   *  `SubscriptionPlan.chariowMonthlyProductId`/`chariowYearlyProductId`. */
  providerProductId?: string | null;
}

export interface CreateCheckoutSessionResult {
  providerCheckoutId: string;
  checkoutUrl: string;
  raw: unknown;
}

export interface VerifyPulseWebhookInput {
  headers: Record<string, string | string[] | undefined>;
  rawBody: string;
}

export interface VerifiedPulseEvent {
  /** Identifiant unique de l'événement côté prestataire — clé d'idempotence webhook. */
  eventId: string;
  providerSaleId: string;
  /** Extrait du `custom_metadata` renvoyé par le prestataire, si présent — permet de
   *  retrouver la `BillingCheckoutSession` correspondante SANS faire confiance au
   *  contenu déclaré (le montant/devise/produit sont revérifiés séparément). */
  internalReference: string | null;
  status: "succeeded" | "failed" | "pending";
  amountXOF: number;
  currency: string;
  providerProductId: string | null;
  raw: unknown;
}

export interface SaasBillingProvider {
  readonly name: SaasBillingProviderName;

  /** Crée une session de paiement chez le prestataire pour UN renouvellement/une
   *  souscription précis. */
  createCheckoutSession(input: CreateCheckoutSessionInput): Promise<CreateCheckoutSessionResult>;

  /**
   * Vérifie l'authenticité d'une notification Pulse entrante et retourne l'état
   * vérifié. DOIT rejeter (throw) si la signature est invalide — ne jamais retourner
   * un statut "succeeded" sans validation cryptographique réussie (voir
   * ChariowBillingAdapter pour l'implémentation, et docs/14 pour les points à
   * vérifier en sandbox avant production réelle).
   */
  verifyWebhook(input: VerifyPulseWebhookInput): Promise<VerifiedPulseEvent>;

  /** Interroge activement le prestataire pour confirmer l'état d'une vente — utilisé
   *  par le balayage de rapprochement périodique (paiements restés en attente). */
  getStatus(providerSaleId: string): Promise<VerifiedPulseEvent>;
}
