"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const NAV = [
  { href: "/vehicules", label: "Nos véhicules" },
  { href: "/vehicules?stock=arrivage", label: "Arrivages" },
  { href: "/#services", label: "Reprise et financement" },
  { href: "/#showroom", label: "Showroom" },
];

/** En-tête asphalte : nom de la concession, stock, arrivages, essai en un geste. */
export function AutoHeader({ tenantName, logoUrl, phone }: { tenantName: string; logoUrl: string | null; phone: string | null }) {
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
  const focus = "rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent-primary)] focus-visible:ring-offset-4 focus-visible:ring-offset-[var(--color-primary)]";
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[var(--color-primary)] text-white">
      <div className="mx-auto flex h-16 max-w-[var(--content-max-width,1320px)] items-center gap-6 px-4 sm:px-8">
        <Link href="/" aria-label={`${tenantName}, accueil`} className={`flex min-w-0 items-center gap-3 ${focus}`}>
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt={tenantName} className="h-9 w-auto max-w-[170px] object-contain" />
          ) : (
            <>
              <svg width="34" height="20" viewBox="0 0 34 20" aria-hidden="true" className="shrink-0">
                <path d="M6 0h10L10 20H0Z" fill="var(--color-accent-primary)" />
                <path d="M18 0h7l-6 20h-7Z" fill="var(--color-accent-primary)" opacity=".6" />
                <path d="M27 0h7l-6 20h-7Z" fill="var(--color-accent-primary)" opacity=".3" />
              </svg>
              <span className="truncate text-[19px] font-black uppercase leading-none tracking-[-0.02em] sm:text-[21px]" style={{ fontStyle: "oblique 8deg" }}>{tenantName}</span>
            </>
          )}
        </Link>
        <nav aria-label="Navigation principale" className="ml-auto hidden items-center gap-7 lg:flex">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} aria-current={pathname === n.href ? "page" : undefined} className={`text-[13.5px] font-semibold uppercase tracking-[0.06em] text-white/70 transition-colors hover:text-white aria-[current=page]:text-white ${focus}`}>
              {n.label}
            </Link>
          ))}
        </nav>
        {phone && (
          <a href={`tel:${phone.replace(/\s/g, "")}`} className={`yc-num ml-auto hidden text-[14px] font-semibold text-white/85 hover:text-white md:inline lg:ml-0 ${focus}`}>{phone}</a>
        )}
        <Link href="/vehicules" className="ml-auto hidden h-11 shrink-0 items-center bg-[var(--color-accent-primary)] px-5 text-[13.5px] font-extrabold uppercase tracking-[0.06em] text-[var(--color-primary)] transition-transform hover:-translate-y-0.5 sm:inline-flex md:ml-0 [clip-path:polygon(8px_0,100%_0,calc(100%-8px)_100%,0_100%)]">
          Réserver un essai
        </Link>
        <button type="button" onClick={() => setMenu(true)} aria-label="Ouvrir le menu" aria-expanded={menu} className="ml-auto grid h-11 w-11 place-items-center sm:ml-0 lg:hidden">
          <svg width="22" height="22" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h10" /></svg>
        </button>
      </div>
      {menu && (
        <div role="dialog" aria-modal="true" aria-label="Menu" className="fixed inset-0 z-50 flex flex-col bg-[var(--color-primary)] px-5 pb-8 pt-4 text-white lg:hidden">
          <div className="flex items-center justify-between">
            <span className="text-xl font-black uppercase" style={{ fontStyle: "oblique 8deg" }}>{tenantName}</span>
            <button type="button" onClick={() => setMenu(false)} aria-label="Fermer le menu" className="grid h-11 w-11 place-items-center">
              <svg width="22" height="22" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
            </button>
          </div>
          <nav aria-label="Menu mobile" className="mt-10 flex flex-col">
            <Link href="/" onClick={() => setMenu(false)} className="border-b border-white/10 py-3 text-[30px] font-black uppercase leading-tight tracking-[-0.02em]">Accueil</Link>
            {NAV.map((n) => <Link key={n.href} href={n.href} onClick={() => setMenu(false)} className="border-b border-white/10 py-3 text-[30px] font-black uppercase leading-tight tracking-[-0.02em]">{n.label}</Link>)}
          </nav>
          <div className="mt-auto grid gap-3">
            <Link href="/vehicules" onClick={() => setMenu(false)} className="inline-flex h-14 items-center justify-center bg-[var(--color-accent-primary)] text-[15px] font-extrabold uppercase tracking-[0.06em] text-[var(--color-primary)]">Réserver un essai</Link>
            {phone && <a href={`tel:${phone.replace(/\s/g, "")}`} className="inline-flex h-14 items-center justify-center bg-white/10 text-[15px] font-semibold">Appeler · {phone}</a>}
          </div>
        </div>
      )}
    </header>
  );
}
