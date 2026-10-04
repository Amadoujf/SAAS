"use client";

import Link from "next/link";
import type { HeroSlide } from "@/lib/storefront/home-content";
import { Controls, Picture, Segments, useCarousel, useSwipe } from "@/components/store/hero-carousel";

export interface SlideProperty { slug: string; title: string; price: string; facts: string; place: string | null; deal: string }

const selectCls = "h-12 w-full appearance-none rounded-[var(--radius-md)] bg-white px-3.5 text-[14px] text-[var(--color-text-primary)] ring-1 ring-inset ring-[var(--color-border)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]";

/** Recherche de biens : envoie vers /biens avec les filtres (GET, partageable). */
export function EstateSearch({ className = "" }: { className?: string }) {
  return (
    <form action="/biens" role="search" aria-label="Rechercher un bien" className={`grid gap-2.5 rounded-[var(--radius-lg)] bg-white p-3 shadow-[var(--shadow-lg)] sm:grid-cols-[1fr_1fr_1fr_1fr_auto] sm:p-3.5 ${className}`}>
      <label className="grid gap-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">Projet
        <select name="transaction" className={selectCls} defaultValue="">
          <option value="">Acheter ou louer</option>
          <option value="sale">Acheter</option>
          <option value="rent">Louer</option>
        </select>
      </label>
      <label className="grid gap-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">Type
        <select name="type" className={selectCls} defaultValue="">
          <option value="">Tous les biens</option>
          <option value="villa">Villa</option>
          <option value="apartment">Appartement</option>
          <option value="house">Maison</option>
          <option value="land">Terrain</option>
          <option value="commercial">Local commercial</option>
          <option value="office">Bureau</option>
        </select>
      </label>
      <label className="grid gap-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">Commune
        <input name="commune" placeholder="Almadies, Mermoz…" className={selectCls} />
      </label>
      <label className="grid gap-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">Chambres
        <select name="chambres" className={selectCls} defaultValue="">
          <option value="">Indifférent</option>
          <option value="1">1 et plus</option>
          <option value="2">2 et plus</option>
          <option value="3">3 et plus</option>
          <option value="4">4 et plus</option>
        </select>
      </label>
      <button type="submit" className="mt-auto inline-flex h-12 items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-primary)] px-7 text-[14px] font-semibold text-white transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
        Rechercher
      </button>
    </form>
  );
}

/** Accueil d'une agence : la photo, le texte et le bien mis en avant changent
 *  ensemble ; pause (survol, focus, bouton), flèches clavier, balayage mobile. */
