"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { z } from "zod";
import type { sectionParamSchemas } from "@yamacommerce/templates";
import { useMotionAmplitude } from "@/lib/motion/immersive";
import { ImmersiveImage } from "./immersive-image";
import { isDarkColor } from "./immersive-hero";

export type ScrollStoryParams = z.infer<typeof sectionParamSchemas.scroll_story>;
type Step = ScrollStoryParams["steps"][number];

/** Cadrage d'une étape : l'image « glisse » vers le détail choisi (point focal + zoom). */
function framing(step: Step, animate: boolean): CSSProperties {
  return {
    transformOrigin: `${step.focusX}% ${step.focusY}%`,
    transform: `scale(${step.zoom})`,
    transition: animate ? "transform 1.1s cubic-bezier(0.22, 1, 0.36, 1)" : "none",
  };
}

/** Recadrage de la photo elle-même sur le détail : une photo paysage affichée en format
 *  portrait garde ainsi le détail choisi dans le cadre avant d'être agrandie. */
function crop(step: Step, animate: boolean): CSSProperties {
  return {
    objectPosition: `${step.focusX}% ${step.focusY}%`,
    transition: animate ? "object-position 1.1s cubic-bezier(0.22, 1, 0.36, 1)" : "none",
  };
}

/**
 * Récit au défilement — voir @yamacommerce/templates `scroll_story`. Ordinateur : image
 * « collante » (CSS sticky, le défilement reste celui du navigateur) et étapes qui
 * défilent normalement ; l'étape au centre de l'écran pilote l'image. Mobile : chaque
 * étape affiche sa propre image dans le flux — rien de collant, rien de bloqué. Tout le
 * texte reste lisible et accessible, animations ou pas.
 */
