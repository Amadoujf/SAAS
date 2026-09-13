"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";

/**
 * Carrousel léger à défilement natif (`scroll-snap`), sans dépendance supplémentaire —
 * répond à « carrousels premium »/« carrousels fluides » sans sacrifier la
 * performance (pas de recalcul de layout coûteux, juste un défilement natif accéléré
 * matériellement). Boutons précédent/suivant accessibles au clavier ; glissement
 * tactile natif sur mobile (`overflow-x-auto` + `scroll-snap`).
 *
 * `autoplayMobile` : avance automatique UNIQUEMENT sous le point de rupture `sm`
 * (voir la refonte artistique du 16 septembre 2026, « carrousels AUTOMATIQUE » en
 * mobile) — jamais sur desktop, où le survol/la navigation manuelle prime. Se met en
 * pause dès que le visiteur touche le carrousel, et ne démarre jamais si
 * `prefers-reduced-motion` est actif.
 */
export function Carousel({
  children,
  autoplayMobile = false,
  autoplayInterval = 3500,
}: {
  children: React.ReactNode;
  autoplayMobile?: boolean;
  autoplayInterval?: number;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);
  const prefersReducedMotion = useReducedMotion();

  function scrollBy(direction: 1 | -1) {
    const track = trackRef.current;
    if (!track) return;
    track.scrollBy({ left: direction * track.clientWidth * 0.8, behavior: "smooth" });
  }

  useEffect(() => {
    if (!autoplayMobile || paused || prefersReducedMotion) return;
    if (!window.matchMedia("(max-width: 639px)").matches) return;

    const interval = window.setInterval(() => {
      const track = trackRef.current;
      if (!track) return;
      const atEnd = track.scrollLeft + track.clientWidth >= track.scrollWidth - 4;
      track.scrollTo({ left: atEnd ? 0 : track.scrollLeft + track.clientWidth * 0.85, behavior: "smooth" });
    }, autoplayInterval);

    return () => window.clearInterval(interval);
  }, [autoplayMobile, autoplayInterval, paused, prefersReducedMotion]);

  return (
    <div className="relative">
      <div
        ref={trackRef}
        onPointerDown={() => setPaused(true)}
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {Array.isArray(children)
          ? children.map((child, index) => (
              <div key={index} className="snap-start">
                {child}
              </div>
            ))
          : children}
      </div>
      <div className="mt-6 hidden justify-end gap-3 sm:flex">
        <button
          type="button"
          aria-label="Précédent"
          onClick={() => scrollBy(-1)}
          className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--color-border)] text-[var(--color-text-primary)] transition hover:border-[var(--color-primary)] hover:bg-[var(--color-primary)] hover:text-white"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <button
          type="button"
          aria-label="Suivant"
          onClick={() => scrollBy(1)}
          className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--color-border)] text-[var(--color-text-primary)] transition hover:border-[var(--color-primary)] hover:bg-[var(--color-primary)] hover:text-white"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M9 5l7 7-7 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}
