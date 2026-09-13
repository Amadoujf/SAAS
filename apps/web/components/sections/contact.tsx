"use client";

import type { ContactParams } from "./content-types";
import { Reveal } from "@/lib/motion/reveal";
import { t, type Locale } from "@/lib/i18n";

export function ContactSection({
  variant,
  params,
  locale,
}: {
  variant: string;
  params: ContactParams;
  locale: Locale;
}) {
  const infoBlock = (
    <div className="flex flex-col gap-2 text-[var(--color-text-secondary)] text-[var(--text-body-md)]">
      {params.address && <p>{params.address}</p>}
      {params.phone && (
        <p>
          <a href={`tel:${params.phone}`} className="hover:text-[var(--color-primary)]">
            {params.phone}
          </a>
        </p>
      )}
      {params.email && (
        <p>
          <a href={`mailto:${params.email}`} className="hover:text-[var(--color-primary)]">
            {params.email}
          </a>
        </p>
      )}
    </div>
  );

  if (variant === "split") {
    return (
      <section className="mx-auto grid max-w-[var(--content-max-width)] grid-cols-1 gap-10 px-6 py-16 md:grid-cols-2">
        <Reveal>
          <h2 className="mb-4 font-[family-name:var(--font-heading)] text-[var(--color-text-primary)] text-[var(--text-heading-2xl)]">
            {t(locale, "section.contact.title")}
          </h2>
          {infoBlock}
        </Reveal>
        {params.showMap && (
          <Reveal className="aspect-video overflow-hidden rounded-[var(--radius-lg)] bg-[var(--color-surface-muted)]">
            <div
              className="h-full w-full"
              role="img"
              aria-label={locale === "en" ? "Map (placeholder)" : "Carte (emplacement réservé)"}
            />
          </Reveal>
        )}
      </section>
    );
  }

  return (
    <section className="px-6 py-16 text-center">
      <Reveal className="mx-auto max-w-md">
        <h2 className="mb-4 font-[family-name:var(--font-heading)] text-[var(--color-text-primary)] text-[var(--text-heading-2xl)]">
          {t(locale, "section.contact.title")}
        </h2>
        {infoBlock}
      </Reveal>
    </section>
  );
}
