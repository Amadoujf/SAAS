"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MediaLibrary } from "@/components/media/media-library";

/**
 * Formulaire produit (création ET édition) — voir docs/08 §8.2,
 * `/dashboard/produits/nouveau` et `/dashboard/produits/[id]`. Images et variantes
 * n'existent qu'en mode édition (elles ont besoin d'un `productId` réel) : la
 * création ne porte que les champs de base, puis redirige vers l'édition. Aucune
 * donnée de démonstration codée en dur — tout vient de `/api/catalog/*`.
 */

interface Category {
  id: string;
  name: string;
}

interface ProductImage {
  id: string;
  url: string;
  altText: string | null;
}

interface InventoryItem {
  id: string;
  quantity: number;
  lowStockThreshold: number;
  shop: { id: string; name: string };
}

interface ProductVariant {
  id: string;
  name: string;
  sku: string | null;
  price: number;
  attributes: Record<string, string>;
  inventoryItems: InventoryItem[];
}

interface ProductDetail {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  shortDescription: string | null;
  categoryId: string | null;
  basePrice: number;
  compareAtPrice: number | null;
  costPrice: number | null;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  tags: string[];
  images: ProductImage[];
  variants: ProductVariant[];
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function postJson<T>(url: string, method: string, body: unknown): Promise<{ ok: boolean; data: T }> {
  const response = await fetch(url, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await response.json()) as T;
  return { ok: response.ok, data };
}

export function ProductForm({ mode, productId }: { mode: "create" | "edit"; productId?: string }) {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [basePrice, setBasePrice] = useState("");
  const [compareAtPrice, setCompareAtPrice] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  const [variantName, setVariantName] = useState("");
  const [variantSku, setVariantSku] = useState("");
  const [variantPrice, setVariantPrice] = useState("");
  const [variantColor, setVariantColor] = useState("");
  const [variantSize, setVariantSize] = useState("");
  const [variantMaterial, setVariantMaterial] = useState("");
  const [variantStock, setVariantStock] = useState("0");

  useEffect(() => {
    void fetch("/api/catalog/categories")
      .then((r) => r.json() as Promise<{ categories?: Category[] }>)
      .then((data) => setCategories(data.categories ?? []));
  }, []);

  const loadProduct = useCallback(async () => {
    if (!productId) return;
    const response = await fetch(`/api/catalog/products/${productId}`);
    const data = (await response.json()) as { product?: ProductDetail };
    if (data.product) {
      setProduct(data.product);
      setName(data.product.name);
      setSlug(data.product.slug);
      setDescription(data.product.description ?? "");
      setCategoryId(data.product.categoryId ?? "");
      setBasePrice(String(data.product.basePrice));
      setCompareAtPrice(data.product.compareAtPrice ? String(data.product.compareAtPrice) : "");
    }
  }, [productId]);

  useEffect(() => {
    void loadProduct();
  }, [loadProduct]);

  async function handleSave() {
    setSaving(true);
    setMessage(null);
    const payload = {
      name,
      slug,
      description: description || null,
      categoryId: categoryId || null,
      basePrice: Number(basePrice) || 0,
      compareAtPrice: compareAtPrice ? Number(compareAtPrice) : null,
    };

    if (mode === "create") {
      const { ok, data } = await postJson<{ product?: { id: string }; error?: string }>(
        "/api/catalog/products",
        "POST",
        payload,
      );
      setSaving(false);
      if (!ok || !data.product) {
        setMessage(data.error ?? "Échec de la création.");
        return;
      }
      router.push(`/dashboard/produits/${data.product.id}`);
      return;
    }

    const { ok, data } = await postJson<{ error?: string }>(`/api/catalog/products/${productId}`, "PATCH", payload);
    setSaving(false);
    if (!ok) {
      setMessage(data.error ?? "Échec de l'enregistrement.");
      return;
    }
    setMessage("Enregistré.");
    await loadProduct();
  }

  async function handleStatusChange(status: "DRAFT" | "PUBLISHED" | "ARCHIVED") {
    const { ok, data } = await postJson<{ error?: string }>(`/api/catalog/products/${productId}/status`, "POST", {
      status,
    });
    if (!ok) {
      setMessage(data.error ?? "Échec du changement de statut.");
      return;
    }
    await loadProduct();
  }

  async function handleRemoveImage(imageId: string) {
    await fetch(`/api/catalog/products/${productId}/images/${imageId}`, { method: "DELETE" });
    await loadProduct();
  }

  async function handleAddVariant() {
    if (!variantName || !variantPrice) return;
    const attributes: Record<string, string> = {};
    if (variantColor) attributes.color = variantColor;
    if (variantSize) attributes.size = variantSize;
    if (variantMaterial) attributes.material = variantMaterial;

    const { ok, data } = await postJson<{ variant?: { id: string }; error?: string }>(
      `/api/catalog/products/${productId}/variants`,
      "POST",
      { name: variantName, sku: variantSku || null, price: Number(variantPrice), attributes },
    );
    if (!ok || !data.variant) {
      setMessage(data.error ?? "Échec de la création de la variante.");
      return;
    }
    await postJson(`/api/catalog/inventory`, "POST", {
      variantId: data.variant.id,
      initialQuantity: Number(variantStock) || 0,
    });
    setVariantName("");
    setVariantSku("");
    setVariantPrice("");
    setVariantColor("");
    setVariantSize("");
    setVariantMaterial("");
    setVariantStock("0");
    await loadProduct();
  }

  async function handleDeleteVariant(variantId: string) {
    if (!confirm("Supprimer cette variante ?")) return;
    await fetch(`/api/catalog/variants/${variantId}`, { method: "DELETE" });
    await loadProduct();
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-4">
      {message && <p className="text-sm text-gray-700">{message}</p>}

      <section className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-gray-900">Informations générales</h2>
        <label className="flex flex-col gap-1 text-sm text-gray-700">
          Nom
          <input
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (!slugEdited) setSlug(slugify(e.target.value));
            }}
            className="rounded border border-gray-300 px-3 py-1.5 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-gray-700">
          Slug (URL)
          <input
            type="text"
            value={slug}
            onChange={(e) => {
              setSlug(e.target.value);
              setSlugEdited(true);
            }}
            className="rounded border border-gray-300 px-3 py-1.5 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-gray-700">
          Description
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className="rounded border border-gray-300 px-3 py-1.5 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-gray-700">
          Catégorie
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="rounded border border-gray-300 px-3 py-1.5 text-sm"
          >
            <option value="">Aucune</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-sm text-gray-700">
            Prix (FCFA)
            <input
              type="number"
              value={basePrice}
              onChange={(e) => setBasePrice(e.target.value)}
              className="rounded border border-gray-300 px-3 py-1.5 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-gray-700">
            Prix barré (optionnel)
            <input
              type="number"
              value={compareAtPrice}
              onChange={(e) => setCompareAtPrice(e.target.value)}
              className="rounded border border-gray-300 px-3 py-1.5 text-sm"
            />
          </label>
        </div>
        <button
          type="button"
          disabled={saving || !name || !slug}
          onClick={() => void handleSave()}
          className="w-fit rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {mode === "create" ? "Créer le produit" : "Enregistrer"}
        </button>
      </section>

