"use client";

import { useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import type { LookbookParams } from "./content-types";
import type { ResolvedLookbookContent } from "./content-types";
import { Reveal } from "@/lib/motion/reveal";
import { formatFcfa } from "@/lib/format";
import { t, type Locale } from "@/lib/i18n";

/**
 * Lookbook interactif — points discrets sur l'image, ouverture d'une fiche rapide au
 * clic (voir la refonte artistique du 16 septembre 2026). Les identifiants de produits
 * référencés par les points sont résolus par l'appelant, jamais lus depuis une base de
 * données par ce composant — voir la séparation config/contenu résolu de
 * content-types.ts.
 */
export function LookbookSection({
  variant,
  params,
  content,
  locale,
}: {
  variant: string;
  params: LookbookParams;
  content?: ResolvedLookbookContent;
  locale: Locale;
}) {
  const [openHotspot, setOpenHotspot] = useState<{ imageIndex: number; productId: string } | null>(
    null,
  );
  const isFullscreen = variant === "fullscreen";

  return (
    <section className="mx-auto max-w-[var(--content-max-width)] px-6 py-24 lg:px-10 lg:py-32">
      {params.title && (
        <Reveal>
          <h2 className="mb-10 lg:mb-16 font-[family-name:var(--font-heading)] text-[var(--color-text-primary)] text-[length:var(--text-heading-2xl)]">
            {params.title}
          </h2>
        </Reveal>
      )}
      <div
        className={
          isFullscreen ? "flex flex-col gap-6" : "grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3"
        }
      >
        {params.images.map((image, imageIndex) => (
          <Reveal
            key={imageIndex}
            className={`relative overflow-hidden rounded-[var(--card-radius)] ${
              isFullscreen ? "aspect-[16/9]" : "aspect-[4/5]"
            }`}
          >
            <Image
              src={image.url}
              alt={image.alt ?? ""}
              fill
              sizes={isFullscreen ? "100vw" : "(max-width: 1024px) 50vw, 33vw"}
              className="object-cover"
            />
            {image.hotspots?.map((hotspot, hotspotIndex) => {
              const product = content?.productsById[hotspot.productId];
              return (
                <button
                  key={hotspotIndex}
                  type="button"
                  aria-label={product?.name ?? t(locale, "product.view")}
                  onClick={() =>
                    setOpenHotspot((current) =>
                      current?.imageIndex === imageIndex && current.productId === hotspot.productId
                        ? null
                        : { imageIndex, productId: hotspot.productId },
                    )
                  }
                  className="absolute flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center"
                  style={{ left: `${hotspot.x}%`, top: `${hotspot.y}%` }}
                >
                  <span className="absolute h-full w-full animate-ping rounded-full bg-white/60" />
                  <span className="relative flex h-3.5 w-3.5 items-center justify-center rounded-full border border-[var(--color-primary)] bg-white">
                    <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-primary)]" />
                  </span>
                </button>
              );
            })}

            <AnimatePresence>
              {image.hotspots?.map((hotspot, hotspotIndex) => {
                const product = content?.productsById[hotspot.productId];
                const isOpen =
                  openHotspot?.imageIndex === imageIndex &&
                  openHotspot.productId === hotspot.productId;
                if (!isOpen || !product) return null;
                return (
                  <motion.div
                    key={hotspotIndex}
                    initial={{ opacity: 0, transform: "translateY(6px)" }}
                    animate={{ opacity: 1, transform: "translateY(0px)" }}
                    exit={{ opacity: 0, transform: "translateY(6px)" }}
                    transition={{ duration: 0.2 }}
                    className="absolute z-10 flex w-48 items-center gap-3 rounded-[var(--card-radius)] bg-[var(--color-background)] p-3 shadow-[var(--shadow-lg)]"
                    style={{
                      left: `${hotspot.x}%`,
                      top: `${hotspot.y}%`,
                      transform: "translate(1rem, 1rem)",
                    }}
                  >
                    <div className="relative h-14 w-11 shrink-0 overflow-hidden rounded-[2px] bg-[var(--color-surface-muted)]">
                      <Image src={product.imageUrl} alt={product.name} fill className="object-cover" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-[var(--color-text-primary)] text-[length:var(--text-body-sm)]">
                        {product.name}
                      </p>
                      <p className="font-semibold text-[var(--color-text-primary)] text-[length:var(--text-body-sm)]">
                        {formatFcfa(product.price, locale)}
                      </p>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
