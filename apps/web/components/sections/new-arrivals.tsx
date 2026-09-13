"use client";

import { motion } from "framer-motion";
import type { ResolvedProductsContent } from "./content-types";
import { ProductCard } from "@/components/ui/product-card";
import { Carousel } from "@/components/ui/carousel";
import { EmptyState } from "@/components/ui/empty-state";
import { Reveal } from "@/lib/motion/reveal";
import { useAnimationLevel } from "@/lib/motion/animation-level-context";
import { staggerChildren } from "@/lib/motion/variants";
import { t, type Locale } from "@/lib/i18n";

/** Nouveautés — 2 variantes : grid, carousel. Chaque produit reçoit le badge "Nouveau"
 *  automatiquement si `product.badge` n'est pas déjà défini. */
export function NewArrivalsSection({
  variant,
  content,
  locale,
}: {
  variant: string;
  content: ResolvedProductsContent;
  locale: Locale;
}) {
  const level = useAnimationLevel();
  const title = content.title ?? t(locale, "section.new_arrivals.title");
  const badge = t(locale, "section.new_arrivals.badge");
  const products = content.products.map((p) => ({ ...p, badge: p.badge ?? badge }));

  if (products.length === 0) {
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
          {products.map((product) => (
            <div key={product.id} className="w-[300px] shrink-0 lg:w-[360px]">
              <ProductCard product={product} locale={locale} />
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
          {title}
        </h2>
      </Reveal>
      <motion.div
        className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:gap-10"
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
