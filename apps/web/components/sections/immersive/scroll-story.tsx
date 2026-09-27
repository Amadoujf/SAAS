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
/** Étape active = celle qui traverse le milieu de l'écran (IntersectionObserver). */
function useActiveStep(count: number) {
  const [active, setActive] = useState(0);
  const stepsRef = useRef<(HTMLLIElement | null)[]>([]);
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
  }, [count]);
  return { active, stepsRef };
}

export function ScrollStorySection({ variant, params }: { variant: string; params: ScrollStoryParams }) {
  if (variant === "product") return <ProductStory params={params} />;
  return <MediaStory variant={variant} params={params} />;
}

function MediaStory({ variant, params }: { variant: string; params: ScrollStoryParams }) {
  const steps = params.steps;
  const { active, stepsRef } = useActiveStep(steps.length);
  const amp = useMotionAmplitude("balanced");
  const animate = amp > 0;
  const dark = isDarkColor(params.backgroundColor);

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

/**
 * Variante « product » : UN objet détouré mis en scène (bouteille, flacon, chaussure,
 * appareil…) qui pivote et change d'échelle d'étape en étape, sur une ambiance dont la
 * couleur suit l'étape. Ordinateur : scène « collante » à droite, textes qui défilent à
 * gauche, points de progression cliquables (défilement natif vers l'étape, jamais
 * bloqué). Mobile : un panneau coloré par étape, objet et texte dans le flux.
 */
function ProductStory({ params }: { params: ScrollStoryParams }) {
  const steps = params.steps;
  const { active, stepsRef } = useActiveStep(steps.length);
  const amp = useMotionAmplitude("balanced");
  const animate = amp > 0;
  const colorOf = (i: number) => steps[i]?.accentColor ?? params.backgroundColor ?? "var(--color-primary)";
  const ambiance = (color: string) => `color-mix(in srgb, ${color} 58%, #06080c)`;
  const imageOf = (i: number) => steps[i]?.imageUrl ?? params.image;
  const altOf = (i: number) => steps[i]?.imageAlt ?? params.imageAlt ?? "";
  const cur = steps[active] ?? steps[0]!;
  const visuals = [...new Set(steps.map((_, i) => imageOf(i)))];
  const photo = params.objectStyle === "photo";
  // Une photographie (rectangle) garde une inclinaison et un agrandissement discrets :
  // tournée comme un objet détouré, elle sortirait du cadre et paraîtrait bancale.
  const poseOf = (st: Step) => (photo ? { r: st.rotate * 0.25, s: 1 + (st.objectScale - 1) * 0.4 } : { r: st.rotate, s: st.objectScale });
  const pose = (st: Step): CSSProperties => ({
    transform: `rotate(${poseOf(st).r}deg) scale(${poseOf(st).s})`,
    transition: animate ? "transform 1.1s cubic-bezier(0.22, 1, 0.36, 1)" : "none",
  });
  const goTo = (i: number) => stepsRef.current[i]?.scrollIntoView({ behavior: animate ? "smooth" : "auto", block: "center" });
  const glow = "bg-[radial-gradient(50%_45%_at_68%_52%,rgba(255,255,255,0.20),transparent_70%)]";

  return (
    <section className="relative isolate text-white" aria-label={params.title ?? params.eyebrow ?? "Récit"}>
      <span aria-hidden="true" className={`absolute inset-0 -z-10 hidden lg:block ${animate ? "transition-[background-color] duration-1000" : ""}`} style={{ backgroundColor: ambiance(colorOf(active)) }}>
        <span className={`absolute inset-0 ${glow}`} />
      </span>
      <div className="bg-[#0b0d12] lg:bg-transparent">
        {(params.eyebrow || params.title || params.intro) && (
          <header className="mx-auto max-w-[var(--content-max-width,1320px)] px-5 pb-4 pt-20 sm:px-10 lg:pb-0 lg:pt-28">
            <div className="max-w-2xl">
              {params.eyebrow && <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-white/70">{params.eyebrow}</p>}
              {params.title && <h2 className="mt-3 font-[family-name:var(--font-heading)] text-[clamp(2rem,4.6vw,3.6rem)] leading-[1.03] tracking-[-0.02em]">{params.title}</h2>}
              {params.intro && <p className="mt-5 text-[17px] leading-relaxed text-white/75">{params.intro}</p>}
            </div>
          </header>
        )}
        <div className="relative mx-auto max-w-[var(--content-max-width,1320px)] sm:px-10">
          {/* Scène collante (ordinateur) : l'objet et la progression. */}
          <div className="sticky top-0 hidden h-screen lg:block">
            <div className="absolute inset-y-[10vh] left-[48%] right-[8%]">
              {/* Un calque par visuel distinct : des étapes qui partagent le même objet ne le
                  dupliquent pas — il pivote simplement ; un nouvel objet arrive en fondu. */}
              {visuals.map((src) => {
                const shown = src === imageOf(active);
                return (
                  <div key={src ?? "vide"} aria-hidden={!shown} className={`absolute inset-0 ${photo ? "grid place-items-center" : ""} ${animate ? "transition-opacity duration-700" : ""} ${shown ? "opacity-100" : "opacity-0"}`}>
                    {photo ? (
                      <div className="relative aspect-[4/5] h-[88%] max-w-full overflow-hidden rounded-[var(--radius-lg,18px)] shadow-[0_50px_90px_-30px_rgba(0,0,0,0.65)] ring-1 ring-white/10" style={pose(cur)}>
                        <ImmersiveImage src={src} alt={shown ? altOf(active) : ""} />
                      </div>
                    ) : (
                      <div className="h-full w-full" style={pose(cur)}>
                        <ImmersiveImage src={src} alt={shown ? altOf(active) : ""} fit="contain" className="drop-shadow-[0_40px_40px_rgba(0,0,0,0.45)]" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {steps.length > 1 && (
              <nav aria-label="Étapes" className="absolute right-0 top-1/2 flex -translate-y-1/2 flex-col gap-1">
                {steps.map((st, i) => (
                  <button key={i} type="button" onClick={() => goTo(i)} aria-label={`Étape ${i + 1} : ${st.title}`} aria-current={i === active ? "step" : undefined} className="grid h-9 w-9 place-items-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
                    <span className={`block rounded-full ring-1 ring-white/70 transition-all duration-300 ${i === active ? "h-3.5 w-3.5 bg-white" : "h-2 w-2 bg-transparent"}`} />
                  </button>
                ))}
              </nav>
            )}
          </div>
          <ol className="relative lg:-mt-[100vh] lg:w-[44%]">
            {steps.map((st, i) => (
              <li
                key={i}
                ref={(el) => { stepsRef.current[i] = el; }}
                data-step={i}
                className="relative flex flex-col justify-center px-5 py-12 sm:px-0 lg:min-h-screen lg:py-0"
              >
                {/* Mobile : un panneau coloré par étape, l'objet dans sa pose. */}
                <div className="relative mb-7 aspect-[4/5] max-h-[62vh] w-full overflow-hidden rounded-[var(--radius-lg,18px)] lg:hidden" style={{ backgroundColor: ambiance(colorOf(i)) }}>
                  <span aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_50%,rgba(255,255,255,0.22),transparent_72%)]" />
                  {photo ? (
                    <div className="absolute inset-0">
                      <ImmersiveImage src={imageOf(i)} alt={altOf(i)} />
                    </div>
                  ) : (
                    <div className="absolute inset-[8%]" style={{ transform: `rotate(${st.rotate}deg) scale(${st.objectScale})` }}>
                      <ImmersiveImage src={imageOf(i)} alt={altOf(i)} fit="contain" className="drop-shadow-[0_30px_30px_rgba(0,0,0,0.45)]" />
                    </div>
                  )}
                </div>
                <div className={`max-w-md ${animate ? "transition-opacity duration-500" : ""} ${i === active ? "opacity-100" : "lg:opacity-40"}`}>
                  <p className="text-[12px] font-semibold tabular-nums tracking-[0.2em] text-white/60">{String(i + 1).padStart(2, "0")} / {String(steps.length).padStart(2, "0")}</p>
                  {st.eyebrow && <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.26em] text-white/70">{st.eyebrow}</p>}
                  <h3 className="mt-2 font-[family-name:var(--font-heading)] text-[clamp(1.8rem,3.4vw,2.8rem)] font-semibold uppercase leading-[1.02] tracking-[-0.01em]" style={{ overflowWrap: "anywhere" }}>{st.title}</h3>
                  {st.body && <p className="mt-4 text-[16px] leading-relaxed text-white/80">{st.body}</p>}
                </div>
              </li>
            ))}
          </ol>
        </div>
        {params.ctaLabel && params.ctaHref && (
          <div className="flex justify-center px-5 pb-20 pt-4 lg:pb-28">
            <Link href={params.ctaHref} className="inline-flex min-h-[52px] items-center gap-2 rounded-full bg-white px-7 text-[15px] font-semibold text-[#0b0d12] transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black">{params.ctaLabel}</Link>
          </div>
        )}
      </div>
    </section>
  );
}
