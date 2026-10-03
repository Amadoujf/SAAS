"use client";

import { usePrefersReducedMotion } from "@/lib/motion/animation-level-context";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { IconArrowRight, IconX } from "@/components/yc/icons";
import { fcfa, useStoreCart } from "./cart-provider";
import { CartLineRow } from "./cart-lines";

/** Panier latéral : glisse depuis la droite (bas d'écran sur mobile), se ferme par
 *  Échap, clic sur le voile ou bouton ; le focus revient au déclencheur. */
export function CartDrawer() {
  const { cart, open, setOpen, error, notice, clearMessages } = useStoreCart();
  const reduce = usePrefersReducedMotion();
  const panel = useRef<HTMLDivElement>(null);
  const opener = useRef<Element | null>(null);

  useEffect(() => {
    if (!open) return;
    opener.current = document.activeElement;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    // Le panneau est monté par l'animation : on attend qu'il existe pour y placer
    // le focus (bouton Fermer), sans délai arbitraire.
    let frame = 0;
    let tries = 0;
    const focusInside = () => {
      const target = panel.current?.querySelector<HTMLElement>("[data-autofocus]");
      if (target) target.focus();
      else if (tries++ < 30) frame = requestAnimationFrame(focusInside);
    };
    frame = requestAnimationFrame(focusInside);
    return () => {
      cancelAnimationFrame(frame);
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
              <button type="button" data-autofocus onClick={() => setOpen(false)} aria-label="Fermer" className="grid h-10 w-10 place-items-center rounded-full hover:bg-[var(--color-surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]">
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
