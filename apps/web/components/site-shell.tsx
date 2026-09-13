import type { AnimationLevel, DesignTokens } from "@yamacommerce/design-tokens";
import { designTokensToStyle } from "@/lib/design-tokens-to-css";
import { AnimationLevelProvider } from "@/lib/motion/animation-level-context";
import { CustomCursor } from "@/components/ui/custom-cursor";
import { LocaleProvider } from "@/lib/locale-context";
import { CartProvider, type CartLine } from "@/lib/commerce/cart-context";
import { FavoritesProvider } from "@/lib/commerce/favorites-context";
import type { Locale } from "@/lib/i18n";

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
 *
 * Fournit aussi la langue, le panier et les favoris (voir la revue du 16 septembre
 * 2026, point 2) : un seul endroit central pour ces états partagés entre `Header`, le
 * contenu de la page et `Footer`.
 */
export function SiteShell({
  tokens,
  animationLevel,
  initialLocale = "fr",
  initialCartLines = [],
  children,
}: {
  tokens: DesignTokens;
  animationLevel: AnimationLevel;
  initialLocale?: Locale;
  initialCartLines?: CartLine[];
  children: React.ReactNode;
}) {
  return (
    <div
      style={designTokensToStyle(tokens)}
      className="bg-[var(--color-background)] text-[var(--color-text-primary)]"
    >
      <LocaleProvider initialLocale={initialLocale}>
        <CartProvider initialLines={initialCartLines}>
          <FavoritesProvider>
            <AnimationLevelProvider level={animationLevel}>
              <CustomCursor />
              {children}
            </AnimationLevelProvider>
          </FavoritesProvider>
        </CartProvider>
      </LocaleProvider>
    </div>
  );
}
