"use client";

import {
  colorsSchema,
  typographySchema,
  buttonStyleSchema,
  cardStyleSchema,
  headerStyleSchema,
  footerStyleSchema,
  formStyleSchema,
  animationLevelSchema,
  type DesignTokens,
  type DesignTokensOverrides,
} from "@yamacommerce/design-tokens";
import { useState } from "react";
import { describeObjectSchema } from "@/lib/editor/schema-introspect";
import type { SiteSettings } from "@/lib/editor/site-settings";
import { SchemaForm } from "./schema-form";
import { MediaLibrary } from "@/components/media/media-library";

/** `colorsSchema` est structurellement 100% des jetons de couleur — on force le
 *  type "color" sur chacun de ses champs plutôt que de compter sur l'heuristique
 *  générique par nom (qui ne voit que "primary"/"background"/... sans le mot
 *  "color", puisqu'il est déjà porté par le nom du GROUPE parent). */
const colorFields = describeObjectSchema(colorsSchema).map((field) => ({
  ...field,
  kind: "color" as const,
}));
const typographyFields = describeObjectSchema(typographySchema);
const buttonFields = describeObjectSchema(buttonStyleSchema);
const cardFields = describeObjectSchema(cardStyleSchema);
const headerFields = describeObjectSchema(headerStyleSchema);
const footerFields = describeObjectSchema(footerStyleSchema);
const formFields = describeObjectSchema(formStyleSchema);
const animationLevelOptions = animationLevelSchema.options;

type GroupKey = keyof DesignTokensOverrides;

