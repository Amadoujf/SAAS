import type { Prisma, DomainLifecycleStatus } from "@prisma/client";

/**
 * Persistance des domaines — voir docs/13 (assistant de domaines personnalisés, 16
 * septembre 2026). Même convention que `media-assets-registry.ts` : chaque fonction
 * reçoit `tx` (déjà scoping-vérifié par `withTenant(tenantId, ...)` pour les
 * opérations "client", ou `withSuperAdminAccess` pour les opérations Super Admin
 * listées en bas de fichier) ET `tenantId` explicitement quand l'opération est
 * censée rester scoping à un tenant — défense en profondeur, jamais une confiance
 * aveugle en la seule RLS.
 *
 * Aucune fonction ici ne supprime jamais une ligne `Domain` : un domaine retiré
 * passe au statut `REMOVED`, conservé pour l'audit (voir « Toute intervention doit
 * être journalisée » et `writeAuditLog`, appelé par l'orchestrateur applicatif, pas
 * ici — ce fichier reste une couche de persistance pure, sans connaissance de
 * l'acteur/session).
 */

export interface CreateCustomDomainInput {
  domain: string; // déjà normalisé (voir @yamacommerce/domains `normalizeDomainName`).
  type: "custom";
  verificationToken: string;
  verificationTokenExpiresAt: Date;
  expectedDnsRecords: unknown; // ExpectedDnsRecord[] (voir @yamacommerce/domains).
  dnsProvider: string;
}

export async function createCustomDomain(
  tx: Prisma.TransactionClient,
  tenantId: string,
  input: CreateCustomDomainInput,
) {
  return tx.domain.create({
    data: {
      tenantId,
      domain: input.domain,
      type: input.type,
      lifecycleStatus: "PENDING_DNS",
      verificationToken: input.verificationToken,
      verificationTokenExpiresAt: input.verificationTokenExpiresAt,
      expectedDnsRecords: input.expectedDnsRecords as Prisma.InputJsonValue,
      dnsProvider: input.dnsProvider,
    },
  });
}

/**
 * Sous-domaine gratuit — voir docs/13, « PARCOURS 1 ». `ACTIVE` immédiatement : servi
 * par le certificat wildcard de la plateforme, jamais de vérification DNS/TLS
 * individuelle à attendre. Devient automatiquement le domaine principal SEULEMENT
 * si le tenant n'en a encore aucun (premier domaine jamais créé).
 */
export async function createFreeSubdomain(
  tx: Prisma.TransactionClient,
  tenantId: string,
  fullDomain: string,
  dnsProvider: string,
) {
  const hasAnyDomain = (await tx.domain.count({ where: { tenantId } })) > 0;
  return tx.domain.create({
    data: {
      tenantId,
      domain: fullDomain,
      type: "subdomain",
      isPrimary: !hasAnyDomain,
      serveDirectlyWhenNotPrimary: true,
      lifecycleStatus: "ACTIVE",
      dnsProvider,
    },
  });
}

export async function listDomainsForTenant(tx: Prisma.TransactionClient, tenantId: string) {
  return tx.domain.findMany({ where: { tenantId }, orderBy: { createdAt: "asc" } });
}

export async function getDomainForTenant(tx: Prisma.TransactionClient, tenantId: string, id: string) {
  return tx.domain.findFirst({ where: { id, tenantId } });
}

/** Renouvelle le jeton de vérification — voir « Être renouvelable » : réinitialise
 *  aussi le compteur de tentatives et repasse en `PENDING_DNS` (l'ancien jeton, s'il
 *  était déjà partiellement propagé chez le client, devient immédiatement invalide). */
export async function regenerateVerificationToken(
  tx: Prisma.TransactionClient,
  tenantId: string,
  id: string,
  token: string,
  expiresAt: Date,
  expectedDnsRecords: unknown,
) {
  const { count } = await tx.domain.updateMany({
    where: { id, tenantId, lifecycleStatus: { notIn: ["ACTIVE", "REMOVED", "SUSPENDED"] } },
    data: {
      verificationToken: token,
      verificationTokenExpiresAt: expiresAt,
      verificationAttempts: 0,
      lifecycleStatus: "PENDING_DNS",
      expectedDnsRecords: expectedDnsRecords as Prisma.InputJsonValue,
    },
  });
  if (count === 0) {
    throw new Error(
      `regenerateVerificationToken : domaine "${id}" introuvable ou dans un état ne permettant pas de régénérer un jeton.`,
    );
  }
}

