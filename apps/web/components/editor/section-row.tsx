"use client";

import { Reorder, useDragControls } from "framer-motion";
import type { SectionInstance } from "@yamacommerce/templates";
import { DragHandleIcon, DuplicateIcon, EyeOffIcon, TrashIcon } from "./editor-icons";
import { EyeIcon } from "@/components/ui/icons";

/**
 * Une ligne de la liste des sections d'une page — glisser-déposer (via
 * `Reorder.Item`, voir docs/12 §12.2 « glisser-déposer »), sélection, masquage,
 * duplication et suppression (docs/12 §12.2). Sector-agnostic : n'affiche que
 * `sectionKey`/`variant`, qui existent identiquement pour n'importe quel secteur (voir
 * @yamacommerce/templates) — cette ligne ne sait rien de l'e-commerce.
 */
export function SectionRow({
  block,
  isSelected,
  hasCustomization = false,
  onSelect,
  onToggleEnabled,
  onDuplicate,
  onDelete,
}: {
  block: SectionInstance;
  isSelected: boolean;
  /** Voir docs/12 §12.2, « indicateur des propriétés personnalisées » — vrai dès que
   *  cette section porte un style/espacement/animation surchargé par rapport au
   *  template (calculé par l'appelant, ce composant reste sector-agnostic). */
  hasCustomization?: boolean;
  onSelect: () => void;
  onToggleEnabled: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const controls = useDragControls();

  return (
    <Reorder.Item
      value={block.id}
      dragListener={false}
      dragControls={controls}
      as="li"
      className={`group flex items-center gap-2 rounded-md border px-2.5 py-2.5 transition-colors ${
        isSelected
          ? "border-indigo-500 bg-indigo-50"
          : "border-gray-200 bg-white hover:border-indigo-300"
      } ${block.isEnabled ? "" : "opacity-50"}`}
    >
      <button
        type="button"
        aria-label="Réorganiser (glisser-déposer)"
        onPointerDown={(event) => controls.start(event)}
        className="shrink-0 cursor-grab touch-none text-gray-400 active:cursor-grabbing"
      >
        <DragHandleIcon />
      </button>

      <button type="button" onClick={onSelect} className="flex min-w-0 flex-1 items-center gap-1.5 text-left">
        <span className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium text-gray-800">{block.sectionKey}</p>
          <p className="truncate text-[11px] text-gray-500">{block.variant}</p>
        </span>
        {hasCustomization && (
          <span
            title="Personnalisé"
            aria-label="Personnalisé"
            className="h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-500"
          />
        )}
      </button>

      <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
        <button
          type="button"
          onClick={onToggleEnabled}
          aria-label={block.isEnabled ? "Masquer la section" : "Afficher la section"}
          aria-pressed={!block.isEnabled}
          className="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-800"
        >
          {block.isEnabled ? <EyeIcon className="h-4 w-4" /> : <EyeOffIcon className="h-4 w-4" />}
        </button>
        <button
          type="button"
          onClick={onDuplicate}
          aria-label="Dupliquer la section"
          className="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-800"
        >
          <DuplicateIcon className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onDelete}
          aria-label="Supprimer la section"
          className="rounded p-1 text-gray-500 hover:bg-red-50 hover:text-red-600"
        >
          <TrashIcon className="h-4 w-4" />
        </button>
      </div>
    </Reorder.Item>
  );
}
