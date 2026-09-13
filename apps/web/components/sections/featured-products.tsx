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
      <section className="mx-auto max-w-[var(--content-max-width)] px-6 py-24 lg:py-32 lg:px-10">
        <SkeletonBlock className="mb-10 lg:mb-16 h-10 w-72" />
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:gap-10">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonBlock key={i} className="aspect-[4/5]" />
          ))}
        </div>
      </section>
    );
  }

  if (content.products.length === 0) {
    return (
      <section className="mx-auto max-w-[var(--content-max-width)] px-6 py-24 lg:py-32 lg:px-10">
        <EmptyState
          title={t(locale, "empty.no_products.title")}
          description={t(locale, "empty.no_products.description")}
        />
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
          {content.products.map((product) => (
            <div key={product.id} className="w-[300px] shrink-0 lg:w-[360px]">
              <ProductCard product={product} locale={locale} />
            </div>
          ))}
        </Carousel>
      </section>
    );
  }

  // "editorial" partage la grille à tailles alternées de "masonry" (voir la refonte
  // artistique du 16 septembre 2026, « alternance des dimensions ») — les deux ne se
  // distinguent que par un espacement plus généreux, géré ci-dessous par `gap-8 lg:gap-10`.
  const isMasonry = variant === "masonry" || variant === "editorial";

  return (
    <section className="mx-auto max-w-[var(--content-max-width)] px-6 py-24 lg:py-32 lg:px-10">
      <Reveal>
        <h2 className="mb-10 lg:mb-16 font-[family-name:var(--font-heading)] text-[var(--color-text-primary)] text-[length:var(--text-heading-2xl)]">
          {title}
        </h2>
      </Reveal>
      <motion.div
        className={
          isMasonry
            ? "grid grid-cols-2 gap-6 sm:grid-cols-4 lg:gap-10 [&>*:nth-child(4n+1)]:col-span-2 [&>*:nth-child(4n+1)]:row-span-2"
            : "grid grid-cols-2 gap-6 sm:grid-cols-3 lg:gap-10"
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