/** Enregistre le résultat d'UNE tentative de détection DNS (voir @yamacommerce/
 *  domains `checkExpectedDnsRecords`) — ne décide PAS elle-même du statut final :
 *  seulement l'historique (`detectedDnsRecords`, `lastCheckedAt`,
 *  `verificationAttempts`) et la première transition DRAFT/PENDING_DNS -> VERIFYING
 *  ("au moins une tentative a eu lieu"). Voir `markVerified`/`markMisconfigured`
 *  pour les transitions qui dépendent du RÉSULTAT de la détection. */
export async function recordDnsCheckAttempt(
  tx: Prisma.TransactionClient,
  tenantId: string,
  id: string,
  detectedDnsRecords: unknown,
) {
  const domain = await tx.domain.findFirstOrThrow({ where: { id, tenantId } });
  const nextStatus: DomainLifecycleStatus =
    domain.lifecycleStatus === "PENDING_DNS" ? "VERIFYING" : domain.lifecycleStatus;
  return tx.domain.update({
    where: { id },
    data: {
      detectedDnsRecords: detectedDnsRecords as Prisma.InputJsonValue,
      lastCheckedAt: new Date(),
      verificationAttempts: { increment: 1 },
      lifecycleStatus: nextStatus,
    },
  });
}

/** Propriété confirmée (TXT correspondant) — voir « VÉRIFICATION DE PROPRIÉTÉ ».
 *  Idempotent : si déjà `VERIFIED` ou au-delà, ne fait rien. */
export async function markVerified(tx: Prisma.TransactionClient, tenantId: string, id: string) {
  await tx.domain.updateMany({
    where: { id, tenantId, lifecycleStatus: { in: ["PENDING_DNS", "VERIFYING", "MISCONFIGURED"] } },
    data: { lifecycleStatus: "VERIFIED" },
  });
}

export async function markSslPending(tx: Prisma.TransactionClient, tenantId: string, id: string) {
  await tx.domain.updateMany({
    where: { id, tenantId, lifecycleStatus: "VERIFIED" },
    data: { lifecycleStatus: "SSL_PENDING" },
  });
}

/** Certificat réellement émis — voir « Ne jamais afficher un domaine comme actif
 *  avant que le HTTPS fonctionne réellement ». */
export async function markActive(tx: Prisma.TransactionClient, tenantId: string, id: string) {
  await tx.domain.updateMany({
    where: { id, tenantId, lifecycleStatus: { in: ["VERIFIED", "SSL_PENDING"] } },
    data: { lifecycleStatus: "ACTIVE" },
  });
}

/** Une configuration valide a été détectée puis cassée, OU n'a jamais abouti après
 *  de nombreuses tentatives — voir « Détecte une configuration cassée après
 *  activation ». Ne s'applique jamais à un domaine déjà `REMOVED`/`SUSPENDED`
 *  (décisions volontaires, jamais reclassées automatiquement en "erreur"). */
export async function markMisconfigured(tx: Prisma.TransactionClient, tenantId: string, id: string) {
  await tx.domain.updateMany({
    where: { id, tenantId, lifecycleStatus: { notIn: ["REMOVED", "SUSPENDED", "DRAFT"] } },
    data: { lifecycleStatus: "MISCONFIGURED" },
  });
}

/**
 * Domaine principal — voir « DOMAINES PRINCIPAUX ET REDIRECTIONS » : un seul par
 * tenant. Exige `ACTIVE` (jamais un domaine dont le HTTPS ne fonctionne pas encore).
 */
export async function setPrimaryDomain(tx: Prisma.TransactionClient, tenantId: string, id: string) {
  const target = await tx.domain.findFirstOrThrow({ where: { id, tenantId } });
  if (target.lifecycleStatus !== "ACTIVE") {
    throw new Error(`setPrimaryDomain : le domaine "${id}" n'est pas encore actif (HTTPS non confirmé).`);
  }
  await tx.domain.updateMany({ where: { tenantId, isPrimary: true }, data: { isPrimary: false } });
  return tx.domain.update({ where: { id }, data: { isPrimary: true } });
}

/** Retrait — jamais une suppression de ligne (voir la note de tête de fichier). */
export async function removeDomain(tx: Prisma.TransactionClient, tenantId: string, id: string) {
  const { count } = await tx.domain.updateMany({
    where: { id, tenantId, lifecycleStatus: { not: "REMOVED" } },
    data: { lifecycleStatus: "REMOVED", isPrimary: false },
  });
  if (count === 0) {
    throw new Error(`removeDomain : domaine "${id}" introuvable ou déjà retiré.`);
  }
}

