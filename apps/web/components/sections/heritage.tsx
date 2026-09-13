"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import type { HeritageParams } from "./content-types";
import { Reveal } from "@/lib/motion/reveal";
import { MaskReveal } from "@/lib/motion/mask-reveal";
import { Button } from "@/components/ui/button";
import { useAnimationLevel } from "@/lib/motion/animation-level-context";
import { staggerChildren, fadeInUp } from "@/lib/motion/variants";

/**
 * Savoir-faire & héritage — remplace le grand espace vide entre les nouveautés et les
 * avantages (voir la refonte artistique du 16 septembre 2026). Composition
 * image/texte asymétrique, chiffres clés animés en cascade.
 */
export function HeritageSection({ variant, params }: { variant: string; params: HeritageParams }) {
  const level = useAnimationLevel();
  const imageFirst = variant === "image-left";

  return (
    <section
      id="savoir-faire"
      className="mx-auto max-w-[var(--content-max-width)] px-6 py-24 lg:px-10 lg:py-40"
    >
      <div
        className={`grid grid-cols-1 items-center gap-14 lg:grid-cols-2 lg:gap-24 ${
          imageFirst ? "" : "lg:[&>*:first-child]:order-2"
        }`}
      >
        <MaskReveal className="relative aspect-[4/5] lg:aspect-[3/4]">
          <Image
            src={params.media.url}
            alt={params.media.alt ?? ""}
            fill
            sizes="(max-width: 1024px) 100vw, 45vw"
            className="object-cover"
          />
        </MaskReveal>
        <div>
          {params.eyebrow && (
            <Reveal>
              <p className="mb-5 flex items-center gap-3 uppercase tracking-[0.28em] text-[var(--color-secondary)] text-[length:var(--text-body-sm)]">
                <span className="h-px w-10 bg-[var(--color-secondary)]" aria-hidden="true" />
                {params.eyebrow}
              </p>
            </Reveal>
          )}
          <Reveal>
            <h2 className="font-[family-name:var(--font-heading)] text-[var(--color-text-primary)] text-[length:var(--text-heading-xl)]">
              {params.title}
            </h2>
          </Reveal>
          <Reveal>
            <p className="mt-6 max-w-md text-[var(--color-text-secondary)] text-[length:var(--text-body-lg)]">
              {params.body}
            </p>
          </Reveal>

          {params.stats && params.stats.length > 0 && (
            <motion.dl
              className="mt-12 grid grid-cols-2 gap-x-8 gap-y-8 border-t border-[var(--color-border)] pt-10 sm:grid-cols-4 lg:grid-cols-2"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={staggerChildren(level)}
            >
              {params.stats.map((stat, index) => (
                <motion.div key={index} variants={fadeInUp(level)}>
                  <dt className="font-[family-name:var(--font-heading)] text-[var(--color-primary)] text-[length:var(--text-heading-lg)]">
                    {stat.value}
                  </dt>
                  <dd className="mt-1 text-[var(--color-text-muted)] text-[length:var(--text-body-sm)]">
                    {stat.label}
                  </dd>
                </motion.div>
              ))}
            </motion.dl>
          )}

          {params.ctaLabel && params.ctaHref && (
            <Reveal>
              <div className="mt-10">
                <Button href={params.ctaHref} variant="outline">
                  {params.ctaLabel}
                </Button>
              </div>
            </Reveal>
          )}
        </div>
      </div>
    </section>
  );
}
