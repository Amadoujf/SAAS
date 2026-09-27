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

  // « masonry » : par groupes de 5, une grande pièce (2 × 2) et quatre petites — la grille
  // se remplit sans trou. « editorial » : même principe, la grande pièce alterne
  // gauche/droite d'un groupe à l'autre. Un reste de moins de 5 produits passe en grille.
  const isMasonry = (variant === "masonry" || variant === "editorial") && content.products.length >= 5;
  const products = isMasonry ? content.products.slice(0, content.products.length - (content.products.length % 5)) : content.products;
  const masonryClass =
    variant === "editorial"
      ? "grid grid-flow-dense grid-cols-2 gap-6 sm:grid-cols-4 lg:gap-10 [&>*:nth-child(10n+1)]:col-span-2 [&>*:nth-child(10n+1)]:row-span-2 sm:[&>*:nth-child(10n+6)]:col-start-3 [&>*:nth-child(10n+6)]:col-span-2 [&>*:nth-child(10n+6)]:row-span-2"
      : "grid grid-flow-dense grid-cols-2 gap-6 sm:grid-cols-4 lg:gap-10 [&>*:nth-child(5n+1)]:col-span-2 [&>*:nth-child(5n+1)]:row-span-2";

  return (
    <section className="mx-auto max-w-[var(--content-max-width)] px-6 py-24 lg:py-32 lg:px-10">
      <Reveal>
        <h2 className="mb-10 lg:mb-16 font-[family-name:var(--font-heading)] text-[var(--color-text-primary)] text-[length:var(--text-heading-2xl)]">
          {title}
        </h2>
      </Reveal>
      <motion.div
        className={
          isMasonry ? masonryClass : "grid grid-cols-2 gap-6 sm:grid-cols-3 lg:gap-10"
        }
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        variants={staggerChildren(level)}
      >
        {products.map((product) => (
          <ProductCard key={product.id} product={product} locale={locale} />
        ))}
      </motion.div>
    </section>
  );
}
