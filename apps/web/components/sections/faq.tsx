"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { FaqParams } from "./content-types";
import { Reveal } from "@/lib/motion/reveal";
import { t, type Locale } from "@/lib/i18n";

export function FaqSection({
  variant,
  params,
  locale,
}: {
  variant: string;
  params: FaqParams;
  locale: Locale;
}) {
  if (variant === "two-column") {
    return (
      <section className="mx-auto max-w-[var(--content-max-width)] px-6 py-16">
        <Reveal>
          <h2 className="mb-8 font-[family-name:var(--font-heading)] text-[var(--color-text-primary)] text-[var(--text-heading-2xl)]">
            {t(locale, "section.faq.title")}
          </h2>
        </Reveal>
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
          {params.items.map((item, index) => (
            <Reveal key={index}>
              <h3 className="mb-2 font-medium text-[var(--color-text-primary)]">{item.question}</h3>
              <p className="text-[var(--color-text-muted)] text-[var(--text-body-sm)]">
                {item.answer}
              </p>
            </Reveal>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-2xl px-6 py-16">
      <Reveal>
        <h2 className="mb-8 text-center font-[family-name:var(--font-heading)] text-[var(--color-text-primary)] text-[var(--text-heading-2xl)]">
          {t(locale, "section.faq.title")}
        </h2>
      </Reveal>
      <div className="divide-y divide-[var(--color-border)] border-y border-[var(--color-border)]">
        {params.items.map((item, index) => (
          <FaqAccordionItem key={index} question={item.question} answer={item.answer} />
        ))}
      </div>
    </section>
  );
}

function FaqAccordionItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  const panelId = `faq-panel-${question.slice(0, 12).replace(/\s+/g, "-")}`;

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex w-full items-center justify-between py-4 text-left font-medium text-[var(--color-text-primary)]"
      >
        {question}
        <span
          aria-hidden="true"
          className="ml-4 transition-transform"
          style={{ transform: open ? "rotate(45deg)" : "none" }}
        >
          +
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={panelId}
            role="region"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <p className="pb-4 text-[var(--color-text-muted)] text-[var(--text-body-sm)]">
              {answer}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
