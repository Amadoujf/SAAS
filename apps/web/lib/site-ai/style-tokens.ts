import type { DesignTokens } from "@yamacommerce/design-tokens";
import { templateTokens } from "@/lib/storefront/store-templates";
import { BRAISE_TOKENS } from "@/lib/restaurant/restaurant-templates";

/** Styles de secteur hors boutique utilisables par l'assistant (le secteur impose le sien). */
export const SECTOR_STYLES: Record<string, DesignTokens> = { braise: BRAISE_TOKENS };

/** Tokens d'un style : modèle de boutique, ou style propre à un secteur (Braise…). */
export function siteStyleTokens(slug: string | null | undefined): DesignTokens | null {
  return templateTokens(slug) ?? (slug ? (SECTOR_STYLES[slug] ?? null) : null);
}
