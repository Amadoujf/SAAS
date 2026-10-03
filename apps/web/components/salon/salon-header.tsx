"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const NAV = [
  { href: "/#carte", label: "La carte" },
  { href: "/#equipe", label: "L'équipe" },
  { href: "/#infos", label: "Horaires et accès" },
];

/** En-tête du salon : nom en Didone italique, carte, équipe, infos, rendez-vous. */
export function SalonHeader({ tenantName, logoUrl, phone }: { tenantName: string; logoUrl: string | null; phone: string | null }) {
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
    <header className="sticky top-0 z-40 border-b border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-background)_92%,transparent)] backdrop-blur-md">
      <div className="mx-auto flex h-[76px] max-w-[var(--content-max-width,1280px)] items-center gap-6 px-5 sm:px-8">
        <Link href="/" aria-label={`${tenantName}, accueil`} className="min-w-0 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt={tenantName} className="h-10 w-auto max-w-[180px] object-contain" />
          ) : (
            <span className="block truncate font-[family-name:var(--font-heading)] text-[26px] italic leading-none tracking-[-0.01em] text-[var(--color-primary)] sm:text-[30px]">{tenantName}</span>
          )}
        </Link>
        <nav aria-label="Navigation principale" className="ml-auto hidden items-center gap-8 lg:flex">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="rounded-sm text-[13px] font-medium uppercase tracking-[0.16em] text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-4">
              {n.label}
            </Link>
          ))}
        </nav>
        <Link
          href="/reserver"
          aria-current={pathname === "/reserver" ? "page" : undefined}
          className="hidden h-11 shrink-0 items-center rounded-[var(--radius-full)] bg-[var(--color-primary)] px-6 text-[13px] font-semibold text-white transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent-primary)] focus-visible:ring-offset-2 lg:inline-flex"
        >
          Prendre rendez-vous
        </Link>
        <button type="button" onClick={() => setOpen(true)} aria-label="Ouvrir le menu" aria-expanded={open} className="ml-auto grid h-11 w-11 place-items-center rounded-full lg:hidden">
          <svg width="22" height="22" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M4 8h16M4 16h16" /></svg>
        </button>
      </div>
      {open && (
        <div role="dialog" aria-modal="true" aria-label="Menu" className="fixed inset-0 z-50 flex flex-col bg-[var(--color-primary)] px-6 pb-8 pt-5 text-white lg:hidden">
          <div className="flex items-center justify-between">
            <span className="font-[family-name:var(--font-heading)] text-2xl italic">{tenantName}</span>
            <button type="button" onClick={() => setOpen(false)} aria-label="Fermer le menu" className="grid h-11 w-11 place-items-center rounded-full">
              <svg width="22" height="22" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
            </button>
          </div>
          <nav aria-label="Menu mobile" className="mt-12 flex flex-col gap-1">
            <Link href="/" onClick={() => setOpen(false)} className="py-2.5 font-[family-name:var(--font-heading)] text-[38px] italic leading-tight">Accueil</Link>
            {NAV.map((n) => <Link key={n.href} href={n.href} onClick={() => setOpen(false)} className="py-2.5 font-[family-name:var(--font-heading)] text-[38px] italic leading-tight">{n.label}</Link>)}
          </nav>
          <div className="mt-auto grid gap-3">
            <Link href="/reserver" onClick={() => setOpen(false)} className="inline-flex h-14 items-center justify-center rounded-[var(--radius-full)] bg-[var(--color-accent-primary)] text-[15px] font-semibold text-white">Prendre rendez-vous</Link>
            {phone && <a href={`tel:${phone.replace(/\s/g, "")}`} className="inline-flex h-14 items-center justify-center rounded-[var(--radius-full)] bg-white/10 text-[15px] font-semibold">Appeler le salon · {phone}</a>}
          </div>
        </div>
      )}
    </header>
  );
}
