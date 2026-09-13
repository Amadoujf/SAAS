"use client";

import { useRef } from "react";

/**
 * Carrousel léger à défilement natif (`scroll-snap`), sans dépendance supplémentaire —
 * répond à « carrousels premium »/« carrousels fluides » sans sacrifier la
 * performance (pas de recalcul de layout coûteux, juste un défilement natif accéléré
 * matériellement). Boutons précédent/suivant accessibles au clavier.
 */
export function Carousel({ children }: { children: React.ReactNode }) {
  const trackRef = useRef<HTMLDivElement>(null);

  function scrollBy(direction: 1 | -1) {
    const track = trackRef.current;
    if (!track) return;
    track.scrollBy({ left: direction * track.clientWidth * 0.8, behavior: "smooth" });
  }

  return (
    <div className="relative">
      <div
        ref={trackRef}
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
      <div className="mt-4 hidden justify-end gap-2 sm:flex">
        <button
          type="button"
          aria-label="Précédent"
          onClick={() => scrollBy(-1)}
          className="rounded-[var(--radius-full)] border border-[var(--color-border)] p-2 text-[var(--color-text-primary)] transition hover:bg-[var(--color-surface-muted)]"
        >
          ←
        </button>
        <button
          type="button"
          aria-label="Suivant"
          onClick={() => scrollBy(1)}
          className="rounded-[var(--radius-full)] border border-[var(--color-border)] p-2 text-[var(--color-text-primary)] transition hover:bg-[var(--color-surface-muted)]"
        >
          →
        </button>
      </div>
    </div>
  );
}
