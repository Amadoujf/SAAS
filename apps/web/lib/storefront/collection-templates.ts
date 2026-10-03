import type { DesignTokens } from "@yamacommerce/design-tokens";
import { LUXURY_MINIMAL_DESIGN_TOKENS } from "@/lib/demo/luxury-minimal-template";
import { COMMERCE_MODERNE_DESIGN_TOKENS } from "@/lib/demo/commerce-moderne-template";

/**
 * Styles des directions « sculpturale » et « studio » (1er octobre 2026) : des surfaces
 * propres (pierre froide et ciel pâle ; blanc et cobalt), pour que les trois directions
 * ne partagent pas la même ambiance beige. Typographie et formes : celles de la direction.
 */
export const SOCLE_TOKENS: DesignTokens = {
  ...LUXURY_MINIMAL_DESIGN_TOKENS,
  colors: {
    ...LUXURY_MINIMAL_DESIGN_TOKENS.colors,
    primary: "#1C2733",
    secondary: "#9A5B34",
    background: "#F5F6F4",
    surface: "#E8ECEB",
    surfaceMuted: "#D9E2E7",
    textPrimary: "#141A21",
    textSecondary: "#47525D",
    textMuted: "#76818B",
    border: "#D3D9DC",
    accentPrimary: "#9A5B34",
    accentSecondary: "#1C2733",
  },
};

export const STUDIO_TOKENS: DesignTokens = {
  ...COMMERCE_MODERNE_DESIGN_TOKENS,
  colors: {
    ...COMMERCE_MODERNE_DESIGN_TOKENS.colors,
    primary: "#1F3FD1",
    secondary: "#0B0B0F",
    background: "#FFFFFF",
    surface: "#F2F3F7",
    surfaceMuted: "#E6E9F3",
    textPrimary: "#0B0B0F",
    textSecondary: "#3A3D4A",
    textMuted: "#6A6E7C",
    border: "#D8DBE4",
    accentPrimary: "#1F3FD1",
    accentSecondary: "#0B0B0F",
  },
};
