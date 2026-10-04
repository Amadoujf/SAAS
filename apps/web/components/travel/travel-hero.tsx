"use client";

import Link from "next/link";
import type { HeroSlide } from "@/lib/storefront/home-content";
import { Controls, Picture, Segments, useCarousel, useSwipe } from "@/components/store/hero-carousel";

export interface SlideTrip {
  slug: string;
  title: string;
  from: string;
  to: string;
  dates: string | null;
  seats: string | null;
  price: string;
}

const field = "h-12 w-full appearance-none rounded-[var(--radius-full)] bg-[var(--color-surface)] px-4 text-[14px] font-medium normal-case tracking-normal text-[var(--color-text-primary)] ring-1 ring-inset ring-transparent focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]";

/** Recherche de voyages : type, destination, mois de départ → /voyages (GET, partageable). */
export function TravelSearch({ countries, months, className = "" }: { countries: string[]; months: { value: string; label: string }[]; className?: string }) {
  return (
    <form action="/voyages" role="search" aria-label="Rechercher un voyage" className={`grid gap-2.5 rounded-[28px] bg-white p-3 shadow-[var(--shadow-lg)] sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end sm:p-3.5 ${className}`}>
      <label className="grid gap-1.5 px-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">Envie
        <select name="type" defaultValue="" className={field}>
          <option value="">Tous les voyages</option>
          <option value="pilgrimage">Pèlerinage</option>
          <option value="stay">Séjour</option>
          <option value="circuit">Circuit</option>
          <option value="excursion">Escapade</option>
        </select>
      </label>
      <label className="grid gap-1.5 px-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">Destination
        <select name="pays" defaultValue="" className={field}>
          <option value="">Toutes</option>
          {countries.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </label>
      <label className="grid gap-1.5 px-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">Départ
        <select name="mois" defaultValue="" className={field}>
          <option value="">Quand vous voulez</option>
          {months.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
      </label>
      <button type="submit" className="inline-flex h-12 items-center justify-center gap-2 rounded-[var(--radius-full)] bg-[var(--color-accent-primary)] px-7 text-[14px] font-semibold text-white transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
        Trouver
      </button>
    </form>
  );
}

/** Carte « embarquement » : le prochain départ RÉEL du voyage de la diapositive. */
function BoardingPass({ trip, active, reduced }: { trip: SlideTrip; active: boolean; reduced: boolean }) {
  return (
    <Link
      href={`/voyages/${trip.slug}#reserver`}
      tabIndex={active ? 0 : -1}
      className={`absolute bottom-40 right-8 z-10 hidden w-[360px] overflow-hidden rounded-[22px] bg-[var(--color-background)] text-[var(--color-text-primary)] shadow-[var(--shadow-lg)] transition-all hover:-translate-y-1 lg:block ${reduced ? "" : "delay-300 duration-700"} ${active ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"}`}
    >
      <span className="flex items-center justify-between bg-[var(--color-primary)] px-5 py-2.5 text-[10.5px] font-semibold uppercase tracking-[0.24em] text-white/85">
        <span>Carte d&apos;embarquement</span>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z" /></svg>
      </span>
      <span className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-5 pt-4">
        <span className="min-w-0"><span className="block text-[10px] uppercase tracking-[0.2em] text-[var(--color-text-muted)]">Départ</span><span className="block truncate font-[family-name:var(--font-heading)] text-[22px]">{trip.from}</span></span>
        <span className="text-[var(--color-accent-primary)]" aria-hidden="true">✈</span>
        <span className="min-w-0 text-right"><span className="block text-[10px] uppercase tracking-[0.2em] text-[var(--color-text-muted)]">Arrivée</span><span className="block truncate font-[family-name:var(--font-heading)] text-[22px]">{trip.to}</span></span>
      </span>
      <span className="mx-5 mt-3 block border-t border-dashed border-[var(--color-border)]" />
      <span className="grid grid-cols-2 gap-3 px-5 py-4 text-[13px]">
        <span><span className="block text-[10px] uppercase tracking-[0.2em] text-[var(--color-text-muted)]">Dates</span><span className="font-semibold">{trip.dates ?? "Sur demande"}</span></span>
        <span className="text-right"><span className="block text-[10px] uppercase tracking-[0.2em] text-[var(--color-text-muted)]">Places</span><span className="font-semibold">{trip.seats ?? "—"}</span></span>
      </span>
      <span className="flex items-center justify-between bg-[var(--color-surface)] px-5 py-3.5">
        <span className="text-[15px] font-semibold">{trip.price}</span>
        <span className="text-[13px] font-semibold text-[var(--color-accent-primary)]">Réserver →</span>
      </span>
    </Link>
  );
}

/** Accueil d'une agence : la grande image, le titre et le départ mis en avant changent
 *  ensemble ; pause (survol, focus, bouton), flèches clavier, balayage mobile. */
export function TravelHero({ slides, autoplaySeconds, trips, countries, months }: { slides: HeroSlide[]; autoplaySeconds: number; trips: Record<string, SlideTrip>; countries: string[]; months: { value: string; label: string }[] }) {
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
      <div className="relative h-[calc(100svh-73px)] max-h-[880px] min-h-[580px] overflow-hidden bg-[var(--color-primary)] text-white" {...swipe}>
        {slides.map((s, i) => {
          const active = i === c.index;
          const trip = s.productId ? trips[s.productId] : undefined;
          return (
            <div key={s.id} role="group" aria-roledescription="diapositive" aria-label={`${i + 1} sur ${slides.length}`} aria-hidden={!active} className={`absolute inset-0 transition-opacity ${c.reduced ? "" : "duration-1000"} ${active ? "z-10 opacity-100" : "pointer-events-none opacity-0"}`}>
              {s.imageUrl && <Picture slide={s} eager={i === 0} className={`absolute inset-0 h-full w-full object-cover transition-transform ${c.reduced ? "" : "duration-[10000ms] ease-out"} ${active ? "scale-[1.08]" : "scale-100"}`} />}
              <span className="absolute inset-0 bg-[linear-gradient(180deg,rgba(10,16,32,0.25)_0%,rgba(10,16,32,0.05)_35%,rgba(10,16,32,0.72)_100%)]" aria-hidden="true" />
              <div className="relative mx-auto flex h-full max-w-[var(--content-max-width,1320px)] flex-col justify-end px-5 pb-44 sm:px-8 sm:pb-40">
                <div className={`max-w-3xl transition-all ${c.reduced ? "" : "duration-700"} ${active ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"}`}>
                  {s.eyebrow && <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-white/80">{s.eyebrow}</p>}
                  <h2 className="mt-4 font-[family-name:var(--font-heading)] text-[46px] leading-[0.98] tracking-[-0.02em] sm:text-[72px] lg:text-[88px]">{s.title}</h2>
                  {s.subtitle && <p className="mt-5 max-w-xl text-[16px] leading-relaxed text-white/85 sm:text-[18px]">{s.subtitle}</p>}
                  {s.ctaLabel && s.ctaHref && (
                    <Link href={s.ctaHref} tabIndex={active ? 0 : -1} className="mt-8 inline-flex h-12 items-center gap-3 rounded-[var(--radius-full)] bg-white px-6 text-[14px] font-semibold text-[var(--color-primary)] transition-transform hover:-translate-y-0.5">
                      {s.ctaLabel}
                      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" /></svg>
                    </Link>
                  )}
                </div>
              </div>
              {trip && <BoardingPass trip={trip} active={active} reduced={c.reduced} />}
            </div>
          );
        })}
        {slides.length > 1 && (
          <div className="absolute inset-x-0 bottom-28 z-20 sm:bottom-24">
            <div className="mx-auto flex max-w-[var(--content-max-width,1320px)] items-center gap-4 px-5 sm:px-8">
              <p className="shrink-0 font-[family-name:var(--font-heading)] text-sm tabular-nums text-white/90">{String(c.index + 1).padStart(2, "0")} <span className="mx-1 text-white/50">/</span> {String(slides.length).padStart(2, "0")}</p>
              <div className="hidden sm:block"><Segments count={slides.length} index={c.index} running={c.running} seconds={autoplaySeconds} go={c.go} tone="light" /></div>
              <div className="ml-auto"><Controls count={slides.length} index={c.index} go={c.go} paused={c.paused} setPaused={c.setPaused} tone="light" label="Diapositives" dots={false} /></div>
            </div>
          </div>
        )}
      </div>
      <div className="relative z-20 mx-auto -mt-20 max-w-[var(--content-max-width,1320px)] px-4 sm:-mt-14 sm:px-8">
        <TravelSearch countries={countries} months={months} />
      </div>
    </section>
  );
}
