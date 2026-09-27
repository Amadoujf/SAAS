import type { Prisma } from "@prisma/client";

/**
 * Personnalisation de la boutique : identité (nom affiché = nom de l'entreprise, logo,
 * couleurs, template) dans `Tenant.branding`, et contenus mis en avant dans
 * `StorefrontContent`. La validation du contenu (schéma Zod) est faite par l'appelant
 * AVANT d'arriver ici — ce module ne fait que lire/écrire sous RLS.
 */

export interface TenantBrandingPatch {
  templatePreference?: string;
  logoUrl?: string | null;
  logoMediaAssetId?: string | null;
  primaryColor?: string | null;
  accentColor?: string | null;
  backgroundColor?: string | null;
}

export async function getStorefrontCustomization(tx: Prisma.TransactionClient, tenantId: string) {
  const [tenant, content] = await Promise.all([
    tx.tenant.findUnique({ where: { id: tenantId }, select: { name: true, branding: true } }),
    tx.storefrontContent.findUnique({ where: { tenantId } }),
  ]);
  return {
    tenantName: tenant?.name ?? "",
    branding: ((tenant?.branding ?? {}) as Record<string, unknown>),
    content: (content?.content ?? null) as unknown,
    updatedAt: content?.updatedAt ?? null,
  };
}

export async function updateTenantBranding(tx: Prisma.TransactionClient, tenantId: string, patch: TenantBrandingPatch) {
  const tenant = await tx.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { branding: true } });
  const current = (tenant.branding ?? {}) as Record<string, unknown>;
  const next: Record<string, unknown> = { ...current };
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    if (value === null) delete next[key];
    else next[key] = value;
  }
  await tx.tenant.update({ where: { id: tenantId }, data: { branding: next as Prisma.InputJsonValue } });
  return next;
}

export async function saveStorefrontContent(tx: Prisma.TransactionClient, tenantId: string, content: Prisma.InputJsonValue, userId: string | null) {
  return tx.storefrontContent.upsert({
    where: { tenantId },
    update: { content, updatedBy: userId },
    create: { tenantId, content, updatedBy: userId },
  });
}
