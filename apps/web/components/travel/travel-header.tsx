"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

const NAV = [
  { href: "/voyages", label: "Tous les voyages", match: (p: string, t: string | null) => p.startsWith("/voyages") && !t },
  { href: "/voyages?type=pilgrimage", label: "Pèlerinages", match: (p: string, t: string | null) => p === "/voyages" && t === "pilgrimage" },
  { href: "/voyages?type=stay", label: "Séjours", match: (p: string, t: string | null) => p === "/voyages" && t === "stay" },
  { href: "/voyages?type=circuit", label: "Circuits", match: (p: string, t: string | null) => p === "/voyages" && t === "circuit" },
  { href: "/#departs", label: "Prochains départs", match: () => false },
];

/** En-tête du site d'une agence de voyage : nom ou logo, univers de voyages, départs,
 *  appel direct. Menu plein écran sur mobile. */
export function TravelHeader({ tenantName, logoUrl, phone }: { tenantName: string; logoUrl: string | null; phone: string | null }) {
  const pathname = usePathname();
  const type = useSearchParams().get("type");
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname, type]);
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
    <header className="sticky top-0 z-40 border-b border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-background)_92%,transparent)] backdrop-blur-md">
      <div className="mx-auto flex h-[72px] max-w-[var(--content-max-width,1320px)] items-center gap-6 px-5 sm:px-8">
        <Link href="/" aria-label={`${tenantName}, accueil`} className="min-w-0 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt={tenantName} className="h-9 w-auto max-w-[180px] object-contain" />
          ) : (
            <span className="flex items-center gap-2.5">
              <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden="true" className="shrink-0 text-[var(--color-accent-primary)]">
                <circle cx="16" cy="16" r="6" fill="currentColor" />
                <path d="M3 22h26M6 26h20" stroke="var(--color-primary)" strokeWidth="2.2" strokeLinecap="round" />
              </svg>
              <span className="truncate font-[family-name:var(--font-heading)] text-[21px] italic tracking-[-0.01em] text-[var(--color-primary)] sm:text-[24px]">{tenantName}</span>
            </span>
          )}
        </Link>
        <nav aria-label="Navigation principale" className="ml-auto hidden items-center gap-6 lg:flex">
          {NAV.map((n) => {
            const active = n.match(pathname, type);
            return (
              <Link key={n.label} href={n.href} aria-current={active ? "page" : undefined} className={`whitespace-nowrap rounded-sm text-[14px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-4 ${active ? "font-semibold text-[var(--color-text-primary)]" : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"}`}>
                {n.label}
              </Link>
            );
          })}
        </nav>
        {phone && (
          <a href={`tel:${phone.replace(/\s/g, "")}`} aria-label={`Appeler l'agence : ${phone}`} className="hidden h-11 shrink-0 items-center gap-2 rounded-[var(--radius-full)] bg-[var(--color-primary)] px-5 text-[13px] font-semibold text-white transition-transform hover:-translate-y-0.5 lg:inline-flex">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" /></svg>
            <span aria-hidden="true">{phone}</span>
          </a>
        )}
        <button type="button" onClick={() => setOpen(true)} aria-label="Ouvrir le menu" aria-expanded={open} className="ml-auto grid h-11 w-11 place-items-center rounded-full lg:hidden">
          <svg width="22" height="22" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h10" /></svg>
        </button>
      </div>
      {open && (
        <div role="dialog" aria-modal="true" aria-label="Menu" className="fixed inset-0 z-50 flex flex-col bg-[var(--color-primary)] px-6 pb-8 pt-5 text-white lg:hidden">
          <div className="flex items-center justify-between">
            <span className="font-[family-name:var(--font-heading)] text-xl italic">{tenantName}</span>
            <button type="button" onClick={() => setOpen(false)} aria-label="Fermer le menu" className="grid h-11 w-11 place-items-center rounded-full">
              <svg width="22" height="22" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
            </button>
          </div>
          <nav aria-label="Menu mobile" className="mt-10 flex flex-col gap-1">
            <Link href="/" className="py-2.5 font-[family-name:var(--font-heading)] text-[34px] leading-tight">Accueil</Link>
            {NAV.map((n) => <Link key={n.label} href={n.href} onClick={() => setOpen(false)} className="py-2.5 font-[family-name:var(--font-heading)] text-[34px] leading-tight">{n.label}</Link>)}
          </nav>
          {phone && <a href={`tel:${phone.replace(/\s/g, "")}`} className="mt-auto inline-flex h-14 items-center justify-center rounded-[var(--radius-full)] bg-white text-[15px] font-semibold text-[var(--color-primary)]">Appeler l&apos;agence · {phone}</a>}
        </div>
      )}
    </header>
  );
}
