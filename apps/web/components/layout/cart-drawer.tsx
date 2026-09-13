"use client";

import { useEffect } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { formatFcfa } from "@/lib/format";
import type { Locale } from "@/lib/i18n";
import { useCart } from "@/lib/commerce/cart-context";

/**
 * Panier latéral — lit et modifie désormais l'état partagé `useCart()` (voir la revue
 * du 16 septembre 2026, point 2 : l'ajout au panier doit réellement fonctionner dans
 * la démonstration, pas seulement afficher une liste statique).
 */
export function CartDrawer({
  open,
  onClose,
  locale,
}: {
  open: boolean;
  onClose: () => void;
  locale: Locale;
}) {
  const { lines, removeLine, updateQuantity, subtotal } = useCart();

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-[60] bg-black/40"
            onClick={onClose}
            aria-hidden="true"
          />
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-label={locale === "en" ? "Shopping cart" : "Panier"}
            initial={{ transform: "translateX(100%)" }}
            animate={{ transform: "translateX(0%)" }}
            exit={{ transform: "translateX(100%)" }}
            transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
            className="fixed inset-y-0 right-0 z-[61] flex w-full max-w-md flex-col bg-[var(--color-background)] shadow-[var(--shadow-lg)]"
          >
            <div className="flex items-center justify-between border-b border-[var(--color-border)] px-6 py-5">
              <h2 className="font-[family-name:var(--font-heading)] text-[var(--color-text-primary)] text-[length:var(--text-heading-sm)]">
                {locale === "en" ? "Your selection" : "Votre sélection"}
                {lines.length > 0 && (
                  <span className="ml-2 text-[var(--color-text-muted)] text-[length:var(--text-body-sm)]">
                    ({lines.reduce((sum, l) => sum + l.quantity, 0)})
                  </span>
                )}
              </h2>
              <button
                type="button"
                onClick={onClose}
                aria-label={locale === "en" ? "Close cart" : "Fermer le panier"}
                className="text-2xl font-light leading-none text-[var(--color-text-primary)]"
              >
                ×
              </button>
            </div>

            {lines.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
                <p className="text-[var(--color-text-muted)] text-[length:var(--text-body-md)]">
                  {locale === "en" ? "Your cart is empty." : "Votre panier est vide."}
                </p>
                <Button href="/catalogue" onClick={onClose}>
                  {locale === "en" ? "Discover the collection" : "Découvrir la collection"}
                </Button>
              </div>
            ) : (
              <>
                <ul className="flex-1 divide-y divide-[var(--color-border)] overflow-y-auto px-6">
                  {lines.map((line) => (
                    <li key={`${line.id}-${line.variant ?? ""}`} className="flex gap-4 py-5">
                      <div className="relative h-24 w-20 shrink-0 overflow-hidden rounded-[var(--card-radius)] bg-[var(--color-surface-muted)]">
                        <Image src={line.imageUrl} alt={line.name} fill className="object-cover" />
                      </div>
                      <div className="flex flex-1 flex-col justify-between">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-medium text-[var(--color-text-primary)] text-[length:var(--text-body-md)]">
                              {line.name}
                            </p>
                            {line.variant && (
                              <p className="text-[var(--color-text-muted)] text-[length:var(--text-body-xs)]">
                                {line.variant}
                              </p>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => removeLine(line.id, line.variant)}
                            aria-label={locale === "en" ? "Remove" : "Retirer"}
                            className="shrink-0 text-[var(--color-text-muted)] transition hover:text-[var(--color-danger)]"
                          >
                            ×
                          </button>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center border border-[var(--color-border)]">
                            <button
                              type="button"
                              aria-label="-"
                              onClick={() => updateQuantity(line.id, line.variant, line.quantity - 1)}
                              className="px-2.5 py-1 text-[var(--color-text-primary)]"
                            >
                              −
                            </button>
                            <span className="min-w-6 text-center text-[length:var(--text-body-sm)]">
                              {line.quantity}
                            </span>
                            <button
                              type="button"
                              aria-label="+"
                              onClick={() => updateQuantity(line.id, line.variant, line.quantity + 1)}
                              className="px-2.5 py-1 text-[var(--color-text-primary)]"
                            >
                              +
                            </button>
                          </div>
                          <span className="font-semibold text-[var(--color-text-primary)] text-[length:var(--text-body-sm)]">
                            {formatFcfa(line.price * line.quantity, locale)}
                          </span>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
                <div className="border-t border-[var(--color-border)] px-6 py-6">
                  <div className="mb-4 flex items-center justify-between text-[var(--color-text-primary)] text-[length:var(--text-body-lg)]">
                    <span>{locale === "en" ? "Subtotal" : "Sous-total"}</span>
                    <span className="font-semibold">{formatFcfa(subtotal, locale)}</span>
                  </div>
                  <Button href="/panier" onClick={onClose} className="w-full">
                    {locale === "en" ? "Go to checkout" : "Passer commande"}
                  </Button>
                </div>
              </>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
