"use client";

import Image from "next/image";
import type { ResolvedPromotionsContent } from "./content-types";
import { Reveal } from "@/lib/motion/reveal";
import { Button } from "@/components/ui/button";

/** Promotion — 2 variantes : banner (pleine largeur, fond de couleur) et split (image
 *  + texte, plus proche de l'esprit "Hero"). */
export function PromotionsSection({
  variant,
  content,
}: {
  variant: string;
  content: ResolvedPromotionsContent;
}) {
  if (variant === "split" && content.imageUrl) {
    return (
      <section className="mx-auto grid max-w-[var(--content-max-width)] grid-cols-1 items-center gap-12 px-6 py-24 lg:grid-cols-2 lg:gap-20 lg:px-10 lg:py-32">
        <Reveal className="relative aspect-[4/5] overflow-hidden rounded-[var(--card-radius)] lg:aspect-[3/4]">
          <Image src={content.imageUrl} alt="" fill sizes="(max-width: 1024px) 100vw, 50vw" className="object-cover" />
        </Reveal>
        <Reveal>
          {content.discountLabel && (
            <span className="mb-4 inline-block border border-[var(--color-secondary)] px-4 py-1.5 font-semibold uppercase tracking-[0.08em] text-[var(--color-secondary)] text-[length:var(--text-body-sm)]">
              {content.discountLabel}
            </span>
          )}
          <h2 className="font-[family-name:var(--font-heading)] text-[var(--color-text-primary)] text-[length:var(--text-heading-2xl)]">
            {content.headline}
          </h2>
          {content.description && (
            <p className="mt-4 max-w-md text-[var(--color-text-secondary)] text-[length:var(--text-body-lg)]">
              {content.description}
            </p>
          )}
          <div className="mt-8">
            <Button href={content.ctaHref} size="xl">
              {content.ctaLabel}
            </Button>
          </div>
        </Reveal>
      </section>
    );
  }

  return (
    <section className="px-6 py-24 lg:py-32 lg:px-10">
      <Reveal className="mx-auto flex max-w-[var(--content-max-width)] flex-col items-center gap-4 rounded-[var(--radius-lg)] bg-[var(--color-primary)] px-8 py-14 text-center text-white">
        {content.discountLabel && (
          <span className="rounded-[var(--radius-full)] bg-white/15 px-4 py-1 font-semibold text-[length:var(--text-body-sm)]">
            {content.discountLabel}
          </span>
        )}
        <h2 className="font-[family-name:var(--font-heading)] text-[length:var(--text-heading-2xl)]">
          {content.headline}
        </h2>
        {content.description && (
          <p className="max-w-xl text-[length:var(--text-body-lg)] text-white/90">{content.description}</p>
        )}
        <a
          href={content.ctaHref}
          className="rounded-[var(--button-radius)] bg-white px-6 py-3 font-medium text-[var(--color-primary)] text-[length:var(--text-body-sm)] transition hover:opacity-90"
        >
          {content.ctaLabel}
        </a>
      </Reveal>
    </section>
  );
}
