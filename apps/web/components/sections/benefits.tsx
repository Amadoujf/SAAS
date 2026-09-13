"use client";

import { motion } from "framer-motion";
import type { BenefitsParams } from "./content-types";
import { Reveal } from "@/lib/motion/reveal";
import { useAnimationLevel } from "@/lib/motion/animation-level-context";
import { staggerChildren, fadeInUp } from "@/lib/motion/variants";
import { t, type Locale } from "@/lib/i18n";
import { CraftIcon, ReturnIcon, ShieldIcon, TruckIcon } from "@/components/ui/icons";

/**
 * `item.icon` reste un champ texte libre au niveau du schéma (une entreprise peut y
 * saisir n'importe quel emoji dans un futur éditeur) — mais quand la valeur correspond
 * à l'un de ces mots-clés, on affiche une icône trait fin cohérente avec la direction
 * artistique plutôt qu'un emoji (voir la revue visuelle du 16 septembre 2026).
 */
const ICON_BY_KEYWORD: Record<string, React.ComponentType<{ className?: string }>> = {
  truck: TruckIcon,
  livraison: TruckIcon,
  craft: CraftIcon,
  "fait-main": CraftIcon,
  shield: ShieldIcon,
  paiement: ShieldIcon,
  return: ReturnIcon,
  retour: ReturnIcon,
};

function BenefitIcon({ icon }: { icon: string }) {
  const Icon = ICON_BY_KEYWORD[icon];
  if (Icon) return <Icon className="h-7 w-7 text-[var(--color-primary)]" />;
  return (
    <span aria-hidden="true" className="text-3xl">
      {icon}
    </span>
  );
}

/** Avantages — icons-row (ligne sobre) ou cards (chaque avantage dans une carte). */
export function BenefitsSection({
  variant,
  params,
  locale,
}: {
  variant: string;
  params: BenefitsParams;
  locale: Locale;
}) {
  const level = useAnimationLevel();
  const isCards = variant === "cards";

  return (
    <section className="mx-auto max-w-[var(--content-max-width)] px-6 py-24 lg:py-32 lg:px-10">
      <Reveal>
        <h2 className="mb-10 text-center font-[family-name:var(--font-heading)] text-[var(--color-text-primary)] text-[length:var(--text-heading-2xl)]">
          {t(locale, "section.benefits.title")}
        </h2>
      </Reveal>
      <motion.div
        className={
          isCards
            ? "grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3"
            : "flex flex-wrap justify-center gap-10"
        }
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        variants={staggerChildren(level)}
      >
        {params.items.map((item, index) => (
          <motion.div
            key={index}
            variants={fadeInUp(level)}
            className={
              isCards
                ? "flex flex-col items-center gap-3 rounded-[var(--card-radius)] border border-[var(--color-border)] p-6 text-center [box-shadow:var(--card-shadow)]"
                : "flex max-w-[180px] flex-col items-center gap-2 text-center"
            }
          >
            <BenefitIcon icon={item.icon} />
            <p className="font-[family-name:var(--font-heading)] text-[var(--color-text-primary)] text-[length:var(--text-heading-xs)]">
              {item.title}
            </p>
            {item.description && (
              <p className="text-[var(--color-text-muted)] text-[length:var(--text-body-sm)]">
                {item.description}
              </p>
            )}
          </motion.div>
        ))}
      </motion.div>
    </section>
  );
}
