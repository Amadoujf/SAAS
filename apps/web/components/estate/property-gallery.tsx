"use client";

import { useState } from "react";

/** Galerie d'un bien : grande photo, vignettes, flèches (boutons, clavier, balayage). */
export function PropertyGallery({ images, title }: { images: { url: string; alt: string }[]; title: string }) {
  const [index, setIndex] = useState(0);
  const [touch, setTouch] = useState<number | null>(null);
  if (!images.length) return <div className="aspect-[16/10] rounded-[var(--radius-lg)] bg-[var(--color-surface-muted)]" />;
  const go = (i: number) => setIndex(((i % images.length) + images.length) % images.length);
  const current = images[index]!;
  const btn = "grid h-11 w-11 place-items-center rounded-full bg-white/90 text-[var(--color-text-primary)] shadow-[var(--shadow-md)] transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white";
  return (
    <section aria-label={`Photos : ${title}`} aria-roledescription="galerie" onKeyDown={(e) => { if (e.key === "ArrowRight") go(index + 1); if (e.key === "ArrowLeft") go(index - 1); }}>
      <div
        className="relative aspect-[16/10] overflow-hidden rounded-[var(--radius-lg)] bg-[var(--color-surface-muted)]"
        onTouchStart={(e) => setTouch(e.touches[0]?.clientX ?? null)}
        onTouchEnd={(e) => { if (touch === null) return; const dx = (e.changedTouches[0]?.clientX ?? touch) - touch; if (Math.abs(dx) > 45) go(index + (dx < 0 ? 1 : -1)); setTouch(null); }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img key={current.url} src={current.url} alt={current.alt} className="yc-fade-in h-full w-full object-cover" fetchPriority="high" />
        {images.length > 1 && (
          <>
            <div className="absolute inset-x-3 top-1/2 flex -translate-y-1/2 justify-between">
              <button type="button" className={btn} onClick={() => go(index - 1)} aria-label="Photo précédente"><svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3 5 8l5 5" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" /></svg></button>
              <button type="button" className={btn} onClick={() => go(index + 1)} aria-label="Photo suivante"><svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="m6 3 5 5-5 5" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" /></svg></button>
            </div>
            <p className="absolute bottom-3 right-3 rounded-[var(--radius-full)] bg-black/55 px-3 py-1 text-xs font-semibold text-white" aria-live="polite">{index + 1} / {images.length}</p>
          </>
        )}
      </div>
      {images.length > 1 && (
        <ul className="mt-3 flex gap-2.5 overflow-x-auto pb-1">
          {images.map((img, i) => (
            <li key={`${img.url}-${i}`} className="shrink-0">
              <button type="button" onClick={() => go(i)} aria-label={`Voir la photo ${i + 1}`} aria-current={i === index ? "true" : undefined} className={`block h-16 w-24 overflow-hidden rounded-[var(--radius-sm)] ring-2 transition-all sm:h-20 sm:w-28 ${i === index ? "ring-[var(--color-primary)]" : "opacity-60 ring-transparent hover:opacity-100"}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.url} alt="" loading="lazy" className="h-full w-full object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