      {mode === "edit" && product && (
        <>
          <section className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-900">Statut : {product.status}</h2>
              <div className="flex gap-2">
                {product.status !== "PUBLISHED" && (
                  <button
                    type="button"
                    onClick={() => void handleStatusChange("PUBLISHED")}
                    className="rounded border border-green-300 px-3 py-1 text-xs text-green-700 hover:bg-green-50"
                  >
                    Publier
                  </button>
                )}
                {product.status === "PUBLISHED" && (
                  <button
                    type="button"
                    onClick={() => void handleStatusChange("ARCHIVED")}
                    className="rounded border border-gray-300 px-3 py-1 text-xs text-gray-700 hover:bg-gray-50"
                  >
                    Archiver
                  </button>
                )}
              </div>
            </div>
          </section>

          <section className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-gray-900">Images</h2>
            <div className="flex flex-wrap gap-3">
              {product.images.map((image) => (
                <div key={image.id} className="relative h-24 w-24 overflow-hidden rounded border border-gray-200">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={image.url} alt={image.altText ?? ""} className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => void handleRemoveImage(image.id)}
                    className="absolute right-1 top-1 rounded bg-black/60 px-1.5 text-[10px] text-white"
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setPickerOpen(true)}
                className="flex h-24 w-24 items-center justify-center rounded border border-dashed border-gray-300 text-xs text-gray-500 hover:border-gray-400"
              >
                + Média
              </button>
            </div>
            {pickerOpen && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                <div className="max-h-[80vh] w-full max-w-3xl overflow-auto rounded-lg bg-white p-4">
                  <MediaLibrary
                    apiBase="/api/media"
                    onClose={() => setPickerOpen(false)}
                    onSelect={async (asset) => {
                      await postJson(`/api/catalog/products/${productId}/images`, "POST", {
                        mediaAssetId: asset.id,
                        altText: asset.altText,
                      });
                      setPickerOpen(false);
                      await loadProduct();
                    }}
                  />
                </div>
              </div>
            )}
          </section>

          <section className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-gray-900">Variantes (taille, couleur, matière) et stock</h2>
            <ul className="flex flex-col gap-2">
              {product.variants.map((variant) => {
                const inventory = variant.inventoryItems[0];
                return (
                  <li key={variant.id} className="flex items-center justify-between rounded border border-gray-200 px-3 py-2 text-sm">
                    <div>
                      <p className="font-medium text-gray-900">
                        {variant.name} {variant.sku ? `· ${variant.sku}` : ""}
                      </p>
                      <p className="text-gray-500">
                        {Object.entries(variant.attributes)
                          .map(([k, v]) => `${k}: ${v}`)
                          .join(" · ")}{" "}
                        · {variant.price.toLocaleString("fr-FR")} FCFA
                        {inventory ? ` · Stock: ${inventory.quantity}` : ""}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleDeleteVariant(variant.id)}
                      className="rounded border border-red-300 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                    >
                      Supprimer
                    </button>
                  </li>
                );
              })}
            </ul>

            <div className="grid grid-cols-2 gap-2 border-t border-gray-200 pt-3 sm:grid-cols-3">
              <input
                type="text"
                placeholder="Nom (ex. Rouge / M)"
                value={variantName}
                onChange={(e) => setVariantName(e.target.value)}
                className="rounded border border-gray-300 px-2 py-1.5 text-sm"
              />
              <input
                type="text"
                placeholder="SKU"
                value={variantSku}
                onChange={(e) => setVariantSku(e.target.value)}
                className="rounded border border-gray-300 px-2 py-1.5 text-sm"
              />
              <input
                type="number"
                placeholder="Prix (FCFA)"
                value={variantPrice}
                onChange={(e) => setVariantPrice(e.target.value)}
                className="rounded border border-gray-300 px-2 py-1.5 text-sm"
              />
              <input
                type="text"
                placeholder="Couleur"
                value={variantColor}
                onChange={(e) => setVariantColor(e.target.value)}
                className="rounded border border-gray-300 px-2 py-1.5 text-sm"
              />
              <input
                type="text"
                placeholder="Taille"
                value={variantSize}
                onChange={(e) => setVariantSize(e.target.value)}
                className="rounded border border-gray-300 px-2 py-1.5 text-sm"
              />
              <input
                type="text"
                placeholder="Matière"
                value={variantMaterial}
                onChange={(e) => setVariantMaterial(e.target.value)}
                className="rounded border border-gray-300 px-2 py-1.5 text-sm"
              />
              <input
                type="number"
                placeholder="Stock initial"
                value={variantStock}
                onChange={(e) => setVariantStock(e.target.value)}
                className="rounded border border-gray-300 px-2 py-1.5 text-sm"
              />
              <button
                type="button"
                onClick={() => void handleAddVariant()}
                className="rounded bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
              >
                Ajouter la variante
              </button>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
