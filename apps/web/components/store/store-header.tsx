"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { IconBag, IconMenu, IconSearch, IconTruck, IconX } from "@/components/yc/icons";
import type { StoreLayout } from "@/lib/storefront/store-templates";
import { useStoreCart } from "./cart-provider";

interface HeaderProps {
  tenantName: string;
  logoUrl: string | null;
  categories: { slug: string; name: string }[];
  layout: StoreLayout;
}

function CartButton() {
  const { cart, setOpen } = useStoreCart();
  const [bump, setBump] = useState(false);
  const count = cart?.itemCount ?? 0;
  useEffect(() => {
    if (count === 0) return;
    setBump(true);
    const t = setTimeout(() => setBump(false), 450);
    return () => clearTimeout(t);
  }, [count]);
  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      aria-label={`Ouvrir le panier, ${count} article(s)`}
      className="relative grid h-11 w-11 place-items-center rounded-full hover:bg-[var(--color-surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
    >
      <IconBag size={22} />
      {count > 0 && (
        <span className={`absolute right-0.5 top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-[var(--color-accent-primary,var(--color-primary))] px-1 text-[11px] font-bold text-white tabular-nums ${bump ? "yc-pop" : ""}`}>
          {count}
        </span>
      )}
    </button>
  );
}

function Brand({ tenantName, logoUrl, editorial }: { tenantName: string; logoUrl: string | null; editorial: boolean }) {
  return (
    <Link href="/" className="flex min-w-0 items-center gap-2.5 rounded-md md:shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {logoUrl ? <img src={logoUrl} alt="" className="h-9 w-auto" /> : null}
      <span className={`truncate font-[family-name:var(--font-heading)] ${editorial ? "text-[20px] uppercase tracking-[0.14em] sm:text-[22px]" : "text-[22px] font-semibold leading-none tracking-tight sm:text-[26px]"}`}>{tenantName}</span>
    </Link>
  );
}

function SearchForm({ className = "", autoFocus = false }: { className?: string; autoFocus?: boolean }) {
  return (
    <form action="/catalogue" role="search" className={className}>
      <label className="flex h-11 items-center gap-2 rounded-[var(--radius-full)] border border-[var(--color-border)] bg-[var(--color-background)] px-4 focus-within:border-[var(--color-primary)]">
        <span className="sr-only">Rechercher dans la boutique</span>
        <input name="q" type="search" autoFocus={autoFocus} placeholder="Rechercher un produit, une idée…" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--color-text-muted)]" />
        <IconSearch size={18} />
      </label>
    </form>
  );
}

/** En-tête de boutique. Deux compositions selon le template : « market » (recherche
 *  centrale, rangée d'univers) et « editorial » (nom en capitales espacées, navigation
 *  sobre). Couleurs et polices viennent toujours des design tokens de l'entreprise. */
