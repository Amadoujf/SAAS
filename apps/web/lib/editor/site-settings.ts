import type { DesignTokensOverrides } from "@yamacommerce/design-tokens";

/**
 * Paramètres généraux du site — voir docs/12 §12.2, « Paramètres généraux du site »
 * (20 septembre 2026). `designTokenOverrides` réutilise EXACTEMENT le type déjà utilisé
 * par `TenantSite.designTokenOverrides` (voir @yamacommerce/database
 * `resolveEffectiveDesignTokens`/`mergeDesignTokens`) : la fusion appliquée par
 * l'éditeur est donc la MÊME que celle qui s'appliquera réellement une fois publiée,
 * pas une simulation séparée. Logo/favicon vivent sur `Tenant.branding` côté base
 * (hors du schéma `DesignTokens`, voir docs/04) — regroupés ici pour un seul panneau,
 * mais persistés séparément par l'appelant.
 */
export interface SiteSettings {
  logoUrl?: string;
  faviconUrl?: string;
  designTokenOverrides: DesignTokensOverrides;
}

export function createEmptySiteSettings(): SiteSettings {
  return { designTokenOverrides: {} };
}
