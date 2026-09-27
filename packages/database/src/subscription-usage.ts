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
export type QuotaResourceKey = "records" | "employees" | "domains";

type QuotaCounter = (tx: Prisma.TransactionClient, tenantId: string) => Promise<number>;

/**
 * « Fiches » — l'unité du quota catalogue de chaque formule (voir docs/14, « Ce que
 * compte une fiche »). Une fiche est un élément PUBLIABLE du catalogue de l'entreprise,
 * quel que soit son secteur : produit ou plat (commerce, mode, restauration), bien
 * (immobilier), offre (voyage), véhicule, chambre ou logement, prestation, formation,
 * zone ou formule de livraison. Ne sont JAMAIS comptés : commandes, réservations,
 * rendez-vous, paiements, factures, clients, historiques, révisions, médias. Chaque
 * secteur livré ajoute ici le décompte de SA table de catalogue.
 */
export const RECORD_COUNTERS: { label: string; count: QuotaCounter }[] = [
  { label: "Produits", count: (tx, tenantId) => tx.product.count({ where: { tenantId, deletedAt: null } }) },
  // Biens, offres de voyage, prestations, chambres, véhicules, formations (docs/04
  // §4.5.2). Les réservations, comme les commandes, ne sont jamais comptées.
  { label: "Fiches", count: (tx, tenantId) => tx.listing.count({ where: { tenantId, deletedAt: null } }) },
];

const QUOTA_COUNTERS: Record<QuotaResourceKey, QuotaCounter> = {
  records: async (tx, tenantId) => {
    let total = 0;
    for (const counter of RECORD_COUNTERS) total += await counter.count(tx, tenantId);
    return total;
  },
  // Une invitation en attente (non acceptée, non révoquée, non expirée) réserve une
  // place : sinon on pourrait inviter au-delà du quota puis tout faire accepter.
  employees: async (tx, tenantId) =>
    (await tx.tenantUser.count({ where: { tenantId, status: { in: ["INVITED", "ACTIVE"] } } })) +
    (await tx.tenantInvitation.count({ where: { tenantId, acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } } })),
  domains: (tx, tenantId) => tx.domain.count({ where: { tenantId, lifecycleStatus: { not: "REMOVED" } } }),
};

/** Consommation actuelle d'une ressource (affichage des quotas dans le dashboard). */
export function countQuotaUsage(tx: Prisma.TransactionClient, tenantId: string, resourceKey: QuotaResourceKey) {
  return QUOTA_COUNTERS[resourceKey](tx, tenantId);
}

const PLAN_LIMIT_FIELD: Record<QuotaResourceKey, "maxProducts" | "maxEmployees" | "maxCustomDomains"> = {
  records: "maxProducts",
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
  // Verrou consultatif PAR (tenant, ressource) — CORRECTION DE STABILISATION, bogue
  // réel trouvé en testant pour de vrai la concurrence (voir "CONCURRENCE RÉELLE" dans
  // subscription-usage.test.ts) : un COMPTAGE (`SELECT COUNT(*)`) n'a pas de ligne
  // unique à verrouiller via un `UPDATE ... WHERE` gardé (contrairement à `adjustStock`,
  // catalog-registry.ts). Sans coordination explicite, plusieurs créations simultanées
  // proches de la limite lisaient TOUTES un compte encore sous la limite et
  // dépassaient le quota réel (3 produits acceptés pour une limite de 2, reproduit de
  // façon fiable). `pg_advisory_xact_lock` sérialise toute paire (tenant, ressource) le
  // temps de CETTE transaction — relâché automatiquement au commit/rollback, jamais un
  // verrou à libérer manuellement. `hashtext` retourne un entier 32 bits : une
  // collision ferait au pire sérialiser deux paires (tenant, ressource) sans rapport
  // entre elles, jamais un dépassement de quota.
  // `$executeRaw`, pas `$queryRaw` : `pg_advisory_xact_lock` renvoie `void`, que Prisma
  // ne sait pas désérialiser depuis `$queryRaw` ("Failed to deserialize column of type
  // 'void'") — `$executeRaw` n'essaie pas d'interpréter les colonnes retournées.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${tenantId} || ':' || ${resourceKey}))`;

  const limit = await resolveEffectiveLimit(tx, tenantId, resourceKey);
  if (limit === null) return;

  const current = await QUOTA_COUNTERS[resourceKey](tx, tenantId);
  if (current + increment > limit) {
    throw new QuotaExceededError(resourceKey, limit, current);
  }
}

/**
 * Fonctions réservées à certaines formules (`SubscriptionPlan.features`). Même règle que
 * les quotas : vérifié CÔTÉ SERVEUR, dérogation Super Admin (`billingExemptedAt`) =
 * tout autorisé, aucun abonnement = rien d'optionnel.
 */
export type PlanFeature = "invoices" | "statistics" | "custom_domain" | "advanced_reports" | "automations" | "ai_quota";

export async function planHasFeature(tx: Prisma.TransactionClient, tenantId: string, feature: PlanFeature): Promise<boolean> {
  const subscription = await tx.tenantSubscription.findUnique({ where: { tenantId }, include: { plan: true } });
  if (subscription) return Array.isArray(subscription.plan.features) && (subscription.plan.features as unknown[]).includes(feature);
  const tenant = await tx.tenant.findUnique({ where: { id: tenantId }, select: { billingExemptedAt: true } });
  return !!tenant?.billingExemptedAt;
}

export class PlanFeatureUnavailableError extends Error {
  constructor(public readonly feature: PlanFeature) {
    super(`Cette fonction n'est pas incluse dans votre formule actuelle — passez à une formule supérieure pour l'utiliser.`);
    this.name = "PlanFeatureUnavailableError";
  }
}

export async function assertPlanFeature(tx: Prisma.TransactionClient, tenantId: string, feature: PlanFeature) {
  if (!(await planHasFeature(tx, tenantId, feature))) throw new PlanFeatureUnavailableError(feature);
}
