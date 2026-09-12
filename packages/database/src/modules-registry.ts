import type { Prisma } from "@prisma/client";

/**
 * Registre secteurs/modules — voir docs/11-secteurs-et-modules.md.
 *
 * Toute la logique d'activation des modules par entreprise passe par ce module :
 * jamais de vérification "en dur" du secteur dans le code applicatif (dashboard,
 * navigation, permissions) — toujours une consultation de `TenantModule`.
 */

export interface EnabledModule {
  moduleKey: string;
  source: string;
  config: unknown;
}

/** Modules réellement actifs pour un tenant — c'est la seule source de vérité que le
 *  dashboard, la navigation et les permissions doivent consulter. */
export async function getEnabledModules(
  tx: Prisma.TransactionClient,
  tenantId: string,
): Promise<EnabledModule[]> {
  const rows = await tx.tenantModule.findMany({
    where: { tenantId, isEnabled: true },
    select: { moduleKey: true, source: true, config: true },
  });
  return rows;
}

export async function isModuleEnabled(
  tx: Prisma.TransactionClient,
  tenantId: string,
  moduleKey: string,
): Promise<boolean> {
  const row = await tx.tenantModule.findUnique({
    where: { tenantId_moduleKey: { tenantId, moduleKey } },
  });
  return row?.isEnabled ?? false;
}

/**
 * Active les modules par défaut d'un secteur pour un tenant (à la création, ou lors
 * d'un changement de secteur — voir docs/11 §11.6, règle 5 : aucune donnée n'est
 * supprimée, seule la liste des modules proposés par défaut change).
 *
 * Idempotent : un module déjà activé pour ce tenant n'est jamais écrasé (préserve un
 * éventuel `source: "manual"` ou une désactivation volontaire du propriétaire).
 */
export async function activateSectorDefaults(
  tx: Prisma.TransactionClient,
  tenantId: string,
  sectorKey: string,
): Promise<void> {
  const sector = await tx.sector.findUnique({ where: { key: sectorKey } });
  if (!sector) {
    throw new Error(`Secteur inconnu : "${sectorKey}". Le registre doit être seedé avant usage.`);
  }

  for (const moduleKey of sector.defaultModuleKeys) {
    const existing = await tx.tenantModule.findUnique({
      where: { tenantId_moduleKey: { tenantId, moduleKey } },
    });
    if (existing) continue;

    await tx.tenantModule.create({
      data: { tenantId, moduleKey, isEnabled: true, source: "sector_default" },
    });
  }

  // Les modules "core" sont actifs pour tout le monde par construction — voir
  // docs/11 §11.2 — et n'ont donc pas besoin d'une ligne TenantModule pour être
  // considérés actifs par le reste du code (voir isCoreModule ci-dessous).
}

/**
 * Active/désactive manuellement un module pour un tenant. Refuse explicitement de
 * désactiver un module core (voir docs/11 §11.6, règle 3).
 */
export async function setModuleEnabled(
  tx: Prisma.TransactionClient,
  params: { tenantId: string; moduleKey: string; isEnabled: boolean; source?: string },
): Promise<void> {
  const moduleDef = await tx.module.findUnique({ where: { key: params.moduleKey } });
  if (!moduleDef) {
    throw new Error(`Module inconnu : "${params.moduleKey}".`);
  }
  if (moduleDef.category === "core" && !params.isEnabled) {
    throw new Error(`Le module core "${params.moduleKey}" ne peut pas être désactivé.`);
  }

  await tx.tenantModule.upsert({
    where: { tenantId_moduleKey: { tenantId: params.tenantId, moduleKey: params.moduleKey } },
    create: {
      tenantId: params.tenantId,
      moduleKey: params.moduleKey,
      isEnabled: params.isEnabled,
      source: params.source ?? "manual",
    },
    update: { isEnabled: params.isEnabled, source: params.source ?? "manual" },
  });
}
