"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import type { ResolvedCategoriesContent } from "./content-types";
import { Reveal } from "@/lib/motion/reveal";
import { useAnimationLevel } from "@/lib/motion/animation-level-context";
import { hoverLift, staggerChildren } from "@/lib/motion/variants";
import { Carousel } from "@/components/ui/carousel";
import { EmptyState } from "@/components/ui/empty-state";
import { t, type Locale } from "@/lib/i18n";

export function CategoriesSection({
  variant,
  content,
  locale,
}: {
  variant: string;
  content: ResolvedCategoriesContent;
  locale: Locale;
}) {
  // Toujours appelé, quel que soit le chemin de retour emprunté ensuite — les Hooks ne
  // doivent jamais être conditionnels (règle React).
  const level = useAnimationLevel();
  const title = content.title ?? t(locale, "section.categories.title");

  if (content.categories.length === 0) {
    return (
      <section className="mx-auto max-w-[var(--content-max-width)] px-6 py-24 lg:py-32 lg:px-10">
        <EmptyState title={t(locale, "empty.no_products.title")} />
      </section>
    );
  }

  if (variant === "carousel") {
    return (
      <section className="mx-auto max-w-[var(--content-max-width)] px-6 py-24 lg:py-32 lg:px-10">
        <Reveal>
          <h2 className="mb-10 lg:mb-16 font-[family-name:var(--font-heading)] text-[var(--color-text-primary)] text-[length:var(--text-heading-2xl)]">
            {title}
          </h2>
        </Reveal>
        <Carousel autoplayMobile>
          {content.categories.map((category) => (
            <CategoryCard key={category.id} category={category} className="w-[280px] shrink-0 lg:w-[340px]" />
          ))}
        </Carousel>
      </section>
    );
  }

  if (variant === "editorial") {
    return (
      <section className="mx-auto max-w-[var(--content-max-width)] px-6 py-24 lg:px-10 lg:py-32">
        <Reveal>
          <h2 className="mb-10 lg:mb-16 font-[family-name:var(--font-heading)] text-[var(--color-text-primary)] text-[length:var(--text-heading-2xl)]">
            {title}
          </h2>
        </Reveal>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:auto-rows-[260px] lg:gap-8">
          {content.categories.map((category, index) => (
            <EditorialCategoryTile key={category.id} category={category} index={index} />
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-[var(--content-max-width)] px-6 py-24 lg:py-32 lg:px-10">
      <Reveal>
        <h2 className="mb-10 lg:mb-16 font-[family-name:var(--font-heading)] text-[var(--color-text-primary)] text-[length:var(--text-heading-2xl)]">
          {title}
        </h2>
      </Reveal>
      <motion.div
        className="grid grid-cols-2 gap-6 sm:grid-cols-4 lg:gap-8"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        variants={staggerChildren(level)}
      >
        {content.categories.map((category) => (
          <CategoryCard key={category.id} category={category} />
        ))}
      </motion.div>
    </section>
  );
}

/** Position dans la mosaïque asymétrique — se répète toutes les 4 tuiles. */
const EDITORIAL_LAYOUT = [
  "lg:col-span-7 lg:row-span-2",
  "lg:col-span-5 lg:row-span-1",
  "lg:col-span-5 lg:row-span-1",
  "lg:col-span-12 lg:row-span-1",
];

function EditorialCategoryTile({
  category,
  index,
}: {
  category: ResolvedCategoriesContent["categories"][number];
  index: number;
}) {
  const level = useAnimationLevel();
  const hover = hoverLift(level);
  const span = EDITORIAL_LAYOUT[index % EDITORIAL_LAYOUT.length];

  return (
    <motion.a
      href={category.href}
      data-cursor-hover
      className={`group relative block aspect-[4/5] overflow-hidden rounded-[var(--card-radius)] lg:aspect-auto ${span}`}
      {...hover}
    >
      <Image
        src={category.imageUrl}
        alt={category.name}
        fill
        sizes="(max-width: 1024px) 100vw, 60vw"
        className="object-cover transition-transform duration-[1200ms] ease-out group-hover:scale-110"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent transition-opacity group-hover:from-black/80" />
      <div className="absolute inset-0 flex flex-col justify-end p-6 lg:p-8">
        <span className="font-[family-name:var(--font-heading)] text-white text-[length:var(--text-heading-lg)]">
          {category.name}
        </span>
        <span className="mt-2 flex items-center gap-2 text-[length:var(--text-body-sm)] uppercase tracking-[0.1em] text-white opacity-0 transition-all duration-300 group-hover:translate-x-1 group-hover:opacity-100">
          Découvrir l&apos;univers
          <span aria-hidden="true">→</span>
        </span>
      </div>
    </motion.a>
  );
}

function CategoryCard({
  category,
  className,
}: {
  category: ResolvedCategoriesContent["categories"][number];
  className?: string;
}) {
  const level = useAnimationLevel();
  const hover = hoverLift(level);
  return (
    <motion.a
      href={category.href}
      className={`group relative block aspect-[4/5] overflow-hidden rounded-[var(--card-radius)] ${className ?? ""}`}
      {...hover}
    >
      <Image
        src={category.imageUrl}
        alt={category.name}
        fill
        sizes="(max-width: 640px) 50vw, 25vw"
        className="object-cover transition-transform duration-[var(--motion-duration-slow)] group-hover:scale-105"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/5 to-transparent transition-opacity group-hover:from-black/65" />
      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between p-5">
        <span className="font-[family-name:var(--font-heading)] text-[length:var(--text-heading-sm)] text-white">
          {category.name}
        </span>
        <span className="translate-y-1 text-[13px] uppercase tracking-[0.1em] text-white/0 transition-all duration-300 group-hover:translate-y-0 group-hover:text-white/90">
          →
        </span>
      </div>
    </motion.a>
  );
}
