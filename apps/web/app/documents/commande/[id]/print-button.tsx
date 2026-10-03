"use client";

export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className="yc-focus fixed bottom-6 right-6 rounded-2xl bg-yc-night-900 px-5 py-3 text-sm font-semibold text-white shadow-yc-float print:hidden">
      Imprimer / Enregistrer en PDF
    </button>
  );
}
