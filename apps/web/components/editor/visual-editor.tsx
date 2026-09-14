"use client";

import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { Reorder } from "framer-motion";
import { mergeDesignTokens, type AnimationLevel, type DesignTokens } from "@yamacommerce/design-tokens";
import type { ResolvedContentBySectionId } from "@/components/sections/section-renderer";
import type { Locale } from "@/lib/i18n";
import {
  canRedo,
  canUndo,
  createInitialHistory,
  editorHistoryReducer,
  getSelectedPage,
  getSelectedSection,
  type EditorContent,
} from "@/lib/editor/editor-reducer";
import { PreviewStage } from "./preview-stage";
import { SectionRow } from "./section-row";
import { ViewportToggle, type PreviewViewport } from "./viewport-toggle";
import { RedoIcon, UndoIcon } from "./editor-icons";
import { CustomizationPanel } from "./panels/customization-panel";

const VIEWPORT_WIDTH: Record<PreviewViewport, string> = {
  desktop: "100%",
  tablet: "768px",
  mobile: "390px",
};

let duplicateCounter = 0;
/** Identifiant de duplication — le réducteur reste pur (voir editor-reducer.ts), c'est
 *  donc l'appelant (ici) qui fournit un id garanti unique. */
function nextDuplicateId(sourceId: string): string {
  duplicateCounter += 1;
  return `${sourceId}-copie-${duplicateCounter}`;
}

export interface VisualEditorProps {
  initialContent: EditorContent;
  tokens: DesignTokens;
  animationLevel: AnimationLevel;
  locale?: Locale;
  resolvedContent?: ResolvedContentBySectionId;
  /** Rappels de persistance optionnels — l'éditeur reste utilisable sans backend
   *  branché (voir la démonstration statique) : sans ces props, "Enregistrer"/
   *  "Publier" se contentent d'un retour visuel local. Une vraie page de tableau de
   *  bord (Phase 1, une fois l'authentification branchée) passera ici les Server
   *  Actions qui appellent @yamacommerce/database `site-versions-registry.ts`. */
  onSaveDraft?: (content: EditorContent) => void | Promise<void>;
  onPublish?: (content: EditorContent) => void | Promise<void>;
}

/**
 * Éditeur visuel — voir docs/12 §12.2. Composant SECTOR-AGNOSTIC : il n'importe et ne
 * connaît que `SectionInstance`/`EditorPage` (voir @yamacommerce/templates et
 * lib/editor/editor-reducer.ts), le même contrat déjà utilisé par les 5 templates
 * e-commerce ET par n'importe quel futur secteur (immobilier, hôtellerie, etc.) — voir
 * la note de mémoire "project-multisector-saas-goal". Aucune donnée ni logique propre
 * à l'e-commerce n'apparaît ici.
 *
 * Depuis le 20 septembre 2026, inclut les panneaux avancés de personnalisation
 * (Contenu/Style/Espacement/Animation par section + Paramètres généraux du site, voir
 * `CustomizationPanel`) — toujours générés à partir des schémas (voir
 * lib/editor/schema-introspect.ts), jamais d'un champ codé en dur propre à un
 * template. Portée VOLONTAIREMENT arrêtée avant la médiathèque R2 et la publication
 * définitive (consigne du 20 septembre 2026).
 */
