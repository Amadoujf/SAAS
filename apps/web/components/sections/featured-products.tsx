"use client";

import { motion } from "framer-motion";
import type { ResolvedProductsContent } from "./content-types";
import { ProductCard } from "@/components/ui/product-card";
import { Carousel } from "@/components/ui/carousel";
import { SkeletonBlock } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Reveal } from "@/lib/motion/reveal";
import { useAnimationLevel } from "@/lib/motion/animation-level-context";
import { staggerChildren } from "@/lib/motion/variants";
import { t, type Locale } from "@/lib/i18n";

/**
 * Produits en vedette — 3 variantes : grid (par défaut), carousel, masonry (grille à
 * hauteurs variables, mise en avant d'un produit phare).
 */
export function FeaturedProductsSection({
  variant,
  content,
  locale,
  isLoading,
}: {
  variant: string;
  content: ResolvedProductsContent;
  locale: Locale;
  isLoading?: boolean;
}) {
  const level = useAnimationLevel();
  const title = content.title ?? t(locale, "section.featured_products.title");

  if (isLoading) {
    return (
      <section className="mx-auto max-w-[var(--content-max-width)] px-6 py-16">
        <SkeletonBlock className="mb-8 h-8 w-64" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <SkeletonBlock key={i} className="aspect-[4/5]" />
          ))}
        </div>
      </section>
    );
  }

  if (content.products.length === 0) {
    return (
      <section className="mx-auto max-w-[var(--content-max-width)] px-6 py-16">
        <EmptyState
          title={t(locale, "empty.no_products.title")}
          description={t(locale, "empty.no_products.description")}
        />
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
          {content.products.map((product) => (
            <div key={product.id} className="w-[240px] shrink-0">
              <ProductCard product={product} locale={locale} />
            </div>
          ))}
        </Carousel>
      </section>
    );
  }

  const isMasonry = variant === "masonry";

  return (
    <section className="mx-auto max-w-[var(--content-max-width)] px-6 py-16">
      <Reveal>
        <h2 className="mb-8 font-[family-name:var(--font-heading)] text-[var(--color-text-primary)] text-[var(--text-heading-2xl)]">
          {title}
        </h2>
      </Reveal>
      <motion.div
        className={
          isMasonry
            ? "grid grid-cols-2 gap-4 sm:grid-cols-4 [&>*:first-child]:col-span-2 [&>*:first-child]:row-span-2"
            : "grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4"
        }
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        variants={staggerChildren(level)}
      >
        {content.products.map((product) => (
          <ProductCard key={product.id} product={product} locale={locale} />
        ))}
      </motion.div>
    </section>
  );
}
