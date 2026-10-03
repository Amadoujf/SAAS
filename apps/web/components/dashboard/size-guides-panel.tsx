"use client";

import { useCallback, useEffect, useState } from "react";

interface Guide {
  id: string;
  name: string;
  columns: string[];
  rows: string[][];
  note: string | null;
  categories: number;
  products: number;
}
interface CategoryRef {
  id: string;
  name: string;
  sizeGuideId: string | null;
}
interface Draft {
  id: string | null;
  name: string;
  columns: string[];
  rows: string[][];
  note: string;
}

const EMPTY: Draft = { id: null, name: "", columns: ["Taille", "Poitrine (cm)", "Taille (cm)", "Hanches (cm)"], rows: [["S", "", "", ""], ["M", "", "", ""], ["L", "", "", ""]], note: "" };
const field = "h-10 min-w-0 w-full rounded-lg border border-yc-ink/15 bg-white px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-yc-electric/60";
const ghost = "rounded-lg border border-yc-ink/15 px-3 py-1.5 text-xs font-semibold text-yc-ink hover:bg-yc-ink/[0.04]";

/** Guides des tailles : création, modification en tableau, rattachement aux catégories.
 *  Le remplacement produit par produit se règle sur la fiche du produit. */
export function SizeGuidesPanel() {
  const [guides, setGuides] = useState<Guide[]>([]);
  const [categories, setCategories] = useState<CategoryRef[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [message, setMessage] = useState<{ tone: "error" | "ok"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const response = await fetch("/api/catalog/size-guides");
    if (!response.ok) return;
    const data = (await response.json()) as { guides: Guide[]; categories: CategoryRef[] };
    setGuides(data.guides);
    setCategories(data.categories);
  }, []);
  useEffect(() => void refresh(), [refresh]);

  const edit = (g: Guide) => setDraft({ id: g.id, name: g.name, columns: [...g.columns], rows: g.rows.map((r) => [...r]), note: g.note ?? "" });
  const set = (patch: Partial<Draft>) => setDraft((d) => (d ? { ...d, ...patch } : d));
  const setCell = (r: number, c: number, value: string) => setDraft((d) => (d ? { ...d, rows: d.rows.map((row, i) => (i === r ? row.map((cell, k) => (k === c ? value : cell)) : row)) } : d));

  async function save() {
    if (!draft) return;
    setBusy(true);
    const response = await fetch(draft.id ? `/api/catalog/size-guides/${draft.id}` : "/api/catalog/size-guides", {
      method: draft.id ? "PUT" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: draft.name, columns: draft.columns, rows: draft.rows, note: draft.note || null }),
    });
    const data = (await response.json().catch(() => ({}))) as { error?: string };
    setBusy(false);
    if (!response.ok) return setMessage({ tone: "error", text: data.error ?? "Enregistrement impossible." });
    setMessage({ tone: "ok", text: "Guide enregistré : il s'affiche sur les fiches des produits concernés." });
    setDraft(null);
    await refresh();
  }

  async function remove(g: Guide) {
    const used = g.categories + g.products;
    if (!window.confirm(used ? `Ce guide est utilisé par ${g.categories} catégorie(s) et ${g.products} produit(s). Le supprimer quand même ?` : `Supprimer « ${g.name} » ?`)) return;
    const response = await fetch(`/api/catalog/size-guides/${g.id}`, { method: "DELETE" });
    if (!response.ok) return setMessage({ tone: "error", text: "Suppression impossible." });
    setMessage({ tone: "ok", text: "Guide supprimé." });
    await refresh();
  }

  async function assign(categoryId: string, sizeGuideId: string | null) {
    const response = await fetch("/api/catalog/size-guides/assign", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind: "category", id: categoryId, sizeGuideId }) });
    if (!response.ok) return setMessage({ tone: "error", text: "Rattachement impossible." });
    setMessage({ tone: "ok", text: "Catégorie mise à jour." });
    await refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      {message && <p role="status" className={`rounded-xl px-4 py-3 text-sm ${message.tone === "error" ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-800"}`}>{message.text}</p>}

      {draft ? (
        <section className="rounded-yc-lg bg-white p-4 shadow-yc ring-1 ring-yc-ink/[0.06] sm:p-6" aria-label="Modifier le guide">
          <label className="block text-sm font-semibold text-yc-ink">
            Nom du guide
            <input className={`${field} mt-1.5`} value={draft.name} maxLength={80} placeholder="Ex. Robes et hauts femme" onChange={(e) => set({ name: e.target.value })} />
          </label>
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[480px] border-separate border-spacing-1.5 text-sm">
              <thead>
                <tr>
                  {draft.columns.map((col, c) => (
                    <th key={c} className="text-left font-normal">
                      <input aria-label={`Intitulé de la colonne ${c + 1}`} className={`${field} font-semibold`} value={col} maxLength={40} onChange={(e) => set({ columns: draft.columns.map((x, k) => (k === c ? e.target.value : x)) })} />
                      {c > 0 && draft.columns.length > 2 && (
                        <button type="button" className="mt-1 text-xs text-yc-ink-soft underline" onClick={() => set({ columns: draft.columns.filter((_, k) => k !== c), rows: draft.rows.map((r) => r.filter((_, k) => k !== c)) })}>Retirer</button>
                      )}
                    </th>
                  ))}
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {draft.rows.map((row, r) => (
                  <tr key={r}>
                    {row.map((cell, c) => (
                      <td key={c}><input aria-label={`${draft.columns[c] || "Colonne"}, ligne ${r + 1}`} className={`${field} ${c === 0 ? "font-semibold" : ""}`} value={cell} maxLength={30} onChange={(e) => setCell(r, c, e.target.value)} /></td>
                    ))}
                    <td>
                      {draft.rows.length > 1 && <button type="button" aria-label={`Retirer la ligne ${r + 1}`} className="h-10 w-10 rounded-lg text-yc-ink-soft hover:bg-yc-ink/[0.05]" onClick={() => set({ rows: draft.rows.filter((_, i) => i !== r) })}>×</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {draft.rows.length < 30 && <button type="button" className={ghost} onClick={() => set({ rows: [...draft.rows, draft.columns.map(() => "")] })}>+ Ligne</button>}
            {draft.columns.length < 6 && <button type="button" className={ghost} onClick={() => set({ columns: [...draft.columns, "Mesure (cm)"], rows: draft.rows.map((r) => [...r, ""]) })}>+ Colonne</button>}
          </div>
          <label className="mt-5 block text-sm font-semibold text-yc-ink">
            Conseil affiché sous le tableau <span className="font-normal text-yc-ink-soft">(facultatif)</span>
            <input className={`${field} mt-1.5`} value={draft.note} maxLength={300} placeholder="Ex. Entre deux tailles, prenez la plus grande." onChange={(e) => set({ note: e.target.value })} />
          </label>
          <div className="mt-6 flex flex-wrap gap-2">
            <button type="button" disabled={busy} onClick={() => void save()} className="h-11 rounded-xl bg-yc-night-900 px-5 text-sm font-semibold text-white hover:bg-yc-night-800 disabled:opacity-60">Enregistrer le guide</button>
            <button type="button" onClick={() => setDraft(null)} className="h-11 rounded-xl px-4 text-sm font-semibold text-yc-ink-soft hover:bg-yc-ink/[0.04]">Annuler</button>
          </div>
        </section>
      ) : (
        <button type="button" onClick={() => setDraft({ ...EMPTY, rows: EMPTY.rows.map((r) => [...r]), columns: [...EMPTY.columns] })} className="h-11 self-start rounded-xl bg-yc-night-900 px-5 text-sm font-semibold text-white hover:bg-yc-night-800">Nouveau guide des tailles</button>
      )}

      <ul className="grid gap-3 md:grid-cols-2">
        {guides.length === 0 && <li className="rounded-yc-lg bg-white p-4 text-sm text-yc-ink-soft shadow-yc ring-1 ring-yc-ink/[0.06]">Aucun guide pour le moment. Créez-en un, puis rattachez-le à une catégorie.</li>}
        {guides.map((g) => (
          <li key={g.id} className="rounded-yc-lg bg-white p-4 shadow-yc ring-1 ring-yc-ink/[0.06]">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold text-yc-ink">{g.name}</p>
                <p className="mt-0.5 text-xs text-yc-ink-soft">{g.rows.map((r) => r[0]).join(" · ")} — {g.categories} catégorie(s), {g.products} produit(s)</p>
              </div>
              <div className="flex shrink-0 gap-1.5">
                <button type="button" className={ghost} onClick={() => edit(g)}>Modifier</button>
                <button type="button" className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50" onClick={() => void remove(g)}>Supprimer</button>
              </div>
            </div>
          </li>
        ))}
      </ul>

      {guides.length > 0 && categories.length > 0 && (
        <section className="rounded-yc-lg bg-white p-4 shadow-yc ring-1 ring-yc-ink/[0.06] sm:p-6" aria-labelledby="guides-categories">
          <h2 id="guides-categories" className="font-semibold text-yc-ink">Guide par catégorie</h2>
          <p className="mt-1 text-sm text-yc-ink-soft">Chaque produit de la catégorie affiche ce guide, sauf s&apos;il a le sien (réglage sur la fiche du produit).</p>
          <ul className="mt-4 divide-y divide-yc-ink/[0.06]">
            {categories.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <span className="text-sm text-yc-ink">{c.name}</span>
                <select aria-label={`Guide des tailles de la catégorie ${c.name}`} className={`${field} w-auto max-w-full`} value={c.sizeGuideId ?? ""} onChange={(e) => void assign(c.id, e.target.value || null)}>
                  <option value="">Aucun guide</option>
                  {guides.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
