import type { DesignTokens, AnimationLevel } from "@yamacommerce/design-tokens";
import type { PageDefinition } from "@yamacommerce/templates";
import { designTokensToStyle } from "@/lib/design-tokens-to-css";
import { AnimationLevelProvider } from "@/lib/motion/animation-level-context";
import {
  SectionRenderer,
  type ResolvedContentBySectionId,
} from "@/components/sections/section-renderer";
import type { Locale } from "@/lib/i18n";

/**
 * Cœur du moteur de rendu — voir docs/09-plan-developpement.md, Phase 1, « moteur de
 * rendu des templates ». Un Server Component pur : lit une page déjà résolue (manifeste
 * + tokens + niveau d'animation + locale), l'affiche dans l'ordre défini, chaque
 * section étant revalidée et isolée par `SectionRenderer`.
 *
 * Ne résout JAMAIS lui-même le tenant, les tokens ou le contenu catalogue — cette
 * fonction reçoit tout en argument, déjà scoping-vérifié par l'appelant (voir
 * `lib/rendering/resolve-tenant-site.ts` pour le chemin réel par tenant, ou
 * `lib/demo/*` pour une démonstration statique). C'est ce qui rend le moteur
 * entièrement testable sans base de données.
 */
export function RenderTemplatePage({
  page,
  tokens,
  animationLevel,
  locale,
  resolvedContent,
}: {
  page: PageDefinition;
  tokens: DesignTokens;
  animationLevel: AnimationLevel;
  locale: Locale;
  resolvedContent?: ResolvedContentBySectionId;
}) {
  const sortedSections = [...page.sections].sort((a, b) => a.order - b.order);

  return (
    <div
      style={designTokensToStyle(tokens)}
      className="bg-[var(--color-background)] text-[var(--color-text-primary)]"
    >
      <AnimationLevelProvider level={animationLevel}>
        {sortedSections.map((section) => (
          <SectionRenderer
            key={section.id}
            instance={section}
            locale={locale}
            resolvedContent={resolvedContent}
          />
        ))}
      </AnimationLevelProvider>
    </div>
  );
}
