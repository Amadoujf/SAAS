"use client";

import { useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import type { ProvenanceParams } from "./content-types";
import { Reveal } from "@/lib/motion/reveal";
import { t, type Locale } from "@/lib/i18n";

/**
 * Provenance des créations — section ajoutée pour « Boutique africaine contemporaine »
 * (Teranga Atelier, 20 septembre 2026). Variante "map" : illustration stylisée avec
 * points de repère cliquables (même mécanique que les hotspots du lookbook, appliquée
 * à des régions plutôt qu'à des produits) ; variante "list" : liste simple, plus sobre,
 * pour un rendu mobile-first sans illustration décorative.
 */
export function ProvenanceSection({
  variant,
  params,
  locale,
}: {
  variant: string;
  params: ProvenanceParams;
  locale: Locale;
}) {
  const [activeRegion, setActiveRegion] = useState<string | null>(null);
  const title = params.title ?? t(locale, "section.provenance.title");

  if (variant === "list") {
    return (
      <section className="mx-auto max-w-[var(--content-max-width)] px-6 py-24 lg:px-10 lg:py-32">
        <Reveal>
          <h2 className="font-[family-name:var(--font-heading)] text-[length:var(--text-heading-2xl)] text-[var(--color-text-primary)]">
            {title}
          </h2>
        </Reveal>
        {params.intro && (
          <Reveal>
            <p className="mt-4 max-w-2xl text-[length:var(--text-body-lg)] text-[var(--color-text-secondary)]">
              {params.intro}
            </p>
          </Reveal>
        )}
        <div className="mt-12 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {params.regions.map((region) => (
            <Reveal key={region.id}>
              <div className="relative mb-4 aspect-[4/3] overflow-hidden rounded-[var(--card-radius)]">
                <Image
                  src={region.media.url}
                  alt={region.media.alt ?? region.name}
                  fill
                  sizes="(max-width: 1024px) 100vw, 33vw"
                  className="object-cover"
                />
              </div>
              <p className="font-[family-name:var(--font-heading)] text-[length:var(--text-heading-sm)] text-[var(--color-text-primary)]">
                {region.name}
              </p>
              <p className="mt-1 text-[length:var(--text-body-xs)] uppercase tracking-[0.12em] text-[var(--color-secondary)]">
                {region.craft}
              </p>
              <p className="mt-3 text-[length:var(--text-body-sm)] text-[var(--color-text-secondary)]">
                {region.description}
              </p>
            </Reveal>
          ))}
        </div>
      </section>
    );
  }

  const active = params.regions.find((region) => region.id === activeRegion) ?? params.regions[0]!;

  return (
    <section className="mx-auto max-w-[var(--content-max-width)] px-6 py-24 lg:px-10 lg:py-32">
      <Reveal>
        <h2 className="font-[family-name:var(--font-heading)] text-[length:var(--text-heading-2xl)] text-[var(--color-text-primary)]">
          {title}
        </h2>
      </Reveal>
      {params.intro && (
        <Reveal>
          <p className="mt-4 max-w-2xl text-[length:var(--text-body-lg)] text-[var(--color-text-secondary)]">
            {params.intro}
          </p>
        </Reveal>
      )}
      <div className="mt-12 grid grid-cols-1 gap-10 lg:grid-cols-2 lg:items-center lg:gap-16">
        <Reveal className="relative aspect-square overflow-hidden rounded-[var(--card-radius)] bg-[var(--color-surface-muted)]">
          <Image
            src={active.media.url}
            alt={active.media.alt ?? active.name}
            fill
            sizes="(max-width: 1024px) 100vw, 50vw"
            className="object-cover transition-opacity duration-500"
            key={active.id}
          />
          {params.regions.map((region) => (
            <button
              key={region.id}
              type="button"
              aria-label={region.name}
              aria-pressed={region.id === active.id}
              onClick={() => setActiveRegion(region.id)}
              className="absolute flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center"
              style={{ left: `${region.x}%`, top: `${region.y}%` }}
            >
              {region.id === active.id && (
                <span className="absolute h-full w-full animate-ping rounded-full bg-white/60" />
              )}
              <span
                className={`relative flex h-3.5 w-3.5 items-center justify-center rounded-full border bg-white transition-transform ${
                  region.id === active.id
                    ? "scale-125 border-[var(--color-secondary)]"
                    : "border-[var(--color-primary)]"
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    region.id === active.id
                      ? "bg-[var(--color-secondary)]"
                      : "bg-[var(--color-primary)]"
                  }`}
                />
              </span>
            </button>
          ))}
        </Reveal>

        <AnimatePresence mode="wait">
          <motion.div
            key={active.id}
            initial={{ opacity: 0, transform: "translateY(8px)" }}
            animate={{ opacity: 1, transform: "translateY(0px)" }}
            exit={{ opacity: 0, transform: "translateY(-8px)" }}
            transition={{ duration: 0.25 }}
          >
            <p className="text-[length:var(--text-body-xs)] uppercase tracking-[0.12em] text-[var(--color-secondary)]">
              {active.craft}
            </p>
            <p className="mt-2 font-[family-name:var(--font-heading)] text-[length:var(--text-heading-lg)] text-[var(--color-text-primary)]">
              {active.name}
            </p>
            <p className="mt-4 max-w-md text-[length:var(--text-body-lg)] text-[var(--color-text-secondary)]">
              {active.description}
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              {params.regions.map((region) => (
                <button
                  key={region.id}
                  type="button"
                  onClick={() => setActiveRegion(region.id)}
                  className={`rounded-[var(--radius-full)] border px-4 py-1.5 text-[length:var(--text-body-xs)] transition ${
                    region.id === active.id
                      ? "border-[var(--color-secondary)] bg-[var(--color-secondary)] text-white"
                      : "border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-secondary)]"
                  }`}
                >
                  {region.name}
                </button>
              ))}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}
