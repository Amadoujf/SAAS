"use client";

import Link from "next/link";
import type { z } from "zod";
import type { sectionParamSchemas } from "@yamacommerce/templates";
import { useAnimationLevel } from "@/lib/motion/animation-level-context";

export type BrandStoryParams = z.infer<typeof sectionParamSchemas.brand_story>;

/**
 * Récit de marque : une phrase forte et un texte de l'entreprise.
 * - « quote » (éditorial) : citation centrée en didone italique, petite photo ovale ;
 * - « split » (sculptural) : photo dans une arche sur fond de pierre, texte grotesque ;
 * - « bold » (studio) : aplat de la couleur de marque, phrase en capitales, photo carrée.
 */
export function BrandStorySection({ variant, params }: { variant: string; params: BrandStoryParams }) {
  const motion = useAnimationLevel() === "none" ? "off" : "on";
  const cta = (cls: string) => (params.ctaLabel && params.ctaHref ? <Link href={params.ctaHref} className={cls}>{params.ctaLabel} <span aria-hidden="true">→</span></Link> : null);

  if (variant === "split") {
    return (
      <section data-motion={motion} className="bg-[var(--color-surface)]">
        <div className="mx-auto grid max-w-[1320px] items-center gap-12 px-5 py-20 sm:px-10 lg:grid-cols-2 lg:gap-20 lg:py-28">
          {params.media && (
            <div className="ycc-reveal mx-auto w-full max-w-[480px] bg-[var(--color-surface-muted)] p-[7%]">
              <div className="overflow-hidden rounded-t-[999px]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={params.media.url} alt={params.media.alt ?? ""} loading="lazy" className="ycc-parallax aspect-[4/5] w-full object-cover" />
              </div>
            </div>
          )}
          <div className="ycc-reveal">
            {params.eyebrow && <p className="text-[12px] font-medium uppercase tracking-[0.22em] text-[var(--color-text-muted)]">{params.eyebrow}</p>}
            <p className="mt-5 font-[family-name:var(--font-heading)] text-[clamp(2rem,3.4vw,3.2rem)] font-semibold leading-[1.02] tracking-[-0.04em]">{params.statement}</p>
            {params.body && <p className="mt-6 max-w-lg text-[16px] leading-relaxed text-[var(--color-text-secondary)]">{params.body}</p>}
            {cta("mt-8 inline-flex items-center gap-2 border-b border-current pb-1 text-[14px] font-medium transition-opacity hover:opacity-60")}
          </div>
        </div>
      </section>
    );
  }

  if (variant === "bold") {
    return (
      <section data-motion={motion} className="bg-[var(--color-primary)] text-white">
        <div className="mx-auto grid max-w-[1440px] items-end gap-10 px-4 py-20 sm:px-8 lg:grid-cols-[1.4fr_1fr] lg:py-24">
          <div className="ycc-reveal">
            {params.eyebrow && <p className="text-[12px] font-bold uppercase tracking-[0.2em] text-white/70">{params.eyebrow}</p>}
            <p className="mt-4 font-[family-name:var(--font-heading)] text-[clamp(2.4rem,5.4vw,5.4rem)] font-semibold uppercase leading-[0.9] tracking-[-0.045em]">{params.statement}</p>
            {params.body && <p className="mt-8 max-w-xl text-[16px] leading-relaxed text-white/85">{params.body}</p>}
            {cta("mt-8 inline-flex h-12 items-center gap-2 rounded-full bg-white px-7 text-[13px] font-bold uppercase tracking-[0.08em] text-[var(--color-primary)] transition-transform hover:-translate-y-0.5")}
          </div>
          {params.media && (
            <div className="ycc-reveal overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={params.media.url} alt={params.media.alt ?? ""} loading="lazy" className="ycc-parallax aspect-square w-full object-cover" />
            </div>
          )}
        </div>
      </section>
    );
  }

  // « quote »
  return (
    <section data-motion={motion} className="mx-auto max-w-[980px] px-5 py-24 text-center sm:px-10 lg:py-36">
      {params.media && (
        <div className="ycc-reveal mx-auto mb-10 w-28 overflow-hidden rounded-[50%] sm:w-36">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={params.media.url} alt={params.media.alt ?? ""} loading="lazy" className="aspect-[3/4] w-full object-cover" />
        </div>
      )}
      {params.eyebrow && <p className="ycc-reveal text-[11px] uppercase tracking-[0.34em] text-[var(--color-text-muted)]">{params.eyebrow}</p>}
      <p className="ycc-reveal mt-6 font-[family-name:var(--font-heading)] text-[clamp(2rem,4.2vw,3.8rem)] italic leading-[1.08] tracking-[-0.01em]">« {params.statement} »</p>
      {params.body && <p className="ycc-reveal mx-auto mt-8 max-w-xl text-[16px] leading-relaxed text-[var(--color-text-secondary)]">{params.body}</p>}
      <div className="mx-auto mt-10 h-px w-16 bg-[var(--color-text-primary)]" aria-hidden="true" />
      {cta("mt-8 inline-flex items-center gap-2 border-b border-current pb-1 text-[13px] uppercase tracking-[0.16em] transition-opacity hover:opacity-60")}
    </section>
  );
}