export function StoreHeader({ tenantName, logoUrl, categories, layout }: HeaderProps) {
  const [menu, setMenu] = useState(false);
  const [search, setSearch] = useState(false);
  const editorial = layout === "editorial";

  useEffect(() => {
    if (!menu && !search) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenu(false);
        setSearch(false);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [menu, search]);

  const links = [{ href: "/catalogue", label: editorial ? "Collections" : "Tout" }, ...categories.slice(0, editorial ? 4 : 7).map((c) => ({ href: `/catalogue?categorie=${c.slug}`, label: c.name }))];

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-background)_92%,transparent)] backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-[var(--content-max-width,1280px)] items-center gap-3 px-4 sm:h-[72px] sm:gap-4 sm:px-6">
        <button type="button" className="grid h-10 w-10 shrink-0 place-items-center rounded-full md:hidden" aria-label="Menu" aria-expanded={menu} onClick={() => setMenu(true)}>
          <IconMenu size={22} />
        </button>
        <Brand tenantName={tenantName} logoUrl={logoUrl} editorial={editorial} />
        {editorial ? (
          <nav aria-label="Collections" className="mx-auto hidden items-center gap-7 md:flex">
            {links.map((l) => (
              <Link key={l.href} href={l.href} className="text-[13px] tracking-[0.06em] text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)]">{l.label}</Link>
            ))}
          </nav>
        ) : (
          <SearchForm className="mx-auto hidden w-full max-w-md md:block" />
        )}
        <div className="ml-auto flex shrink-0 items-center gap-0.5 md:ml-0">
          <button type="button" aria-label="Rechercher" onClick={() => setSearch(true)} className={`grid h-11 w-11 place-items-center rounded-full hover:bg-[var(--color-surface-muted)] ${editorial ? "" : "md:hidden"}`}>
            <IconSearch size={20} />
          </button>
          <Link href="/suivi" aria-label="Suivre ma commande" title="Suivre ma commande" className="hidden h-11 w-11 place-items-center rounded-full hover:bg-[var(--color-surface-muted)] sm:grid">
            <IconTruck size={20} />
          </Link>
          <CartButton />
        </div>
      </div>

      {!editorial && categories.length > 0 && (
        <nav aria-label="Univers" className="hidden border-t border-[var(--color-border)] md:block">
          <ul className="mx-auto flex h-11 max-w-[var(--content-max-width,1280px)] items-center gap-7 overflow-x-auto px-6 text-[13.5px]">
            {links.map((l) => (
              <li key={l.href} className="shrink-0"><Link href={l.href} className="text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)]">{l.label}</Link></li>
            ))}
            <li className="ml-auto shrink-0"><Link href="/suivi" className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]">Suivre ma commande</Link></li>
          </ul>
        </nav>
      )}

      {/* Recherche plein écran (mobile, et template éditorial). */}
      {search && (
        <div className="fixed inset-0 z-50 bg-[var(--color-background)] p-4 sm:p-8" role="dialog" aria-modal="true" aria-label="Recherche">
          <div className="mx-auto flex max-w-2xl items-center gap-3">
            <SearchForm className="flex-1" autoFocus />
            <button type="button" aria-label="Fermer la recherche" onClick={() => setSearch(false)} className="grid h-11 w-11 place-items-center rounded-full"><IconX size={22} /></button>
          </div>
        </div>
      )}

      {/* Menu mobile : transitions CSS (aucune bibliothèque d'animation au 1er rendu). */}
      <div className={`fixed inset-0 z-50 md:hidden ${menu ? "" : "pointer-events-none"}`} aria-hidden={!menu}>
        <button type="button" tabIndex={menu ? 0 : -1} aria-label="Fermer le menu" className={`absolute inset-0 bg-black/40 transition-opacity duration-300 ${menu ? "opacity-100" : "opacity-0"}`} onClick={() => setMenu(false)} />
        <nav
          aria-label="Menu"
          className={`absolute inset-y-0 left-0 flex w-[82vw] max-w-xs flex-col gap-1 overflow-y-auto bg-[var(--color-background)] p-5 text-[var(--color-text-primary)] transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${menu ? "translate-x-0" : "-translate-x-full"}`}
        >
          <div className="mb-4 flex items-center justify-between">
            <span className="truncate font-[family-name:var(--font-heading)] text-lg font-semibold">{tenantName}</span>
            <button type="button" tabIndex={menu ? 0 : -1} aria-label="Fermer" onClick={() => setMenu(false)} className="grid h-10 w-10 place-items-center rounded-full"><IconX size={20} /></button>
          </div>
          {[{ href: "/", label: "Accueil" }, { href: "/catalogue", label: "Tout le catalogue" }, ...categories.map((c) => ({ href: `/catalogue?categorie=${c.slug}`, label: c.name })), { href: "/suivi", label: "Suivre ma commande" }].map((l) => (
            <Link key={l.href} href={l.href} tabIndex={menu ? 0 : -1} onClick={() => setMenu(false)} className="rounded-[var(--radius-md)] px-3 py-3 text-base font-medium hover:bg-[var(--color-surface-muted)]">{l.label}</Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
