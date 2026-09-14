"use client";

import { useMemo } from "react";
import {
  sectionStyleOverrideSchema,
  type SectionStyleOverride,
} from "@yamacommerce/templates";
import type { DesignTokens } from "@yamacommerce/design-tokens";
import { describeObjectSchema } from "@/lib/editor/schema-introspect";
import { evaluateContrast } from "@/lib/editor/contrast";
import { WarningIcon } from "@/components/editor/editor-icons";
import { SchemaForm } from "./schema-form";

const styleFields = describeObjectSchema(sectionStyleOverrideSchema);

/**
 * Onglet "Style" — voir docs/12 §12.2. Généré à partir de `sectionStyleOverrideSchema`
 * (voir @yamacommerce/templates), le MÊME schéma pour toutes les sections et tous les
 * secteurs (docs/12 §12.2, "SectionStyleOverride" appliqué via variables CSS). Ajoute
 * une seule chose au-delà du formulaire générique : l'avertissement de contraste WCAG
 * (« protection contre les couleurs illisibles ») entre le texte et l'arrière-plan
 * choisis pour CETTE section — une vérification structurelle du contrat de style, pas
 * une règle propre à un template.
 */
export function StylePanel({
  value,
  original,
  tokens,
  onChange,
}: {
  value: SectionStyleOverride | undefined;
  original: SectionStyleOverride | undefined;
  tokens: DesignTokens;
  onChange: (next: SectionStyleOverride | undefined) => void;
}) {
  const current = value ?? {};

  const effectiveBackground = current.colorBackground ?? tokens.colors.background;
  const primaryContrast = useMemo(
    () => evaluateContrast(current.colorTextPrimary ?? tokens.colors.textPrimary, effectiveBackground),
    [current.colorTextPrimary, effectiveBackground, tokens.colors.textPrimary],
  );
  const secondaryContrast = useMemo(
    () =>
      evaluateContrast(current.colorTextSecondary ?? tokens.colors.textSecondary, effectiveBackground),
    [current.colorTextSecondary, effectiveBackground, tokens.colors.textSecondary],
  );

  function handleChange(next: Record<string, unknown>) {
    const cleaned = Object.fromEntries(
      Object.entries(next).filter(([, v]) => v !== undefined && v !== ""),
    );
    onChange(Object.keys(cleaned).length > 0 ? (cleaned as SectionStyleOverride) : undefined);
  }

  return (
    <div className="flex flex-col gap-4">
      {(primaryContrast.level !== "pass" || secondaryContrast.level !== "pass") && (
        <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-2.5 text-[12px] text-amber-800">
          <WarningIcon className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium">Contraste de texte insuffisant</p>
            {primaryContrast.level !== "pass" && primaryContrast.ratio && (
              <p>
                Texte principal sur l&apos;arrière-plan : ratio {primaryContrast.ratio.toFixed(1)}:1
                {primaryContrast.level === "fail" ? " (illisible, minimum 3:1)" : " (sous le seuil recommandé 4.5:1)"}.
              </p>
            )}
            {secondaryContrast.level !== "pass" && secondaryContrast.ratio && (
              <p>
                Texte secondaire sur l&apos;arrière-plan : ratio {secondaryContrast.ratio.toFixed(1)}:1
                {secondaryContrast.level === "fail" ? " (illisible, minimum 3:1)" : " (sous le seuil recommandé 4.5:1)"}.
              </p>
            )}
          </div>
        </div>
      )}

      <SchemaForm
        fields={styleFields}
        value={current}
        onChange={handleChange}
        originalValue={original ?? {}}
        idPrefix="style"
      />
    </div>
  );
}
