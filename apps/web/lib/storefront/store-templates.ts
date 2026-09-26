import type { DesignTokens } from "@yamacommerce/design-tokens";
import { TERANGA_ATELIER_DESIGN_TOKENS } from "@/lib/demo/teranga-atelier-template";
import { COMMERCE_MODERNE_DESIGN_TOKENS } from "@/lib/demo/commerce-moderne-template";
import { LUXURY_MINIMAL_DESIGN_TOKENS } from "@/lib/demo/luxury-minimal-template";
import { MARKETPLACE_DESIGN_TOKENS } from "@/lib/demo/marketplace-template";
import { DAKAR_DISTRIBUTION_DESIGN_TOKENS } from "@/lib/demo/dakar-distribution-pro-template";
import { ATELIER_NAYA_TOKENS, SUNU_MARCHE_TOKENS } from "./commerce-templates";

/** Directions artistiques disponibles à l'onboarding — les design tokens COMPLETS
 *  des 5 templates du projet. Choisir un style applique immédiatement ses couleurs,
 *  typographies et rayons aux pages commerce de la boutique (voir `resolveStore`),
 *  tant qu'aucun site n'est publié depuis l'éditeur. */
/** `layout` : composition de la page d'accueil de la boutique — « market » (univers,
 *  grandes sélections) ou « editorial » (grand titre, compositions asymétriques). */
export type StoreLayout = "market" | "editorial";

export const STORE_TEMPLATES: { slug: string; name: string; tagline: string; layout: StoreLayout; tokens: DesignTokens }[] = [
  { slug: "sunu-marche", name: "Sunu Marché", tagline: "Maison, déco & quotidien", layout: "market", tokens: SUNU_MARCHE_TOKENS },
  { slug: "atelier-naya", name: "Atelier Naya", tagline: "Mode éditoriale", layout: "editorial", tokens: ATELIER_NAYA_TOKENS },
  { slug: "teranga-atelier", name: "Atelier", tagline: "Éditorial & artisanal", layout: "editorial", tokens: TERANGA_ATELIER_DESIGN_TOKENS },
  { slug: "commerce-moderne", name: "Impact", tagline: "Moderne & audacieux", layout: "market", tokens: COMMERCE_MODERNE_DESIGN_TOKENS },
  { slug: "luxury-minimal", name: "Maison", tagline: "Luxe minimaliste", layout: "editorial", tokens: LUXURY_MINIMAL_DESIGN_TOKENS },
  { slug: "marketplace", name: "Marché", tagline: "Grand catalogue", layout: "market", tokens: MARKETPLACE_DESIGN_TOKENS },
  { slug: "dakar-distribution-pro", name: "Pro", tagline: "Grossiste & B2B", layout: "market", tokens: DAKAR_DISTRIBUTION_DESIGN_TOKENS },
];

export function templateLayout(slug: string | null | undefined): StoreLayout {
  return STORE_TEMPLATES.find((t) => t.slug === slug)?.layout ?? "market";
}

export function templateTokens(slug: string | null | undefined): DesignTokens | null {
  return STORE_TEMPLATES.find((t) => t.slug === slug)?.tokens ?? null;
}