export function VisualEditor({
  initialContent,
  tokens,
  animationLevel,
  locale = "fr",
  resolvedContent,
  onSaveDraft,
  onPublish,
}: VisualEditorProps) {
  const [history, dispatch] = useReducer(
    editorHistoryReducer,
    createInitialHistory(initialContent),
  );
  const [viewport, setViewport] = useState<PreviewViewport>("desktop");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [panelMode, setPanelMode] = useState<"section" | "site">("section");

  // Cliché IMMUABLE du contenu tel que chargé — sert de référence pour "Retour aux
  // valeurs du template" (voir CustomizationPanel) : jamais réassigné après le montage,
  // contrairement à `history.present` qui change à chaque modification.
  const originalContentRef = useRef(initialContent);
  // Dernier contenu réellement enregistré (brouillon) — sert à la protection contre la
  // perte des modifications (voir l'écouteur `beforeunload` ci-dessous) : un simple
  // test de référence suffit puisque le réducteur ne mute jamais `content` en place.
  const lastSavedContentRef = useRef(initialContent);

  const content = history.present;
  const selectedPage = getSelectedPage(content);
  const selectedSection = getSelectedSection(content);
  const originalSection = selectedPage
    ? originalContentRef.current.pages
        .find((page) => page.id === selectedPage.id)
        ?.blocks.find((block) => block.id === selectedSection?.id)
    : undefined;
  const orderedBlocks = selectedPage
    ? [...selectedPage.blocks].sort((a, b) => a.order - b.order)
    : [];
  const orderedIds = orderedBlocks.map((block) => block.id);

  // Tokens EFFECTIFS du site édité — mêmes règles de fusion que le site publié (voir
  // `mergeDesignTokens`, @yamacommerce/design-tokens) : les "Paramètres généraux du
  // site" (palette/typographie/...) se reflètent donc immédiatement dans l'aperçu ET
  // dans les panneaux (ex. contraste WCAG), sans logique de simulation séparée.
  const effectiveTokens = useMemo(
    () => mergeDesignTokens(tokens, content.siteSettings.designTokenOverrides),
    [tokens, content.siteSettings.designTokenOverrides],
  );

  const isDirty = content !== lastSavedContentRef.current;

  useEffect(() => {
    if (!isDirty) return;
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  async function handleSave() {
    if (!onSaveDraft) {
      lastSavedContentRef.current = content;
      setSaveState("saved");
      window.setTimeout(() => setSaveState("idle"), 1600);
      return;
    }
    setSaveState("saving");
    await onSaveDraft(content);
    lastSavedContentRef.current = content;
    setSaveState("saved");
    window.setTimeout(() => setSaveState("idle"), 1600);
  }

  function selectSection(sectionId: string | null) {
    dispatch({ type: "SELECT_SECTION", sectionId });
    if (sectionId) setPanelMode("section");
  }

  return (
    // Chrome de l'éditeur en couleurs FIXES (gris/indigo neutres), volontairement
    // JAMAIS les tokens du tenant en cours d'édition — un outil d'administration doit
    // rester lisible et cohérent quel que soit le secteur/la palette du site ouvert
    // (comme Webflow/Shopify : seul l'aperçu, dans `PreviewStage`, reflète la marque du
    // tenant). Bug réel trouvé le 20 septembre 2026 en testant cette page : réutiliser
    // les classes `var(--color-*)` ici les laissait non résolues hors de tout élément
    // portant `designTokensToStyle()` — boutons invisibles (même famille de bug que
    // celui du 13 septembre 2026 sur Header/Footer, voir site-shell.tsx).
    <div className="flex h-full min-h-[720px] flex-col border border-gray-200 bg-white text-gray-800">
      {/* Barre d'outils générale — voir docs/12 §12.2, « interface générale ». */}
      <div className="flex flex-wrap items-center gap-3 border-b border-gray-200 bg-white px-4 py-2.5">
        <p className="text-[13px] font-semibold text-gray-800">Éditeur visuel</p>
        <div className="mx-1 h-5 w-px bg-gray-200" />
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => dispatch({ type: "UNDO" })}
            disabled={!canUndo(history)}
            aria-label="Annuler"
            className="rounded p-1.5 text-gray-500 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <UndoIcon />
          </button>
          <button
            type="button"
            onClick={() => dispatch({ type: "REDO" })}
            disabled={!canRedo(history)}
            aria-label="Rétablir"
            className="rounded p-1.5 text-gray-500 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <RedoIcon />
          </button>
        </div>

        <div className="ml-auto flex items-center gap-3">
          <ViewportToggle value={viewport} onChange={setViewport} />
          <div className="mx-1 h-5 w-px bg-gray-200" />
          <button
            type="button"
            onClick={handleSave}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-[12px] font-medium text-gray-700 hover:border-gray-400"
          >
            {saveState === "saving"
              ? "Enregistrement..."
              : saveState === "saved"
                ? "Brouillon enregistré ✓"
                : "Enregistrer le brouillon"}
          </button>
          <button
            type="button"
            onClick={() => onPublish?.(content)}
            className="rounded-md bg-indigo-600 px-3 py-1.5 text-[12px] font-medium text-white hover:bg-indigo-700"
          >
            Publier
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Colonne gauche : pages puis sections — voir docs/12 §12.2, « liste des
            pages », « liste des sections ». */}
        <div className="flex w-64 shrink-0 flex-col border-r border-gray-200 bg-gray-50">
          <div className="border-b border-gray-200 p-3">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-gray-400">
              Pages
            </p>
            <ul className="flex flex-col gap-1">
              {content.pages.map((page) => (
                <li key={page.id}>
                  <button
                    type="button"
                    onClick={() => dispatch({ type: "SELECT_PAGE", pageId: page.id })}
                    aria-current={page.id === content.selectedPageId}
                    className={`w-full rounded px-2.5 py-1.5 text-left text-[13px] transition-colors ${
                      page.id === content.selectedPageId
                        ? "bg-indigo-600 text-white"
                        : "text-gray-700 hover:bg-gray-100"
                    }`}
                  >
                    {page.title}
                    {page.isHome && (
                      <span
                        className={`ml-1.5 text-[10px] uppercase ${
                          page.id === content.selectedPageId ? "text-white/70" : "text-gray-400"
                        }`}
                      >
                        · accueil
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-gray-400">
              Sections {selectedPage ? `— ${selectedPage.title}` : ""}
            </p>
            {selectedPage && (
              <Reorder.Group
                as="ul"
                axis="y"
                values={orderedIds}
                onReorder={(newOrder) => {
                  if (!selectedPage) return;
                  dispatch({
                    type: "REORDER_SECTIONS",
                    pageId: selectedPage.id,
                    orderedIds: newOrder,
                  });
                }}
                className="flex flex-col gap-2"
              >
                {orderedBlocks.map((block) => (
                  <SectionRow
                    key={block.id}
                    block={block}
                    isSelected={block.id === content.selectedSectionId}
                    hasCustomization={
                      Boolean(block.styleOverride && Object.keys(block.styleOverride).length > 0) ||
                      Boolean(block.spacingOverride && Object.keys(block.spacingOverride).length > 0) ||
                      block.animationOverride !== "inherit" ||
                      Boolean(block.animationDetail)
                    }
                    onSelect={() => selectSection(block.id)}
                    onToggleEnabled={() =>
                      dispatch({
                        type: "TOGGLE_SECTION_ENABLED",
                        pageId: selectedPage.id,
                        sectionId: block.id,
                      })
                    }
                    onDuplicate={() =>
                      dispatch({
                        type: "DUPLICATE_SECTION",
                        pageId: selectedPage.id,
                        sectionId: block.id,
                        newId: nextDuplicateId(block.id),
                      })
                    }
                    onDelete={() =>
                      dispatch({
                        type: "DELETE_SECTION",
                        pageId: selectedPage.id,
                        sectionId: block.id,
                      })
                    }
                  />
                ))}
              </Reorder.Group>
            )}
          </div>
        </div>

        {/* Aperçu — voir docs/12 §12.2, « prévisualisation ordinateur/tablette/téléphone ».
            Tout ce qui est DANS `PreviewStage` porte en revanche les vrais tokens du
            tenant — c'est le point exprès où la marque du site édité doit apparaître. */}
        <div className="min-h-0 flex-1 overflow-y-auto bg-gray-100 p-6">
          {selectedPage && (
            <div
              className="mx-auto overflow-hidden rounded-md bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.06),0_12px_32px_rgba(0,0,0,0.12)] transition-[width] duration-300"
              style={{ width: VIEWPORT_WIDTH[viewport], maxWidth: "100%" }}
            >
              <PreviewStage
                page={selectedPage}
                tokens={effectiveTokens}
                animationLevel={animationLevel}
                locale={locale}
                resolvedContent={resolvedContent}
                selectedSectionId={content.selectedSectionId}
                onSelectSection={selectSection}
                viewport={viewport}
              />
            </div>
          )}
        </div>

        <CustomizationPanel
          mode={panelMode}
          onModeChange={setPanelMode}
          section={selectedSection}
          originalSection={originalSection}
          tokens={effectiveTokens}
          viewport={viewport}
          siteSettings={content.siteSettings}
          originalSiteSettings={originalContentRef.current.siteSettings}
          onUpdateParams={(params) => {
            if (!selectedPage || !selectedSection) return;
            dispatch({
              type: "UPDATE_SECTION_PARAMS",
              pageId: selectedPage.id,
              sectionId: selectedSection.id,
              params,
            });
          }}
          onUpdateStyle={(styleOverride) => {
            if (!selectedPage || !selectedSection) return;
            dispatch({
              type: "UPDATE_SECTION_STYLE_OVERRIDE",
              pageId: selectedPage.id,
              sectionId: selectedSection.id,
              styleOverride,
            });
          }}
          onUpdateSpacing={(spacingOverride) => {
            if (!selectedPage || !selectedSection) return;
            dispatch({
              type: "UPDATE_SECTION_SPACING_OVERRIDE",
              pageId: selectedPage.id,
              sectionId: selectedSection.id,
              spacingOverride,
            });
          }}
          onUpdateAnimation={(animationOverride, animationDetail) => {
            if (!selectedPage || !selectedSection) return;
            dispatch({
              type: "UPDATE_SECTION_ANIMATION",
              pageId: selectedPage.id,
              sectionId: selectedSection.id,
              animationOverride,
              animationDetail,
            });
          }}
          onUpdateSiteSettings={(siteSettings) => dispatch({ type: "UPDATE_SITE_SETTINGS", siteSettings })}
        />
      </div>
    </div>
  );
}
