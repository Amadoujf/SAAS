"use client";

import { motion } from "framer-motion";
import type { BenefitsParams } from "./content-types";
import { Reveal } from "@/lib/motion/reveal";
import { useAnimationLevel } from "@/lib/motion/animation-level-context";
import { staggerChildren, fadeInUp } from "@/lib/motion/variants";
import { t, type Locale } from "@/lib/i18n";

/** Avantages — icons-row (ligne sobre) ou cards (chaque avantage dans une carte). */
export function BenefitsSection({
  variant,
  params,
  locale,
}: {
  variant: string;
  params: BenefitsParams;
  locale: Locale;
}) {
  const level = useAnimationLevel();
  const isCards = variant === "cards";

  return (
    <section className="mx-auto max-w-[var(--content-max-width)] px-6 py-16">
      <Reveal>
        <h2 className="mb-10 text-center font-[family-name:var(--font-heading)] text-[var(--color-text-primary)] text-[var(--text-heading-2xl)]">
          {t(locale, "section.benefits.title")}
        </h2>
      </Reveal>
      <motion.div
        className={
          isCards
            ? "grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3"
            : "flex flex-wrap justify-center gap-10"
        }
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        variants={staggerChildren(level)}
      >
        {params.items.map((item, index) => (
          <motion.div
            key={index}
            variants={fadeInUp(level)}
            className={
              isCards
                ? "flex flex-col items-center gap-3 rounded-[var(--card-radius)] border border-[var(--color-border)] p-6 text-center [box-shadow:var(--card-shadow)]"
                : "flex max-w-[180px] flex-col items-center gap-2 text-center"
            }
          >
            <span aria-hidden="true" className="text-3xl">
              {item.icon}
            </span>
            <p className="font-medium text-[var(--color-text-primary)]">{item.title}</p>
            {item.description && (
              <p className="text-[var(--color-text-muted)] text-[var(--text-body-sm)]">
                {item.description}
              </p>
            )}
          </motion.div>
        ))}
      </motion.div>
    </section>
  );
}
