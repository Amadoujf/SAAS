"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { IconBag, IconMenu, IconX } from "@/components/yc/icons";
import { useStoreCart } from "./cart-provider";

export function StoreHeader({ tenantName, logoUrl, categories }: { tenantName: string; logoUrl: string | null; categories: { slug: string; name: string }[] }) {
  const { cart, setOpen } = useStoreCart();
  const [menu, setMenu] = useState(false);
  const [bump, setBump] = useState(false);
  const count = cart?.itemCount ?? 0;

  useEffect(() => {
    if (count === 0) return;
    setBump(true);
    const t = setTimeout(() => setBump(false), 450);
    return () => clearTimeout(t);
  }, [count]);

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-background)_88%,transparent)] backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-[var(--content-max-width,1280px)] items-center gap-4 px-4 sm:h-[72px] sm:px-6">
        <button type="button" className="grid h-10 w-10 place-items-center rounded-full md:hidden" aria-label="Menu" aria-expanded={menu} onClick={() => setMenu(true)}>
          <IconMenu size={22} />
        </button>
        <Link href="/" className="flex min-w-0 items-center gap-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] rounded-md">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {logoUrl ? <img src={logoUrl} alt="" className="h-8 w-auto" /> : null}
          <span className="truncate font-[family-name:var(--font-heading)] text-lg font-semibold tracking-tight sm:text-xl">{tenantName}</span>
        </Link>
        <nav aria-label="Catalogue" className="ml-6 hidden items-center gap-1 md:flex">
          <Link href="/catalogue" className="rounded-full px-3 py-2 text-sm font-medium hover:bg-[var(--color-surface-muted)]">Tout</Link>
          {categories.slice(0, 5).map((c) => (
            <Link key={c.slug} href={`/catalogue?categorie=${c.slug}`} className="rounded-full px-3 py-2 text-sm font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-text-primary)]">{c.name}</Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-1">
          <Link href="/suivi" className="hidden rounded-full px-3 py-2 text-sm font-medium hover:bg-[var(--color-surface-muted)] sm:block">Suivre ma commande</Link>
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label={`Ouvrir le panier, ${count} article(s)`}
            className="relative grid h-11 w-11 place-items-center rounded-full hover:bg-[var(--color-surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
          >
            <IconBag size={22} />
            {count > 0 && (
              <span className={`absolute right-0.5 top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-[var(--color-primary)] px-1 text-[11px] font-bold text-white tabular-nums ${bump ? "yc-pop" : ""}`}>
                {count}
              </span>
            )}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {menu && (
          <motion.div className="fixed inset-0 z-50 md:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <button type="button" aria-label="Fermer le menu" className="absolute inset-0 bg-black/40" onClick={() => setMenu(false)} />
            <motion.nav
              aria-label="Menu"
              className="absolute inset-y-0 left-0 flex w-[82vw] max-w-xs flex-col gap-1 bg-[var(--color-background)] p-5 text-[var(--color-text-primary)]"
              initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }} transition={{ type: "spring", stiffness: 400, damping: 40 }}
            >
              <div className="mb-4 flex items-center justify-between">
                <span className="font-[family-name:var(--font-heading)] text-lg font-semibold">{tenantName}</span>
                <button type="button" aria-label="Fermer" onClick={() => setMenu(false)} className="grid h-10 w-10 place-items-center rounded-full"><IconX size={20} /></button>
              </div>
              {[{ href: "/catalogue", label: "Tout le catalogue" }, ...categories.map((c) => ({ href: `/catalogue?categorie=${c.slug}`, label: c.name })), { href: "/suivi", label: "Suivre ma commande" }].map((l) => (
                <Link key={l.href} href={l.href} onClick={() => setMenu(false)} className="rounded-[var(--radius-md)] px-3 py-3 text-base font-medium hover:bg-[var(--color-surface-muted)]">{l.label}</Link>
              ))}
            </motion.nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
