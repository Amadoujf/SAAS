"use client";

import Link from "next/link";
import { IconArrowRight, IconShield } from "@/components/yc/icons";
import { fcfa, useStoreCart } from "./cart-provider";
import { CartLineRow } from "./cart-drawer";
import { ProductCard, type StoreProductCard } from "./product-card";

export function CartPage({ suggestions }: { suggestions: StoreProductCard[] }) {
  const { cart, loading, error, notice } = useStoreCart();
  const blocked = cart?.lines.some((l) => l.quantity > l.availableQuantity) ?? false;
  const inCart = new Set(cart?.lines.map((l) => l.productName));

  return (
    <div className="mx-auto max-w-[var(--content-max-width,1280px)] px-4 pt-10 sm:px-6">
      <h1 className="font-[family-name:var(--font-heading)] text-[length:var(--text-heading-lg,2rem)] font-semibold tracking-tight">Votre panier</h1>
      {loading ? (
        <div role="status" aria-label="Chargement du panier" className="mt-8 grid gap-4 lg:grid-cols-[1fr_380px]">
          <div className="space-y-4">{[0, 1].map((i) => <div key={i} className="h-36 animate-pulse rounded-[var(--radius-lg)] bg-[var(--color-surface-muted)]" />)}</div>
          <div className="h-56 animate-pulse rounded-[var(--radius-lg)] bg-[var(--color-surface-muted)]" />
        </div>
      ) : !cart || cart.lines.length === 0 ? (
        <div className="mt-8 rounded-[var(--radius-lg)] bg-[var(--color-surface)] px-6 py-20 text-center">
          <p className="font-[family-name:var(--font-heading)] text-xl font-semibold">Votre panier est vide</p>
          <p className="mt-2 text-sm text-[var(--color-text-muted)]">Ajoutez vos articles préférés : ils resteront ici, même si vous revenez plus tard.</p>
          <Link href="/catalogue" className="mt-6 inline-flex rounded-[var(--radius-full)] bg-[var(--color-primary)] px-6 py-3 text-sm font-semibold text-white">Découvrir le catalogue</Link>
        </div>
      ) : (
        <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_380px]">
          <div>
            {(error || notice) && <p role="alert" className="mb-4 rounded-[var(--radius-md)] bg-[color-mix(in_srgb,var(--color-warning)_12%,transparent)] px-4 py-3 text-sm">{error ?? notice}</p>}
            <ul className="divide-y divide-[var(--color-border)] border-y border-[var(--color-border)]">
              {cart.lines.map((l) => <CartLineRow key={l.id} line={l} />)}
            </ul>
          </div>
          <aside className="h-fit rounded-[var(--radius-lg)] bg-[var(--color-surface)] p-6 lg:sticky lg:top-24">
            <h2 className="font-[family-name:var(--font-heading)] text-lg font-semibold">Récapitulatif</h2>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-[var(--color-text-muted)]">Articles ({cart.itemCount})</dt><dd className="tabular-nums">{fcfa(cart.subtotal)}</dd></div>
              <div className="flex justify-between"><dt className="text-[var(--color-text-muted)]">Livraison</dt><dd>Selon votre zone</dd></div>
              <div className="flex justify-between border-t border-[var(--color-border)] pt-3 text-base font-semibold"><dt>Sous-total</dt><dd className="tabular-nums">{fcfa(cart.subtotal)}</dd></div>
            </dl>
            <Link
              href={blocked ? "#" : "/commander"}
              aria-disabled={blocked}
              onClick={(e) => blocked && e.preventDefault()}
              className={`group mt-6 flex items-center justify-center gap-2 rounded-[var(--radius-full)] bg-[var(--color-primary)] px-6 py-4 font-semibold text-white transition ${blocked ? "cursor-not-allowed opacity-50" : "hover:brightness-110"}`}
            >
              Passer la commande <IconArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
            </Link>
            {blocked && <p className="mt-2 text-xs text-[var(--color-danger)]">Ajustez les quantités signalées pour continuer.</p>}
            <p className="mt-4 flex items-center gap-2 text-xs text-[var(--color-text-muted)]"><IconShield size={16} /> Les prix sont vérifiés par la boutique au moment de la commande.</p>
          </aside>
        </div>
      )}
      {suggestions.filter((s) => !inCart.has(s.name)).length > 0 && (
        <section className="mt-20" aria-labelledby="cart-suggestions">
          <h2 id="cart-suggestions" className="font-[family-name:var(--font-heading)] text-2xl font-semibold tracking-tight">À associer</h2>
          <ul className="mt-6 grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-4">
            {suggestions.filter((s) => !inCart.has(s.name)).slice(0, 4).map((p) => <li key={p.slug}><ProductCard product={p} /></li>)}
          </ul>
        </section>
      )}
    </div>
  );
}
