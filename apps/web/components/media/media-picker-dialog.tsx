"use client";

import { MediaLibrary } from "@/components/media/media-library";

type MediaPick = { id: string; altText: string | null; variants?: { key: string }[] };

/** URL publique d'une image de la médiathèque, dans la meilleure variante disponible. */
export function mediaUrl(asset: MediaPick, size: "large" | "medium" = "large") {
  const keys = (asset.variants ?? []).map((v) => v.key);
  const variant = keys.includes(size) ? size : keys.includes("medium") ? "medium" : null;
  return `/api/media/${asset.id}/file${variant ? `?variant=${variant}` : ""}`;
}

/** Médiathèque de l'entreprise en mode sélection (fenêtre modale). */
export function MediaPickerDialog({ size = "large", onPick, onClose }: { size?: "large" | "medium"; onPick: (url: string, alt: string) => void; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="Médiathèque">
      <div className="max-h-[85vh] w-full max-w-4xl overflow-auto rounded-xl bg-white p-4">
        <MediaLibrary
          apiBase="/api/media"
          onClose={onClose}
          onSelect={(asset) => {
            onPick(mediaUrl(asset, size), asset.altText ?? "");
            onClose();
          }}
        />
      </div>
    </div>
  );
}
