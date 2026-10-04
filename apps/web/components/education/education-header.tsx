"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const NAV = [
  { href: "/formations", label: "Formations" },
  { href: "/#inscription", label: "S'inscrire" },
  { href: "/#etablissement", label: "L'établissement" },
  { href: "/#contact", label: "Contact" },
];

/** En-tête papier : nom de l'établissement, formations, inscription en un geste. */
export function EducationHeader({ tenantName, logoUrl, phone, academicYear }: { tenantName: string; logoUrl: string | null; phone: string | null; academicYear: string }) {
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
  const focus = "rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-4 focus-visible:ring-offset-[var(--color-background)]";
  return (
    <header className="sticky top-0 z-40 border-b border-[var(--color-border)] bg-[var(--color-background)]/95 backdrop-blur">
      <div className="mx-auto flex h-[68px] max-w-[var(--content-max-width,1240px)] items-center gap-6 px-4 sm:px-8">
        <Link href="/" aria-label={`${tenantName}, accueil`} className={`flex min-w-0 items-center gap-3 ${focus}`}>
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt={tenantName} className="h-10 w-auto max-w-[170px] object-contain" />
          ) : (
            <>
              <span aria-hidden="true" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--color-primary)] font-[family-name:var(--font-heading)] text-[20px] italic text-[var(--color-accent-primary)]">{tenantName.trim().charAt(0)}</span>
              <span className="min-w-0">
                <span className="block truncate font-[family-name:var(--font-heading)] text-[20px] font-semibold leading-tight tracking-[-0.01em]">{tenantName}</span>
                {academicYear && <span className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Année {academicYear}</span>}
              </span>
            </>
          )}
        </Link>
        <nav aria-label="Navigation principale" className="ml-auto hidden items-center gap-7 lg:flex">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} aria-current={pathname === n.href ? "page" : undefined} className={`text-[15px] font-medium text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)] aria-[current=page]:text-[var(--color-text-primary)] aria-[current=page]:underline aria-[current=page]:decoration-[var(--color-accent-primary)] aria-[current=page]:decoration-2 aria-[current=page]:underline-offset-8 ${focus}`}>
              {n.label}
            </Link>
          ))}
        </nav>
        {phone && <a href={`tel:${phone.replace(/\s/g, "")}`} className={`yc-num ml-auto hidden text-[14.5px] font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] md:inline lg:ml-0 ${focus}`}>{phone}</a>}
        <Link href="/formations" className="ml-auto hidden h-11 shrink-0 items-center rounded-[var(--radius-md)] bg-[var(--color-primary)] px-5 text-[14.5px] font-semibold text-white transition-transform hover:-translate-y-0.5 sm:inline-flex md:ml-0">
          Inscrire un élève
        </Link>
        <button type="button" onClick={() => setMenu(true)} aria-label="Ouvrir le menu" aria-expanded={menu} className="ml-auto grid h-11 w-11 place-items-center sm:ml-0 lg:hidden">
          <svg width="22" height="22" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h10" /></svg>
        </button>
      </div>
      {menu && (
        <div role="dialog" aria-modal="true" aria-label="Menu" className="fixed inset-0 z-50 flex flex-col bg-[var(--color-background)] px-5 pb-8 pt-4 lg:hidden">
          <div className="flex items-center justify-between">
            <span className="font-[family-name:var(--font-heading)] text-xl font-semibold">{tenantName}</span>
            <button type="button" onClick={() => setMenu(false)} aria-label="Fermer le menu" className="grid h-11 w-11 place-items-center">
              <svg width="22" height="22" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
            </button>
          </div>
          <nav aria-label="Menu mobile" className="mt-10 flex flex-col border-l-2 border-[var(--color-accent-secondary)] pl-5">
            <Link href="/" onClick={() => setMenu(false)} className="border-b border-[var(--color-border)] py-3 font-[family-name:var(--font-heading)] text-[30px] leading-tight">Accueil</Link>
            {NAV.map((n) => <Link key={n.href} href={n.href} onClick={() => setMenu(false)} className="border-b border-[var(--color-border)] py-3 font-[family-name:var(--font-heading)] text-[30px] leading-tight">{n.label}</Link>)}
          </nav>
          <div className="mt-auto grid gap-3">
            <Link href="/formations" onClick={() => setMenu(false)} className="inline-flex h-14 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-primary)] text-[16px] font-semibold text-white">Inscrire un élève</Link>
            {phone && <a href={`tel:${phone.replace(/\s/g, "")}`} className="inline-flex h-14 items-center justify-center rounded-[var(--radius-md)] ring-1 ring-inset ring-[var(--color-border)] text-[15px] font-semibold">Appeler · {phone}</a>}
          </div>
        </div>
      )}
    </header>
  );
}
