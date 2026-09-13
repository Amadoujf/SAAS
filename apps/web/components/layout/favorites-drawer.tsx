"use client";

import { useEffect } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { formatFcfa } from "@/lib/format";
import type { Locale } from "@/lib/i18n";
import { useFavorites } from "@/lib/commerce/favorites-context";
import { CloseIcon } from "@/components/ui/icons";

/**
 * Tiroir des favoris — voir la revue du 16 septembre 2026, point 2 : le bouton favoris
 * devait cesser d'être décoratif. Même structure que `CartDrawer`, alimenté par
 * `useFavorites()` (voir lib/commerce/favorites-context.tsx).
 */
export function FavoritesDrawer({
  open,
  onClose,
  locale,
}: {
  open: boolean;
  onClose: () => void;
  locale: Locale;
}) {
  const { items, toggle } = useFavorites();

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
            aria-label={locale === "en" ? "Wishlist" : "Favoris"}
            initial={{ transform: "translateX(100%)" }}
            animate={{ transform: "translateX(0%)" }}
            exit={{ transform: "translateX(100%)" }}
            transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
            className="fixed inset-y-0 right-0 z-[61] flex w-full max-w-md flex-col bg-[var(--color-background)] shadow-[var(--shadow-lg)]"
          >
            <div className="flex items-center justify-between border-b border-[var(--color-border)] px-6 py-5">
              <h2 className="font-[family-name:var(--font-heading)] text-[var(--color-text-primary)] text-[length:var(--text-heading-sm)]">
                {locale === "en" ? "Your favorites" : "Vos favoris"}
              </h2>
              <button
                type="button"
                onClick={onClose}
                aria-label={locale === "en" ? "Close" : "Fermer"}
                className="text-[var(--color-text-primary)]"
              >
                <CloseIcon />
              </button>
            </div>

            {items.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
                <p className="text-[var(--color-text-muted)] text-[length:var(--text-body-md)]">
                  {locale === "en" ? "No favorites yet." : "Aucun favori pour l'instant."}
                </p>
                <Button href="/catalogue" onClick={onClose}>
                  {locale === "en" ? "Discover the collection" : "Découvrir la collection"}
                </Button>
              </div>
            ) : (
              <ul className="flex-1 divide-y divide-[var(--color-border)] overflow-y-auto px-6">
                {items.map((item) => (
                  <li key={item.id} className="flex gap-4 py-5">
                    <div className="relative h-24 w-20 shrink-0 overflow-hidden rounded-[var(--card-radius)] bg-[var(--color-surface-muted)]">
                      <Image src={item.imageUrl} alt={item.name} fill className="object-cover" />
                    </div>
                    <div className="flex flex-1 flex-col justify-between">
                      <div className="flex items-start justify-between gap-2">
                        {item.href ? (
                          <a
                            href={item.href}
                            onClick={onClose}
                            className="font-medium text-[var(--color-text-primary)] text-[length:var(--text-body-md)] hover:underline"
                          >
                            {item.name}
                          </a>
                        ) : (
                          <p className="font-medium text-[var(--color-text-primary)] text-[length:var(--text-body-md)]">
                            {item.name}
                          </p>
                        )}
                        <button
                          type="button"
                          onClick={() => toggle(item)}
                          aria-label={locale === "en" ? "Remove from favorites" : "Retirer des favoris"}
                          className="shrink-0 text-[var(--color-text-muted)] transition hover:text-[var(--color-danger)]"
                        >
                          ×
                        </button>
                      </div>
                      <span className="font-semibold text-[var(--color-text-primary)] text-[length:var(--text-body-sm)]">
                        {formatFcfa(item.price, locale)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
