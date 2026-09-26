"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { IconAlert, IconArrowRight, IconMinus, IconPlus, IconX } from "@/components/yc/icons";
import { fcfa, useStoreCart, type StoreCartLine } from "./cart-provider";

export function QuantityStepper({ line, compact = false }: { line: StoreCartLine; compact?: boolean }) {
  const { update, busyLine } = useStoreCart();
  const busy = busyLine === line.id;
  const size = compact ? "h-8 w-8" : "h-10 w-10";
  return (
    <div className="inline-flex items-center rounded-[var(--radius-full)] ring-1 ring-inset ring-[var(--color-border)]" role="group" aria-label={`Quantité de ${line.productName}`}>
      <button type="button" disabled={busy} onClick={() => update(line.id, line.quantity - 1)} aria-label="Diminuer" className={`grid ${size} place-items-center rounded-full transition hover:bg-[var(--color-surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] disabled:opacity-40`}>
        <IconMinus size={16} />
      </button>
      <span className="min-w-[2ch] text-center text-sm font-semibold tabular-nums" aria-live="polite">{line.quantity}</span>
      <button type="button" disabled={busy || line.quantity >= line.availableQuantity} onClick={() => update(line.id, line.quantity + 1)} aria-label="Augmenter" className={`grid ${size} place-items-center rounded-full transition hover:bg-[var(--color-surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] disabled:opacity-40`}>
        <IconPlus size={16} />
      </button>
    </div>
  );
}

