import type { DesignTokens } from "@yamacommerce/design-tokens";
import { TERANGA_ATELIER_DESIGN_TOKENS } from "@/lib/demo/teranga-atelier-template";
import { COMMERCE_MODERNE_DESIGN_TOKENS } from "@/lib/demo/commerce-moderne-template";
import { LUXURY_MINIMAL_DESIGN_TOKENS } from "@/lib/demo/luxury-minimal-template";
import { MARKETPLACE_DESIGN_TOKENS } from "@/lib/demo/marketplace-template";
import { DAKAR_DISTRIBUTION_DESIGN_TOKENS } from "@/lib/demo/dakar-distribution-pro-template";

/** Directions artistiques disponibles à l'onboarding — les design tokens COMPLETS
 *  des 5 templates du projet. Choisir un style applique immédiatement ses couleurs,
 *  typographies et rayons aux pages commerce de la boutique (voir `resolveStore`),
 *  tant qu'aucun site n'est publié depuis l'éditeur. */
export const STORE_TEMPLATES: { slug: string; name: string; tagline: string; tokens: DesignTokens }[] = [
  { slug: "teranga-atelier", name: "Atelier", tagline: "Éditorial & artisanal", tokens: TERANGA_ATELIER_DESIGN_TOKENS },
  { slug: "commerce-moderne", name: "Impact", tagline: "Moderne & audacieux", tokens: COMMERCE_MODERNE_DESIGN_TOKENS },
  { slug: "luxury-minimal", name: "Maison", tagline: "Luxe minimaliste", tokens: LUXURY_MINIMAL_DESIGN_TOKENS },
  { slug: "marketplace", name: "Marché", tagline: "Grand catalogue", tokens: MARKETPLACE_DESIGN_TOKENS },
  { slug: "dakar-distribution-pro", name: "Pro", tagline: "Grossiste & B2B", tokens: DAKAR_DISTRIBUTION_DESIGN_TOKENS },
];

export function templateTokens(slug: string | null | undefined): DesignTokens | null {
  return STORE_TEMPLATES.find((t) => t.slug === slug)?.tokens ?? null;
}