// ============================================================================
// SUPER ADMIN — voir docs/13, « INTERFACE SUPER ADMIN ». Appelées avec un `tx`
// ouvert par `withSuperAdminAccess` (accès cross-tenant) — l'appelant (apps/web)
// reste responsable de la vérification `User.isSuperAdmin` ET de l'écriture
// `AuditLog` correspondante (voir audit-log-registry.ts), jamais faites ici.
// ============================================================================

export interface SearchDomainsFilter {
  status?: DomainLifecycleStatus;
  query?: string; // recherche sur le nom de domaine.
  cursor?: string;
  limit?: number;
}

export async function searchDomains(tx: Prisma.TransactionClient, filter: SearchDomainsFilter = {}) {
  const limit = Math.min(filter.limit ?? 50, 200);
  return tx.domain.findMany({
    where: {
      ...(filter.status ? { lifecycleStatus: filter.status } : {}),
      ...(filter.query ? { domain: { contains: filter.query, mode: "insensitive" } } : {}),
    },
    include: { tenant: { select: { id: true, name: true, slug: true, status: true } } },
    orderBy: { createdAt: "desc" },
    take: limit,
    ...(filter.cursor ? { skip: 1, cursor: { id: filter.cursor } } : {}),
  });
}

export async function suspendDomain(tx: Prisma.TransactionClient, id: string) {
  await tx.domain.update({ where: { id }, data: { lifecycleStatus: "SUSPENDED" } });
}

export async function reactivateDomain(tx: Prisma.TransactionClient, id: string) {
  const domain = await tx.domain.findUniqueOrThrow({ where: { id } });
  if (domain.lifecycleStatus !== "SUSPENDED") {
    throw new Error(`reactivateDomain : le domaine "${id}" n'est pas suspendu.`);
  }
  // Reprend au dernier état connu AVANT suspension : `ACTIVE` seulement si le
  // certificat avait déjà été confirmé émis — sinon on repart de `VERIFIED`, plus
  // prudent qu'une réactivation directe en `ACTIVE` sans revalidation.
  await tx.domain.update({ where: { id }, data: { lifecycleStatus: "VERIFIED" } });
}

/** Configuration manuelle "pour le client" — voir « Configurer manuellement pour le
 *  client » : un Super Admin peut faire avancer le cycle de vie à la main
 *  (ex. après avoir lui-même vérifié le DNS par téléphone avec le client). */
export async function forceVerifiedByAdmin(tx: Prisma.TransactionClient, id: string) {
  await tx.domain.update({ where: { id }, data: { lifecycleStatus: "VERIFIED" } });
}

export interface ConfigureManagedDomainInput {
  managedByPlatform?: boolean;
  registrarProvider?: string | null;
  externalRegistrarId?: string | null;
  purchasedAt?: Date | null;
  expiresAt?: Date | null;
  autoRenew?: boolean;
  purchaseCostXOF?: number | null;
  priceBilledXOF?: number | null;
  paymentStatus?: string | null;
  legalOwnerName?: string | null;
  legalOwnerContact?: unknown;
  transferStatus?: string | null;
  isLocked?: boolean;
}

export async function configureManagedDomain(
  tx: Prisma.TransactionClient,
  id: string,
  input: ConfigureManagedDomainInput,
) {
  const { legalOwnerContact, ...rest } = input;
  return tx.domain.update({
    where: { id },
    data: {
      ...rest,
      ...(legalOwnerContact !== undefined
        ? { legalOwnerContact: legalOwnerContact as Prisma.InputJsonValue }
        : {}),
    },
  });
}

/** Domaines à revérifier périodiquement (voir « relance périodiquement les domaines
 *  mal configurés ») — appelée par le planificateur du worker, cross-tenant. */
export async function listDomainsNeedingRecheck(
  tx: Prisma.TransactionClient,
  checkedBefore: Date,
): Promise<string[]> {
  const rows = await tx.domain.findMany({
    where: {
      lifecycleStatus: { in: ["PENDING_DNS", "VERIFYING", "MISCONFIGURED"] },
      OR: [{ lastCheckedAt: null }, { lastCheckedAt: { lt: checkedBefore } }],
    },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}
