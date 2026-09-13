"use client";

import Image from "next/image";
import type { SignatureProductParams } from "./content-types";
import { Reveal } from "@/lib/motion/reveal";
import { Parallax } from "@/lib/motion/parallax";
import { Magnetic } from "@/lib/motion/magnetic";
import { Button } from "@/components/ui/button";

/**
 * Section « produit signature » — mise en scène immersive d'une pièce phare sur fond
 * sombre (voir la refonte artistique du 16 septembre 2026, « section signature »).
 * Les deux fonds proviennent des tokens `leather`/`mutedSurface` (voir
 * packages/design-tokens/src/schema.ts, ajoutés le 16 septembre 2026 suite à la revue
 * de refonte) — plus aucune couleur propre à un template codée en dur ici.
 */
export function SignatureProductSection({
  variant,
  params,
}: {
  variant: string;
  params: SignatureProductParams;
}) {
  const isLeather = variant === "leather";
  const bg = isLeather ? "var(--color-leather)" : "var(--color-muted-surface)";

  return (
    <section
      className="relative overflow-hidden py-24 text-white lg:py-0"
      style={{ backgroundColor: bg }}
    >
      <div className="mx-auto grid max-w-[var(--content-max-width)] grid-cols-1 items-stretch lg:grid-cols-2">
        <div className="flex flex-col justify-center px-6 py-16 lg:px-16 lg:py-24">
          {params.collectionNumber && (
            <Reveal>
              <p className="mb-6 font-[family-name:var(--font-heading)] text-[length:var(--text-body-sm)] text-white/40">
                {params.collectionNumber}
              </p>
            </Reveal>
          )}
          {params.eyebrow && (
            <Reveal>
              <p className="mb-4 text-[length:var(--text-body-sm)] uppercase tracking-[0.28em] text-[var(--color-secondary)]">
                {params.eyebrow}
              </p>
            </Reveal>
          )}
          <Reveal>
            <h2 className="max-w-md font-[family-name:var(--font-heading)] text-[length:var(--text-heading-2xl)] leading-[1.05]">
              {params.title}
            </h2>
          </Reveal>
          {params.description && (
            <Reveal>
              <p className="mt-6 max-w-sm text-[length:var(--text-body-lg)] text-white/70">
                {params.description}
              </p>
            </Reveal>
          )}
          {(typeof params.piecesRemaining === "number" || params.isPreorder) && (
            <Reveal>
              <p className="mt-6 inline-flex items-center gap-2 rounded-[var(--radius-full)] border border-white/25 px-4 py-1.5 text-[length:var(--text-body-sm)] text-white/85">
                <span
                  className="h-1.5 w-1.5 rounded-full bg-[var(--color-secondary)]"
                  aria-hidden="true"
                />
                {params.isPreorder
                  ? params.preorderReleaseDate
                    ? `Précommande — disponible le ${params.preorderReleaseDate}`
                    : "Précommande ouverte"
                  : `${params.piecesRemaining} pièce${params.piecesRemaining === 1 ? "" : "s"} restante${
                      params.piecesRemaining === 1 ? "" : "s"
                    }`}
              </p>
            </Reveal>
          )}
          {params.ctaLabel && params.ctaHref && (
            <Reveal>
              <div className="mt-10">
                <Magnetic className="inline-block">
                  <Button
                    href={params.ctaHref}
                    variant="outline"
                    size="xl"
                    className="border-white/50 text-white hover:bg-white hover:text-[var(--color-muted-surface)]"
                  >
                    {params.ctaLabel}
                  </Button>
                </Magnetic>
              </div>
            </Reveal>
          )}
        </div>
        <div className="relative min-h-[420px] lg:min-h-[640px]">
          <Parallax strength={50} className="absolute inset-0">
            <div className="relative h-full w-full">
              <Image
                src={params.media.url}
                alt={params.media.alt ?? ""}
                fill
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="object-cover"
              />
            </div>
          </Parallax>
          {params.detailMedia && (
            <div className="absolute -bottom-8 -left-8 hidden aspect-square w-40 overflow-hidden border-4 shadow-2xl [border-color:var(--color-background)] sm:block lg:w-56">
              <Image
                src={params.detailMedia.url}
                alt={params.detailMedia.alt ?? ""}
                fill
                sizes="224px"
                className="object-cover"
              />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
