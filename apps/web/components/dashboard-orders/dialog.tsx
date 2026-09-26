"use client";

import { useEffect, useRef, type ReactNode } from "react";

/** Boîte de dialogue native (`<dialog>`) : focus piégé, Échap, retour du focus —
 *  gérés par le navigateur. Pleine largeur en bas d'écran sur mobile. */
export function Dialog({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      aria-labelledby="yc-dialog-title"
      className="m-0 mt-auto w-full max-w-none rounded-t-3xl bg-white p-0 text-yc-ink shadow-yc-float backdrop:bg-yc-night-950/50 backdrop:backdrop-blur-sm open:animate-[yc-rise_0.35s_var(--yc-ease)] sm:m-auto sm:max-w-md sm:rounded-3xl"
    >
      <div className="p-6">
        <h2 id="yc-dialog-title" className="font-display text-xl font-semibold tracking-tight">{title}</h2>
        <div className="mt-4">{children}</div>
      </div>
    </dialog>
  );
}
