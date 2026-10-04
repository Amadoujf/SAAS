"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef, useState } from "react";
import { IconArrowRight } from "@/components/yc/icons";
import { SECTOR_LINKS, withAvailability } from "./site-header";

type SectorKey = (typeof SECTOR_LINKS)[number]["key"];

/** Ce que chaque secteur propose. Seul le commerce est ouvert : les autres
 *  univers sont montrés comme des directions en préparation, sans lien d'achat. */
const UNIVERSES: Record<SectorKey, { intro: string; card?: { img: string; title: [string, string]; text: string } }> = {
  commerce: {
    intro: "Boutiques en ligne complètes : catalogue, stock, panier, paiements Wave, Orange Money ou à la livraison, suivi des commandes.",
    card: { img: "/marketing/secteur-commerce.jpg", title: ["Boutiques en ligne", "qui ont du style."], text: "Mode, beauté, artisanat, déco…" },
  },
  immobilier: {
    intro: "Des vitrines pour villas, appartements et terrains, avec demandes de visite.",
    card: { img: "/marketing/secteur-immobilier.jpg", title: ["Immobilier", "en toute confiance."], text: "Villas, appartements, terrains…" },
  },
  voyage: {
    intro: "Circuits, séjours et activités présentés comme une invitation au voyage.",
    card: { img: "/marketing/secteur-voyage.jpg", title: ["Voyages et séjours", "authentiques."], text: "Circuits, séjours, activités…" },
  },
  restauration: { intro: "Menus, commandes à emporter et réservations pour restaurants et traiteurs." },
  services: { intro: "Prises de rendez-vous et devis pour les prestataires de services." },
};

const CARD_ORDER: SectorKey[] = ["commerce", "immobilier", "voyage"];

export function SectorUniverses({ availableSectors }: { availableSectors: string[] }) {
  const sectors = withAvailability(availableSectors);
  const [active, setActive] = useState<SectorKey>("commerce");
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const current = sectors.find((s) => s.key === active)!;

  const onKey = (e: React.KeyboardEvent, i: number) => {
    const dir = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    const next = (i + dir + SECTOR_LINKS.length) % SECTOR_LINKS.length;
    setActive(SECTOR_LINKS[next]!.key);
    tabs.current[next]?.focus();
  };

  return (
    <div>
      <div role="tablist" aria-label="Secteurs" className="-mx-4 flex overflow-x-auto border-b border-yc-navy/10 px-4 [scrollbar-width:none] sm:mx-0 sm:px-0">
        {sectors.map((s, i) => (
          <button
            key={s.key}
            id={`univers-${s.key}`}
            ref={(el) => { tabs.current[i] = el; }}
            role="tab"
            type="button"
            aria-selected={active === s.key}
            aria-controls="univers-panel"
            tabIndex={active === s.key ? 0 : -1}
            onClick={() => setActive(s.key)}
            onKeyDown={(e) => onKey(e, i)}
            className={`relative shrink-0 scroll-mt-24 px-4 pb-3.5 pt-2 text-[15px] transition-colors first:pl-0 sm:px-8 sm:first:pl-7 ${active === s.key ? "font-semibold text-yc-royal" : "text-yc-ink-soft hover:text-yc-navy-ink"}`}
          >
            {s.label}
            <span className={`absolute inset-x-0 -bottom-px h-[2px] bg-yc-royal transition-opacity first:left-0 ${active === s.key ? "opacity-100" : "opacity-0"}`} />
          </button>
        ))}
      </div>

      <div id="univers-panel" role="tabpanel" aria-labelledby={`univers-${active}`} className="mt-10 sm:mt-14">
        <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr] lg:items-end">
          <h2 className="font-editorial text-[40px] leading-[1.02] tracking-[-0.01em] text-yc-navy-ink sm:text-[56px]">Un univers pour chaque entreprise.</h2>
          <p className="max-w-md text-[15px] leading-relaxed text-yc-ink-soft lg:justify-self-end" aria-live="polite">
            <span className="font-semibold text-yc-navy-ink">{current.label}</span>
            {current.available ? " · disponible" : " · bientôt"} — {UNIVERSES[active].intro}
          </p>
        </div>

        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {CARD_ORDER.map((key) => {
            const u = UNIVERSES[key].card!;
            const sector = sectors.find((s) => s.key === key)!;
            return (
              <article key={key} className="group relative overflow-hidden rounded-md">
                <div className="relative aspect-[349/238]">
                  <Image src={u.img} alt="" fill sizes="(min-width: 768px) 33vw, 100vw" className="object-cover transition-transform duration-700 ease-yc group-hover:scale-[1.03]" />
                  {/* Encart : couvre le coin bas-gauche de la photo, comme une légende de magazine. */}
                  <div className="absolute bottom-0 left-0 flex h-[42%] min-h-[118px] w-[62%] min-w-[210px] flex-col justify-center bg-yc-paper px-4 py-3 sm:px-5">
                    <h3 className="font-editorial text-[19px] leading-[1.08] text-yc-navy-ink xl:text-[21px]">{u.title[0]}<br />{u.title[1]}</h3>
                    <p className="mt-1 truncate text-xs text-yc-ink-soft">{u.text}</p>
                    {sector.available ? (
                      <Link href="/creer-ma-boutique" className="mt-2 inline-flex w-fit items-center gap-1.5 text-[13px] font-semibold text-yc-royal after:absolute after:inset-0 hover:underline">
                        Découvrir <IconArrowRight size={14} />
                      </Link>
                    ) : (
                      <span className="mt-2 inline-flex w-fit rounded-full bg-yc-paper-deep px-2.5 py-0.5 text-[11px] font-semibold text-yc-ink-soft">Bientôt disponible</span>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
}
