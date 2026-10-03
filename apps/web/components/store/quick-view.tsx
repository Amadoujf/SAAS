"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { IconPlus, IconX } from "@/components/yc/icons";
import { AddToCart, type VariantOption } from "./add-to-cart";

interface QuickProduct {
  slug: string;
  name: string;
  shortDescription: string | null;
  category: string | null;
  images: { url: string; alt: string }[];
  variants: VariantOption[];
}

/**
 * Aperçu rapide : choix de la variante et ajout au panier sans quitter la page.
 * Données chargées à l'ouverture (stock réel), fermeture par Échap / clic extérieur,
 * focus rendu au bouton d'origine.
 */
export function QuickViewButton({ slug, name, className = "" }: { slug: string; name: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const [product, setProduct] = useState<QuickProduct | null>(null);
  const [error, setError] = useState<string | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setError(null);
    fetch(`/api/storefront/products/${encodeURIComponent(slug)}`)
      .then(async (r) => {
        const json = (await r.json()) as { product?: QuickProduct; error?: string };
        if (cancelled) return;
        if (!r.ok || !json.product) setError(json.error ?? "Produit indisponible.");
        else setProduct(json.product);
      })
      .catch(() => !cancelled && setError("Connexion interrompue."));
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    dialog.current?.focus();
    return () => {
      cancelled = true;
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, slug]);

  function close() {
    setOpen(false);
    trigger.current?.focus();
  }

  return (
    <>
      <button ref={trigger} type="button" onClick={() => setOpen(true)} aria-label={`Aperçu rapide : ${name}`}
        className={`grid h-10 w-10 place-items-center rounded-full bg-[var(--color-background)] text-[var(--color-text-primary)] shadow-[var(--shadow-md)] ring-1 ring-[var(--color-border)] transition-all duration-300 hover:scale-110 hover:bg-[var(--color-primary)] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] ${className}`}>
        <IconPlus size={18} />
      </button>
      {open && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-6">
          <button type="button" aria-label="Fermer l'aperçu" tabIndex={-1} className="absolute inset-0 bg-black/45 backdrop-blur-[2px]" onClick={close} />
          <div ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-label={`Aperçu : ${name}`}
            className="yc-rise relative grid max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-t-[var(--radius-lg)] bg-[var(--color-background)] text-[var(--color-text-primary)] shadow-[var(--shadow-lg)] outline-none sm:grid-cols-2 sm:rounded-[var(--radius-lg)]">
            <button type="button" onClick={close} aria-label="Fermer" className="absolute right-3 top-3 z-10 grid h-10 w-10 place-items-center rounded-full bg-[var(--color-background)]/90"><IconX size={20} /></button>
            <div className="aspect-square bg-[var(--color-surface-muted)] sm:aspect-auto">
              {product?.images[0] && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={product.images[0].url} alt={product.images[0].alt} className="h-full w-full object-cover" />
              )}
            </div>
            <div className="flex flex-col gap-4 p-6 sm:p-8">
              {error ? (
                <p role="alert" className="text-[var(--color-danger)]">{error}</p>
              ) : !product ? (
                <div className="space-y-3" aria-busy="true" aria-label="Chargement"><div className="h-6 w-3/4 animate-pulse rounded bg-[var(--color-surface-muted)]" /><div className="h-4 w-1/2 animate-pulse rounded bg-[var(--color-surface-muted)]" /></div>
              ) : (
                <>
                  <div>
                    {product.category && <p className="text-xs uppercase tracking-[0.16em] text-[var(--color-text-muted)]">{product.category}</p>}
                    <h2 className="mt-1 font-[family-name:var(--font-heading)] text-2xl leading-tight">{product.name}</h2>
                    {product.shortDescription && <p className="mt-2 text-sm text-[var(--color-text-secondary)]">{product.shortDescription}</p>}
                  </div>
                  <AddToCart variants={product.variants} />
                  <Link href={`/p/${product.slug}`} className="text-sm font-semibold underline-offset-4 hover:underline">Voir la fiche complète</Link>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
