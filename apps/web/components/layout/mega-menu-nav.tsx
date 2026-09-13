"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import type { Locale } from "@/lib/i18n";

export interface MegaMenuColumn {
  title: string;
  links: { label: string; href: string }[];
}

export interface MegaMenuContent {
  columns: MegaMenuColumn[];
  featured: { imageUrl: string; title: string; href: string; ctaLabel: string };
}

export interface NavItem {
  label: string;
  href: string;
  megaMenu?: MegaMenuContent;
}

/**
 * Navigation desktop avec mega menu — voir la demande de refonte du 16 septembre 2026
 * (« navigation avec mega menu »). Le panneau s'ouvre au survol ET au focus clavier
 * (accessibilité), avec un court délai à la fermeture pour tolérer le trajet de la
 * souris entre le lien et le panneau.
 */
export function MegaMenuNav({
  items,
  locale,
  isDark,
}: {
  items: NavItem[];
  locale: Locale;
  /** true = header transparent sur le hero (texte clair) ; false = header solide. */
  isDark: boolean;
}) {
  const [openLabel, setOpenLabel] = useState<string | null>(null);
  const closeTimer = useRef<number | null>(null);

  function scheduleClose() {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setOpenLabel(null), 150);
  }

  function openNow(label: string) {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    setOpenLabel(label);
  }

  const openItem = items.find((item) => item.label === openLabel && item.megaMenu);

  return (
    <nav
      className="hidden items-center gap-10 lg:flex"
      aria-label={locale === "en" ? "Main navigation" : "Navigation principale"}
      onMouseLeave={scheduleClose}
    >
      {items.map((item) => (
        <div
          key={item.href}
          onMouseEnter={() => item.megaMenu && openNow(item.label)}
          onFocus={() => item.megaMenu && openNow(item.label)}
        >
          <a
            href={item.href}
            aria-expanded={item.megaMenu ? openLabel === item.label : undefined}
            className={`relative py-2 text-[length:var(--text-body-sm)] uppercase tracking-[0.08em] transition-colors after:absolute after:-bottom-0.5 after:left-0 after:h-px after:w-0 after:bg-current after:transition-[width] after:duration-300 hover:after:w-full ${
              isDark ? "text-white/90 hover:text-white" : "text-[var(--color-text-secondary)] hover:text-[var(--color-primary)]"
            }`}
          >
            {item.label}
          </a>
        </div>
      ))}

      <AnimatePresence>
        {openItem?.megaMenu && (
          <motion.div
            key={openItem.label}
            initial={{ opacity: 0, transform: "translateY(-8px)" }}
            animate={{ opacity: 1, transform: "translateY(0px)" }}
            exit={{ opacity: 0, transform: "translateY(-8px)" }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            onMouseEnter={() => openNow(openItem.label)}
            onMouseLeave={scheduleClose}
            className="fixed inset-x-0 top-[var(--header-height)] z-40 border-t border-[var(--color-border)] bg-[var(--color-background)] shadow-[var(--shadow-lg)]"
          >
            <div className="mx-auto grid max-w-[var(--content-max-width)] grid-cols-1 gap-12 px-6 py-12 lg:grid-cols-[1fr_1fr_1fr_1.1fr]">
              {openItem.megaMenu.columns.map((column) => (
                <div key={column.title}>
                  <p className="mb-4 uppercase tracking-[0.15em] text-[var(--color-text-muted)] text-[length:var(--text-body-xs)]">
                    {column.title}
                  </p>
                  <ul className="flex flex-col gap-3">
                    {column.links.map((link) => (
                      <li key={link.href}>
                        <a
                          href={link.href}
                          className="text-[var(--color-text-secondary)] text-[length:var(--text-body-md)] transition hover:text-[var(--color-primary)]"
                        >
                          {link.label}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              <a
                href={openItem.megaMenu.featured.href}
                className="group relative block aspect-[4/5] overflow-hidden rounded-[var(--card-radius)]"
              >
                <Image
                  src={openItem.megaMenu.featured.imageUrl}
                  alt=""
                  fill
                  sizes="360px"
                  className="object-cover transition-transform duration-[var(--motion-duration-slow)] group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/5 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-5 text-white">
                  <p className="font-[family-name:var(--font-heading)] text-[length:var(--text-heading-xs)]">
                    {openItem.megaMenu.featured.title}
                  </p>
                  <p className="mt-1 text-[length:var(--text-body-sm)] underline decoration-white/50 underline-offset-4">
                    {openItem.megaMenu.featured.ctaLabel}
                  </p>
                </div>
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
