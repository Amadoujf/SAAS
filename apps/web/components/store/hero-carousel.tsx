"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { HeroSlide } from "@/lib/storefront/home-content";
import { QuickViewButton } from "./quick-view";

/** Produit mis en scène par une diapositive (résolu côté serveur). */
export interface SlideProduct { slug: string; name: string; price: number; category: string | null }

const fcfa = (n: number) => `${new Intl.NumberFormat("fr-SN").format(n)} FCFA`;

/** Barre de progression segmentée : le segment actif se remplit pendant la durée de
 *  la diapositive (figé en pause). */
export function Segments({ count, index, running, seconds, go, tone = "dark" }: { count: number; index: number; running: boolean; seconds: number; go: (i: number) => void; tone?: "light" | "dark" }) {
  return (
    <div className="flex items-center gap-1.5" role="group" aria-label="Choisir une diapositive">
      {Array.from({ length: count }, (_, i) => (
        <button key={i} type="button" onClick={() => go(i)} aria-label={`Aller à la diapositive ${i + 1}`} aria-current={i === index ? "true" : undefined}
          className="relative h-6 w-10 sm:w-14">
          <span className={`absolute inset-x-0 top-1/2 h-[3px] -translate-y-1/2 overflow-hidden rounded-full ${tone === "light" ? "bg-white/25" : "bg-[color-mix(in_srgb,var(--color-text-primary)_15%,transparent)]"}`}>
            <span key={`${index}-${running}`} className={`absolute inset-y-0 left-0 rounded-full ${tone === "light" ? "bg-white" : "bg-[var(--color-primary)]"}`}
              style={i < index ? { width: "100%" } : i === index ? (running ? { animation: `yc-progress ${seconds}s linear forwards` } : { width: "100%" }) : { width: 0 }} />
          </span>
        </button>
      ))}
    </div>
  );
}

/**
 * Carrousel d'accueil. Accessibilité (WCAG 2.2.2) : défilement automatique suspendu au
 * survol, au focus clavier, par un bouton Pause explicite, et désactivé si
 * l'utilisateur demande moins d'animations. Navigation : boutons, points, flèches du
 * clavier, glissement du doigt sur mobile. Titres et boutons sont du texte réel.
 */
export function Picture({ slide, eager, className }: { slide: HeroSlide; eager: boolean; className: string }) {
  if (!slide.imageUrl) return null;
  return (
    <picture>
      {slide.mobileImageUrl && <source media="(max-width: 640px)" srcSet={slide.mobileImageUrl} />}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={slide.imageUrl} alt={slide.imageAlt} className={className} loading={eager ? "eager" : "lazy"} fetchPriority={eager ? "high" : "auto"} decoding="async" />
    </picture>
  );
}

export function useCarousel(count: number, autoplaySeconds: number) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false); // choix explicite de l'utilisateur
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  const running = count > 1 && !paused && !hovered && !focused && !reduced;
  useEffect(() => {
    if (!running) return;
    const t = setTimeout(() => setIndex((i) => (i + 1) % count), autoplaySeconds * 1000);
    return () => clearTimeout(t);
  }, [running, index, count, autoplaySeconds]);
  const go = useCallback((i: number) => setIndex(((i % count) + count) % count), [count]);
  return { index, go, paused, setPaused, setHovered, setFocused, running, reduced };
}

export function Controls({ count, index, go, paused, setPaused, tone, label, dots = true }: { count: number; index: number; go: (i: number) => void; paused: boolean; setPaused: (v: boolean) => void; tone: "light" | "dark"; label: string; dots?: boolean }) {
  if (count < 2) return null;
  const btn = `grid h-10 w-10 place-items-center rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${tone === "light" ? "border-white/60 text-white hover:bg-white/15 focus-visible:ring-white" : "border-[color-mix(in_srgb,var(--color-text-primary)_28%,transparent)] bg-[var(--color-background)] text-[var(--color-text-primary)] hover:bg-[var(--color-surface-muted)] focus-visible:ring-[var(--color-primary)]"}`;
  return (
    <div className="flex items-center gap-2">
      <button type="button" className={btn} onClick={() => go(index - 1)} aria-label="Diapositive précédente">
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3 5 8l5 5" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" /></svg>
      </button>
      {dots && <div className="flex items-center gap-1.5 px-1" role="group" aria-label={label}>
        {Array.from({ length: count }, (_, i) => (
          <button key={i} type="button" onClick={() => go(i)} aria-label={`Aller à la diapositive ${i + 1}`} aria-current={i === index ? "true" : undefined}
            className={`h-2 rounded-full transition-all duration-300 ${i === index ? "w-6" : "w-2 opacity-50"} ${tone === "light" ? "bg-white" : "bg-[var(--color-text-primary)]"}`} />
        ))}
      </div>}
      <button type="button" className={btn} onClick={() => go(index + 1)} aria-label="Diapositive suivante">
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="m6 3 5 5-5 5" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" /></svg>
      </button>
      <button type="button" className={btn} onClick={() => setPaused(!paused)} aria-label={paused ? "Reprendre le défilement" : "Mettre en pause le défilement"} aria-pressed={paused}>
        {paused ? (
          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M3 2v10l9-5z" fill="currentColor" /></svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M3 2h3v10H3zM8 2h3v10H8z" fill="currentColor" /></svg>
        )}
      </button>
    </div>
  );
}

