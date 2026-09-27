"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

const NAV = [
  { href: "/biens?transaction=sale", label: "Acheter", match: (p: string, t: string | null) => p === "/biens" && t === "sale" },
  { href: "/biens?transaction=rent", label: "Louer", match: (p: string, t: string | null) => p === "/biens" && t === "rent" },
  { href: "/biens", label: "Tous nos biens", match: (p: string, t: string | null) => p.startsWith("/biens") && !t },
];

/** En-tête du site d'une agence : son nom ou son logo, la navigation (acheter, louer,
 *  tous les biens) et un appel direct. Menu plein écran sur mobile. */
export function EstateHeader({ tenantName, logoUrl, phone }: { tenantName: string; logoUrl: string | null; phone: string | null }) {
  const pathname = usePathname();
  const deal = useSearchParams().get("transaction");
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname, deal]);
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
  const link = "rounded-sm text-[14px] tracking-[0.02em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-4";
  return (
    <header className="sticky top-0 z-40 border-b border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-background)_94%,transparent)] backdrop-blur">
      <div className="mx-auto flex h-[72px] max-w-[var(--content-max-width,1320px)] items-center gap-6 px-5 sm:px-8">
        <Link href="/" className="min-w-0 rounded-sm md:shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]" aria-label={`${tenantName}, accueil`}>
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt={tenantName} className="h-9 w-auto max-w-[180px] object-contain" />
          ) : (
            <span className="block truncate font-[family-name:var(--font-heading)] text-[17px] font-medium uppercase tracking-[0.08em] text-[var(--color-primary)] sm:text-[22px] sm:tracking-[0.14em]">{tenantName}</span>
          )}
        </Link>
        <nav aria-label="Navigation principale" className="ml-auto hidden items-center gap-6 md:flex lg:gap-8">
          {NAV.map((n) => {
            const active = n.match(pathname, deal);
            return <Link key={n.label} href={n.href} aria-current={active ? "page" : undefined} className={`${link} whitespace-nowrap ${active ? "text-[var(--color-text-primary)] underline decoration-[var(--color-accent-primary)] decoration-2 underline-offset-8" : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"}`}>{n.label}</Link>;
          })}
        </nav>
        {phone && (
          <a href={`tel:${phone.replace(/\s/g, "")}`} aria-label={`Appeler l'agence : ${phone}`} className="hidden h-11 min-w-11 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius-full)] bg-[var(--color-primary)] text-[13px] font-semibold tracking-[0.02em] text-white transition-transform hover:-translate-y-0.5 md:inline-flex lg:px-5">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" /></svg>
            {/* Tablette : icône seule (le numéro reste annoncé) ; ordinateur : numéro visible. */}
            <span aria-hidden="true" className="hidden lg:inline">{phone}</span>
          </a>
        )}
        <button type="button" onClick={() => setOpen(true)} aria-label="Ouvrir le menu" aria-expanded={open} className="ml-auto grid h-11 w-11 place-items-center rounded-full text-[var(--color-text-primary)] md:hidden">
          <svg width="22" height="22" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h10" /></svg>
        </button>
      </div>
      {open && (
        <div role="dialog" aria-modal="true" aria-label="Menu" className="fixed inset-0 z-50 flex flex-col bg-[var(--color-background)] px-6 pb-8 pt-5 md:hidden">
          <div className="flex items-center justify-between">
            <span className="font-[family-name:var(--font-heading)] text-lg uppercase tracking-[0.14em] text-[var(--color-primary)]">{tenantName}</span>
            <button type="button" onClick={() => setOpen(false)} aria-label="Fermer le menu" className="grid h-11 w-11 place-items-center rounded-full">
              <svg width="22" height="22" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
            </button>
          </div>
          <nav aria-label="Menu mobile" className="mt-10 flex flex-col gap-2">
            <Link href="/" className="py-3 font-[family-name:var(--font-heading)] text-[32px] leading-tight">Accueil</Link>
            {NAV.map((n) => <Link key={n.label} href={n.href} className="py-3 font-[family-name:var(--font-heading)] text-[32px] leading-tight">{n.label}</Link>)}
          </nav>
          {phone && <a href={`tel:${phone.replace(/\s/g, "")}`} className="mt-auto inline-flex h-14 items-center justify-center rounded-[var(--radius-full)] bg-[var(--color-primary)] text-[15px] font-semibold text-white">Appeler l&apos;agence · {phone}</a>}
        </div>
      )}
    </header>
  );
}
