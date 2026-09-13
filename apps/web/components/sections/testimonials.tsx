"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import type { TestimonialsParams } from "./content-types";
import { Reveal } from "@/lib/motion/reveal";
import { useAnimationLevel } from "@/lib/motion/animation-level-context";
import { staggerChildren, fadeInUp } from "@/lib/motion/variants";
import { Carousel } from "@/components/ui/carousel";
import { t, type Locale } from "@/lib/i18n";

export function TestimonialsSection({
  variant,
  params,
  locale,
}: {
  variant: string;
  params: TestimonialsParams;
  locale: Locale;
}) {
  const level = useAnimationLevel();

  if (variant === "carousel") {
    return (
      <section className="mx-auto max-w-[var(--content-max-width)] px-6 py-16">
        <Reveal>
          <h2 className="mb-8 font-[family-name:var(--font-heading)] text-[var(--color-text-primary)] text-[var(--text-heading-2xl)]">
            {t(locale, "section.testimonials.title")}
          </h2>
        </Reveal>
        <Carousel>
          {params.items.map((item, index) => (
            <div key={index} className="w-[320px] shrink-0">
              <TestimonialCard item={item} />
            </div>
          ))}
        </Carousel>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-[var(--content-max-width)] px-6 py-16">
      <Reveal>
        <h2 className="mb-8 font-[family-name:var(--font-heading)] text-[var(--color-text-primary)] text-[var(--text-heading-2xl)]">
          {t(locale, "section.testimonials.title")}
        </h2>
      </Reveal>
      <motion.div
        className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        variants={staggerChildren(level)}
      >
        {params.items.map((item, index) => (
          <motion.div key={index} variants={fadeInUp(level)}>
            <TestimonialCard item={item} />
          </motion.div>
        ))}
      </motion.div>
    </section>
  );
}

function TestimonialCard({ item }: { item: TestimonialsParams["items"][number] }) {
  return (
    <div className="flex h-full flex-col gap-3 rounded-[var(--card-radius)] border border-[var(--color-border)] p-6 [box-shadow:var(--card-shadow)]">
      {item.rating && (
        <div aria-label={`${item.rating} sur 5`} className="text-[var(--color-secondary)]">
          {"★".repeat(item.rating)}
          {"☆".repeat(5 - item.rating)}
        </div>
      )}
      <p className="flex-1 italic text-[var(--color-text-secondary)] text-[var(--text-body-md)]">
        « {item.quote} »
      </p>
      <div className="flex items-center gap-3">
        {item.avatarUrl && (
          <div className="relative h-10 w-10 overflow-hidden rounded-full">
            <Image src={item.avatarUrl} alt={item.author} fill className="object-cover" />
          </div>
        )}
        <span className="font-medium text-[var(--color-text-primary)] text-[var(--text-body-sm)]">
          {item.author}
        </span>
      </div>
    </div>
  );
}
