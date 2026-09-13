"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import type { HeroParams } from "./content-types";
import { Reveal } from "@/lib/motion/reveal";
import { Button } from "@/components/ui/button";
import { useAnimationLevel } from "@/lib/motion/animation-level-context";
import { scaleIn } from "@/lib/motion/variants";

/**
 * Section Hero — 3 variantes structurellement différentes (voir docs/12 §12.5,
 * direction « Immobilier de luxe » adaptée ici au commerce premium) :
 * - fullbleed : image plein cadre, texte superposé, très immersif
 * - split : image et texte côte à côte
 * - centered : texte centré sur fond uni, image en arrière-plan discret
 */
export function HeroSection({ variant, params }: { variant: string; params: HeroParams }) {
  if (variant === "split") return <HeroSplit params={params} />;
  if (variant === "centered") return <HeroCentered params={params} />;
  return <HeroFullbleed params={params} />;
}

function HeroFullbleed({ params }: { params: HeroParams }) {
  const level = useAnimationLevel();
  return (
    <section className="relative flex h-[100dvh] min-h-[720px] items-end overflow-hidden">
      <motion.div
        className="absolute inset-0"
        initial="hidden"
        animate="visible"
        variants={scaleIn(level)}
      >
        <Image
          src={params.media.url}
          alt={params.media.alt ?? ""}
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-black/5" />
      </motion.div>

      {/* Composition asymétrique : le bloc de texte n'occupe qu'une partie de la
          largeur, ancré en bas-gauche — jamais centré — pour un rendu éditorial plutôt
          que "diapositive" (retour de la revue visuelle du 16 septembre 2026). */}
      <Reveal className="relative z-10 w-full px-6 pb-16 sm:pb-20 lg:px-12 lg:pb-28">
        <div className="mx-auto grid max-w-[var(--content-max-width)] grid-cols-1 items-end gap-8 lg:grid-cols-[1.6fr_1fr]">
          <div>
            {params.eyebrow && (
              <p className="mb-5 flex items-center gap-3 uppercase tracking-[0.28em] text-[length:var(--text-body-sm)] text-white/85">
                <span className="h-px w-10 bg-[var(--color-secondary)]" aria-hidden="true" />
                {params.eyebrow}
              </p>
            )}
            <h1 className="max-w-3xl font-[family-name:var(--font-heading)] leading-[0.98] text-white text-[length:var(--text-heading-4xl)]">
              {params.title}
            </h1>
          </div>
          <div className="lg:pb-2">
            {params.subtitle && (
              <p className="max-w-md text-[length:var(--text-body-lg)] text-white/85">{params.subtitle}</p>
            )}
            {params.ctaLabel && params.ctaHref && (
              <div className="mt-7 flex flex-wrap gap-4">
                <Button href={params.ctaHref} size="xl">
                  {params.ctaLabel}
                </Button>
                <Button
                  href="#savoir-faire"
                  variant="outline"
                  size="xl"
                  className="border-white/60 text-white hover:bg-white hover:text-[var(--color-primary)]"
                >
                  Notre savoir-faire
                </Button>
              </div>
            )}
          </div>
        </div>
      </Reveal>

      <div
        aria-hidden="true"
        className="absolute bottom-8 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-2 text-white/70 lg:flex"
      >
        <span className="text-[11px] uppercase tracking-[0.3em]">Scroll</span>
        <span className="h-10 w-px bg-white/50" />
      </div>
    </section>
  );
}

function HeroSplit({ params }: { params: HeroParams }) {
  return (
    <section className="mx-auto grid max-w-[var(--content-max-width)] grid-cols-1 items-center gap-12 px-6 py-24 lg:grid-cols-[1fr_1.15fr] lg:gap-20 lg:px-12 lg:py-32">
      <Reveal>
        {params.eyebrow && (
          <p className="mb-4 flex items-center gap-3 uppercase tracking-[0.28em] text-[var(--color-text-muted)] text-[length:var(--text-body-sm)]">
            <span className="h-px w-10 bg-[var(--color-secondary)]" aria-hidden="true" />
            {params.eyebrow}
          </p>
        )}
        <h1 className="font-[family-name:var(--font-heading)] text-[var(--color-text-primary)] text-[length:var(--text-heading-3xl)]">
          {params.title}
        </h1>
        {params.subtitle && (
          <p className="mt-5 max-w-md text-[var(--color-text-secondary)] text-[length:var(--text-body-lg)]">
            {params.subtitle}
          </p>
        )}
        {params.ctaLabel && params.ctaHref && (
          <div className="mt-9">
            <Button href={params.ctaHref} size="xl">
              {params.ctaLabel}
            </Button>
          </div>
        )}
      </Reveal>
      <Reveal className="relative aspect-[4/5] w-full overflow-hidden rounded-[var(--radius-lg)]">
        <Image
          src={params.media.url}
          alt={params.media.alt ?? ""}
          fill
          priority
          className="object-cover"
        />
      </Reveal>
    </section>
  );
}

function HeroCentered({ params }: { params: HeroParams }) {
  return (
    <section className="relative overflow-hidden bg-[var(--color-surface)] py-28 text-center">
      <div className="absolute inset-0 opacity-10">
        <Image src={params.media.url} alt="" fill className="object-cover" />
      </div>
      <Reveal className="relative mx-auto max-w-2xl px-6">
        {params.eyebrow && (
          <p className="mb-3 uppercase tracking-[0.2em] text-[var(--color-text-muted)] text-[length:var(--text-body-sm)]">
            {params.eyebrow}
          </p>
        )}
        <h1 className="font-[family-name:var(--font-heading)] text-[var(--color-text-primary)] text-[length:var(--text-heading-3xl)]">
          {params.title}
        </h1>
        {params.subtitle && (
          <p className="mx-auto mt-4 max-w-md text-[var(--color-text-secondary)] text-[length:var(--text-body-lg)]">
            {params.subtitle}
          </p>
        )}
        {params.ctaLabel && params.ctaHref && (
          <div className="mt-8 flex justify-center">
            <Button href={params.ctaHref}>{params.ctaLabel}</Button>
          </div>
        )}
      </Reveal>
    </section>
  );
}
