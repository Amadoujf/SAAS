"use client";

import { useState } from "react";
import { IconCheck, IconMinus, IconPlus } from "@/components/yc/icons";
import { fcfa, useStoreCart } from "./cart-provider";

export interface VariantOption { id: string; name: string; price: number; available: number }

/** Choix de variante + quantité + ajout. Les variantes épuisées restent visibles
 *  (barrées, non sélectionnables) ; le prix affiché est celui de la variante choisie. */
export function AddToCart({ variants, lowStockThreshold = 3 }: { variants: VariantOption[]; lowStockThreshold?: number }) {
  const { add, busyLine, error } = useStoreCart();
  const firstAvailable = variants.find((v) => v.available > 0) ?? variants[0];
  const [selected, setSelected] = useState(firstAvailable?.id ?? "");
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const variant = variants.find((v) => v.id === selected);
  const busy = busyLine === `add:${selected}`;
  const soldOut = !variant || variant.available === 0;
  const single = variants.length === 1 && variants[0]!.name.toLowerCase() === "unique";

  return (
    <div className="flex flex-col gap-5">
      {variant && <p className="text-2xl font-semibold tabular-nums">{fcfa(variant.price)}</p>}
      {!single && (
        <fieldset>
          <legend className="mb-2 text-sm font-semibold">Option : <span className="font-normal text-[var(--color-text-muted)]">{variant?.name}</span></legend>
          <div className="flex flex-wrap gap-2">
            {variants.map((v) => {
              const out = v.available === 0;
              const active = v.id === selected;
              return (
                <button
                  key={v.id}
                  type="button"
                  disabled={out}
                  aria-pressed={active}
                  onClick={() => { setSelected(v.id); setQty(1); setAdded(false); }}
                  className={`min-w-12 rounded-[var(--radius-md)] px-4 py-2.5 text-sm font-semibold ring-1 ring-inset transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] ${
                    active ? "bg-[var(--color-text-primary)] text-[var(--color-background)] ring-[var(--color-text-primary)]" : "ring-[var(--color-border)] hover:ring-[var(--color-text-primary)]"
                  } ${out ? "cursor-not-allowed line-through opacity-40" : ""}`}
                >
                  {v.name}
                </button>
              );
            })}
          </div>
        </fieldset>
      )}
      {variant && variant.available > 0 && variant.available <= lowStockThreshold && (
        <p className="text-sm font-semibold text-[var(--color-warning)]">Plus que {variant.available} en stock</p>
      )}
      <div className="flex gap-3">
        <div className="inline-flex items-center rounded-[var(--radius-full)] ring-1 ring-inset ring-[var(--color-border)]" role="group" aria-label="Quantité">
          <button type="button" aria-label="Diminuer" disabled={qty <= 1} onClick={() => setQty((q) => q - 1)} className="grid h-12 w-12 place-items-center rounded-full disabled:opacity-40"><IconMinus size={16} /></button>
          <span className="min-w-[2ch] text-center font-semibold tabular-nums" aria-live="polite">{qty}</span>
          <button type="button" aria-label="Augmenter" disabled={!variant || qty >= variant.available} onClick={() => setQty((q) => q + 1)} className="grid h-12 w-12 place-items-center rounded-full disabled:opacity-40"><IconPlus size={16} /></button>
        </div>
        <button
          type="button"
          // Jamais `disabled` pendant l'envoi : un bouton désactivé perd le focus
          // clavier (il retombait sur la page). On bloque le double envoi par la garde.
          disabled={soldOut}
          aria-disabled={busy || undefined}
          aria-busy={busy || undefined}
          onClick={async () => {
            if (busy) return;
            const ok = await add(selected, qty);
            if (ok) { setAdded(true); setTimeout(() => setAdded(false), 2200); }
          }}
          className="relative flex h-12 flex-1 items-center justify-center gap-2 overflow-hidden rounded-[var(--radius-full)] bg-[var(--color-primary)] px-6 font-semibold text-white transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {soldOut ? "Épuisé" : added ? (<><span className="yc-pop grid h-5 w-5 place-items-center rounded-full bg-white/25"><IconCheck size={14} /></span> Ajouté au panier</>) : busy ? "Ajout…" : "Ajouter au panier"}
        </button>
      </div>
      {error && <p role="alert" className="text-sm font-medium text-[var(--color-danger)]">{error}</p>}
    </div>
  );
}