function Section({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  return (
    <details open={defaultOpen} className="group rounded-md border border-gray-200">
      <summary className="cursor-pointer select-none list-none px-3 py-2 text-[12px] font-semibold uppercase tracking-[0.06em] text-gray-500 [&::-webkit-details-marker]:hidden">
        <span className="mr-1.5 inline-block transition-transform group-open:rotate-90">›</span>
        {title}
      </summary>
      <div className="border-t border-gray-200 p-3">{children}</div>
    </details>
  );
}

/**
 * "Paramètres généraux du site" — voir docs/12 §12.2 : logo, favicon, palette,
 * polices, boutons, cartes, en-tête, pied de page, formulaires, niveau général
 * d'animation. Chaque groupe (hors logo/favicon/niveau d'animation) correspond
 * EXACTEMENT à un groupe de `DesignTokensOverrides` (voir @yamacommerce/design-tokens)
 * — la fusion appliquée est `mergeDesignTokens`, la MÊME que celle du site publié,
 * jamais une simulation séparée (voir lib/editor/site-settings.ts).
 */
export function SiteSettingsPanel({
  settings,
  originalSettings,
  effectiveTokens,
  onChange,
  mediaApiBase,
}: {
  settings: SiteSettings;
  originalSettings: SiteSettings;
  effectiveTokens: DesignTokens;
  onChange: (next: SiteSettings) => void;
  mediaApiBase?: string;
}) {
  const overrides = settings.designTokenOverrides;
  const [picking, setPicking] = useState<"logo" | "favicon" | null>(null);

  function setGroup(group: GroupKey, next: Record<string, unknown>) {
    const cleaned = Object.fromEntries(
      Object.entries(next).filter(([, v]) => v !== undefined && v !== ""),
    );
    const nextOverrides: DesignTokensOverrides = { ...overrides };
    if (Object.keys(cleaned).length > 0) {
      (nextOverrides as Record<string, unknown>)[group] = cleaned;
    } else {
      delete nextOverrides[group];
    }
    onChange({ ...settings, designTokenOverrides: nextOverrides });
  }

  return (
    <div className="flex flex-col gap-3">
      <Section title="Logo et favicon" defaultOpen>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="site-logo" className="text-[12px] font-medium text-gray-700">
              Logo
            </label>
            <div className="flex gap-1.5">
              <input
                id="site-logo"
                type="text"
                placeholder="https://..."
                value={settings.logoUrl ?? ""}
                onChange={(event) => onChange({ ...settings, logoUrl: event.target.value || undefined })}
                className="w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-[13px] text-gray-800 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
              />
              {mediaApiBase && (
                <button
                  type="button"
                  onClick={() => setPicking("logo")}
                  className="shrink-0 rounded-md border border-gray-300 px-2.5 py-1.5 text-[12px] font-medium text-gray-700 hover:border-indigo-400 hover:text-indigo-600"
                >
                  Média
                </button>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="site-favicon" className="text-[12px] font-medium text-gray-700">
              Favicon
            </label>
            <div className="flex gap-1.5">
              <input
                id="site-favicon"
                type="text"
                placeholder="https://..."
                value={settings.faviconUrl ?? ""}
                onChange={(event) => onChange({ ...settings, faviconUrl: event.target.value || undefined })}
                className="w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-[13px] text-gray-800 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
              />
              {mediaApiBase && (
                <button
                  type="button"
                  onClick={() => setPicking("favicon")}
                  className="shrink-0 rounded-md border border-gray-300 px-2.5 py-1.5 text-[12px] font-medium text-gray-700 hover:border-indigo-400 hover:text-indigo-600"
                >
                  Média
                </button>
              )}
            </div>
          </div>
        </div>
      </Section>

      <Section title="Palette">
        <SchemaForm
          fields={colorFields}
          value={{ ...effectiveTokens.colors, ...overrides.colors }}
          onChange={(next) => setGroup("colors", next)}
          originalValue={{ ...effectiveTokens.colors, ...originalSettings.designTokenOverrides.colors }}
          idPrefix="site-colors"
        />
      </Section>

      <Section title="Polices">
        <SchemaForm
          fields={typographyFields}
          value={{ ...effectiveTokens.typography, ...overrides.typography }}
          onChange={(next) => setGroup("typography", next)}
          originalValue={{
            ...effectiveTokens.typography,
            ...originalSettings.designTokenOverrides.typography,
          }}
          idPrefix="site-typography"
        />
      </Section>

      <Section title="Boutons">
        <SchemaForm
          fields={buttonFields}
          value={{ ...effectiveTokens.buttonStyle, ...overrides.buttonStyle }}
          onChange={(next) => setGroup("buttonStyle", next)}
          originalValue={{
            ...effectiveTokens.buttonStyle,
            ...originalSettings.designTokenOverrides.buttonStyle,
          }}
          idPrefix="site-buttons"
        />
      </Section>

      <Section title="Cartes">
        <SchemaForm
          fields={cardFields}
          value={{ ...effectiveTokens.cardStyle, ...overrides.cardStyle }}
          onChange={(next) => setGroup("cardStyle", next)}
          originalValue={{
            ...effectiveTokens.cardStyle,
            ...originalSettings.designTokenOverrides.cardStyle,
          }}
          idPrefix="site-cards"
        />
      </Section>

      <Section title="En-tête">
        <SchemaForm
          fields={headerFields}
          value={{ ...effectiveTokens.headerStyle, ...overrides.headerStyle }}
          onChange={(next) => setGroup("headerStyle", next)}
          originalValue={{
            ...effectiveTokens.headerStyle,
            ...originalSettings.designTokenOverrides.headerStyle,
          }}
          idPrefix="site-header"
        />
      </Section>

      <Section title="Pied de page">
        <SchemaForm
          fields={footerFields}
          value={{ ...effectiveTokens.footerStyle, ...overrides.footerStyle }}
          onChange={(next) => setGroup("footerStyle", next)}
          originalValue={{
            ...effectiveTokens.footerStyle,
            ...originalSettings.designTokenOverrides.footerStyle,
          }}
          idPrefix="site-footer"
        />
      </Section>

      <Section title="Formulaires">
        <SchemaForm
          fields={formFields}
          value={{ ...effectiveTokens.formStyle, ...overrides.formStyle }}
          onChange={(next) => setGroup("formStyle", next)}
          originalValue={{
            ...effectiveTokens.formStyle,
            ...originalSettings.designTokenOverrides.formStyle,
          }}
          idPrefix="site-forms"
        />
      </Section>

      <Section title="Animation générale">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="site-animation-level" className="text-[12px] font-medium text-gray-700">
            Niveau général d&apos;animation
          </label>
          <select
            id="site-animation-level"
            value={overrides.animation?.level ?? effectiveTokens.animation.level}
            onChange={(event) => setGroup("animation", { ...overrides.animation, level: event.target.value })}
            className="w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-[13px] text-gray-800 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
          >
            {animationLevelOptions.map((option) => (
              <option key={option} value={option}>
                {option === "discreet" ? "Discrète" : option === "dynamic" ? "Dynamique" : "Immersive"}
              </option>
            ))}
          </select>
        </div>
      </Section>

      {picking && mediaApiBase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6">
          <div className="h-[80vh] w-full max-w-4xl overflow-hidden rounded-lg bg-white shadow-xl">
            <MediaLibrary
              apiBase={mediaApiBase}
              onSelect={(asset) => {
                onChange(picking === "logo" ? { ...settings, logoUrl: asset.url } : { ...settings, faviconUrl: asset.url });
                setPicking(null);
              }}
              onClose={() => setPicking(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
