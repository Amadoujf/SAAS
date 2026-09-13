"use client";

import type { VideoParams } from "./content-types";
import { Reveal } from "@/lib/motion/reveal";

export function VideoSection({ variant, params }: { variant: string; params: VideoParams }) {
  const framed = variant === "framed";

  return (
    <section className={framed ? "mx-auto max-w-[var(--content-max-width)] px-6 py-16" : "py-16"}>
      {params.title && (
        <Reveal>
          <h2 className="mb-8 text-center font-[family-name:var(--font-heading)] text-[var(--color-text-primary)] text-[var(--text-heading-2xl)]">
            {params.title}
          </h2>
        </Reveal>
      )}
      <Reveal
        className={
          framed
            ? "relative aspect-video overflow-hidden rounded-[var(--radius-lg)] [box-shadow:var(--card-shadow)]"
            : "relative aspect-video w-full"
        }
      >
        <video
          src={params.videoUrl}
          poster={params.posterUrl}
          controls
          playsInline
          className="h-full w-full object-cover"
        />
      </Reveal>
    </section>
  );
}
