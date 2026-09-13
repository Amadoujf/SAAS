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
          {products.map((product) => (
            <div key={product.id} className="w-[240px] shrink-0">
              <ProductCard product={product} locale={locale} />
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
        {products.map((product) => (
          <ProductCard key={product.id} product={product} locale={locale} />
        ))}
      </motion.div>
    </section>
  );
}
