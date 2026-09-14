"use client";

import {
  sectionAnimationDetailSchema,
  type SectionAnimationDetail,
  type SectionInstance,
} from "@yamacommerce/templates";
import { describeObjectSchema } from "@/lib/editor/schema-introspect";
import { SchemaForm } from "./schema-form";

const detailFields = describeObjectSchema(sectionAnimationDetailSchema);

type AnimationOverride = SectionInstance["animationOverride"];

/** Les 5 réglages généraux d'animation par section — voir docs/12 §12.2, « Aucune/
 *  Discrète/Dynamique/Immersive » + l'héritage du niveau du site déjà existant
 *  (`animationOverride: "inherit"`, voir editor-reducer.ts). Liste FIXE et volontaire
 *  (pas une introspection de schéma) : `animationOverride` est une union
 *  littéraux+enum sur `SectionInstance`, identique pour toutes les sections de tous les
 *  secteurs — ce n'est pas un réglage propre à un template. */
const OVERRIDE_OPTIONS: { value: AnimationOverride; label: string }[] = [
  { value: "inherit", label: "Suivre le site" },
  { value: "none", label: "Aucune" },
  { value: "discreet", label: "Discrète" },
  { value: "dynamic", label: "Dynamique" },
  { value: "immersive", label: "Immersive" },
];

export function AnimationPanel({
  animationOverride,
  animationDetail,
  originalDetail,
  onChange,
}: {
  animationOverride: AnimationOverride;
  animationDetail: SectionAnimationDetail | undefined;
  originalDetail: SectionAnimationDetail | undefined;
  onChange: (override: AnimationOverride, detail: SectionAnimationDetail | undefined) => void;
}) {
  function handleDetailChange(next: Record<string, unknown>) {
    const cleaned = Object.fromEntries(
      Object.entries(next).filter(([, v]) => v !== undefined && v !== ""),
    ) as SectionAnimationDetail;
    onChange(animationOverride, Object.keys(cleaned).length > 0 ? cleaned : undefined);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="animation-level" className="text-[12px] font-medium text-gray-700">
          Niveau d&apos;animation
        </label>
        <select
          id="animation-level"
          value={animationOverride}
          onChange={(event) => onChange(event.target.value as AnimationOverride, animationDetail)}
          className="w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-[13px] text-gray-800 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
        >
          {OVERRIDE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {animationOverride !== "none" && (
        <SchemaForm
          fields={detailFields}
          value={animationDetail ?? {}}
          onChange={handleDetailChange}
          originalValue={originalDetail ?? {}}
          idPrefix="animation-detail"
        />
      )}
    </div>
  );
}
