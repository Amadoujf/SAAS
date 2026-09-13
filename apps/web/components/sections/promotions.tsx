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
      <section className="mx-auto grid max-w-[var(--content-max-width)] grid-cols-1 items-center gap-8 px-6 py-16 md:grid-cols-2">
        <Reveal className="relative aspect-[16/10] overflow-hidden rounded-[var(--radius-lg)]">
          <Image src={content.imageUrl} alt="" fill className="object-cover" />
        </Reveal>
        <Reveal>
          {content.discountLabel && (
            <span className="mb-3 inline-block rounded-[var(--radius-full)] bg-[var(--color-secondary)] px-4 py-1 font-semibold text-[var(--text-body-sm)] text-white">
              {content.discountLabel}
            </span>
          )}
          <h2 className="font-[family-name:var(--font-heading)] text-[var(--color-text-primary)] text-[var(--text-heading-2xl)]">
            {content.headline}
          </h2>
          {content.description && (
            <p className="mt-3 text-[var(--color-text-secondary)] text-[var(--text-body-lg)]">
              {content.description}
            </p>
          )}
          <div className="mt-6">
            <Button href={content.ctaHref}>{content.ctaLabel}</Button>
          </div>
        </Reveal>
      </section>
    );
  }

  return (
    <section className="px-6 py-16">
      <Reveal className="mx-auto flex max-w-[var(--content-max-width)] flex-col items-center gap-4 rounded-[var(--radius-lg)] bg-[var(--color-primary)] px-8 py-14 text-center text-white">
        {content.discountLabel && (
          <span className="rounded-[var(--radius-full)] bg-white/15 px-4 py-1 font-semibold text-[var(--text-body-sm)]">
            {content.discountLabel}
          </span>
        )}
        <h2 className="font-[family-name:var(--font-heading)] text-[var(--text-heading-2xl)]">
          {content.headline}
        </h2>
        {content.description && (
          <p className="max-w-xl text-[var(--text-body-lg)] text-white/90">{content.description}</p>
        )}
        <a
          href={content.ctaHref}
          className="rounded-[var(--button-radius)] bg-white px-6 py-3 font-medium text-[var(--color-primary)] text-[var(--text-body-sm)] transition hover:opacity-90"
        >
          {content.ctaLabel}
        </a>
      </Reveal>
    </section>
  );
}
