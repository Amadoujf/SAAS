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
      <section className="mx-auto max-w-[var(--content-max-width)] px-6 py-16">
        <EmptyState title={t(locale, "empty.no_products.title")} />
      </section>
    );
  }

  if (variant === "carousel") {
    return (
      <section className="mx-auto max-w-[var(--content-max-width)] px-6 py-16">
        <Reveal>
          <h2 className="mb-8 font-[family-name:var(--font-heading)] text-[var(--color-text-primary)] text-[var(--text-heading-2xl)]">
            {title}
          </h2>
        </Reveal>
        <Carousel>
          {content.categories.map((category) => (
            <CategoryCard key={category.id} category={category} className="w-[220px] shrink-0" />
          ))}
        </Carousel>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-[var(--content-max-width)] px-6 py-16">
      <Reveal>
        <h2 className="mb-8 font-[family-name:var(--font-heading)] text-[var(--color-text-primary)] text-[var(--text-heading-2xl)]">
          {title}
        </h2>
      </Reveal>
      <motion.div
        className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4"
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
      className={`group relative block aspect-square overflow-hidden rounded-[var(--card-radius)] ${className ?? ""}`}
      {...hover}
    >
      <Image
        src={category.imageUrl}
        alt={category.name}
        fill
        sizes="(max-width: 640px) 50vw, 25vw"
        className="object-cover transition-transform duration-[var(--motion-duration-slow)] group-hover:scale-105"
      />
      <div className="absolute inset-0 bg-black/25 transition-colors group-hover:bg-black/35" />
      <span className="absolute bottom-4 left-4 font-[family-name:var(--font-heading)] text-[var(--text-heading-sm)] text-white">
        {category.name}
      </span>
    </motion.a>
  );
}
