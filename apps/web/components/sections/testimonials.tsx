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

  if (variant === "editorial") {
    return (
      <section className="mx-auto max-w-[var(--content-max-width)] px-6 py-24 lg:py-32 lg:px-10">
        <Reveal>
          <h2 className="mb-10 lg:mb-16 font-[family-name:var(--font-heading)] text-[var(--color-text-primary)] text-[length:var(--text-heading-2xl)]">
            {t(locale, "section.testimonials.title")}
          </h2>
        </Reveal>
        <Carousel autoplayMobile>
          {params.items.map((item, index) => (
            <div key={index} className="w-[85vw] shrink-0 sm:w-[560px] lg:w-[720px]">
              <EditorialTestimonialCard item={item} />
            </div>
          ))}
        </Carousel>
      </section>
    );
  }

  if (variant === "carousel") {
    return (
      <section className="mx-auto max-w-[var(--content-max-width)] px-6 py-24 lg:py-32 lg:px-10">
        <Reveal>
          <h2 className="mb-10 lg:mb-16 font-[family-name:var(--font-heading)] text-[var(--color-text-primary)] text-[length:var(--text-heading-2xl)]">
            {t(locale, "section.testimonials.title")}
          </h2>
        </Reveal>
        <Carousel autoplayMobile>
          {params.items.map((item, index) => (
            <div key={index} className="w-[380px] shrink-0 lg:w-[440px]">
              <TestimonialCard item={item} />
            </div>
          ))}
        </Carousel>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-[var(--content-max-width)] px-6 py-24 lg:py-32 lg:px-10">
      <Reveal>
        <h2 className="mb-10 lg:mb-16 font-[family-name:var(--font-heading)] text-[var(--color-text-primary)] text-[length:var(--text-heading-2xl)]">
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

function EditorialTestimonialCard({ item }: { item: TestimonialsParams["items"][number] }) {
  const initials = item.author
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="grid h-full grid-cols-1 items-stretch gap-0 overflow-hidden bg-[var(--color-surface)] sm:grid-cols-[0.8fr_1.2fr]">
      <div className="relative aspect-square sm:aspect-auto">
        {item.avatarUrl ? (
          <Image src={item.avatarUrl} alt={item.author} fill className="object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-[var(--color-primary)] font-[family-name:var(--font-heading)] text-white text-[length:var(--text-heading-2xl)]">
            {initials}
          </div>
        )}
      </div>
      <div className="flex flex-col justify-center p-8 lg:p-10">
        {item.rating && (
          <div aria-label={`${item.rating} sur 5`} className="mb-4 text-[var(--color-secondary)]">
            {"★".repeat(item.rating)}
            {"☆".repeat(5 - item.rating)}
          </div>
        )}
        <p className="font-[family-name:var(--font-heading)] italic leading-snug text-[var(--color-text-primary)] text-[length:var(--text-heading-xs)]">
          « {item.quote} »
        </p>
        <div className="mt-6">
          <p className="text-[var(--color-text-primary)] text-[length:var(--text-body-sm)]">
            {item.author}
          </p>
          {item.productPurchased && (
            <p className="mt-0.5 text-[var(--color-text-muted)] text-[length:var(--text-body-xs)]">
              {item.productPurchased}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function TestimonialCard({ item }: { item: TestimonialsParams["items"][number] }) {
  const initials = item.author
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="flex h-full flex-col gap-5 border-t-2 border-[var(--color-primary)] p-8 [box-shadow:var(--card-shadow)]">
      {item.rating && (
        <div aria-label={`${item.rating} sur 5`} className="text-[var(--color-secondary)]">
          {"★".repeat(item.rating)}
          {"☆".repeat(5 - item.rating)}
        </div>
      )}
      <p className="flex-1 font-[family-name:var(--font-heading)] italic leading-relaxed text-[var(--color-text-primary)] text-[length:var(--text-body-lg)]">
        « {item.quote} »
      </p>
      <div className="flex items-center gap-3">
        {item.avatarUrl ? (
          <div className="relative h-11 w-11 overflow-hidden rounded-full">
            <Image src={item.avatarUrl} alt={item.author} fill className="object-cover" />
          </div>
        ) : (
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--color-surface-muted)] text-[var(--color-text-primary)] text-[length:var(--text-body-sm)]">
            {initials}
          </div>
        )}
        <span className="text-[var(--color-text-secondary)] text-[length:var(--text-body-sm)]">
          {item.author}
        </span>
      </div>
    </div>
  );
}
