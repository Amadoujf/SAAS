import type { AnimationLevel, DesignTokens } from "@yamacommerce/design-tokens";
import { designTokensToStyle } from "@/lib/design-tokens-to-css";
import { templateFontVariables } from "@/lib/storefront/template-fonts";
import { AnimationLevelProvider } from "@/lib/motion/animation-level-context";
import { LocaleProvider } from "@/lib/locale-context";
import { CartProvider, type CartLine } from "@/lib/commerce/cart-context";
import { FavoritesProvider } from "@/lib/commerce/favorites-context";
import { CurrencyProvider, type Currency } from "@/lib/commerce/currency-context";
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
  initialCurrency = "FCFA",
  children,
}: {
  tokens: DesignTokens;
  animationLevel: AnimationLevel;
  initialLocale?: Locale;
  initialCartLines?: CartLine[];
  /** Devise d'affichage initiale — voir lib/commerce/currency-context.tsx. La plupart
   *  des templates n'exposent pas de sélecteur et restent en FCFA ; ce provider reste
   *  systématique pour que tout futur secteur/template puisse l'utiliser sans changer
   *  `SiteShell`. */
  initialCurrency?: Currency;
  children: React.ReactNode;
}) {
  return (
    <div
      style={designTokensToStyle(tokens)}
      className={`${templateFontVariables} bg-[var(--color-background)] font-[family-name:var(--font-body)] text-[var(--color-text-primary)]`}
    >
      <LocaleProvider initialLocale={initialLocale}>
        <CurrencyProvider initialCurrency={initialCurrency}>
          <CartProvider initialLines={initialCartLines}>
            <FavoritesProvider>
              <AnimationLevelProvider level={animationLevel} mobile={tokens.animation.mobile}>
                {children}
              </AnimationLevelProvider>
            </FavoritesProvider>
          </CartProvider>
        </CurrencyProvider>
      </LocaleProvider>
    </div>
  );
}
