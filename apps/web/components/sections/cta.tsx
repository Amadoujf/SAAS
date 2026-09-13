"use client";

import type { CtaParams } from "./content-types";
import { Reveal } from "@/lib/motion/reveal";
import { Button } from "@/components/ui/button";

export function CtaSection({ variant, params }: { variant: string; params: CtaParams }) {
  if (variant === "split") {
    return (
      <section className="mx-auto flex max-w-[var(--content-max-width)] flex-col items-center justify-between gap-6 border-t border-[var(--color-border)] px-6 py-14 sm:flex-row">
        <Reveal>
          <h2 className="font-[family-name:var(--font-heading)] text-[var(--color-text-primary)] text-[var(--text-heading-xl)]">
            {params.title}
          </h2>
          {params.description && (
            <p className="mt-2 text-[var(--color-text-muted)] text-[var(--text-body-md)]">
              {params.description}
            </p>
          )}
        </Reveal>
        <Reveal>
          <Button href={params.buttonHref}>{params.buttonLabel}</Button>
        </Reveal>
      </section>
    );
  }

  return (
    <section className="px-6 py-16">
      <Reveal className="mx-auto flex max-w-[var(--content-max-width)] flex-col items-center gap-4 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] px-8 py-14 text-center">
        <h2 className="font-[family-name:var(--font-heading)] text-[var(--color-text-primary)] text-[var(--text-heading-2xl)]">
          {params.title}
        </h2>
        {params.description && (
          <p className="max-w-xl text-[var(--color-text-muted)] text-[var(--text-body-lg)]">
            {params.description}
          </p>
        )}
        <Button href={params.buttonHref}>{params.buttonLabel}</Button>
      </Reveal>
    </section>
  );
}
