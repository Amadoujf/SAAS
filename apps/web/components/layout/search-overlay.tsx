"use client";

import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { Locale } from "@/lib/i18n";

export interface SearchSuggestion {
  label: string;
  href: string;
}

/**
 * Recherche plein écran — voir la demande de refonte du 16 septembre 2026. Ferme au
 * clic sur le fond, à Échap, ou après une saisie soumise. Verrouille le défilement de
 * la page pendant qu'elle est ouverte (une boutique de luxe ne laisse jamais deux
 * couches défiler en même temps).
 */
export function SearchOverlay({
  open,
  onClose,
  locale,
  suggestions,
}: {
  open: boolean;
  onClose: () => void;
  locale: Locale;
  suggestions: SearchSuggestion[];
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const timer = window.setTimeout(() => inputRef.current?.focus(), 50);
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.clearTimeout(timer);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label={locale === "en" ? "Search" : "Recherche"}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-[60] backdrop-blur-md"
          // Tailwind ne peut pas mélanger une opacité sur une couleur référencée par
          // `var(...)` (même gotcha que la taille de police — voir le correctif
          // `text-[length:var(...)]`) : `bg-[var(--color-background)]/98` restait
          // largement transparent. `color-mix()` en style inline résout ce cas.
          style={{ backgroundColor: "color-mix(in srgb, var(--color-background) 96%, transparent)" }}
          onClick={onClose}
        >
          <motion.div
            initial={{ transform: "translateY(-12px)", opacity: 0 }}
            animate={{ transform: "translateY(0px)", opacity: 1 }}
            exit={{ transform: "translateY(-12px)", opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
            className="mx-auto flex h-full max-w-[var(--content-max-width)] flex-col px-6 pt-28 sm:pt-36"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={onClose}
                aria-label={locale === "en" ? "Close search" : "Fermer la recherche"}
                className="ml-auto text-3xl font-light leading-none text-[var(--color-text-primary)]"
              >
                ×
              </button>
            </div>
            <form
              role="search"
              onSubmit={(event) => event.preventDefault()}
              className="mt-6 border-b border-[var(--color-border)] pb-6"
            >
              <input
                ref={inputRef}
                type="search"
                placeholder={
                  locale === "en"
                    ? "Search for a bag, a jewel, an outfit…"
                    : "Rechercher un sac, un bijou, une tenue…"
                }
                className="w-full bg-transparent font-[family-name:var(--font-heading)] text-[var(--color-text-primary)] text-[length:clamp(1.75rem,1.2rem+3vw,3.5rem)] outline-none placeholder:text-[var(--color-text-muted)]"
              />
            </form>
            <div className="mt-10">
              <p className="mb-4 uppercase tracking-[0.2em] text-[var(--color-text-muted)] text-[length:var(--text-body-xs)]">
                {locale === "en" ? "Popular searches" : "Recherches populaires"}
              </p>
              <ul className="flex flex-wrap gap-3">
                {suggestions.map((suggestion) => (
                  <li key={suggestion.href}>
                    <a
                      href={suggestion.href}
                      className="inline-block rounded-[var(--radius-full)] border border-[var(--color-border)] px-5 py-2.5 text-[var(--color-text-secondary)] text-[length:var(--text-body-sm)] transition hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
                    >
                      {suggestion.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
