"use client";

import { useState } from "react";

/** Galerie d'un véhicule : grande vue sur « piste » + vignettes (clavier et toucher). */
export function VehicleGallery({ images, title }: { images: { url: string; alt: string; demo: boolean }[]; title: string }) {
  const [i, setI] = useState(0);
  const current = images[i];
  if (!current) {
    return <div className="grid aspect-[16/10] place-items-center bg-[var(--color-surface-muted)] text-[13px] font-semibold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">Photos à venir</div>;
  }
  return (
    <div>
      <div className="relative aspect-[16/10] overflow-hidden bg-[linear-gradient(180deg,#E3E6E8_0%,#C4CACD_100%)]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={current.url} alt={current.alt || title} className="h-full w-full object-cover" />
        {current.demo && <span className="absolute right-2 top-2 bg-black/55 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-white">Visuel de démonstration</span>}
        {images.length > 1 && (
          <>
            <button type="button" aria-label="Photo précédente" onClick={() => setI((i - 1 + images.length) % images.length)} className="absolute left-2 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center bg-[var(--color-primary)]/80 text-white">←</button>
            <button type="button" aria-label="Photo suivante" onClick={() => setI((i + 1) % images.length)} className="absolute right-2 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center bg-[var(--color-primary)]/80 text-white">→</button>
            <p className="yc-num absolute bottom-2 right-2 bg-[var(--color-primary)]/80 px-2 py-0.5 text-[12px] font-bold text-white">{i + 1} / {images.length}</p>
          </>
        )}
      </div>
      {images.length > 1 && (
        <ul className="mt-2 grid grid-cols-5 gap-2">
          {images.slice(0, 10).map((img, k) => (
            <li key={img.url + k}>
              <button type="button" aria-label={`Photo ${k + 1}`} aria-pressed={k === i} onClick={() => setI(k)} className={`block aspect-[4/3] w-full overflow-hidden ring-2 ${k === i ? "ring-[var(--color-accent-primary)]" : "ring-transparent opacity-75 hover:opacity-100"}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.url} alt="" loading="lazy" className="h-full w-full object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
