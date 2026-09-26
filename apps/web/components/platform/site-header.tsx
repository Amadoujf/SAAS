"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { YcLogo } from "@/components/yc/logo";
import { IconArrowRight, IconMenu, IconX } from "@/components/yc/icons";

/** Secteurs couverts : seul le commerce est ouvert aujourd'hui ; les autres sont
 *  annoncés honnêtement comme « bientôt », jamais proposés à la vente. */
export const SECTOR_LINKS = [
  { key: "commerce", label: "Commerce", sectorKeys: ["ecommerce", "fashion"], liveNote: "Boutiques en ligne" },
  { key: "immobilier", label: "Immobilier", sectorKeys: ["real_estate"], liveNote: "Biens et locations" },
  { key: "voyage", label: "Voyage", sectorKeys: ["travel_agency"], liveNote: "Offres et réservations" },
  { key: "restauration", label: "Restauration", sectorKeys: ["restaurant"], liveNote: "Carte et réservations" },
  { key: "services", label: "Services", sectorKeys: ["services"], liveNote: "Prestations et rendez-vous" },
] as const;

/** Disponibilité d'un univers : ouvert si l'un de ses secteurs est opérationnel en base. */
export function withAvailability(availableSectors: string[]) {
  return SECTOR_LINKS.map((s) => {
    const available = s.sectorKeys.some((k) => availableSectors.includes(k));
    return { ...s, available, note: available ? s.liveNote : "À venir" };
  });
}

const LINKS = [
  { href: "#templates", label: "Templates" },
  { href: "#tarifs", label: "Tarifs" },
];

export function PlatformHeader({ availableSectors }: { availableSectors: string[] }) {
  const sectors = withAvailability(availableSectors);
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [solutions, setSolutions] = useState(false);
  const solutionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!solutions) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !solutionsRef.current?.contains(e.target as Node)) setSolutions(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [solutions]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  return (
    <header className={`sticky top-0 z-50 border-b transition-colors duration-300 ${scrolled ? "border-yc-navy/10 bg-yc-paper/90 backdrop-blur-md" : "border-transparent bg-yc-paper xl:bg-transparent"}`}>
      <div className="mx-auto flex h-[72px] max-w-[1200px] items-center gap-10 px-4 sm:px-8">
        <Link href="/" aria-label="YamaCommerce, accueil" className="rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yc-royal"><YcLogo /></Link>

        <nav aria-label="Principale" className="hidden items-center gap-1 text-[15px] text-yc-navy-ink lg:flex">
          <div ref={solutionsRef} className="relative">
            <button type="button" aria-expanded={solutions} aria-controls="yc-solutions" onClick={() => setSolutions((v) => !v)}
              className="flex items-center gap-1.5 rounded-md px-3.5 py-2 font-medium hover:text-yc-royal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yc-royal">
              Solutions
              <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" className={`transition-transform ${solutions ? "rotate-180" : ""}`}><path d="M2.5 4.5 6 8l3.5-3.5" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" /></svg>
            </button>
            {solutions && (
              <div id="yc-solutions" className="absolute left-0 top-full mt-2 w-72 rounded-xl border border-yc-navy/10 bg-white p-2 shadow-[0_24px_60px_-24px_rgb(12_22_48/0.35)]">
                {sectors.map((s) => (
                  <a key={s.key} href={`#univers-${s.key}`} onClick={() => setSolutions(false)} className="flex items-center justify-between rounded-lg px-3 py-2.5 hover:bg-yc-paper">
                    <span className="font-medium text-yc-navy-ink">{s.label}</span>
                    <span className={`text-xs ${s.available ? "font-semibold text-yc-royal" : "text-yc-ink-soft"}`}>{s.note}</span>
                  </a>
                ))}
              </div>
            )}
          </div>
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} className="rounded-md px-3.5 py-2 font-medium hover:text-yc-royal">{l.label}</a>
          ))}
        </nav>

        <div className={`ml-auto hidden items-center gap-5 rounded-xl sm:flex ${scrolled ? "" : "xl:bg-yc-paper/85 xl:py-1.5 xl:pl-5 xl:pr-1.5 xl:backdrop-blur-md"}`}>
          <Link href="/connexion" className="text-[15px] font-medium text-yc-navy-ink hover:text-yc-royal">Connexion</Link>
          <Link href="/creer-ma-boutique" className="rounded-lg bg-yc-royal px-5 py-2.5 text-[15px] font-semibold text-white shadow-[0_8px_20px_-10px_rgb(12_61_186/0.8)] transition-colors hover:bg-yc-royal-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yc-royal focus-visible:ring-offset-2">Commencer</Link>
        </div>

        <button type="button" aria-label="Ouvrir le menu" aria-expanded={open} onClick={() => setOpen(true)} className="ml-auto grid h-11 w-11 place-items-center text-yc-navy-ink sm:ml-0 lg:hidden">
          <IconMenu size={26} />
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-yc-paper lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="flex h-[72px] items-center justify-between px-4 sm:px-8">
            <YcLogo />
            <button type="button" aria-label="Fermer le menu" onClick={() => setOpen(false)} className="grid h-11 w-11 place-items-center text-yc-navy-ink"><IconX size={26} /></button>
          </div>
          <nav aria-label="Menu mobile" className="flex flex-1 flex-col px-4 pb-8 sm:px-8">
            <p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.22em] text-yc-ink-soft">Solutions</p>
            {sectors.map((s) => (
              <a key={s.key} href={`#univers-${s.key}`} onClick={() => setOpen(false)} className="flex items-baseline justify-between border-b border-yc-navy/10 py-3.5">
                <span className="font-editorial text-[28px] leading-none text-yc-navy-ink">{s.label}</span>
                <span className={`text-xs ${s.available ? "font-semibold text-yc-royal" : "text-yc-ink-soft"}`}>{s.note}</span>
              </a>
            ))}
            {LINKS.map((l) => (
              <a key={l.href} href={l.href} onClick={() => setOpen(false)} className="border-b border-yc-navy/10 py-3.5 font-editorial text-[28px] leading-none text-yc-navy-ink">{l.label}</a>
            ))}
            <div className="mt-auto grid gap-3 pt-10">
              <Link href="/creer-ma-boutique" className="flex items-center justify-center gap-2 rounded-lg bg-yc-royal px-6 py-4 text-base font-semibold text-white">Créer mon site <IconArrowRight size={18} /></Link>
              <Link href="/connexion" className="flex items-center justify-center rounded-lg border border-yc-navy/80 px-6 py-4 text-base font-semibold text-yc-navy">Connexion</Link>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
