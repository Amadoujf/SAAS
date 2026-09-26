"use client";

import Link from "next/link";
import { useState } from "react";
import { IconArrowRight } from "@/components/yc/icons";

/** Les 5 templates réels du projet (routes /demo/* existantes), présentés par leur
 *  direction artistique propre — composition, typographie, rythme — et non une
 *  simple couleur. Aperçu interactif : survol/focus révèle la composition, le lien
 *  ouvre la démo complète. */
const TEMPLATES = [
  { slug: "teranga-atelier", name: "Teranga Atelier", sector: "Mode africaine contemporaine", bg: "#FBF6EC", ink: "#241A12", primary: "#2C3A63", accent: "#C1622D", font: "Cambria, Georgia, serif", layout: "editorial" },
  { slug: "commerce-moderne", name: "Sunu Kicks", sector: "Commerce moderne & streetwear", bg: "#16181D", ink: "#FFFFFF", primary: "#FF5A1F", accent: "#FF5A1F", font: "var(--font-yc-display), sans-serif", layout: "bold" },
  { slug: "luxury-minimal", name: "Maison Almadies", sector: "Luxe minimaliste", bg: "#F8F2E8", ink: "#1B140F", primary: "#15100C", accent: "#A8823F", font: "Georgia, serif", layout: "luxe" },
  { slug: "marketplace", name: "Sunu Marché", sector: "Marketplace multi-catégories", bg: "#FFFFFF", ink: "#1A1F36", primary: "#0F52BA", accent: "#FFB020", font: "var(--font-yc-ui), sans-serif", layout: "grid" },
  { slug: "dakar-distribution-pro", name: "Dakar Distribution Pro", sector: "Grossiste & revendeurs", bg: "#FFFFFF", ink: "#101828", primary: "#0B1E3D", accent: "#0EA5C4", font: "var(--font-yc-ui), sans-serif", layout: "b2b" },
] as const;

function Mock({ t }: { t: (typeof TEMPLATES)[number] }) {
  const bar = (w: string, o = 0.18) => <span className="block h-2 rounded-full" style={{ width: w, background: t.ink, opacity: o }} />;
  return (
    <div className="flex h-full flex-col [container-type:inline-size]" style={{ background: t.bg, color: t.ink, fontFamily: t.font }}>
      <div className="flex items-center justify-between px-5 py-4 text-[13px]">
        <span className="truncate whitespace-nowrap font-semibold tracking-tight">{t.name}</span>
        <span className="ml-3 hidden shrink-0 gap-3 opacity-60 [@container(min-width:300px)]:flex"><span>Collections</span><span>Panier</span></span>
      </div>
      {t.layout === "editorial" && (
        <div className="grid flex-1 grid-cols-[1.2fr_1fr] gap-3 px-5 pb-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/demo-commerce/boubou.svg" alt="" className="h-full w-full rounded-[4px] object-cover" loading="lazy" />
          <div className="flex flex-col justify-end gap-2"><span className="text-2xl leading-none">Fait à Thiès,<br /><em>porté partout.</em></span>{bar("70%")}<span className="mt-2 w-fit border-b pb-0.5 text-xs" style={{ borderColor: t.accent, color: t.accent }}>Découvrir</span></div>
        </div>
      )}
      {t.layout === "bold" && (
        <div className="relative flex-1 px-5 pb-5">
          <span className="block text-[44px] font-black uppercase leading-[0.85] tracking-tighter">Drop<br /><span style={{ color: t.accent }}>023</span></span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/demo-commerce/sandales.svg" alt="" className="absolute bottom-4 right-4 h-[62%] rotate-[-8deg] rounded-2xl object-cover" loading="lazy" />
        </div>
      )}
      {t.layout === "luxe" && (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 pb-6 text-center">
          <span className="text-[10px] uppercase tracking-[0.4em]" style={{ color: t.accent }}>Collection Harmattan</span>
          <span className="text-3xl font-light italic leading-tight">L&apos;élégance<br />du silence</span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/demo-commerce/bracelet.svg" alt="" className="mt-2 h-24 w-24 rounded-full object-cover" loading="lazy" />
        </div>
      )}
      {t.layout === "grid" && (
        <div className="flex-1 px-5 pb-5">
          <div className="mb-3 flex gap-2 text-[10px] font-semibold">{["Mode", "Maison", "Beauté", "Épicerie"].map((c) => <span key={c} className="rounded-full px-2 py-1" style={{ background: `${t.primary}14`, color: t.primary }}>{c}</span>)}</div>
          <div className="grid grid-cols-4 gap-2">
            {["huile", "panier", "tissu", "chapeau", "sac-wax", "bracelet", "boubou", "sandales"].map((i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i} src={`/demo-commerce/${i}.svg`} alt="" className="aspect-square w-full rounded-lg object-cover" loading="lazy" />
            ))}
          </div>
          <span className="mt-3 inline-block rounded-md px-2 py-1 text-[10px] font-bold" style={{ background: t.accent, color: "#1A1F36" }}>-20 % ce week-end</span>
        </div>
      )}
      {t.layout === "b2b" && (
        <div className="flex-1 px-5 pb-5 text-[11px]">
          <div className="rounded-lg p-3 text-white" style={{ background: t.primary }}><span className="font-semibold">Espace revendeur</span><span className="float-right" style={{ color: t.accent }}>Tarifs pro</span></div>
          {["Riz parfumé 25 kg", "Huile 20 L", "Sucre 50 kg"].map((p, i) => (
            <div key={p} className="flex items-center justify-between gap-2 whitespace-nowrap border-b py-2.5" style={{ borderColor: `${t.ink}14` }}>
              <span className="truncate">{p}</span><span className="font-semibold">{["14 500", "21 000", "27 800"][i]} F / u</span><span className="rounded px-1.5 py-0.5 text-[9px] font-bold text-white" style={{ background: t.accent }}>+ Devis</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function TemplateShowcase() {
  const [active, setActive] = useState(0);
  return (
    <div>
      <div className="-mx-5 flex snap-x snap-mandatory gap-5 overflow-x-auto px-5 pb-6 sm:-mx-8 sm:px-8 lg:mx-0 lg:overflow-visible lg:px-0" role="list">
        {TEMPLATES.map((t, i) => (
          <div key={t.slug} role="listitem" className={`group w-[78vw] max-w-[360px] shrink-0 snap-center transition-all duration-500 ease-yc sm:w-[46vw] lg:w-auto lg:min-w-0 lg:max-w-none ${active === i ? "lg:flex-[2.2]" : "lg:flex-1"}`}
            onMouseEnter={() => setActive(i)} onFocus={() => setActive(i)}>
            <Link href={`/demo/${t.slug}`} className="yc-focus block overflow-hidden rounded-[26px] bg-white/5 ring-1 ring-white/10 transition-all duration-500 group-hover:-translate-y-1 group-hover:ring-white/30">
              <div className="h-[340px] overflow-hidden rounded-t-[26px] sm:h-[380px]"><Mock t={t} /></div>
              <div className="flex items-center justify-between gap-3 px-5 py-4 text-white">
                <span className="min-w-0"><span className="block truncate font-display text-lg font-semibold">{t.name}</span><span className="block truncate text-xs text-white/55">{t.sector}</span></span>
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/10 transition-colors group-hover:bg-yc-cyan group-hover:text-yc-night-950" aria-label="Voir la démo"><IconArrowRight size={18} /></span>
              </div>
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
