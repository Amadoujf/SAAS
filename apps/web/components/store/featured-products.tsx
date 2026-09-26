"use client";

import { useMemo, useState } from "react";
import { ProductCard, type StoreProductCard } from "./product-card";
import { Reveal } from "./reveal";

/** Produits en vedette choisis par le commerçant, filtrables par catégorie
 *  (onglets), arrivée progressive au défilement, aperçu rapide sur chaque carte. */
export function FeaturedProducts({ products, columns = 5 }: { products: StoreProductCard[]; columns?: 4 | 5 }) {
  const categories = useMemo(() => Array.from(new Set(products.map((p) => p.category).filter((c): c is string => !!c))), [products]);
  const [active, setActive] = useState<string | null>(null);
  const shown = active ? products.filter((p) => p.category === active) : products;
  return (
    <div>
      {categories.length > 1 && (
        <div role="group" aria-label="Filtrer la sélection" className="mb-6 flex gap-2 overflow-x-auto">
          {[null, ...categories].map((c) => (
            <button key={c ?? "tout"} type="button" aria-pressed={active === c} onClick={() => setActive(c)}
              className={`shrink-0 rounded-[var(--radius-full)] px-4 py-2 text-sm transition-colors ${active === c ? "bg-[var(--color-primary)] font-semibold text-white" : "text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-muted)]"}`}>
              {c ?? "Tout"}
            </button>
          ))}
        </div>
      )}
      <Reveal as="ul" key={active ?? "tout"} className={`grid grid-cols-2 gap-x-4 gap-y-10 sm:grid-cols-3 ${columns === 5 ? "lg:grid-cols-5" : "lg:grid-cols-4"}`}>
        {shown.map((p, i) => <li key={p.slug}><ProductCard product={p} priority={i < 2} /></li>)}
      </Reveal>
    </div>
  );
}
