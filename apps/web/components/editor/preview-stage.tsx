"use client";

import type { AnimationLevel, DesignTokens } from "@yamacommerce/design-tokens";
import { designTokensToStyle } from "@/lib/design-tokens-to-css";
import { AnimationLevelProvider } from "@/lib/motion/animation-level-context";
import {
  SectionRenderer,
  type ResolvedContentBySectionId,
} from "@/components/sections/section-renderer";
import { LocaleProvider } from "@/lib/locale-context";
import { CurrencyProvider } from "@/lib/commerce/currency-context";
import { CartProvider } from "@/lib/commerce/cart-context";
import { FavoritesProvider } from "@/lib/commerce/favorites-context";
import type { Locale } from "@/lib/i18n";
import type { EditorPage } from "@/lib/editor/editor-reducer";

/**
 * Scène de prévisualisation de l'éditeur — VOLONTAIREMENT distincte de
 * `RenderTemplatePage` (composant partagé par les 5 templates déjà livrés) plutôt que
 * de le modifier : elle a besoin d'entourer chaque section d'un conteneur cliquable/
 * surlignable, une préoccupation propre à l'éditeur qui n'a rien à faire dans le
 * moteur de rendu public. Réutilise en revanche EXACTEMENT le même `SectionRenderer`
 * — c'est le même rendu qu'un vrai visiteur verrait, jamais une maquette séparée.
 *
 * Fournit elle-même les contextes que certaines sections consomment (panier, favoris,
 * devise, langue) — `RenderTemplatePage` ne les fournit pas non plus, c'est
 * normalement le rôle de `SiteShell` (en-tête/pied de page compris), volontairement
 * absents ici : l'éditeur prévisualise le CONTENU de page, pas le chrome du site.
 */
export function PreviewStage({
  page,
  tokens,
  animationLevel,
  locale = "fr",
  resolvedContent,
  selectedSectionId,
  onSelectSection,
  viewport,
}: {
  page: EditorPage;
  tokens: DesignTokens;
  animationLevel: AnimationLevel;
  locale?: Locale;
  resolvedContent?: ResolvedContentBySectionId;
  selectedSectionId: string | null;
  onSelectSection: (sectionId: string) => void;
  /** Voir `SectionRenderer`'s `forcePreviewViewport` — applique directement
   *  l'espacement du point de rupture affiché, fiable même si cette boîte n'est pas
   *  un vrai viewport redimensionné (voir la limite assumée dans
   *  lib/editor/section-style.ts). */
  viewport?: "desktop" | "tablet" | "mobile";
}) {
  const sortedBlocks = [...page.blocks].sort((a, b) => a.order - b.order);

  return (
    <LocaleProvider initialLocale={locale}>
      <CurrencyProvider>
        <CartProvider>
          <FavoritesProvider>
            <div
              style={designTokensToStyle(tokens)}
              className="bg-[var(--color-background)] text-[var(--color-text-primary)]"
            >
              <AnimationLevelProvider level={animationLevel}>
                {sortedBlocks.map((block) => {
                  const isSelected = block.id === selectedSectionId;
                  return (
                    <div
                      key={block.id}
                      role="button"
                      tabIndex={0}
                      aria-pressed={isSelected}
                      aria-label={`Sélectionner la section ${block.sectionKey}`}
                      onClick={() => onSelectSection(block.id)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          onSelectSection(block.id);
                        }
                      }}
                      className={`relative cursor-pointer outline outline-2 -outline-offset-2 transition-colors ${
                        isSelected
                          ? "outline-[#3B82F6]"
                          : "outline-transparent hover:outline-[#3B82F6]/40"
                      }`}
                    >
                      {isSelected && (
                        <span className="pointer-events-none absolute left-2 top-2 z-20 rounded bg-[#3B82F6] px-2 py-0.5 text-[11px] font-medium text-white">
                          {block.sectionKey} · {block.variant}
                        </span>
                      )}
                      <SectionRenderer
                        instance={block}
                        locale={locale}
                        resolvedContent={resolvedContent}
                        tokens={tokens}
                        forcePreviewViewport={viewport}
                      />
                    </div>
                  );
                })}
              </AnimationLevelProvider>
            </div>
          </FavoritesProvider>
        </CartProvider>
      </CurrencyProvider>
    </LocaleProvider>
  );
}
