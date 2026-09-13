"use client";

import { DesktopIcon, MobileIcon, TabletIcon } from "./editor-icons";

export type PreviewViewport = "desktop" | "tablet" | "mobile";

const OPTIONS: { value: PreviewViewport; label: string; Icon: typeof DesktopIcon }[] = [
  { value: "desktop", label: "Ordinateur", Icon: DesktopIcon },
  { value: "tablet", label: "Tablette", Icon: TabletIcon },
  { value: "mobile", label: "Téléphone", Icon: MobileIcon },
];

/** Bascule ordinateur/tablette/téléphone — voir docs/12 §12.2, « prévisualisation
 *  séparée ordinateur / tablette / téléphone ». */
export function ViewportToggle({
  value,
  onChange,
}: {
  value: PreviewViewport;
  onChange: (viewport: PreviewViewport) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Largeur de prévisualisation"
      className="flex items-center gap-0.5 rounded-md border border-gray-200 p-0.5"
    >
      {OPTIONS.map(({ value: optionValue, label, Icon }) => (
        <button
          key={optionValue}
          type="button"
          role="radio"
          aria-checked={value === optionValue}
          title={label}
          onClick={() => onChange(optionValue)}
          className={`flex h-7 w-8 items-center justify-center rounded transition-colors ${
            value === optionValue ? "bg-indigo-600 text-white" : "text-gray-500 hover:bg-gray-100"
          }`}
        >
          <Icon className="h-4 w-4" />
          <span className="sr-only">{label}</span>
        </button>
      ))}
    </div>
  );
}
