"use client";

import { useState } from "react";
import Image from "next/image";

/**
 * Galerie de fiche produit — image principale + vignettes, transition douce entre les
 * images (voir la refonte artistique du 16 septembre 2026, « transitions entre les
 * images d'un produit »).
 */
export function ProductGallery({ images, alt }: { images: string[]; alt: string }) {
  const [active, setActive] = useState(0);

  return (
    <div className="flex flex-col gap-4 sm:flex-row-reverse sm:gap-4">
      <div className="relative aspect-[4/5] w-full overflow-hidden bg-[var(--color-surface-muted)] sm:flex-1">
        {images.map((src, index) => (
          <Image
            key={src}
            src={src}
            alt={alt}
            fill
            priority={index === 0}
            sizes="(max-width: 1024px) 100vw, 50vw"
            className={`object-cover transition-opacity duration-500 ${
              index === active ? "opacity-100" : "pointer-events-none absolute inset-0 opacity-0"
            }`}
          />
        ))}
      </div>
      <div className="flex gap-3 overflow-x-auto sm:w-24 sm:flex-col sm:overflow-visible">
        {images.map((src, index) => (
          <button
            key={src}
            type="button"
            onClick={() => setActive(index)}
            aria-label={`Image ${index + 1}`}
            aria-current={index === active}
            className={`relative h-20 w-16 shrink-0 overflow-hidden border transition sm:h-24 sm:w-24 ${
              index === active ? "border-[var(--color-primary)]" : "border-transparent opacity-70"
            }`}
          >
            <Image src={src} alt="" fill sizes="96px" className="object-cover" />
          </button>
        ))}
      </div>
    </div>
  );
}
