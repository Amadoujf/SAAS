"use client";

import Image from "next/image";
import type { BrandManifestoParams } from "./content-types";
import { RevealText } from "@/lib/motion/reveal-text";
import { MaskReveal } from "@/lib/motion/mask-reveal";
import { Reveal } from "@/lib/motion/reveal";

/**
 * Manifeste de marque — section éditoriale immersive introduisant l'identité de la
 * maison (voir la refonte artistique du 16 septembre 2026, « introduction de la
 * marque »). Composition volontairement asymétrique : le texte occupe une colonne
 * étroite, l'image une colonne large décalée verticalement.
 */
export function BrandManifestoSection({
  variant,
  params,
}: {
  variant: string;
  params: BrandManifestoParams;
}) {
  const imageFirst = variant === "image-left";

  return (
    <section className="mx-auto max-w-[var(--content-max-width)] px-6 py-24 lg:px-10 lg:py-40">
      <div
        className={`grid grid-cols-1 items-center gap-12 lg:grid-cols-12 lg:gap-8 ${
          imageFirst ? "" : "lg:[&>*:first-child]:order-2"
        }`}
      >
        <MaskReveal className="relative aspect-[3/4] lg:col-span-5">
          <Image
            src={params.media.url}
            alt={params.media.alt ?? ""}
            fill
            sizes="(max-width: 1024px) 100vw, 40vw"
            className="object-cover"
          />
        </MaskReveal>
        <div className={`lg:col-span-7 ${imageFirst ? "lg:pl-8" : "lg:pr-8"}`}>
          {params.eyebrow && (
            <Reveal>
              <p className="mb-6 flex items-center gap-3 uppercase tracking-[0.28em] text-[var(--color-secondary)] text-[length:var(--text-body-sm)]">
                <span className="h-px w-10 bg-[var(--color-secondary)]" aria-hidden="true" />
                {params.eyebrow}
              </p>
            </Reveal>
          )}
          <RevealText
            as="h2"
            text={params.statement}
            className="font-[family-name:var(--font-heading)] leading-[1.08] text-[var(--color-text-primary)] text-[length:var(--text-heading-2xl)]"
          />
          {params.body && (
            <Reveal>
              <p className="mt-8 max-w-lg text-[var(--color-text-secondary)] text-[length:var(--text-body-lg)]">
                {params.body}
              </p>
            </Reveal>
          )}
        </div>
      </div>
    </section>
  );
}
