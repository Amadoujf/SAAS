"use client";

import { useCallback, useEffect, useState } from "react";

interface Category {
  id: string;
  name: string;
  slug: string;
  imageUrl: string | null;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/** CRUD catégories — voir docs/08 §8.2, `/dashboard/categories`. Consomme
 *  UNIQUEMENT `/api/catalog/categories`. */
export function CategoriesPanel() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [name, setName] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const response = await fetch("/api/catalog/categories");
    const data = (await response.json()) as { categories?: Category[] };
    setCategories(data.categories ?? []);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function handleCreate() {
    if (!name.trim()) return;
    const response = await fetch("/api/catalog/categories", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, slug: slugify(name) }),
    });
    if (!response.ok) {
      const data = (await response.json()) as { error?: string };
      setMessage(data.error ?? "Échec de la création.");
      return;
    }
    setName("");
    setMessage(null);
    await refresh();
  }

  async function handleDelete(id: string) {
    const response = await fetch(`/api/catalog/categories/${id}`, { method: "DELETE" });
    if (!response.ok) {
      const data = (await response.json()) as { error?: string };
      setMessage(data.error ?? "Échec de la suppression.");
      return;
    }
    await refresh();
  }

  return (
    <div className="flex flex-col gap-4 ">
      <div className="flex gap-2">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nom de la catégorie"
          aria-label="Nom de la nouvelle catégorie"
          className="h-11 min-w-0 flex-1 bg-white rounded-xl border border-yc-ink/15 focus:outline-none focus:ring-2 focus:ring-yc-electric/60 px-3 py-1.5 text-sm"
        />
        <button
          type="button"
          onClick={() => void handleCreate()}
          className="h-11 shrink-0 rounded-xl bg-yc-night-900 shadow-[0_10px_24px_-12px_rgb(10_16_42/0.8)] px-4 text-sm font-semibold text-white hover:bg-yc-night-800"
        >
          Ajouter
        </button>
      </div>

      {message && <p className="text-sm text-red-600">{message}</p>}

      <ul className="divide-y divide-yc-ink/[0.06] rounded-yc-lg bg-white shadow-yc ring-1 ring-yc-ink/[0.06] border-0">
        {categories.length === 0 && <li className="p-4 text-sm text-yc-ink-soft">Aucune catégorie pour le moment.</li>}
        {categories.map((category) => (
          <li key={category.id} className="flex items-center justify-between px-4 py-3">
            <span className="text-sm text-yc-ink">{category.name}</span>
            <button
              type="button"
              onClick={() => void handleDelete(category.id)}
              className="rounded-xl border border-red-300 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
            >
              Supprimer
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
