"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { GlobeIcon, ChevronDownIcon } from "@/components/ui/icons";
import type { Locale } from "@/lib/i18n";
import { useLocale } from "@/lib/locale-context";

const OPTIONS: { value: Locale; label: string }[] = [
  { value: "fr", label: "Français" },
  { value: "en", label: "English" },
  { value: "wo", label: "Wolof" },
];

/**
 * Sélecteur de langue — RÉELLEMENT fonctionnel depuis la revue du 16 septembre 2026,
 * point 2 (auparavant : changeait juste l'étiquette affichée, sans effet). Passe par
 * `useLocale()` (voir lib/locale-context.tsx) : choisir une langue change effectivement
 * les chaînes de l'en-tête, du panier, des favoris et du pied de page.
 *
 * Limitation assumée et documentée dans le rapport de refonte : le CONTENU des
 * sections (titres de produits, texte du manifeste...) reste en français, ces données
 * de démonstration n'existant pour l'instant que dans cette langue — les traduire est
 * un travail de contenu (Phase 2+), pas une limite technique de ce composant.
 */
export function LanguageSelector() {
  const { locale: current, setLocale } = useLocale();
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="Changer de langue"
        className="flex items-center gap-1.5 transition-opacity hover:opacity-70"
      >
        <GlobeIcon className="h-[18px] w-[18px]" />
        <span className="hidden text-[length:var(--text-body-xs)] uppercase sm:inline">{current}</span>
        <ChevronDownIcon className="h-3.5 w-3.5" />
      </button>
      <AnimatePresence>
        {open && (
          <>
            <button
              aria-hidden="true"
              tabIndex={-1}
              className="fixed inset-0 z-10 cursor-default"
              onClick={() => setOpen(false)}
            />
            <motion.ul
              initial={{ opacity: 0, transform: "translateY(-4px)" }}
              animate={{ opacity: 1, transform: "translateY(0px)" }}
              exit={{ opacity: 0, transform: "translateY(-4px)" }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 top-full z-20 mt-3 w-36 bg-[var(--color-background)] py-2 text-[var(--color-text-primary)] shadow-[var(--shadow-lg)]"
            >
              {OPTIONS.map((option) => (
                <li key={option.value}>
                  <button
                    type="button"
                    onClick={() => {
                      setLocale(option.value);
                      setOpen(false);
                    }}
                    className={`block w-full px-4 py-2 text-left text-[length:var(--text-body-sm)] transition hover:bg-[var(--color-surface-muted)] ${
                      current === option.value ? "font-semibold" : ""
                    }`}
                  >
                    {option.label}
                  </button>
                </li>
              ))}
            </motion.ul>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
