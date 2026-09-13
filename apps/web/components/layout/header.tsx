"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import type { Locale } from "@/lib/i18n";

export interface HeaderNavItem {
  label: string;
  href: string;
}

/**
 * En-tête du site — respecte `headerStyle` (variante/hauteur, voir §12.8). Navigation
 * mobile en tiroir plein écran, avec transition — voir « navigation mobile » et
 * « transitions des pages/cartes » dans les exigences d'animation.
 */
export function Header({
  shopName,
  navItems,
  cartCount = 0,
  locale,
}: {
  shopName: string;
  navItems: HeaderNavItem[];
  cartCount?: number;
  locale: Locale;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  // Le tiroir mobile (plus bas) est rendu HORS du <header> — un ancêtre avec
  // `backdrop-blur` (`backdrop-filter` en CSS) crée un nouveau "containing block" pour
  // ses descendants `position: fixed`, ce qui piégeait le tiroir dans la hauteur du
  // header au lieu du plein écran (bug corrigé le 13 septembre 2026, voir le rapport
  // de l'étape 3 du moteur de rendu).
  return (
    <>
      <header className="bg-[var(--color-background)]/90 sticky top-0 z-30 flex h-[var(--header-height)] items-center border-b border-[var(--color-border)] backdrop-blur">
        <div className="mx-auto flex w-full max-w-[var(--content-max-width)] items-center justify-between px-6">
          <a
            href="/"
            className="font-[family-name:var(--font-heading)] text-[var(--color-text-primary)] text-[var(--text-heading-sm)]"
          >
            {shopName}
          </a>

          <nav className="hidden items-center gap-8 md:flex" aria-label="Navigation principale">
            {navItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="text-[var(--color-text-secondary)] text-[var(--text-body-sm)] transition hover:text-[var(--color-primary)]"
              >
                {item.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-4">
            <a
              href="/panier"
              aria-label={locale === "en" ? "Cart" : "Panier"}
              className="relative text-[var(--color-text-primary)]"
            >
              🛍️
              {cartCount > 0 && (
                <span className="absolute -right-2 -top-2 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--color-secondary)] text-[10px] font-bold text-white">
                  {cartCount}
                </span>
              )}
            </a>
            <button
              type="button"
              className="text-[var(--color-text-primary)] md:hidden"
              aria-label={locale === "en" ? "Open menu" : "Ouvrir le menu"}
              aria-expanded={mobileOpen}
              onClick={() => setMobileOpen(true)}
            >
              ☰
            </button>
            <div className="hidden md:block">
              <Button href="/panier" variant="outline">
                {locale === "en" ? "Shop now" : "Voir la boutique"}
              </Button>
            </div>
          </div>
        </div>
      </header>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-[var(--color-background)] md:hidden"
          >
            <motion.div
              initial={{ transform: "translateX(100%)" }}
              animate={{ transform: "translateX(0%)" }}
              exit={{ transform: "translateX(100%)" }}
              transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
              className="flex h-full flex-col gap-6 p-6"
            >
              <div className="flex items-center justify-between">
                <span className="font-[family-name:var(--font-heading)] text-[var(--text-heading-sm)]">
                  {shopName}
                </span>
                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  aria-label={locale === "en" ? "Close menu" : "Fermer le menu"}
                  className="text-2xl text-[var(--color-text-primary)]"
                >
                  ×
                </button>
              </div>
              <nav className="flex flex-col gap-4" aria-label="Navigation mobile">
                {navItems.map((item) => (
                  <a
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className="text-[var(--color-text-primary)] text-[var(--text-heading-sm)]"
                  >
                    {item.label}
                  </a>
                ))}
              </nav>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