export function EstateHero({ slides, autoplaySeconds, properties }: { slides: HeroSlide[]; autoplaySeconds: number; properties: Record<string, SlideProperty> }) {
  const c = useCarousel(slides.length, autoplaySeconds);
  const swipe = useSwipe((d) => c.go(c.index + d));
  return (
    <section
      aria-roledescription="carrousel"
      aria-label="À la une"
      className="relative"
      onMouseEnter={() => c.setHovered(true)}
      onMouseLeave={() => c.setHovered(false)}
      onFocus={() => c.setFocused(true)}
      onBlur={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && c.setFocused(false)}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") c.go(c.index + 1);
        if (e.key === "ArrowLeft") c.go(c.index - 1);
      }}
    >
      <div className="relative h-[calc(100svh-73px)] max-h-[860px] min-h-[560px] overflow-hidden bg-[var(--color-primary)] text-white" {...swipe}>
        {slides.map((s, i) => {
          const active = i === c.index;
          const property = s.productId ? properties[s.productId] : undefined;
          return (
            <div key={s.id} role="group" aria-roledescription="diapositive" aria-label={`${i + 1} sur ${slides.length}`} aria-hidden={!active} className={`absolute inset-0 transition-opacity ${c.reduced ? "" : "duration-1000"} ${active ? "z-10 opacity-100" : "pointer-events-none opacity-0"}`}>
              {s.imageUrl && <Picture slide={s} eager={i === 0} className={`absolute inset-0 h-full w-full object-cover transition-transform ${c.reduced ? "" : "duration-[9000ms] ease-out"} ${active ? "scale-[1.06]" : "scale-100"}`} />}
              <span className="absolute inset-0 bg-[linear-gradient(90deg,rgba(8,16,34,0.78)_0%,rgba(8,16,34,0.35)_55%,rgba(8,16,34,0.1)_100%)] max-sm:bg-[linear-gradient(0deg,rgba(8,16,34,0.85)_0%,rgba(8,16,34,0.35)_60%,rgba(8,16,34,0.2)_100%)]" aria-hidden="true" />
              <div className="relative mx-auto flex h-full max-w-[var(--content-max-width,1320px)] flex-col justify-end px-5 pb-40 sm:justify-center sm:px-8 sm:pb-24">
                <div className={`max-w-2xl transition-all ${c.reduced ? "" : "duration-700"} ${active ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"}`}>
                  {s.eyebrow && <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-white/80">{s.eyebrow}</p>}
                  <h2 className="mt-4 font-[family-name:var(--font-heading)] text-[44px] leading-[1.02] tracking-[-0.015em] sm:text-[64px] lg:text-[76px]">{s.title}</h2>
                  {s.subtitle && <p className="mt-5 max-w-lg text-[16px] leading-relaxed text-white/85 sm:text-[17px]">{s.subtitle}</p>}
                  {s.ctaLabel && s.ctaHref && (
                    <Link href={s.ctaHref} tabIndex={active ? 0 : -1} className="mt-8 inline-flex h-12 items-center gap-3 rounded-[var(--radius-md)] bg-white px-6 text-[14px] font-semibold text-[var(--color-primary)] transition-transform hover:-translate-y-0.5">
                      {s.ctaLabel}
                      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" /></svg>
                    </Link>
                  )}
                </div>
              </div>
              {property && (
                <Link
                  href={`/biens/${property.slug}`}
                  tabIndex={active ? 0 : -1}
                  className={`absolute bottom-36 right-8 z-10 hidden w-[320px] rounded-[var(--radius-lg)] bg-white/95 p-5 text-[var(--color-text-primary)] shadow-[var(--shadow-lg)] backdrop-blur transition-all hover:-translate-y-1 lg:block ${c.reduced ? "" : "delay-200 duration-700"} ${active ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"}`}
                >
                  <span className="text-[10.5px] font-semibold uppercase tracking-[0.2em] text-[var(--color-accent-primary)]">{property.deal}{property.place ? ` · ${property.place}` : ""}</span>
                  <span className="mt-1.5 block font-[family-name:var(--font-heading)] text-[21px] leading-snug">{property.title}</span>
                  {property.facts && <span className="mt-1 block text-[13px] text-[var(--color-text-secondary)]">{property.facts}</span>}
                  <span className="mt-3 flex items-center justify-between border-t border-[var(--color-border)] pt-3">
                    <span className="text-[15px] font-semibold">{property.price}</span>
                    <span className="text-[13px] font-semibold text-[var(--color-primary)]">Voir le bien →</span>
                  </span>
                </Link>
              )}
            </div>
          );
        })}
        {slides.length > 1 && (
          <div className="absolute inset-x-0 bottom-24 z-20 sm:bottom-20">
            <div className="mx-auto flex max-w-[var(--content-max-width,1320px)] items-center gap-4 px-5 sm:px-8">
              <p className="shrink-0 font-[family-name:var(--font-heading)] text-sm tabular-nums text-white/90">{String(c.index + 1).padStart(2, "0")} <span className="mx-1 text-white/50">/</span> {String(slides.length).padStart(2, "0")}</p>
              <div className="hidden sm:block"><Segments count={slides.length} index={c.index} running={c.running} seconds={autoplaySeconds} go={c.go} tone="light" /></div>
              <div className="ml-auto"><Controls count={slides.length} index={c.index} go={c.go} paused={c.paused} setPaused={c.setPaused} tone="light" label="Diapositives" dots={false} /></div>
            </div>
          </div>
        )}
      </div>
      <div className="relative z-20 mx-auto -mt-16 max-w-[var(--content-max-width,1320px)] px-4 sm:-mt-12 sm:px-8">
        <EstateSearch />
      </div>
    </section>
  );
}
