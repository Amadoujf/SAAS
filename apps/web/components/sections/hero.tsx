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
    <section className="relative flex min-h-[85vh] items-end overflow-hidden">
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
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
      </motion.div>
      <Reveal className="relative z-10 mx-auto w-full max-w-[var(--content-max-width)] px-6 pb-20 pt-32 text-white">
        {params.eyebrow && (
          <p className="mb-3 uppercase tracking-[0.2em] text-[var(--text-body-sm)] text-white/80">
            {params.eyebrow}
          </p>
        )}
        <h1 className="max-w-2xl font-[family-name:var(--font-heading)] leading-[1.05] text-[var(--text-heading-4xl)]">
          {params.title}
        </h1>
        {params.subtitle && (
          <p className="mt-4 max-w-xl text-[var(--text-body-lg)] text-white/90">
            {params.subtitle}
          </p>
        )}
        {params.ctaLabel && params.ctaHref && (
          <div className="mt-8">
            <Button href={params.ctaHref}>{params.ctaLabel}</Button>
          </div>
        )}
      </Reveal>
    </section>
  );
}

function HeroSplit({ params }: { params: HeroParams }) {
  return (
    <section className="mx-auto grid max-w-[var(--content-max-width)] grid-cols-1 items-center gap-10 px-6 py-20 md:grid-cols-2 md:gap-16">
      <Reveal>
        {params.eyebrow && (
          <p className="mb-3 uppercase tracking-[0.2em] text-[var(--color-text-muted)] text-[var(--text-body-sm)]">
            {params.eyebrow}
          </p>
        )}
        <h1 className="font-[family-name:var(--font-heading)] text-[var(--color-text-primary)] text-[var(--text-heading-3xl)]">
          {params.title}
        </h1>
        {params.subtitle && (
          <p className="mt-4 text-[var(--color-text-secondary)] text-[var(--text-body-lg)]">
            {params.subtitle}
          </p>
        )}
        {params.ctaLabel && params.ctaHref && (
          <div className="mt-8">
            <Button href={params.ctaHref}>{params.ctaLabel}</Button>
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
          <p className="mb-3 uppercase tracking-[0.2em] text-[var(--color-text-muted)] text-[var(--text-body-sm)]">
            {params.eyebrow}
          </p>
        )}
        <h1 className="font-[family-name:var(--font-heading)] text-[var(--color-text-primary)] text-[var(--text-heading-3xl)]">
          {params.title}
        </h1>
        {params.subtitle && (
          <p className="mx-auto mt-4 max-w-md text-[var(--color-text-secondary)] text-[var(--text-body-lg)]">
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
