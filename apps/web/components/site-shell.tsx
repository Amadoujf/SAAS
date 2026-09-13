import type { AnimationLevel, DesignTokens } from "@yamacommerce/design-tokens";
import { designTokensToStyle } from "@/lib/design-tokens-to-css";
import { AnimationLevelProvider } from "@/lib/motion/animation-level-context";

/**
 * Périmètre des design tokens pour TOUTE la page — en-tête et pied de page compris,
 * pas seulement les sections rendues par `RenderTemplatePage`.
 *
 * Bug corrigé le 13 septembre 2026 : `Header`/`Footer` posés en dehors de tout élément
 * portant les variables CSS de tokens se retrouvaient avec des `var(--color-*)` non
 * résolues (fond transparent au lieu de la couleur du thème) puisque les variables CSS
 * personnalisées ne sont visibles que par les DESCENDANTS de l'élément qui les
 * déclare. Toute page qui assemble Header + contenu + Footer DOIT les envelopper
 * ensemble dans `<SiteShell>` — jamais seulement le contenu central.
 */
export function SiteShell({
  tokens,
  animationLevel,
  children,
}: {
  tokens: DesignTokens;
  animationLevel: AnimationLevel;
  children: React.ReactNode;
}) {
  return (
    <div
      style={designTokensToStyle(tokens)}
      className="bg-[var(--color-background)] text-[var(--color-text-primary)]"
    >
      <AnimationLevelProvider level={animationLevel}>{children}</AnimationLevelProvider>
    </div>
  );
}
