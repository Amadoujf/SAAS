"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

/**
 * Liste des produits d'un tenant — consomme UNIQUEMENT `/api/catalog/products`
 * (jamais un import direct de `@yamacommerce/database`, paquet serveur). Même
 * convention visuelle que `admin-domains-panel.tsx`. Aucune donnée de démonstration
 * codée en dur — tout vient de l'API, vide au départ pour un nouveau tenant.
 */

const STATUS_LABELS: Record<string, string> = { DRAFT: "Brouillon", PUBLISHED: "Publié", ARCHIVED: "Archivé" };
const STATUS_BADGE_CLASS: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-700",
  PUBLISHED: "bg-green-100 text-green-800",
  ARCHIVED: "bg-amber-100 text-amber-800",
};

interface ProductRow {
  id: string;
  name: string;
  slug: string;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  basePrice: number;
  category: { id: string; name: string } | null;
  images: { id: string; url: string }[];
  variants: { id: string }[];
}

function formatFCFA(amount: number): string {
  return `${amount.toLocaleString("fr-FR")} FCFA`;
}

export function ProductsPanel() {
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      if (search) params.set("search", search);
      const response = await fetch(`/api/catalog/products?${params.toString()}`);
      const data = (await response.json()) as { products?: ProductRow[] };
      setProducts(data.products ?? []);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function handleStatusChange(id: string, status: "DRAFT" | "PUBLISHED" | "ARCHIVED") {
    const response = await fetch(`/api/catalog/products/${id}/status`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const data = (await response.json()) as { error?: string };
    if (!response.ok) {
      setActionMessage(data.error ?? "Échec du changement de statut.");
      return;
    }
    setActionMessage(null);
    await refresh();
  }

  async function handleDelete(id: string) {
    if (!confirm("Supprimer ce produit ? Il restera visible dans l'historique des commandes passées.")) return;
    const response = await fetch(`/api/catalog/products/${id}`, { method: "DELETE" });
    if (!response.ok) {
      const data = (await response.json()) as { error?: string };
      setActionMessage(data.error ?? "Échec de la suppression.");
      return;
    }
    await refresh();
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-sm text-gray-700">
            Rechercher
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Nom du produit"
              className="rounded border border-gray-300 px-3 py-1.5 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-gray-700">
            Statut
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded border border-gray-300 px-3 py-1.5 text-sm"
            >
              <option value="">Tous</option>
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <Link
          href="/dashboard/produits/nouveau"
          className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          Nouveau produit
        </Link>
      </div>

      {actionMessage && <p className="text-sm text-red-600">{actionMessage}</p>}

      <div className="rounded-lg border border-gray-200 bg-white">
        {loading && <p className="p-4 text-sm text-gray-500">Chargement…</p>}
        {!loading && products.length === 0 && (
          <p className="p-8 text-center text-sm text-gray-500">
            Aucun produit pour le moment. Créez votre premier produit pour commencer.
          </p>
        )}
        <ul className="divide-y divide-gray-200">
          {products.map((product) => (
            <li key={product.id} className="flex items-center gap-4 px-4 py-3">
              <div className="h-12 w-12 shrink-0 overflow-hidden rounded bg-gray-100">
                {product.images[0] && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={product.images[0].url} alt="" className="h-full w-full object-cover" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <Link href={`/dashboard/produits/${product.id}`} className="truncate font-medium text-gray-900 hover:underline">
                  {product.name}
                </Link>
                <p className="text-sm text-gray-500">
                  {formatFCFA(product.basePrice)}
                  {product.category ? ` · ${product.category.name}` : ""} · {product.variants.length} variante(s)
                </p>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-medium ${STATUS_BADGE_CLASS[product.status]}`}>
                {STATUS_LABELS[product.status]}
              </span>
              <div className="flex gap-2">
                {product.status !== "PUBLISHED" && (
                  <button
                    type="button"
                    onClick={() => void handleStatusChange(product.id, "PUBLISHED")}
                    className="rounded border border-green-300 px-2 py-1 text-xs text-green-700 hover:bg-green-50"
                  >
                    Publier
                  </button>
                )}
                {product.status === "PUBLISHED" && (
                  <button
                    type="button"
                    onClick={() => void handleStatusChange(product.id, "ARCHIVED")}
                    className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
                  >
                    Archiver
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => void handleDelete(product.id)}
                  className="rounded border border-red-300 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                >
                  Supprimer
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
