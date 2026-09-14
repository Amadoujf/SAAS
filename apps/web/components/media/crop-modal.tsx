"use client";

import { useRef, useState } from "react";

/**
 * Recadrage d'image — voir docs/12 §12.2, « médiathèque R2 » (21 septembre 2026),
 * « Recadrer l'image ». Implémentation volontairement simple (rectangle de sélection
 * glissé/redimensionné à la souris + extraction via `<canvas>`), sans bibliothèque
 * externe — suffisant pour produire un VRAI recadrage (pixels réellement extraits à
 * la résolution native de l'image), pas une simulation. Ne modifie jamais l'original :
 * produit un nouveau `Blob`, à l'appelant de décider (nouvel import, ou remplacement
 * via le flux "Remplacer" déjà existant de la médiathèque).
 */
export interface CropModalProps {
  imageUrl: string;
  fileName: string;
  onCancel: () => void;
  onApply: (blob: Blob) => void;
}

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function CropModal({ imageUrl, fileName, onCancel, onApply }: CropModalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [rect, setRect] = useState<Rect>({ x: 20, y: 20, width: 200, height: 150 });
  const dragState = useRef<{ mode: "move" | "resize"; startX: number; startY: number; origin: Rect } | null>(
    null,
  );
  const [busy, setBusy] = useState(false);

  function clampRect(next: Rect): Rect {
    const bounds = containerRef.current?.getBoundingClientRect();
    if (!bounds) return next;
    const width = Math.max(20, Math.min(next.width, bounds.width));
    const height = Math.max(20, Math.min(next.height, bounds.height));
    const x = Math.max(0, Math.min(next.x, bounds.width - width));
    const y = Math.max(0, Math.min(next.y, bounds.height - height));
    return { x, y, width, height };
  }

  function startDrag(mode: "move" | "resize") {
    return (event: React.PointerEvent) => {
      event.preventDefault();
      event.stopPropagation();
      dragState.current = { mode, startX: event.clientX, startY: event.clientY, origin: rect };
      const handlePointerMove = (moveEvent: PointerEvent) => {
        const state = dragState.current;
        if (!state) return;
        const dx = moveEvent.clientX - state.startX;
        const dy = moveEvent.clientY - state.startY;
        if (state.mode === "move") {
          setRect(clampRect({ ...state.origin, x: state.origin.x + dx, y: state.origin.y + dy }));
        } else {
          setRect(clampRect({ ...state.origin, width: state.origin.width + dx, height: state.origin.height + dy }));
        }
      };
      const handlePointerUp = () => {
        dragState.current = null;
        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerup", handlePointerUp);
      };
      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", handlePointerUp);
    };
  }

  async function applyCrop() {
    const img = imgRef.current;
    const bounds = containerRef.current?.getBoundingClientRect();
    if (!img || !bounds) return;
    setBusy(true);
    try {
      const scaleX = img.naturalWidth / bounds.width;
      const scaleY = img.naturalHeight / bounds.height;
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(rect.width * scaleX);
      canvas.height = Math.round(rect.height * scaleY);
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(
        img,
        rect.x * scaleX,
        rect.y * scaleY,
        rect.width * scaleX,
        rect.height * scaleY,
        0,
        0,
        canvas.width,
        canvas.height,
      );
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
      if (blob) onApply(blob);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6">
      <div className="flex max-h-full w-full max-w-2xl flex-col overflow-hidden rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <p className="text-[13px] font-semibold text-gray-800">Recadrer « {fileName} »</p>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Fermer"
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          >
            ×
          </button>
        </div>

        <div className="flex-1 overflow-auto bg-gray-100 p-6">
          <div
            ref={containerRef}
            className="relative mx-auto select-none"
            style={{ maxWidth: "100%", width: "fit-content" }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={imgRef}
              src={imageUrl}
              alt=""
              draggable={false}
              className="block max-h-[420px] max-w-full"
            />
            <div
              onPointerDown={startDrag("move")}
              className="absolute cursor-move border-2 border-indigo-500 bg-indigo-500/10"
              style={{ left: rect.x, top: rect.y, width: rect.width, height: rect.height }}
              role="presentation"
            >
              <div
                onPointerDown={startDrag("resize")}
                aria-label="Redimensionner la zone de recadrage"
                role="button"
                tabIndex={0}
                className="absolute -bottom-1.5 -right-1.5 h-4 w-4 cursor-nwse-resize rounded-full border-2 border-white bg-indigo-600"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-gray-200 px-4 py-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-[12px] font-medium text-gray-700 hover:border-gray-400"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={applyCrop}
            disabled={busy}
            className="rounded-md bg-indigo-600 px-3 py-1.5 text-[12px] font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {busy ? "Application..." : "Appliquer le recadrage"}
          </button>
        </div>
      </div>
    </div>
  );
}
