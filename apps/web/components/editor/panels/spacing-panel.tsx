"use client";

import {
  spacingValuesSchema,
  type SectionSpacingOverride,
  type SectionSpacingValues,
} from "@yamacommerce/templates";
import { describeObjectSchema } from "@/lib/editor/schema-introspect";
import type { PreviewViewport } from "@/components/editor/viewport-toggle";
import { SchemaForm } from "./schema-form";

const spacingFields = describeObjectSchema(spacingValuesSchema);

const VIEWPORT_LABEL: Record<PreviewViewport, string> = {
  desktop: "Ordinateur",
  tablet: "Tablette",
  mobile: "Téléphone",
};

/**
 * Onglet "Espacement" — voir docs/12 §12.2, « réglages distincts ordinateur/tablette/
 * téléphone ». RÉUTILISE le même bouton de bascule que l'aperçu (barre d'outils
 * générale) plutôt que d'en dupliquer un second dans le panneau : le point de rupture
 * actuellement affiché dans l'aperçu est TOUJOURS celui qu'on est en train de régler
 * ici — évite toute confusion entre "ce que je vois" et "ce que je modifie" (voir la
 * limite assumée sur l'aperçu non-iframe dans lib/editor/section-style.ts, qui rend
 * cette cohérence d'autant plus importante).
 */
export function SpacingPanel({
  value,
  original,
  viewport,
  onChange,
}: {
  value: SectionSpacingOverride | undefined;
  original: SectionSpacingOverride | undefined;
  viewport: PreviewViewport;
  onChange: (next: SectionSpacingOverride | undefined) => void;
}) {
  const currentForViewport = value?.[viewport] ?? {};
  const originalForViewport = original?.[viewport] ?? {};

  function handleChange(next: Record<string, unknown>) {
    const cleaned = Object.fromEntries(
      Object.entries(next).filter(([, v]) => v !== undefined && v !== ""),
    ) as SectionSpacingValues;
    const nextOverride: SectionSpacingOverride = { ...value };
    if (Object.keys(cleaned).length > 0) {
      nextOverride[viewport] = cleaned;
    } else {
      delete nextOverride[viewport];
    }
    onChange(Object.keys(nextOverride).length > 0 ? nextOverride : undefined);
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="rounded-md bg-gray-50 px-2.5 py-2 text-[12px] text-gray-500">
        Réglages pour <span className="font-medium text-gray-700">{VIEWPORT_LABEL[viewport]}</span> —
        changez de mode dans la barre d&apos;outils pour régler un autre appareil.
      </p>
      <SchemaForm
        fields={spacingFields}
        value={currentForViewport}
        onChange={handleChange}
        originalValue={originalForViewport}
        idPrefix={`spacing-${viewport}`}
      />
    </div>
  );
}
