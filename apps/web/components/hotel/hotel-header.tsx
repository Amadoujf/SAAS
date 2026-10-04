"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const NAV = [
  { href: "/chambres", label: "Chambres" },
  { href: "/#sejour", label: "Le séjour" },
  { href: "/#infos", label: "Infos pratiques" },
];

/** En-tête : nom de l'établissement, chambres, infos, réservation directe. */
export function HotelHeader({ tenantName, logoUrl, phone }: { tenantName: string; logoUrl: string | null; phone: string | null }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);
  return (
    <header className="sticky top-0 z-40 border-b border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-background)_94%,transparent)] backdrop-blur-md">
      <div className="mx-auto flex h-[76px] max-w-[var(--content-max-width,1320px)] items-center gap-6 px-5 sm:px-8">
        <Link href="/" aria-label={`${tenantName}, accueil`} className="flex min-w-0 items-center gap-3 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt={tenantName} className="h-10 w-auto max-w-[180px] object-contain" />
          ) : (
            <>
              <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden="true" className="shrink-0 text-[var(--color-primary)]">
                <path d="M16 29V13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                <path d="M16 13c-2-5-7-7-12-5 4 0 8 2 12 5Zm0 0c2-5 7-7 12-5-4 0-8 2-12 5Zm0 0c-4-2-9-1-11 3 3-2 7-3 11-3Zm0 0c4-2 9-1 11 3-3-2-7-3-11-3Zm0 0c0-4-2-8-5-10 2 3 4 6 5 10Z" fill="currentColor" />
              </svg>
              <span className="truncate font-[family-name:var(--font-heading)] text-[24px] leading-none tracking-[-0.01em] text-[var(--color-primary)] sm:text-[27px]">{tenantName}</span>
            </>
          )}
        </Link>
        <nav aria-label="Navigation principale" className="ml-auto hidden items-center gap-8 lg:flex">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} aria-current={pathname === n.href ? "page" : undefined} className="rounded-sm text-[14px] font-medium text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-4">
              {n.label}
            </Link>
          ))}
        </nav>
        <Link href="/chambres" className="hidden h-11 shrink-0 items-center rounded-[var(--radius-md)] bg-[var(--color-primary)] px-6 text-[14px] font-semibold text-white transition-transform hover:-translate-y-0.5 lg:inline-flex">Réserver</Link>
        <button type="button" onClick={() => setOpen(true)} aria-label="Ouvrir le menu" aria-expanded={open} className="ml-auto grid h-11 w-11 place-items-center rounded-full lg:hidden">
          <svg width="22" height="22" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
        </button>
      </div>
      {open && (
        <div role="dialog" aria-modal="true" aria-label="Menu" className="fixed inset-0 z-50 flex flex-col bg-[var(--color-primary)] px-6 pb-8 pt-5 text-white lg:hidden">
          <div className="flex items-center justify-between">
            <span className="font-[family-name:var(--font-heading)] text-2xl">{tenantName}</span>
            <button type="button" onClick={() => setOpen(false)} aria-label="Fermer le menu" className="grid h-11 w-11 place-items-center rounded-full">
              <svg width="22" height="22" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
            </button>
          </div>
          <nav aria-label="Menu mobile" className="mt-12 flex flex-col gap-1">
            <Link href="/" onClick={() => setOpen(false)} className="py-2.5 font-[family-name:var(--font-heading)] text-[36px] leading-tight">Accueil</Link>
            {NAV.map((n) => <Link key={n.href} href={n.href} onClick={() => setOpen(false)} className="py-2.5 font-[family-name:var(--font-heading)] text-[36px] leading-tight">{n.label}</Link>)}
          </nav>
          <div className="mt-auto grid gap-3">
            <Link href="/chambres" onClick={() => setOpen(false)} className="inline-flex h-14 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-accent-primary)] text-[15px] font-semibold text-white">Voir les disponibilités</Link>
            {phone && <a href={`tel:${phone.replace(/\s/g, "")}`} className="inline-flex h-14 items-center justify-center rounded-[var(--radius-md)] bg-white/10 text-[15px] font-semibold">Appeler · {phone}</a>}
          </div>
        </div>
      )}
    </header>
  );
}
