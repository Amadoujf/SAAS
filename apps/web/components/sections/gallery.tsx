"use client";

import Image from "next/image";
import type { GalleryParams } from "./content-types";
import { Reveal } from "@/lib/motion/reveal";
import { Carousel } from "@/components/ui/carousel";
import { t, type Locale } from "@/lib/i18n";

export function GallerySection({
  variant,
  params,
  locale,
}: {
  variant: string;
  params: GalleryParams;
  locale: Locale;
}) {
  const title = params.title ?? t(locale, "section.gallery.title");

  if (variant === "carousel") {
    return (
      <section className="mx-auto max-w-[var(--content-max-width)] px-6 py-16">
        <Reveal>
          <h2 className="mb-8 font-[family-name:var(--font-heading)] text-[var(--color-text-primary)] text-[var(--text-heading-2xl)]">
            {title}
          </h2>
        </Reveal>
        <Carousel>
          {params.images.map((image, index) => (
            <div
              key={index}
              className="relative h-[340px] w-[280px] shrink-0 overflow-hidden rounded-[var(--radius-lg)]"
            >
              <Image src={image.url} alt={image.alt ?? ""} fill className="object-cover" />
            </div>
          ))}
        </Carousel>
      </section>
    );
  }

  const isMasonry = variant === "masonry";
  return (
    <section className="mx-auto max-w-[var(--content-max-width)] px-6 py-16">
      <Reveal>
        <h2 className="mb-8 font-[family-name:var(--font-heading)] text-[var(--color-text-primary)] text-[var(--text-heading-2xl)]">
          {title}
        </h2>
      </Reveal>
      <div
        className={
          isMasonry ? "columns-2 gap-4 sm:columns-3" : "grid grid-cols-2 gap-4 sm:grid-cols-3"
        }
      >
        {params.images.map((image, index) =>
          isMasonry ? (
            <Reveal
              key={index}
              className="mb-4 break-inside-avoid overflow-hidden rounded-[var(--radius-lg)]"
            >
              <Image
                src={image.url}
                alt={image.alt ?? ""}
                width={480}
                height={360 + (index % 3) * 80}
                className="w-full object-cover"
              />
            </Reveal>
          ) : (
            <Reveal
              key={index}
              className="relative aspect-square overflow-hidden rounded-[var(--radius-lg)]"
            >
              <Image src={image.url} alt={image.alt ?? ""} fill className="object-cover" />
            </Reveal>
          ),
        )}
      </div>
    </section>
  );
}
