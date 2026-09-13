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
      <section className="mx-auto max-w-[var(--content-max-width)] px-6 py-24 lg:py-32 lg:px-10">
        <Reveal>
          <h2 className="mb-10 lg:mb-16 font-[family-name:var(--font-heading)] text-[var(--color-text-primary)] text-[length:var(--text-heading-2xl)]">
            {title}
          </h2>
        </Reveal>
        <Carousel autoplayMobile>
          {params.images.map((image, index) => (
            <div
              key={index}
              className="relative h-[420px] w-[340px] lg:h-[480px] lg:w-[380px] shrink-0 overflow-hidden rounded-[var(--radius-lg)]"
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
    <section className="mx-auto max-w-[var(--content-max-width)] px-6 py-24 lg:py-32 lg:px-10">
      <Reveal>
        <h2 className="mb-10 lg:mb-16 font-[family-name:var(--font-heading)] text-[var(--color-text-primary)] text-[length:var(--text-heading-2xl)]">
          {title}
        </h2>
      </Reveal>
      <div
        className={
          isMasonry ? "columns-2 gap-6 sm:columns-4 lg:gap-8" : "grid grid-cols-2 gap-6 sm:grid-cols-4 lg:gap-8"
        }
      >
        {params.images.map((image, index) =>
          isMasonry ? (
            <Reveal
              key={index}
              className="mb-6 break-inside-avoid overflow-hidden rounded-[var(--card-radius)] lg:mb-8"
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
