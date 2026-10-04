"use client";

import { useEffect, useRef, useState } from "react";

export interface StoreSizeGuide {
  name: string;
  columns: string[];
  rows: string[][];
  note: string | null;
}

/** Bouton « Guide des tailles » de la fiche produit : feuille en bas d'écran sur
 *  téléphone, fenêtre centrée sur ordinateur ; Échap ou clic hors du tableau ferme. */
export function SizeGuideButton({ guide }: { guide: StoreSizeGuide }) {
  const [open, setOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [open]);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="text-sm font-medium text-[var(--color-text-primary)] underline underline-offset-4 hover:opacity-80">
        Guide des tailles
      </button>
      {open && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 sm:items-center sm:p-4" onClick={() => setOpen(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="guide-tailles-titre"
            onClick={(e) => e.stopPropagation()}
            className="max-h-[85vh] w-full overflow-y-auto rounded-t-[var(--radius-lg,16px)] bg-[var(--color-background,#fff)] p-5 shadow-xl sm:max-w-xl sm:rounded-[var(--radius-lg,16px)] sm:p-7"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Guide des tailles</p>
                <h2 id="guide-tailles-titre" className="mt-1 font-[family-name:var(--font-heading)] text-xl font-semibold text-[var(--color-text-primary)]">{guide.name}</h2>
              </div>
              <button ref={closeRef} type="button" onClick={() => setOpen(false)} aria-label="Fermer le guide des tailles" className="-mr-2 -mt-1 h-10 w-10 shrink-0 rounded-full text-2xl leading-none text-[var(--color-text-primary)] hover:bg-black/5">
                ×
              </button>
            </div>
            <div className="mt-5 overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-border,#e5e5e5)] text-xs uppercase tracking-[0.08em] text-[var(--color-text-muted)]">
                    {guide.columns.map((c) => <th key={c} scope="col" className="py-2 pr-3 align-bottom font-semibold last:pr-0 sm:pr-4">{c}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {guide.rows.map((row) => (
                    <tr key={row[0]} className="border-b border-[var(--color-border,#e5e5e5)] last:border-0">
                      {row.map((cell, k) => (k === 0
                        ? <th key={k} scope="row" className="whitespace-nowrap py-2.5 pr-3 font-semibold text-[var(--color-text-primary)] sm:pr-4">{cell}</th>
                        : <td key={k} className="whitespace-nowrap py-2.5 pr-3 text-[var(--color-text-secondary)] last:pr-0 sm:pr-4">{cell || "—"}</td>))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {guide.note && <p className="mt-4 text-sm text-[var(--color-text-secondary)]">{guide.note}</p>}
          </div>
        </div>
      )}
    </>
  );
}
