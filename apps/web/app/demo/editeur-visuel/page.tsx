import type { Metadata } from "next";
import { VisualEditor } from "@/components/editor/visual-editor";
import {
  DEMO_MANIFEST,
  DEMO_RESOLVED_CONTENT,
  LUXURY_MINIMAL_DESIGN_TOKENS,
} from "@/lib/demo/luxury-minimal-template";
import type { EditorContent } from "@/lib/editor/editor-reducer";

/**
 * Démonstration de l'éditeur visuel (Phase 1, étape 5 — voir docs/12 §12.2) —
 * fonctionne ENTIÈREMENT côté client, sans base de données, exactement comme les 5
 * démonstrations de template (`/demo/*`) : vérifiable dans n'importe quel
 * environnement, y compris sans PostgreSQL local (voir la note de limitation du 20
 * septembre 2026 sur la fondation `TenantSiteVersion`/`Page`).
 *
 * Contenu de démonstration réutilisé depuis le template « Luxe minimaliste » (déjà
 * validé, 16 sections dont plusieurs propres à ce template) — mais `VisualEditor`
 * lui-même ne sait rien de l'e-commerce : il n'opère que sur `SectionInstance` (voir
 * @yamacommerce/templates), le même contrat que n'importe quel futur secteur. Une
 * vraie page de tableau de bord (une fois l'authentification branchée) passera ici les
 * VRAIES pages du tenant (via `getOrCreateDraftVersion`) et de vraies Server Actions
 * en `onSaveDraft`/`onPublish` au lieu du retour visuel local ci-dessous.
 */
export const metadata: Metadata = {
  title: "Éditeur visuel — démonstration",
  robots: { index: false, follow: false },
};

export default function VisualEditorDemoPage() {
  const initialContent: EditorContent = {
    selectedPageId: DEMO_MANIFEST.pages[0]!.slug,
    selectedSectionId: null,
    pages: DEMO_MANIFEST.pages.map((page) => ({
      id: page.slug,
      slug: page.slug,
      title: page.title,
      isHome: page.isHome,
      blocks: page.sections,
    })),
  };

  return (
    <div className="h-screen p-4">
      <VisualEditor
        initialContent={initialContent}
        tokens={LUXURY_MINIMAL_DESIGN_TOKENS}
        animationLevel={LUXURY_MINIMAL_DESIGN_TOKENS.animation.level}
        resolvedContent={DEMO_RESOLVED_CONTENT}
      />
    </div>
  );
}
