"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import type { ResolvedDesignersContent } from "./content-types";
import { Reveal } from "@/lib/motion/reveal";
import { useAnimationLevel } from "@/lib/motion/animation-level-context";
import { hoverLift, staggerChildren } from "@/lib/motion/variants";
import { Carousel } from "@/components/ui/carousel";
import { EmptyState } from "@/components/ui/empty-state";
import { t, type Locale } from "@/lib/i18n";

/**
 * Créateurs en vedette — section ajoutée pour « Boutique africaine contemporaine »
 * (Teranga Atelier, 20 septembre 2026). Chaque carte pointe vers une VRAIE fiche
 * créateur (`/createur/[handle]`, route dynamique dédiée, voir docs de ce template) —
 * jamais un lien mort.
 */
export function DesignersSection({
  variant,
  content,
  locale,
}: {
  variant: string;
  content: ResolvedDesignersContent;
  locale: Locale;
}) {
  const level = useAnimationLevel();
  const title = content.title ?? t(locale, "section.designers.title");

  if (content.designers.length === 0) {
    return (
      <section className="mx-auto max-w-[var(--content-max-width)] px-6 py-24 lg:px-10 lg:py-32">
        <EmptyState title={t(locale, "empty.no_products.title")} />
      </section>
    );
  }

  if (variant === "carousel") {
    return (
      <section className="mx-auto max-w-[var(--content-max-width)] px-6 py-24 lg:px-10 lg:py-32">
        <Reveal>
          <h2 className="mb-10 font-[family-name:var(--font-heading)] text-[length:var(--text-heading-2xl)] text-[var(--color-text-primary)] lg:mb-16">
            {title}
          </h2>
        </Reveal>
        <Carousel autoplayMobile>
          {content.designers.map((designer) => (
            <DesignerCard
              key={designer.id}
              designer={designer}
              className="w-[260px] shrink-0 lg:w-[300px]"
            />
          ))}
        </Carousel>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-[var(--content-max-width)] px-6 py-24 lg:px-10 lg:py-32">
      <Reveal>
        <h2 className="mb-10 font-[family-name:var(--font-heading)] text-[length:var(--text-heading-2xl)] text-[var(--color-text-primary)] lg:mb-16">
          {title}
        </h2>
      </Reveal>
      <motion.div
        className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4 lg:gap-8"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        variants={staggerChildren(level)}
      >
        {content.designers.map((designer) => (
          <DesignerCard key={designer.id} designer={designer} />
        ))}
      </motion.div>
    </section>
  );
}

function DesignerCard({
  designer,
  className = "",
}: {
  designer: ResolvedDesignersContent["designers"][number];
  className?: string;
}) {
  const level = useAnimationLevel();
  const hover = hoverLift(level);
  return (
    <motion.a href={designer.href} className={`group block ${className}`} {...hover}>
      <div className="relative aspect-[3/4] overflow-hidden rounded-[var(--card-radius)] bg-[var(--color-surface-muted)]">
        <Image
          src={designer.photoUrl}
          alt={designer.name}
          fill
          sizes="(max-width: 1024px) 50vw, 25vw"
          className="object-cover transition duration-500 group-hover:scale-105"
        />
      </div>
      <p className="mt-4 font-[family-name:var(--font-heading)] text-[length:var(--text-body-lg)] text-[var(--color-text-primary)]">
        {designer.name}
      </p>
      <p className="mt-1 text-[length:var(--text-body-sm)] text-[var(--color-text-muted)]">
        {designer.specialty}
        {typeof designer.productCount === "number" &&
          ` · ${designer.productCount} pièce${designer.productCount > 1 ? "s" : ""}`}
      </p>
    </motion.a>
  );
}