export function ScrollStorySection({ variant, params }: { variant: string; params: ScrollStoryParams }) {
  const [active, setActive] = useState(0);
  const stepsRef = useRef<(HTMLLIElement | null)[]>([]);
  const amp = useMotionAmplitude("balanced");
  const animate = amp > 0;
  const dark = isDarkColor(params.backgroundColor);
  const steps = params.steps;

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive(Number((entry.target as HTMLElement).dataset.step));
        }
      },
      { rootMargin: "-45% 0px -45% 0px" },
    );
    stepsRef.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, [steps.length]);

  const imageFor = (i: number) => steps[i]?.imageUrl ?? params.image;
  const altFor = (i: number) => steps[i]?.imageAlt ?? params.imageAlt ?? "";
  const timeline = variant === "timeline";
  const hasMedia = Boolean(params.image || steps.some((s) => s.imageUrl));
  const progress = steps.length > 1 ? active / (steps.length - 1) : 1;

  const media = (
    <div className="relative h-full w-full overflow-hidden rounded-[var(--radius-lg,18px)] bg-[var(--color-surface-muted,#eee)]">
      {variant === "focus" || !steps.some((s) => s.imageUrl) ? (
        <div className="h-full w-full" style={framing(steps[active] ?? steps[0]!, animate)}>
          <ImmersiveImage src={params.image ?? steps[0]?.imageUrl} alt={params.imageAlt ?? ""} style={crop(steps[active] ?? steps[0]!, animate)} />
        </div>
      ) : (
        steps.map((s, i) => (
          <div key={i} aria-hidden={i !== active} className={`absolute inset-0 ${animate ? "transition-opacity duration-700" : ""} ${i === active ? "opacity-100" : "opacity-0"}`}>
            <div className="h-full w-full" style={framing(s, animate)}>
              <ImmersiveImage src={imageFor(i)} alt={i === active ? altFor(i) : ""} style={crop(s, false)} />
            </div>
          </div>
        ))
      )}
      <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-1/3 bg-[linear-gradient(0deg,rgba(8,14,30,0.35),transparent)]" />
      <p className="absolute bottom-4 left-4 rounded-full bg-black/45 px-3 py-1 text-xs font-semibold tabular-nums text-white" aria-hidden="true">{String(active + 1).padStart(2, "0")} / {String(steps.length).padStart(2, "0")}</p>
    </div>
  );

  return (
    <section className={`relative py-20 sm:py-28 ${dark ? "text-white" : "text-[var(--color-text-primary)]"}`} style={{ background: params.backgroundColor ?? "var(--color-background)" }} aria-label={params.title ?? params.eyebrow ?? "Récit"}>
      <div className="mx-auto max-w-[var(--content-max-width,1320px)] px-5 sm:px-10">
        {(params.eyebrow || params.title || params.intro) && (
          <header className="mb-12 max-w-2xl sm:mb-16">
            {params.eyebrow && <p className={`text-[11px] font-semibold uppercase tracking-[0.3em] ${dark ? "text-white/70" : "text-[var(--color-accent-primary,var(--color-text-secondary))]"}`}>{params.eyebrow}</p>}
            {params.title && <h2 className="mt-3 font-[family-name:var(--font-heading)] text-[clamp(2rem,4.6vw,3.6rem)] leading-[1.03] tracking-[-0.02em]">{params.title}</h2>}
            {params.intro && <p className={`mt-5 text-[17px] leading-relaxed ${dark ? "text-white/75" : "text-[var(--color-text-secondary)]"}`}>{params.intro}</p>}
          </header>
        )}
        <div className={`grid gap-10 ${hasMedia ? "lg:grid-cols-[1.15fr_1fr] lg:gap-16" : ""}`}>
          {hasMedia && (
            <div className="hidden lg:block">
              <div className="sticky top-[12vh] h-[76vh] max-h-[760px]">{media}</div>
            </div>
          )}
          <ol className="relative">
            {timeline && (
              <span aria-hidden="true" className={`absolute bottom-0 left-[15px] top-0 w-px ${dark ? "bg-white/20" : "bg-[var(--color-border)]"}`}>
                <span className={`block w-px origin-top bg-[var(--color-accent-primary,var(--color-primary))] ${animate ? "transition-[height] duration-700" : ""}`} style={{ height: `${progress * 100}%` }} />
              </span>
            )}
            {steps.map((step, i) => {
              const on = i === active;
              return (
                <li
                  key={i}
                  ref={(el) => { stepsRef.current[i] = el; }}
                  data-step={i}
                  className={`relative flex flex-col justify-center py-8 lg:min-h-[62vh] ${timeline ? "pl-12" : ""}`}
                >
                  {timeline && (
                    <span aria-hidden="true" className={`absolute left-0 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full text-xs font-bold tabular-nums ring-1 transition-colors duration-500 max-lg:top-10 ${on ? "bg-[var(--color-primary)] text-white ring-[var(--color-primary)]" : dark ? "bg-transparent text-white/70 ring-white/30" : "bg-[var(--color-background)] text-[var(--color-text-secondary)] ring-[var(--color-border)]"}`}>{i + 1}</span>
                  )}
                  {/* Mobile : l'image de CETTE étape dans le flux (même cadrage). */}
                  {hasMedia && (
                    <div className="relative mb-6 aspect-[4/3] overflow-hidden rounded-[var(--radius-lg,18px)] bg-[var(--color-surface-muted,#eee)] lg:hidden">
                      <div className="h-full w-full" style={framing(step, false)}>
                        <ImmersiveImage src={imageFor(i)} alt={altFor(i)} style={crop(step, false)} />
                      </div>
                    </div>
                  )}
                  <div className={`max-w-md transition-opacity duration-500 ${on ? "opacity-100" : "lg:opacity-50"}`}>
                    {step.eyebrow && <p className={`text-[11px] font-semibold uppercase tracking-[0.26em] ${dark ? "text-white/65" : "text-[var(--color-text-muted)]"}`}>{step.eyebrow}</p>}
                    <h3 className="mt-2 font-[family-name:var(--font-heading)] text-[clamp(1.6rem,3vw,2.4rem)] leading-tight" style={{ overflowWrap: "anywhere" }}>{step.title}</h3>
                    {step.body && <p className={`mt-4 text-[16px] leading-relaxed ${dark ? "text-white/80" : "text-[var(--color-text-secondary)]"}`}>{step.body}</p>}
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
        {params.ctaLabel && params.ctaHref && (
          <div className="mt-8 flex justify-center lg:justify-end">
            <Link href={params.ctaHref} className={`inline-flex min-h-[52px] items-center gap-2 rounded-full px-7 text-[15px] font-semibold transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${dark ? "bg-white text-[var(--color-primary)]" : "bg-[var(--color-primary)] text-white focus-visible:ring-[var(--color-primary)]"}`}>{params.ctaLabel}</Link>
          </div>
        )}
      </div>
    </section>
  );
}