export function CartLineRow({ line, compact = false }: { line: StoreCartLine; compact?: boolean }) {
  const { remove, busyLine } = useStoreCart();
  const short = line.quantity > line.availableQuantity;
  return (
    <li className={`flex gap-4 py-4 transition-opacity ${busyLine === line.id ? "opacity-60" : ""}`}>
      <span className={`${compact ? "h-24 w-20" : "h-32 w-28"} shrink-0 overflow-hidden rounded-[var(--radius-md)] bg-[var(--color-surface-muted)]`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {line.imageUrl && <img src={line.imageUrl} alt="" className="h-full w-full object-cover" loading="lazy" />}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="flex items-start justify-between gap-3">
          <span className="min-w-0">
            <span className="block font-semibold leading-snug">{line.productName}</span>
            <span className="block text-sm text-[var(--color-text-muted)]">{line.variantName}</span>
          </span>
          <span className="whitespace-nowrap font-semibold tabular-nums">{fcfa(line.lineTotal)}</span>
        </span>
        {short && (
          <span role="alert" className="mt-1 flex items-center gap-1 text-xs font-semibold text-[var(--color-danger)]">
            <IconAlert size={14} /> {line.availableQuantity === 0 ? "Plus en stock" : `Plus que ${line.availableQuantity} disponible(s)`}
          </span>
        )}
        <span className="mt-auto flex items-center justify-between pt-3">
          <QuantityStepper line={line} compact={compact} />
          <button type="button" onClick={() => remove(line.id)} className="rounded-md text-sm text-[var(--color-text-muted)] underline-offset-4 hover:text-[var(--color-text-primary)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]">
            Retirer
          </button>
        </span>
      </span>
    </li>
  );
}

/** Panier latéral : glisse depuis la droite (bas d'écran sur mobile), se ferme par
 *  Échap, clic sur le voile ou bouton ; le focus revient au déclencheur. */
export function CartDrawer() {
  const { cart, open, setOpen, error, notice, clearMessages } = useStoreCart();
  const reduce = useReducedMotion();
  const panel = useRef<HTMLDivElement>(null);
  const opener = useRef<Element | null>(null);

  useEffect(() => {
    if (!open) return;
    opener.current = document.activeElement;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    const t = setTimeout(() => panel.current?.querySelector<HTMLElement>("button, a")?.focus(), 50);
    return () => {
      clearTimeout(t);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      (opener.current as HTMLElement | null)?.focus?.();
    };
  }, [open, setOpen]);

  const blocked = cart?.lines.some((l) => l.quantity > l.availableQuantity) ?? false;

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[60]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
          <button type="button" aria-label="Fermer le panier" onClick={() => setOpen(false)} className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
          <motion.div
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-label="Votre panier"
            className="absolute bottom-0 right-0 flex max-h-[92dvh] w-full flex-col rounded-t-[28px] bg-[var(--color-background)] text-[var(--color-text-primary)] shadow-2xl sm:inset-y-0 sm:max-h-none sm:w-[440px] sm:rounded-none"
            initial={reduce ? { opacity: 0 } : { x: "100%" }}
            animate={reduce ? { opacity: 1 } : { x: 0 }}
            exit={reduce ? { opacity: 0 } : { x: "100%" }}
            transition={{ type: "spring", stiffness: 380, damping: 38 }}
          >
            <div className="mx-auto mt-2 h-1.5 w-12 rounded-full bg-[var(--color-border)] sm:hidden" aria-hidden="true" />
            <header className="flex items-center justify-between px-6 pb-3 pt-4 sm:pt-6">
              <h2 className="font-[family-name:var(--font-heading)] text-xl font-semibold">
                Panier {cart && cart.itemCount > 0 && <span className="text-[var(--color-text-muted)]">({cart.itemCount})</span>}
              </h2>
              <button type="button" onClick={() => setOpen(false)} aria-label="Fermer" className="grid h-10 w-10 place-items-center rounded-full hover:bg-[var(--color-surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]">
                <IconX size={20} />
              </button>
            </header>
            {(error || notice) && (
              <p role="alert" className="mx-6 mb-2 flex items-start justify-between gap-2 rounded-[var(--radius-md)] bg-[color-mix(in_srgb,var(--color-warning)_12%,transparent)] px-3 py-2 text-sm">
                <span>{error ?? notice}</span>
                <button type="button" onClick={clearMessages} aria-label="Masquer le message" className="shrink-0 opacity-60 hover:opacity-100"><IconX size={16} /></button>
              </p>
            )}
            {!cart || cart.lines.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-16 text-center">
                <p className="font-[family-name:var(--font-heading)] text-lg font-semibold">Votre panier est vide</p>
                <p className="text-sm text-[var(--color-text-muted)]">Parcourez le catalogue : vos coups de cœur vous attendent.</p>
                <Link href="/catalogue" onClick={() => setOpen(false)} className="mt-2 rounded-[var(--radius-full)] bg-[var(--color-primary)] px-6 py-3 text-sm font-semibold text-white">Voir le catalogue</Link>
              </div>
            ) : (
              <>
                <ul className="flex-1 divide-y divide-[var(--color-border)] overflow-y-auto overscroll-contain px-6">
                  {cart.lines.map((l) => <CartLineRow key={l.id} line={l} compact />)}
                </ul>
                <footer className="border-t border-[var(--color-border)] px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4">
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm text-[var(--color-text-muted)]">Sous-total</span>
                    <span className="text-xl font-semibold tabular-nums">{fcfa(cart.subtotal)}</span>
                  </div>
                  <p className="mt-1 text-xs text-[var(--color-text-muted)]">Livraison calculée à l&apos;étape suivante selon votre zone.</p>
                  <div className="mt-4 grid grid-cols-[auto_1fr] gap-2">
                    <Link href="/panier" onClick={() => setOpen(false)} className="grid place-items-center rounded-[var(--radius-full)] px-5 py-3.5 text-sm font-semibold ring-1 ring-inset ring-[var(--color-border)] hover:bg-[var(--color-surface-muted)]">Panier</Link>
                    <Link
                      href={blocked ? "#" : "/commander"}
                      aria-disabled={blocked}
                      onClick={(e) => (blocked ? e.preventDefault() : setOpen(false))}
                      className={`group flex items-center justify-center gap-2 rounded-[var(--radius-full)] bg-[var(--color-primary)] px-5 py-3.5 text-sm font-semibold text-white transition ${blocked ? "cursor-not-allowed opacity-50" : "hover:brightness-110"}`}
                    >
                      Commander <IconArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
                    </Link>
                  </div>
                </footer>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
