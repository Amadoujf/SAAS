"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDownIcon } from "@/components/ui/icons";
import { SUPPORTED_CURRENCIES, useCurrency, type Currency } from "@/lib/commerce/currency-context";

const LABELS: Record<Currency, string> = { FCFA: "FCFA", EUR: "EUR €", CAD: "CAD $", USD: "USD $" };

/**
 * Sélecteur de devise — vente au Sénégal ET à la diaspora (Teranga Atelier, 20
 * septembre 2026) : réellement fonctionnel via `useCurrency()`, reconvertit tous les
 * prix affichés (produits, panier, fiche produit). Voir lib/commerce/currency-context.tsx
 * pour la limitation assumée (taux fixes de démonstration).
 */
export function CurrencySelector() {
  const { currency, setCurrency } = useCurrency();
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="Changer de devise"
        className="flex items-center gap-1.5 transition-opacity hover:opacity-70"
      >
        <span className="text-[length:var(--text-body-xs)] uppercase">{currency}</span>
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
              className="absolute right-0 top-full z-20 mt-3 w-32 bg-[var(--color-background)] py-2 text-[var(--color-text-primary)] shadow-[var(--shadow-lg)]"
            >
              {SUPPORTED_CURRENCIES.map((option) => (
                <li key={option}>
                  <button
                    type="button"
                    onClick={() => {
                      setCurrency(option);
                      setOpen(false);
                    }}
                    className={`block w-full px-4 py-2 text-left text-[length:var(--text-body-sm)] transition hover:bg-[var(--color-surface-muted)] ${
                      currency === option ? "font-semibold" : ""
                    }`}
                  >
                    {LABELS[option]}
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
