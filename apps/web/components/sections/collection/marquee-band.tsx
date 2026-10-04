"use client";

import type { z } from "zod";
import type { sectionParamSchemas } from "@yamacommerce/templates";
import { useAnimationLevel } from "@/lib/motion/animation-level-context";

export type MarqueeParams = z.infer<typeof sectionParamSchemas.marquee>;

/** Bandeau défilant (studio) : univers et matières en capitales, en boucle continue,
 *  mis en pause au survol ; immobile si le visiteur réduit les animations. */
export function MarqueeSection({ variant, params }: { variant: string; params: MarqueeParams }) {
  const level = useAnimationLevel();
  const items = [...params.items, ...params.items, ...params.items];
  const outline = variant === "outline";
  return (
    <section
      data-motion={level === "none" ? "off" : "on"}
      aria-label={params.items.join(", ")}
      className={`ycc-marquee overflow-hidden ${outline ? "border-y-2 border-[var(--color-text-primary)] py-6" : "bg-[var(--color-text-primary)] py-4 text-[var(--color-background)]"}`}
    >
      <div aria-hidden="true" className="ycc-marquee-track flex w-max">
        {[0, 1].map((copy) => (
          <div key={copy} className="flex shrink-0 items-center">
            {items.map((item, i) => (
              <span key={`${copy}-${i}`} className="flex items-center">
                <span
                  className={`whitespace-nowrap px-6 font-[family-name:var(--font-heading)] uppercase tracking-[-0.02em] ${outline ? "text-[clamp(2.4rem,6vw,5rem)] font-semibold leading-none text-transparent [-webkit-text-stroke:1.5px_var(--color-text-primary)]" : "text-[clamp(1.1rem,2vw,1.6rem)] font-semibold"}`}
                >
                  {item}
                </span>
                <span className={outline ? "text-[var(--color-primary)]" : "text-[var(--color-primary)]"}>✦</span>
              </span>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}
