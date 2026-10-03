"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const NAV = [
  { href: "/carte", label: "La carte" },
  { href: "/reserver-une-table", label: "Réserver une table" },
  { href: "/#infos", label: "Horaires et accès" },
];

/** En-tête charbon : nom du restaurant, carte, réservation, commande en un geste. */
export function RestaurantHeader({ tenantName, logoUrl, phone, open }: { tenantName: string; logoUrl: string | null; phone: string | null; open?: boolean }) {
  const pathname = usePathname();
  const [menu, setMenu] = useState(false);
  useEffect(() => setMenu(false), [pathname]);
  useEffect(() => {
    if (!menu) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenu(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [menu]);
  return (
    <header className="sticky top-0 z-40 bg-[var(--color-primary)] text-[#FBF6EE]">
      <div className="mx-auto flex h-[68px] max-w-[var(--content-max-width,1240px)] items-center gap-6 px-4 sm:px-8">
        <Link href="/" aria-label={`${tenantName}, accueil`} className="flex min-w-0 items-center gap-2.5 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent-primary)]">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt={tenantName} className="h-10 w-auto max-w-[170px] object-contain" />
          ) : (
            <>
              <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden="true" className="shrink-0 text-[var(--color-accent-primary)]">
                <path d="M16 3c1 5 6 7 6 13a6 6 0 0 1-12 0c0-3 2-5 3-7 0 3 1 4 2 5 0-4 0-7 1-11Z" fill="currentColor" />
                <path d="M6 24h20M8 28h16" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
              </svg>
              <span className="truncate font-[family-name:var(--font-heading)] text-[22px] uppercase leading-none tracking-[-0.01em] sm:text-[25px]">{tenantName}</span>
            </>
          )}
        </Link>
        <nav aria-label="Navigation principale" className="ml-auto hidden items-center gap-7 lg:flex">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} aria-current={pathname === n.href ? "page" : undefined} className="rounded-sm text-[14px] font-medium text-white/75 transition-colors hover:text-white aria-[current=page]:text-[var(--color-accent-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent-primary)] focus-visible:ring-offset-4 focus-visible:ring-offset-[var(--color-primary)]">
              {n.label}
            </Link>
          ))}
        </nav>
        <Link href="/carte" className="ml-auto hidden h-11 shrink-0 items-center gap-2 rounded-full bg-[var(--color-accent-primary)] px-5 text-[14px] font-bold text-[var(--color-primary)] transition-transform hover:-translate-y-0.5 sm:inline-flex lg:ml-0">
          {open !== undefined && <span aria-hidden="true" className={`h-2 w-2 rounded-full ${open ? "bg-[#1F8A4C]" : "bg-[color-mix(in_srgb,var(--color-primary)_40%,transparent)]"}`} />}
          {open === false ? "Voir la carte" : "Commander"}
        </Link>
        <button type="button" onClick={() => setMenu(true)} aria-label="Ouvrir le menu" aria-expanded={menu} className="ml-auto grid h-11 w-11 place-items-center rounded-full sm:ml-0 lg:hidden">
          <svg width="22" height="22" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h10" /></svg>
        </button>
      </div>
      {menu && (
        <div role="dialog" aria-modal="true" aria-label="Menu" className="fixed inset-0 z-50 flex flex-col bg-[var(--color-primary)] px-5 pb-8 pt-4 text-[#FBF6EE] lg:hidden">
          <div className="flex items-center justify-between">
            <span className="font-[family-name:var(--font-heading)] text-2xl uppercase">{tenantName}</span>
            <button type="button" onClick={() => setMenu(false)} aria-label="Fermer le menu" className="grid h-11 w-11 place-items-center rounded-full">
              <svg width="22" height="22" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
            </button>
          </div>
          <nav aria-label="Menu mobile" className="mt-10 flex flex-col">
            <Link href="/" onClick={() => setMenu(false)} className="py-2 font-[family-name:var(--font-heading)] text-[40px] uppercase leading-tight">Accueil</Link>
            {NAV.map((n) => <Link key={n.href} href={n.href} onClick={() => setMenu(false)} className="py-2 font-[family-name:var(--font-heading)] text-[40px] uppercase leading-tight">{n.label}</Link>)}
          </nav>
          <div className="mt-auto grid gap-3">
            <Link href="/carte" onClick={() => setMenu(false)} className="inline-flex h-14 items-center justify-center rounded-full bg-[var(--color-accent-primary)] text-[16px] font-bold text-[var(--color-primary)]">{open === false ? "Voir la carte" : "Commander"}</Link>
            {phone && <a href={`tel:${phone.replace(/\s/g, "")}`} className="inline-flex h-14 items-center justify-center rounded-full bg-white/10 text-[15px] font-semibold">Appeler · {phone}</a>}
          </div>
        </div>
      )}
    </header>
  );
}
