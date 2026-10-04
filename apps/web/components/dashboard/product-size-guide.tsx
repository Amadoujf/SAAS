"use client";

import { useState } from "react";

/** Guide des tailles d'UN produit : celui de sa catégorie par défaut, ou un autre. */
export function ProductSizeGuide({ productId, current, categoryGuide, guides }: { productId: string; current: string | null; categoryGuide: string | null; guides: { id: string; name: string }[] }) {
  const [value, setValue] = useState(current ?? "");
  const [status, setStatus] = useState<string | null>(null);
  async function change(next: string) {
    setValue(next);
    const response = await fetch("/api/catalog/size-guides/assign", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind: "product", id: productId, sizeGuideId: next || null }) });
    setStatus(response.ok ? "Enregistré." : "Enregistrement impossible.");
  }
  if (!guides.length) return null;
  const inherited = guides.find((g) => g.id === categoryGuide)?.name;
  return (
    <section className="mt-6 rounded-yc-lg bg-white p-4 shadow-yc ring-1 ring-yc-ink/[0.06] sm:p-6" aria-labelledby="produit-guide">
      <h2 id="produit-guide" className="font-semibold text-yc-ink">Guide des tailles</h2>
      <p className="mt-1 text-sm text-yc-ink-soft">{inherited ? `Par défaut : « ${inherited} », le guide de sa catégorie.` : "Sa catégorie n'a pas de guide."}</p>
      <select aria-label="Guide des tailles du produit" className="mt-3 h-10 w-full max-w-sm rounded-lg border border-yc-ink/15 bg-white px-2.5 text-sm" value={value} onChange={(e) => void change(e.target.value)}>
        <option value="">{inherited ? "Celui de la catégorie" : "Aucun guide"}</option>
        {guides.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
      </select>
      {status && <p role="status" className="mt-2 text-xs text-yc-ink-soft">{status}</p>}
    </section>
  );
}
