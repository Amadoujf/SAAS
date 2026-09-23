import type { Prisma } from "@prisma/client";

/**
 * Application RÉELLE des quotas de formule — voir docs/14-facturation-saas-
 * abonnements.md, décision #5 (« cadre extensible par secteur »). Un registre
 * `resourceKey -> fonction de comptage` : les ressources DÉNOMBRABLES via une vraie
 * table (produits, employés, domaines) sont comptées EN DIRECT (`tx.product.count`),
 * JAMAIS dupliquées dans une colonne à resynchroniser (leçon déjà apprise cette
 * session). Seules des ressources CUMULATIVES sans table source propre (e-mails/
 * WhatsApp envoyés — pas encore câblées, aucun canal d'envoi réel dans ce projet
 * aujourd'hui) utiliseraient un jour `SubscriptionUsage`.
 *
 * Sector-agnostic par construction : un futur secteur (immobilier, voyage...)
 * enregistre sa propre fonction de comptage dans `QUOTA_COUNTERS`/`PLAN_LIMIT_FIELD`
 * sans jamais toucher `assertQuotaAvailable` — aucune entrée n'est pré-remplie pour
 * des entités métier qui n'existent pas encore (voir décision #5, hors périmètre).
 */
export type QuotaResourceKey = "products" | "employees" | "domains";

type QuotaCounter = (tx: Prisma.TransactionClient, tenantId: string) => Promise<number>;

const QUOTA_COUNTERS: Record<QuotaResourceKey, QuotaCounter> = {
  products: (tx, tenantId) => tx.product.count({ where: { tenantId, deletedAt: null } }),
  employees: (tx, tenantId) => tx.tenantUser.count({ where: { tenantId, status: { in: ["INVITED", "ACTIVE"] } } }),
  domains: (tx, tenantId) => tx.domain.count({ where: { tenantId, lifecycleStatus: { not: "REMOVED" } } }),
};

const PLAN_LIMIT_FIELD: Record<QuotaResourceKey, "maxProducts" | "maxEmployees" | "maxCustomDomains"> = {
  products: "maxProducts",
  employees: "maxEmployees",
  domains: "maxCustomDomains",
};

export class QuotaExceededError extends Error {
  constructor(
    public readonly resourceKey: QuotaResourceKey,
    public readonly limit: number,
    public readonly current: number,
  ) {
    super(
      `Quota "${resourceKey}" atteint (${current}/${limit}) — passez à une formule supérieure pour continuer, ou demandez une dérogation à un administrateur.`,
    );
    this.name = "QuotaExceededError";
  }
}

/**
 * Résout la limite EFFECTIVE pour une ressource : une dérogation Super Admin
 * (`SubscriptionEntitlement`, non expirée) prévaut TOUJOURS sur la limite de la
 * formule — jamais l'inverse. `null` = illimité.
 *
 * CORRECTION DE STABILISATION (22 septembre 2026) — voir docs/14 : « aucune
 * souscription = accès illimité » a été identifié comme un contournement possible de
 * la facturation (supprimer/perdre la ligne `TenantSubscription` rendait un tenant
 * illimité). L'ABSENCE d'abonnement bloque désormais PAR DÉFAUT (retourne `0`, jamais
 * `null`) — la SEULE exception est un tenant explicitement marqué
 * `Tenant.billingExemptedAt` (dérogation Super Admin ponctuelle pour un tenant
 * antérieur à cette étape, jamais un défaut). Un nouveau tenant standard doit
 * recevoir un `TenantSubscription` réel (essai ou souscription) — voir
 * `getOrCreateSubscription` — jamais dépendre de ce blocage comme mécanisme normal.
 */
export async function resolveEffectiveLimit(
  tx: Prisma.TransactionClient,
  tenantId: string,
  resourceKey: QuotaResourceKey,
): Promise<number | null> {
  const entitlement = await tx.subscriptionEntitlement.findUnique({
    where: { tenantId_resourceKey: { tenantId, resourceKey } },
  });
  if (entitlement && (!entitlement.expiresAt || entitlement.expiresAt > new Date())) {
    return entitlement.limitValue;
  }

  const subscription = await tx.tenantSubscription.findUnique({ where: { tenantId }, include: { plan: true } });
  if (subscription) return subscription.plan[PLAN_LIMIT_FIELD[resourceKey]];

  const tenant = await tx.tenant.findUnique({ where: { id: tenantId }, select: { billingExemptedAt: true } });
  if (tenant?.billingExemptedAt) return null;

  return 0;
}

/**
 * Garde SERVEUR à appeler AVANT toute mutation qui ferait grandir une ressource
 * dénombrable — voir docs/14, décision #5 : « un appel direct à l'API sans passer par
 * l'UI doit échouer tout autant ». `increment` permet de vérifier un import en lot
 * (N nouveaux produits d'un coup) sans boucler un appel par unité.
 */
export async function assertQuotaAvailable(
  tx: Prisma.TransactionClient,
  tenantId: string,
  resourceKey: QuotaResourceKey,
  increment = 1,
): Promise<void> {
  const limit = await resolveEffectiveLimit(tx, tenantId, resourceKey);
  if (limit === null) return;

  const current = await QUOTA_COUNTERS[resourceKey](tx, tenantId);
  if (current + increment > limit) {
    throw new QuotaExceededError(resourceKey, limit, current);
  }
}
