import type { Prisma } from "@prisma/client";
import {
  DEFAULT_DESIGN_TOKENS,
  designTokensSchema,
  mergeDesignTokens,
  type AnimationLevel,
  type DesignTokens,
  type DesignTokensOverrides,
} from "@yamacommerce/design-tokens";
import { validateTemplateManifest, type TemplateManifest } from "@yamacommerce/templates";

/**
 * Registre de templates — voir docs/12-systeme-templates-et-direction-artistique.md.
 *
 * Règle structurante : un `SiteTemplate` ne porte jamais de donnée métier. Changer de
 * template pour un tenant ne fait donc que réécrire `TenantSite.templateId` — les
 * tables `Product`, `Order`, `Customer`, etc. ne sont jamais référencées ici et ne
 * peuvent donc jamais être affectées par une opération de ce module.
 */

export interface CreateTemplateInput {
  key: string;
  name: string;
  sectorKey: string;
  description?: string;
  artDirectionKey: string;
  previewImageUrl?: string;
  pageManifest: TemplateManifest;
  availableSectionKeys?: string[];
  requiredModuleKeys?: string[];
  optionalModuleKeys?: string[];
  defaultDesignTokens: DesignTokens;
  defaultAnimationLevel?: AnimationLevel;
  mobileCompatible?: boolean;
  demoData?: unknown;
}

/**
 * Crée (ou met à jour, par clé stable) un template. Valide systématiquement le
 * manifeste de pages/sections et les tokens de design AVANT toute écriture — jamais de
 * JSON non validé stocké en base (exigence de la validation du 13 septembre 2026).
 */
export async function upsertTemplate(tx: Prisma.TransactionClient, input: CreateTemplateInput) {
  // Le résultat de Zod (objet fortement typé, sans signature d'index) ne satisfait pas
  // structurellement `Prisma.InputJsonValue` — cast explicite, sûr puisque la valeur
  // vient d'être validée par le schéma juste au-dessus (jamais un JSON non contrôlé).
  const validatedManifest = validateTemplateManifest(
    input.pageManifest,
  ) as unknown as Prisma.InputJsonValue;
  const validatedTokens = designTokensSchema.parse(
    input.defaultDesignTokens,
  ) as unknown as Prisma.InputJsonValue;

  return tx.siteTemplate.upsert({
    where: { key: input.key },
    update: {
      name: input.name,
      sectorKey: input.sectorKey,
      description: input.description,
      artDirectionKey: input.artDirectionKey,
      previewImageUrl: input.previewImageUrl,
      pageManifest: validatedManifest,
      availableSectionKeys: input.availableSectionKeys ?? [],
      requiredModuleKeys: input.requiredModuleKeys ?? [],
      optionalModuleKeys: input.optionalModuleKeys ?? [],
      defaultDesignTokens: validatedTokens,
      defaultAnimationLevel: input.defaultAnimationLevel ?? "dynamic",
      mobileCompatible: input.mobileCompatible ?? true,
      demoData: input.demoData as Prisma.InputJsonValue,
    },
    create: {
      key: input.key,
      name: input.name,
      sectorKey: input.sectorKey,
      description: input.description,
      artDirectionKey: input.artDirectionKey,
      previewImageUrl: input.previewImageUrl,
      pageManifest: validatedManifest,
      availableSectionKeys: input.availableSectionKeys ?? [],
      requiredModuleKeys: input.requiredModuleKeys ?? [],
      optionalModuleKeys: input.optionalModuleKeys ?? [],
      defaultDesignTokens: validatedTokens,
      defaultAnimationLevel: input.defaultAnimationLevel ?? "dynamic",
      mobileCompatible: input.mobileCompatible ?? true,
      demoData: input.demoData as Prisma.InputJsonValue,
      status: "draft",
    },
  });
}

export async function publishTemplate(tx: Prisma.TransactionClient, templateId: string) {
  return tx.siteTemplate.update({ where: { id: templateId }, data: { status: "published" } });
}

export async function archiveTemplate(tx: Prisma.TransactionClient, templateId: string) {
  return tx.siteTemplate.update({ where: { id: templateId }, data: { status: "archived" } });
}

export async function getPublishedTemplatesForSector(
  tx: Prisma.TransactionClient,
  sectorKey: string,
) {
  return tx.siteTemplate.findMany({ where: { sectorKey, status: "published" } });
}

/**
 * Attribue un template à un tenant. Si le tenant a déjà un site, **change** son
 * template (voir docs/12 §12.1 : « changer de template ne fait jamais perdre une
 * donnée ») : cette fonction ne touche jamais aux tables métier (Product, Order,
 * Customer…) — seule la ligne `TenantSite` est écrite. Les surcharges de tokens sont
 * réinitialisées car elles étaient calibrées pour l'ancien template.
 */
export async function assignTemplateToTenant(
  tx: Prisma.TransactionClient,
  tenantId: string,
  templateId: string,
) {
  return tx.tenantSite.upsert({
    where: { tenantId },
    update: { templateId, designTokenOverrides: {}, animationLevelOverride: null },
    create: { tenantId, templateId, designTokenOverrides: {} },
  });
}

/**
 * Calcule les tokens effectifs d'un tenant : ceux de son template, fusionnés avec ses
 * propres surcharges (jamais l'inverse — voir @yamacommerce/design-tokens `mergeDesignTokens`).
 * Retourne les tokens par défaut de la plateforme si le tenant n'a pas encore de site.
 */
export async function resolveEffectiveDesignTokens(
  tx: Prisma.TransactionClient,
  tenantId: string,
): Promise<DesignTokens> {
  const tenantSite = await tx.tenantSite.findUnique({
    where: { tenantId },
    include: { template: true },
  });
  if (!tenantSite) return DEFAULT_DESIGN_TOKENS;

  const templateTokens = designTokensSchema.parse(tenantSite.template.defaultDesignTokens);
  const overrides = tenantSite.designTokenOverrides as DesignTokensOverrides;
  return mergeDesignTokens(templateTokens, overrides);
}

export async function resolveEffectiveAnimationLevel(
  tx: Prisma.TransactionClient,
  tenantId: string,
): Promise<AnimationLevel> {
  const tenantSite = await tx.tenantSite.findUnique({
    where: { tenantId },
    include: { template: true },
  });
  if (!tenantSite) return "dynamic";
  return (
    (tenantSite.animationLevelOverride as AnimationLevel | null) ??
    (tenantSite.template.defaultAnimationLevel as AnimationLevel)
  );
}
