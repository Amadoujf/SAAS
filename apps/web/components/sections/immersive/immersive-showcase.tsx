"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import type { z } from "zod";
import type { sectionParamSchemas } from "@yamacommerce/templates";
import { useInView, useMotionAmplitude, usePageVisible } from "@/lib/motion/immersive";
import type { ShowcaseItem } from "@/lib/showcase/showcase";
import { ImmersiveImage } from "./immersive-image";

export type ImmersiveShowcaseParams = z.infer<typeof sectionParamSchemas.immersive_showcase>;

/** Teinte d'arrière-plan de l'élément : la sienne (contenu manuel), sinon une alternance
 *  des couleurs du site — jamais une couleur imposée. */
function tintOf(item: ShowcaseItem, index: number) {
  if (item.accentColor) return item.accentColor;
  return ["var(--color-accent-primary, var(--color-primary))", "var(--color-primary)", "var(--color-secondary, var(--color-primary))"][index % 3]!;
}

function Arrow({ dir }: { dir: "prev" | "next" }) {
  return (
    <svg width="18" height="18" viewBox="0 0 16 16" aria-hidden="true">
      <path d={dir === "prev" ? "M10 3 5 8l5 5" : "m6 3 5 5-5 5"} stroke="currentColor" strokeWidth="1.7" fill="none" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Carrousel immersif — voir @yamacommerce/templates `immersive_showcase`. Défilement
 * automatique suspendu au survol, au focus clavier, hors écran, onglet inactif, par le
 * bouton Pause, et désactivé en mouvement réduit (WCAG 2.2.2). Navigation : flèches,
 * clavier (← →), balayage tactile, clic sur un voisin. Chaque élément mène à SA vraie
 * fiche ; sans lien, il est présenté sans bouton.
 */
export function ImmersiveShowcaseSection({ variant, params, items }: { variant: string; params: ImmersiveShowcaseParams; items: ShowcaseItem[] }) {
  const ref = useRef<HTMLElement>(null);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [announce, setAnnounce] = useState(false);
  const amp = useMotionAmplitude("balanced");
  const inView = useInView(ref);
  const pageVisible = usePageVisible();
  const count = items.length;
  const running = params.autoplay && count > 1 && !paused && !hovered && !focused && inView && pageVisible && amp > 0;

  const go = useCallback((i: number, manual = true) => {
    setAnnounce(manual);
    setIndex(((i % count) + count) % count);
  }, [count]);

  useEffect(() => {
    if (!running) return;
    const t = setTimeout(() => go(index + 1, false), params.intervalSeconds * 1000);
    return () => clearTimeout(t);
  }, [running, index, params.intervalSeconds, go]);

  useEffect(() => {
    if (index >= count && count > 0) setIndex(0);
  }, [count, index]);

  // Balayage : pointer events (souris et tactile), seuil de 45 px.
  const start = useRef<{ x: number; y: number } | null>(null);
  const swiped = useRef(false);
  const onPointerDown = (e: React.PointerEvent) => {
    start.current = { x: e.clientX, y: e.clientY };
    swiped.current = false;
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const s = start.current;
    start.current = null;
    if (!s) return;
    const dx = e.clientX - s.x;
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(e.clientY - s.y)) {
      swiped.current = true; // le relâchement d'un glissement n'est jamais un clic
      go(index + (dx < 0 ? 1 : -1));
    }
  };

  if (count === 0) return null;
  const current = items[index]!;
  const dark = params.backdrop === "dark";
  const tint = tintOf(current, index);
  const btn = `grid h-12 w-12 place-items-center rounded-full ring-1 ring-inset transition-colors focus-visible:outline-none focus-visible:ring-2 ${dark ? "text-white ring-white/30 hover:bg-white/10 focus-visible:ring-white" : "bg-[var(--color-background)] text-[var(--color-text-primary)] ring-[var(--color-border)] hover:bg-[var(--color-surface)] focus-visible:ring-[var(--color-primary)]"}`;
  const smooth = amp > 0 ? "duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]" : "duration-0";

  const slideStyle = (offset: number): CSSProperties => {
    const abs = Math.abs(offset);
    if (variant === "stack") {
      const behind = offset < 0 ? count + offset : offset; // position dans la pile
      return { transform: `translate3d(${behind * 18}px, ${behind * -14}px, 0) scale(${1 - behind * 0.07})`, zIndex: 20 - behind, opacity: behind > 3 ? 0 : 1 - behind * 0.18 };
    }
    return {
      transform: `translate3d(calc(${offset} * var(--yc-step)), ${abs * 16}px, ${-abs * 160}px) rotateY(${-offset * 18}deg) scale(${1 - abs * 0.12})`,
      zIndex: 20 - abs,
      opacity: abs > 2 ? 0 : 1 - abs * 0.28,
      filter: abs ? `saturate(${1 - abs * 0.25})` : undefined,
    };
  };

  return (
    <section
      ref={ref}
      aria-roledescription="carrousel"
      aria-label={params.title ?? "En vedette"}
      className={`relative isolate overflow-hidden py-16 sm:py-24 ${dark ? "bg-[var(--color-primary)] text-white" : params.backdrop === "neutral" ? "bg-[var(--color-surface)] text-[var(--color-text-primary)]" : "bg-[var(--color-background)] text-[var(--color-text-primary)]"}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && setFocused(false)}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") { e.preventDefault(); go(index + 1); }
        if (e.key === "ArrowLeft") { e.preventDefault(); go(index - 1); }
      }}
    >
      {/* Arrière-plan coordonné : la teinte de l'élément central, en fondu. */}
      {params.backdrop === "tinted" && (
        <span aria-hidden="true" className={`pointer-events-none absolute inset-0 -z-10 transition-[background] ${smooth}`} style={{ background: `radial-gradient(60% 70% at 50% 42%, color-mix(in srgb, ${tint} 22%, transparent), transparent 72%)` }} />
      )}
      <div className="mx-auto max-w-[var(--content-max-width,1320px)] px-5 sm:px-10">
        {(params.eyebrow || params.title || params.subtitle) && (
          <header className="mx-auto mb-10 max-w-2xl text-center">
            {params.eyebrow && <p className={`text-[11px] font-semibold uppercase tracking-[0.3em] ${dark ? "text-white/70" : "text-[var(--color-text-secondary)]"}`}>{params.eyebrow}</p>}
            {params.title && <h2 className="mt-3 font-[family-name:var(--font-heading)] text-[clamp(2rem,4.6vw,3.6rem)] leading-[1.02] tracking-[-0.02em]">{params.title}</h2>}
            {params.subtitle && <p className={`mt-4 text-[16px] ${dark ? "text-white/75" : "text-[var(--color-text-secondary)]"}`}>{params.subtitle}</p>}
          </header>
        )}

        <div
          className="relative mx-auto h-[min(118vw,470px)] touch-pan-y select-none sm:h-[480px] lg:h-[540px] [--yc-step:64vw] sm:[--yc-step:40vw] lg:[--yc-step:min(24vw,330px)]"
          style={{ perspective: "1600px" }}
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onPointerCancel={() => { start.current = null; }}
          // Le glisser-déposer natif d'un lien ou d'une image annulerait le geste.
          onDragStart={(e) => e.preventDefault()}
          onClickCapture={(e) => {
            if (swiped.current) {
              e.preventDefault();
              e.stopPropagation();
              swiped.current = false;
            }
          }}
        >
          {items.map((item, i) => {
            let offset = i - index;
            if (offset > count / 2) offset -= count;
            if (offset < -count / 2) offset += count;
            const center = offset === 0;
            const visible = variant === "stack" ? true : Math.abs(offset) <= 2;
            const card = (
              <>
                <span className="relative block h-full w-full overflow-hidden rounded-[var(--radius-lg,18px)] bg-[var(--color-surface-muted,#eee)] shadow-[0_40px_80px_-30px_rgba(10,16,34,0.45)]">
                  <ImmersiveImage src={item.imageUrl} alt={center ? item.imageAlt ?? item.title : ""} eager={Math.abs(offset) <= 1} className={`transition-transform ${smooth} ${center && amp > 0 ? "scale-[1.04]" : "scale-100"}`} />
                  {item.badge && <span className="absolute left-3 top-3 rounded-full bg-white/95 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-primary)]">{item.badge}</span>}
                </span>
              </>
            );
            return (
              <div
                key={item.id}
                role="group"
                aria-roledescription="élément"
                aria-label={`${i + 1} sur ${count} : ${item.title}`}
                aria-hidden={!center}
                className={`absolute left-1/2 top-0 h-full w-[min(76vw,340px)] transition-[transform,opacity,filter] sm:w-[340px] lg:w-[380px] ${smooth} ${visible ? "" : "pointer-events-none"}`}
                style={{ ...slideStyle(offset), translate: "-50% 0" } as CSSProperties}
              >
                {center && item.href ? (
                  <Link href={item.href} draggable={false} className="block h-full rounded-[var(--radius-lg,18px)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-4" aria-label={`${item.title} — voir la fiche`}>{card}</Link>
                ) : center ? (
                  <div className="h-full">{card}</div>
                ) : (
                  <button type="button" tabIndex={-1} onClick={() => go(i)} className="block h-full w-full cursor-pointer" aria-label={`Afficher ${item.title}`}>{card}</button>
                )}
              </div>
            );
          })}
        </div>

        {/* Titre, prix et action : changent AVEC le visuel central. */}
        <div className="mx-auto mt-10 flex max-w-3xl flex-col items-center gap-6 text-center">
          <div key={current.id} className={amp > 0 ? "yc-swap-in" : ""} aria-live={announce ? "polite" : "off"}>
            {current.subtitle && <p className={`text-[12px] font-semibold uppercase tracking-[0.22em] ${dark ? "text-white/70" : "text-[var(--color-accent-primary,var(--color-text-secondary))]"}`}>{current.subtitle}</p>}
            <h3 className="mt-2 font-[family-name:var(--font-heading)] text-[clamp(1.6rem,3.4vw,2.5rem)] leading-tight" style={{ overflowWrap: "anywhere" }}>{current.title}</h3>
            {current.priceLabel && <p className="mt-2 text-[18px] font-semibold tabular-nums">{current.priceLabel}</p>}
          </div>
          <div className="flex w-full flex-wrap items-center justify-center gap-3">
            {count > 1 && <button type="button" className={btn} onClick={() => go(index - 1)} aria-label="Élément précédent"><Arrow dir="prev" /></button>}
            {current.href && (
              <Link href={current.href} className={`inline-flex min-h-[48px] items-center gap-2 rounded-full px-7 text-[15px] font-semibold transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${dark ? "bg-white text-[var(--color-primary)] focus-visible:ring-white" : "bg-[var(--color-primary)] text-white focus-visible:ring-[var(--color-primary)]"}`}>
                {params.ctaLabel}
                <span className="sr-only"> : {current.title}</span>
              </Link>
            )}
            {count > 1 && <button type="button" className={btn} onClick={() => go(index + 1)} aria-label="Élément suivant"><Arrow dir="next" /></button>}
            {count > 1 && params.autoplay && amp > 0 && (
              <button type="button" className={btn} onClick={() => setPaused((p) => !p)} aria-pressed={paused} aria-label={paused ? "Reprendre le défilement automatique" : "Mettre en pause le défilement automatique"}>
                {paused ? <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M3 2v10l9-5z" fill="currentColor" /></svg> : <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M3 2h3v10H3zM8 2h3v10H8z" fill="currentColor" /></svg>}
              </button>
            )}
          </div>
          {count > 1 && (
            <div className="flex items-center gap-2" role="group" aria-label="Choisir un élément">
              {items.map((it, i) => (
                <button key={it.id} type="button" onClick={() => go(i)} aria-label={`Afficher ${it.title}`} aria-current={i === index ? "true" : undefined} className="grid h-8 min-w-[20px] place-items-center">
                  <span className={`block h-1.5 rounded-full transition-all duration-300 ${i === index ? `w-8 ${dark ? "bg-white" : "bg-[var(--color-primary)]"}` : `w-2 ${dark ? "bg-white/40" : "bg-[color-mix(in_srgb,var(--color-text-primary)_25%,transparent)]"}`}`} />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
