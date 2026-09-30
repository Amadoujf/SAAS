"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const NAV = [
  { href: "/envoyer", label: "Envoyer un colis" },
  { href: "/suivre", label: "Suivre un colis" },
  { href: "/#tarifs", label: "Tarifs" },
  { href: "/#contact", label: "Contact" },
];

/** En-tête « Trajet » : nom de la société, envoi et suivi en un geste. */
export function CourierHeader({ tenantName, logoUrl, phone }: { tenantName: string; logoUrl: string | null; phone: string | null }) {
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
  const focus = "rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-primary)]";
  return (
    <header className="sticky top-0 z-40 bg-[var(--color-primary)] text-white">
      <div className="mx-auto flex h-16 max-w-[var(--content-max-width,1240px)] items-center gap-6 px-4 sm:px-8">
        <Link href="/" aria-label={`${tenantName}, accueil`} className={`flex min-w-0 items-center gap-2.5 ${focus}`}>
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt={tenantName} className="h-9 w-auto max-w-[170px] object-contain" />
          ) : (
            <>
              <svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true" className="shrink-0">
                <circle cx="6" cy="24" r="4" fill="var(--color-accent-primary)" />
                <path d="M6 24 C 6 10, 24 20, 24 6" fill="none" stroke="var(--color-accent-primary)" strokeWidth="2.5" strokeDasharray="3 4" strokeLinecap="round" />
                <circle cx="24" cy="6" r="4" fill="none" stroke="var(--color-accent-primary)" strokeWidth="2.5" />
              </svg>
              <span className="truncate font-[family-name:var(--font-heading)] text-[21px] leading-none tracking-[-0.02em]">{tenantName}</span>
            </>
          )}
        </Link>
        <nav aria-label="Navigation principale" className="ml-auto hidden items-center gap-7 lg:flex">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} aria-current={pathname === n.href ? "page" : undefined} className={`text-[14.5px] font-medium text-white/70 transition-colors hover:text-white aria-[current=page]:text-[var(--color-accent-primary)] ${focus}`}>{n.label}</Link>
          ))}
        </nav>
        {phone && <a href={`tel:${phone.replace(/\s/g, "")}`} className={`yc-num ml-auto hidden text-[14.5px] font-semibold text-white/85 hover:text-white md:inline lg:ml-0 ${focus}`}>{phone}</a>}
        <Link href="/envoyer" className="ml-auto hidden h-11 shrink-0 items-center rounded-full bg-[var(--color-accent-primary)] px-5 text-[14.5px] font-bold text-[var(--color-primary)] transition-transform hover:-translate-y-0.5 sm:inline-flex md:ml-0">Demander une course</Link>
        <button type="button" onClick={() => setMenu(true)} aria-label="Ouvrir le menu" aria-expanded={menu} className="ml-auto grid h-11 w-11 place-items-center sm:ml-0 lg:hidden">
          <svg width="22" height="22" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h10" /></svg>
        </button>
      </div>
      {menu && (
        <div role="dialog" aria-modal="true" aria-label="Menu" className="fixed inset-0 z-50 flex flex-col bg-[var(--color-primary)] px-5 pb-8 pt-4 text-white lg:hidden">
          <div className="flex items-center justify-between">
            <span className="font-[family-name:var(--font-heading)] text-xl">{tenantName}</span>
            <button type="button" onClick={() => setMenu(false)} aria-label="Fermer le menu" className="grid h-11 w-11 place-items-center">
              <svg width="22" height="22" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
            </button>
          </div>
          <nav aria-label="Menu mobile" className="mt-10 flex flex-col">
            <Link href="/" onClick={() => setMenu(false)} className="border-b border-white/10 py-3 font-[family-name:var(--font-heading)] text-[30px] leading-tight">Accueil</Link>
            {NAV.map((n) => <Link key={n.href} href={n.href} onClick={() => setMenu(false)} className="border-b border-white/10 py-3 font-[family-name:var(--font-heading)] text-[30px] leading-tight">{n.label}</Link>)}
          </nav>
          <div className="mt-auto grid gap-3">
            <Link href="/envoyer" onClick={() => setMenu(false)} className="inline-flex h-14 items-center justify-center rounded-full bg-[var(--color-accent-primary)] text-[16px] font-bold text-[var(--color-primary)]">Demander une course</Link>
            {phone && <a href={`tel:${phone.replace(/\s/g, "")}`} className="inline-flex h-14 items-center justify-center rounded-full bg-white/10 text-[15px] font-semibold">Appeler · {phone}</a>}
          </div>
        </div>
      )}
    </header>
  );
}
