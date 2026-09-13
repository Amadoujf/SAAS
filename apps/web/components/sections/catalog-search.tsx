"use client";

import { useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import type { CatalogSearchParams } from "./content-types";
import { Reveal } from "@/lib/motion/reveal";
import { SearchIcon } from "@/components/ui/icons";
import { useAnimationLevel } from "@/lib/motion/animation-level-context";
import { staggerChildren, fadeInUp } from "@/lib/motion/variants";

/**
 * Recherche catalogue — remplace le hero cinématographique sur le template B2B « Dakar
 * Distribution Pro » (template 5, 20 septembre 2026) : « recherche de produits très
 * visible » demandée en première position de la page d'accueil. Formulaire natif
 * (GET vers /catalogue?q=...) : navigue réellement au lieu d'un bouton silencieux, sans
 * dépendre d'un moteur de recherche déjà branché.
 */
export function CatalogSearchSection({
  variant,
  params,
}: {
  variant: string;
  params: CatalogSearchParams;
}) {
  const level = useAnimationLevel();
  const [query, setQuery] = useState("");
  const compact = variant === "compact";

  return (
    <section
      className={`relative overflow-hidden ${compact ? "py-16 lg:py-20" : "py-20 lg:py-28"}`}
      style={{ backgroundColor: "var(--color-primary)" }}
    >
      {params.media && (
        <>
          <Image
            src={params.media.url}
            alt={params.media.alt ?? ""}
            fill
            priority
            sizes="100vw"
            className="object-cover opacity-30"
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(90deg, var(--color-primary) 0%, color-mix(in srgb, var(--color-primary) 55%, transparent) 60%, transparent 100%)",
            }}
          />
        </>
      )}
      <div className="relative mx-auto max-w-[var(--content-max-width)] px-6 text-white lg:px-10">
        {params.eyebrow && (
          <Reveal>
            <p className="text-[length:var(--text-body-sm)] uppercase tracking-[0.2em] text-white/60">
              {params.eyebrow}
            </p>
          </Reveal>
        )}
        <Reveal>
          <h1 className="mt-2 max-w-2xl font-[family-name:var(--font-heading)] text-[length:var(--text-heading-2xl)]">
            {params.title}
          </h1>
        </Reveal>
        {params.subtitle && (
          <Reveal>
            <p className="mt-4 max-w-xl text-[length:var(--text-body-lg)] text-white/75">
              {params.subtitle}
            </p>
          </Reveal>
        )}

        <Reveal>
          <form
            action="/catalogue"
            method="get"
            role="search"
            className="mt-8 flex max-w-2xl items-stretch gap-0 rounded-[var(--radius-md)] bg-white p-1.5 shadow-[var(--shadow-lg)]"
          >
            <label htmlFor="catalog-search-input" className="sr-only">
              {params.searchPlaceholder ?? "Rechercher un produit, une référence, une marque"}
            </label>
            <input
              id="catalog-search-input"
              type="search"
              name="q"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={
                params.searchPlaceholder ?? "Rechercher un produit, une référence, une marque..."
              }
              className="min-w-0 flex-1 rounded-[var(--radius-sm)] px-4 py-3 text-[length:var(--text-body-md)] text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-muted)]"
            />
            <button
              type="submit"
              className="flex shrink-0 items-center gap-2 rounded-[var(--radius-sm)] bg-[var(--color-secondary)] px-5 py-3 font-medium text-white transition hover:opacity-90"
            >
              <SearchIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Rechercher</span>
            </button>
          </form>
        </Reveal>

        {params.quickCategories && params.quickCategories.length > 0 && (
          <motion.div
            className="mt-6 flex flex-wrap gap-2"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerChildren(level)}
          >
            {params.quickCategories.map((category) => (
              <motion.a
                key={category.href}
                href={category.href}
                variants={fadeInUp(level)}
                className="rounded-[var(--radius-full)] border border-white/25 px-4 py-1.5 text-[length:var(--text-body-sm)] text-white/85 transition hover:border-white hover:text-white"
              >
                {category.label}
              </motion.a>
            ))}
          </motion.div>
        )}

        {params.stats && params.stats.length > 0 && (
          <dl className="mt-10 grid grid-cols-2 gap-6 border-t border-white/15 pt-8 sm:grid-cols-4 lg:max-w-2xl">
            {params.stats.map((stat, index) => (
              <div key={index}>
                <dt className="font-[family-name:var(--font-heading)] text-[length:var(--text-heading-sm)]">
                  {stat.value}
                </dt>
                <dd className="mt-1 text-[length:var(--text-body-xs)] text-white/60">
                  {stat.label}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </section>
  );
}
