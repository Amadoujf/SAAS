"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import type { NewsletterParams } from "./content-types";
import { Reveal } from "@/lib/motion/reveal";
import { useAnimationLevel } from "@/lib/motion/animation-level-context";
import { t, type Locale } from "@/lib/i18n";

/**
 * Newsletter — inline (bande discrète) ou banner (mise en avant). Micro-animation de
 * formulaire : le champ se surligne au focus, le bouton réagit au clic — voir la
 * demande « microanimations des formulaires ».
 */
export function NewsletterSection({
  variant,
  params,
  locale,
}: {
  variant: string;
  params: NewsletterParams;
  locale: Locale;
}) {
  const level = useAnimationLevel();
  const [submitted, setSubmitted] = useState(false);
  const isBanner = variant === "banner";

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
  }

  return (
    <section
      className={
        isBanner
          ? "bg-[var(--color-surface)] px-6 py-24 lg:py-32"
          : "border-y border-[var(--color-border)] px-6 py-10"
      }
    >
      <Reveal className="mx-auto flex max-w-xl flex-col items-center gap-4 text-center">
        <h2 className="font-[family-name:var(--font-heading)] text-[var(--color-text-primary)] text-[length:var(--text-heading-xl)]">
          {params.title ?? t(locale, "section.newsletter.title")}
        </h2>
        {params.description && (
          <p className="text-[var(--color-text-muted)] text-[length:var(--text-body-md)]">
            {params.description}
          </p>
        )}
        {submitted ? (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="font-medium text-[var(--color-success)] text-[length:var(--text-body-md)]"
          >
            ✓ {locale === "en" ? "Thank you for subscribing!" : "Merci pour votre inscription !"}
          </motion.p>
        ) : (
          <form onSubmit={handleSubmit} className="flex w-full max-w-sm gap-2">
            <motion.input
              type="email"
              required
              placeholder={t(locale, "section.newsletter.placeholder")}
              whileFocus={level === "none" ? {} : { scale: 1.02 }}
              className="w-full rounded-[var(--input-radius)] border border-[var(--color-border)] bg-[var(--color-background)] px-4 py-2.5 text-[length:var(--text-body-sm)] outline-none focus:border-[var(--color-primary)]"
            />
            <button
              type="submit"
              className="shrink-0 rounded-[var(--button-radius)] bg-[var(--color-primary)] px-5 py-2.5 font-medium text-[length:var(--text-body-sm)] text-white transition hover:opacity-90"
            >
              {t(locale, "section.newsletter.submit")}
            </button>
          </form>
        )}
      </Reveal>
    </section>
  );
}
