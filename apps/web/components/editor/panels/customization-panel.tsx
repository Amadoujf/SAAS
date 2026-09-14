"use client";

import { useState } from "react";
import type { DesignTokens } from "@yamacommerce/design-tokens";
import type { SectionInstance } from "@yamacommerce/templates";
import type { SpacingBreakpoint } from "@/lib/editor/device-presets";
import type { SiteSettings } from "@/lib/editor/site-settings";
import { ContentPanel } from "./content-panel";
import { StylePanel } from "./style-panel";
import { SpacingPanel } from "./spacing-panel";
import { AnimationPanel } from "./animation-panel";
import { SiteSettingsPanel } from "./site-settings-panel";

type Tab = "content" | "style" | "spacing" | "animation";

const TABS: { id: Tab; label: string }[] = [
  { id: "content", label: "Contenu" },
  { id: "style", label: "Style" },
  { id: "spacing", label: "Espacement" },
  { id: "animation", label: "Animation" },
];

function hasCustomization(section: SectionInstance, tab: Tab): boolean {
  switch (tab) {
    case "style":
      return Boolean(section.styleOverride && Object.keys(section.styleOverride).length > 0);
    case "spacing":
      return Boolean(section.spacingOverride && Object.keys(section.spacingOverride).length > 0);
    case "animation":
      return section.animationOverride !== "inherit" || Boolean(section.animationDetail);
    case "content":
      return false; // le contenu EST le template — pas de notion de "surcharge" distincte ici
  }
}

/**
 * Conteneur des panneaux avancés de personnalisation — voir docs/12 §12.2. Bascule
 * entre l'édition d'UNE section (sélectionnée dans la liste ou directement dans
 * l'aperçu, voir visual-editor.tsx) et les "Paramètres généraux du site". Ne connaît
 * aucun champ propre à une section : délègue entièrement à `ContentPanel` (généré
 * depuis le schéma de la section) et aux panneaux Style/Espacement/Animation (générés
 * depuis les 3 schémas de surcharge génériques, communs à toutes les sections).
 */
export function CustomizationPanel({
  mode,
  onModeChange,
  section,
  originalSection,
  tokens,
  viewport,
  siteSettings,
  originalSiteSettings,
  onUpdateParams,
  onUpdateStyle,
  onUpdateSpacing,
  onUpdateAnimation,
  onUpdateSiteSettings,
  mediaApiBase,
}: {
  mode: "section" | "site";
  onModeChange: (mode: "section" | "site") => void;
  section: SectionInstance | undefined;
  originalSection: SectionInstance | undefined;
  tokens: DesignTokens;
  viewport: SpacingBreakpoint;
  siteSettings: SiteSettings;
  originalSiteSettings: SiteSettings;
  onUpdateParams: (params: Record<string, unknown>) => void;
  onUpdateStyle: (style: SectionInstance["styleOverride"]) => void;
  onUpdateSpacing: (spacing: SectionInstance["spacingOverride"]) => void;
  onUpdateAnimation: (
    override: SectionInstance["animationOverride"],
    detail: SectionInstance["animationDetail"],
  ) => void;
  onUpdateSiteSettings: (settings: SiteSettings) => void;
  /** Voir docs/12 §12.2, « INTÉGRATION À L'ÉDITEUR » — absent = pas de médiathèque
   *  disponible (comportement d'avant son ajout, champs "url" restent du texte libre). */
  mediaApiBase?: string;
}) {
  const [tab, setTab] = useState<Tab>("content");

  return (
    <div className="flex w-80 shrink-0 flex-col border-l border-gray-200 bg-white">
      <div className="flex items-center gap-1 border-b border-gray-200 p-2">
        <button
          type="button"
          onClick={() => onModeChange("section")}
          disabled={!section}
          className={`flex-1 rounded px-2 py-1.5 text-[12px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
            mode === "section" ? "bg-indigo-600 text-white" : "text-gray-600 hover:bg-gray-100"
          }`}
        >
          Section
        </button>
        <button
          type="button"
          onClick={() => onModeChange("site")}
          className={`flex-1 rounded px-2 py-1.5 text-[12px] font-medium transition-colors ${
            mode === "site" ? "bg-indigo-600 text-white" : "text-gray-600 hover:bg-gray-100"
          }`}
        >
          Paramètres du site
        </button>
      </div>

      {mode === "site" && (
        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          <SiteSettingsPanel
            settings={siteSettings}
            originalSettings={originalSiteSettings}
            effectiveTokens={tokens}
            onChange={onUpdateSiteSettings}
            mediaApiBase={mediaApiBase}
          />
        </div>
      )}

      {mode === "section" && !section && (
        <div className="flex flex-1 items-center justify-center p-6 text-center text-[12px] text-gray-400">
          Sélectionnez une section dans la liste ou dans l&apos;aperçu pour la personnaliser.
        </div>
      )}

      {mode === "section" && section && (
        <>
          <div className="flex border-b border-gray-200">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                aria-pressed={tab === t.id}
                className={`relative flex-1 px-1 py-2 text-[11.5px] font-medium transition-colors ${
                  tab === t.id
                    ? "border-b-2 border-indigo-600 text-indigo-700"
                    : "border-b-2 border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                {t.label}
                {hasCustomization(section, t.id) && (
                  <span
                    aria-label="Personnalisé"
                    className="absolute right-2 top-1.5 h-1.5 w-1.5 rounded-full bg-indigo-500"
                  />
                )}
              </button>
            ))}
          </div>

          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-3">
            {originalSection && hasCustomization(section, tab) && (
              <button
                type="button"
                onClick={() => {
                  if (tab === "style") onUpdateStyle(originalSection.styleOverride);
                  if (tab === "spacing") onUpdateSpacing(originalSection.spacingOverride);
                  if (tab === "animation")
                    onUpdateAnimation(originalSection.animationOverride, originalSection.animationDetail);
                }}
                className="mb-3 self-start rounded-md border border-gray-300 px-2.5 py-1 text-[11px] font-medium text-gray-600 hover:border-indigo-400 hover:text-indigo-600"
              >
                ↺ Retour aux valeurs du template
              </button>
            )}

            {tab === "content" && (
              <ContentPanel
                section={section}
                originalSection={originalSection}
                onChange={onUpdateParams}
                mediaApiBase={mediaApiBase}
              />
            )}
            {tab === "style" && (
              <StylePanel
                value={section.styleOverride}
                original={originalSection?.styleOverride}
                tokens={tokens}
                onChange={onUpdateStyle}
              />
            )}
            {tab === "spacing" && (
              <SpacingPanel
                value={section.spacingOverride}
                original={originalSection?.spacingOverride}
                viewport={viewport}
                onChange={onUpdateSpacing}
              />
            )}
            {tab === "animation" && (
              <AnimationPanel
                animationOverride={section.animationOverride}
                animationDetail={section.animationDetail}
                originalDetail={originalSection?.animationDetail}
                onChange={onUpdateAnimation}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}