export function useSwipe(go: (d: number) => void) {
  const start = useRef<number | null>(null);
  return {
    onTouchStart: (e: React.TouchEvent) => { start.current = e.touches[0]?.clientX ?? null; },
    onTouchEnd: (e: React.TouchEvent) => {
      if (start.current === null) return;
      const dx = (e.changedTouches[0]?.clientX ?? start.current) - start.current;
      if (Math.abs(dx) > 45) go(dx < 0 ? 1 : -1);
      start.current = null;
    },
  };
}

function Cta({ slide, className }: { slide: HeroSlide; className: string }) {
  if (!slide.ctaLabel || !slide.ctaHref) return null;
  return (
    <Link href={slide.ctaHref} className={className}>
      {slide.ctaLabel}
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" /></svg>
    </Link>
  );
}

/** « market » : le visuel, le titre et le produit mis en scène changent ensemble ;
 *  vignettes, compteur « 01 — 03 », progression, pause et flèches sous la scène. */
export function MarketHero({ slides, autoplaySeconds, products }: { slides: HeroSlide[]; autoplaySeconds: number; products: Record<string, SlideProduct> }) {
  const c = useCarousel(slides.length, autoplaySeconds);
  const swipe = useSwipe((d) => c.go(c.index + d));
  const pad = (n: number) => String(n).padStart(2, "0");
  const withImages = slides.every((s) => s.imageUrl);
  return (
    <section
      aria-roledescription="carrousel"
      aria-label="À la une"
      className="relative bg-[var(--color-surface)]"
      onMouseEnter={() => c.setHovered(true)}
      onMouseLeave={() => c.setHovered(false)}
      onFocus={() => c.setFocused(true)}
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) c.setFocused(false); }}
      onKeyDown={(e) => { if (e.key === "ArrowRight") c.go(c.index + 1); if (e.key === "ArrowLeft") c.go(c.index - 1); }}
    >
      <div className="relative h-[600px] overflow-hidden sm:h-[540px] lg:h-[600px]" {...swipe}>
        {slides.map((s, i) => {
          const product = s.productId ? products[s.productId] : undefined;
          const active = i === c.index;
          return (
            <div key={s.id} role="group" aria-roledescription="diapositive" aria-label={`${i + 1} sur ${slides.length}`} aria-hidden={!active}
              className={`absolute inset-0 transition-opacity ${c.reduced ? "duration-0" : "duration-700"} ${active ? "z-10 opacity-100" : "pointer-events-none opacity-0"}`}>
              <div className="absolute inset-y-0 right-0 w-full overflow-hidden max-sm:top-auto max-sm:h-[50%] sm:w-[64%] xl:w-[60%]">
                <Picture slide={s} eager={i === 0} className={`h-full w-full object-cover object-center transition-transform ease-out ${c.reduced ? "" : "duration-[7000ms]"} ${active ? "scale-100" : "scale-[1.05]"}`} />
                <div className="absolute inset-0 bg-[linear-gradient(90deg,var(--color-surface)_0%,transparent_22%)] max-sm:bg-[linear-gradient(180deg,var(--color-surface)_0%,transparent_18%)]" />
              </div>
              <div className="relative mx-auto flex h-full max-w-[var(--content-max-width,1280px)] flex-col px-5 pt-9 sm:justify-center sm:px-10 sm:pb-20 sm:pt-0">
                <div className={`max-w-xl transition-all ${c.reduced ? "" : "duration-700"} ${active ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"}`}>
                  {s.eyebrow && <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-[var(--color-text-secondary)]">{s.eyebrow}</p>}
                  <h2 className="mt-3 font-[family-name:var(--font-heading)] text-[40px] leading-[1.0] tracking-[-0.02em] sm:text-[58px] lg:text-[72px]">{s.title}</h2>
                  {s.subtitle && <p className="mt-4 max-w-md text-[15px] leading-relaxed text-[var(--color-text-secondary)] sm:text-base">{s.subtitle}</p>}
                  <Cta slide={s} className="mt-7 inline-flex items-center gap-3 rounded-[var(--radius-md)] bg-[var(--color-primary)] px-6 py-3.5 text-sm font-semibold text-white transition-transform hover:-translate-y-0.5" />
                  {product && (
                    <Link href={`/p/${product.slug}`} tabIndex={active ? 0 : -1} className="mt-4 flex items-baseline gap-2 text-sm sm:hidden">
                      <span className="font-semibold">{product.name}</span>
                      <span className="tabular-nums text-[var(--color-text-secondary)]">{fcfa(product.price)}</span>
                    </Link>
                  )}
                </div>
              </div>
              {product && (
                <div className={`absolute bottom-24 right-4 z-10 hidden w-[min(290px,calc(100%-2rem))] sm:block rounded-[var(--radius-lg)] bg-[var(--color-background)] p-4 shadow-[var(--shadow-lg)] backdrop-blur transition-all sm:bottom-24 sm:right-10 ${c.reduced ? "" : "delay-200 duration-700"} ${active ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"}`}>
                  {product.category && <p className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">{product.category}</p>}
                  <p className="mt-1 font-[family-name:var(--font-heading)] text-[22px] leading-tight">{product.name}</p>
                  <p className="mt-1 text-sm font-semibold tabular-nums">{fcfa(product.price)}</p>
                  <div className="mt-3 flex items-center gap-2">
                    <Link href={`/p/${product.slug}`} tabIndex={active ? 0 : -1} className="inline-flex flex-1 items-center justify-center gap-2 rounded-[var(--radius-full)] bg-[var(--color-primary)] px-4 py-2.5 text-[13px] font-semibold text-white">Découvrir la pièce</Link>
                    {active && <QuickViewButton slug={product.slug} name={product.name} />}
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {slides.length > 1 && (
          <div className="absolute inset-x-0 bottom-0 z-20">
            <div className="mx-auto flex max-w-[var(--content-max-width,1280px)] items-center gap-4 px-5 pb-5 sm:px-10">
              {/* Sur mobile le compteur passe sur l'image : pastille de fond pour rester lisible. */}
              <div className="flex items-center gap-4 max-sm:rounded-full max-sm:bg-[var(--color-background)] max-sm:px-3.5 max-sm:py-2 max-sm:shadow-[var(--shadow-md)]">
                <p className="shrink-0 font-[family-name:var(--font-heading)] text-sm tabular-nums">{pad(c.index + 1)} <span className="mx-1 text-[var(--color-text-muted)]">—</span> {pad(slides.length)}</p>
                <Segments count={slides.length} index={c.index} running={c.running} seconds={autoplaySeconds} go={c.go} />
              </div>
              {withImages && (
                <div className="mx-auto hidden items-center gap-2 md:flex" aria-hidden="true">
                  {slides.map((s, i) => (
                    <button key={s.id} type="button" tabIndex={-1} onClick={() => c.go(i)} className={`h-12 w-16 overflow-hidden rounded-[var(--radius-sm)] ring-2 transition-all ${i === c.index ? "ring-[var(--color-primary)]" : "opacity-60 ring-transparent hover:opacity-100"}`}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={s.imageUrl!} alt="" className="h-full w-full object-cover" loading="lazy" />
                    </button>
                  ))}
                </div>
              )}
              <div className="ml-auto"><Controls count={slides.length} index={c.index} go={c.go} paused={c.paused} setPaused={c.setPaused} tone="dark" label="Diapositives" dots={false} /></div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

/** « editorial » : texte à gauche, grande image à droite en fondu, compteur « 01 / 03 ». */
export function EditorialHero({ slides, autoplaySeconds, tenantName, sideImage, products }: { slides: HeroSlide[]; autoplaySeconds: number; tenantName: string; sideImage: { url: string; alt: string; caption: string } | null; products: Record<string, SlideProduct> }) {
  const c = useCarousel(slides.length, autoplaySeconds);
  const swipe = useSwipe((d) => c.go(c.index + d));
  const current = slides[c.index]!;
  const product = current.productId ? products[current.productId] : undefined;
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    <section
      aria-roledescription="carrousel"
      aria-label="À la une"
      className="mx-auto max-w-[var(--content-max-width,1400px)] px-4 pt-6 sm:px-6"
      onMouseEnter={() => c.setHovered(true)}
      onMouseLeave={() => c.setHovered(false)}
      onFocus={() => c.setFocused(true)}
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) c.setFocused(false); }}
      onKeyDown={(e) => { if (e.key === "ArrowRight") c.go(c.index + 1); if (e.key === "ArrowLeft") c.go(c.index - 1); }}
    >
      {/* Taille ajustée à la longueur du nom : il tient toujours sur une ligne, sans coupure. */}
      <p aria-hidden="true" style={{ ["--name-fit" as string]: `${(88 / (Math.max(tenantName.length, 6) * 0.63)).toFixed(2)}vw` }}
        className="select-none overflow-x-clip whitespace-nowrap pt-[0.1em] font-[family-name:var(--font-heading)] text-[min(16vw,var(--name-fit))] font-medium uppercase leading-[0.82] tracking-[-0.02em] lg:text-[min(clamp(96px,11.5vw,168px),var(--name-fit))]">
        {tenantName}
      </p>
      <div className="mt-4 grid gap-6 lg:grid-cols-[0.9fr_1.3fr_0.6fr] lg:gap-4">
        <div className="order-2 flex flex-col justify-center lg:order-1 lg:pr-6">
          <div key={current.id} className={c.reduced ? "" : "yc-rise"}>
            {current.eyebrow && <p className="text-[11px] uppercase tracking-[0.3em] text-[var(--color-text-muted)]">{current.eyebrow}</p>}
            <h2 className="mt-3 font-[family-name:var(--font-heading)] text-[44px] leading-[0.98] tracking-[-0.02em] sm:text-[60px]">{current.title}</h2>
            <span className="mt-6 block h-px w-10 bg-[var(--color-text-primary)]" aria-hidden="true" />
            {current.subtitle && <p className="mt-6 max-w-sm text-[15px] leading-relaxed text-[var(--color-text-secondary)]">{current.subtitle}</p>}
            <Cta slide={current} className="mt-8 inline-flex items-center gap-4 bg-[var(--color-primary)] px-6 py-3.5 text-[12px] font-semibold uppercase tracking-[0.18em] text-white transition-opacity hover:opacity-90" />
            {product && (
              <div className="mt-6 flex items-center gap-3 border-t border-[var(--color-border)] pt-4">
                <Link href={`/p/${product.slug}`} className="min-w-0 flex-1">
                  <span className="block text-[11px] uppercase tracking-[0.22em] text-[var(--color-text-muted)]">La pièce</span>
                  <span className="block truncate font-[family-name:var(--font-heading)] text-lg">{product.name}</span>
                  <span className="block text-sm tabular-nums text-[var(--color-text-secondary)]">{fcfa(product.price)}</span>
                </Link>
                <QuickViewButton slug={product.slug} name={product.name} />
              </div>
            )}
          </div>
          {slides.length > 1 && (
            <div className="mt-10 flex flex-wrap items-center gap-5">
              <p className="font-[family-name:var(--font-heading)] text-sm tabular-nums" aria-live={c.running ? "off" : "polite"}>{pad(c.index + 1)} <span className="mx-2 text-[var(--color-text-muted)]">/</span> {pad(slides.length)}</p>
              <span className="relative h-px w-24 overflow-hidden bg-[var(--color-border)]" aria-hidden="true">
                <span key={`${c.index}-${c.running}`} className="absolute inset-y-0 left-0 bg-[var(--color-text-primary)]"
                  style={c.running ? { animation: `yc-progress ${autoplaySeconds}s linear forwards` } : { width: `${((c.index + 1) / slides.length) * 100}%` }} />
              </span>
              <Controls count={slides.length} index={c.index} go={c.go} paused={c.paused} setPaused={c.setPaused} tone="dark" label="Choisir une diapositive" />
            </div>
          )}
        </div>
        <div className="relative order-1 aspect-[4/5] overflow-hidden bg-[var(--color-surface)] sm:aspect-[5/4] lg:order-2 lg:aspect-auto lg:h-[620px]" {...swipe}>
          {slides.map((s, i) => (
            <div key={s.id} role="group" aria-roledescription="diapositive" aria-label={`${i + 1} sur ${slides.length}`} aria-hidden={i !== c.index}
              className={`absolute inset-0 transition-opacity ${c.reduced ? "duration-0" : "duration-1000"} ${i === c.index ? "opacity-100" : "opacity-0"}`}>
              <Picture slide={s} eager={i === 0} className={`h-full w-full object-cover object-[center_18%] transition-transform ${c.reduced ? "" : "duration-[8000ms] ease-out"} ${i === c.index ? "scale-[1.03]" : "scale-100"}`} />
            </div>
          ))}
        </div>
        {sideImage && (
          <div className="order-3 hidden flex-col gap-4 lg:flex">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={sideImage.url} alt={sideImage.alt} loading="lazy" className="h-[440px] w-full object-cover" />
            <p className="text-[11px] uppercase leading-relaxed tracking-[0.28em] text-[var(--color-text-muted)]">{sideImage.caption || tenantName}</p>
          </div>
        )}
      </div>
    </section>
  );
}
