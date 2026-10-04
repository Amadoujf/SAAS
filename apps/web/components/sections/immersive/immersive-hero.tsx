"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { motion, useScroll, useTransform, type MotionValue } from "framer-motion";
import type { z } from "zod";
import type { sectionParamSchemas } from "@yamacommerce/templates";
import { useFinePointer, useInView, useLowPower, useMotionAmplitude, usePageVisible } from "@/lib/motion/immersive";
import { ImmersiveImage } from "./immersive-image";

export type ImmersiveHeroParams = z.infer<typeof sectionParamSchemas.immersive_hero>;
type Layer = ImmersiveHeroParams["layers"][number];

/** Petits écrans : la scène est plus petite, ses mouvements aussi (rien ne sort du cadre). */
function useCompactFactor() {
  const [factor, setFactor] = useState(1);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 640px)");
    const update = () => setFactor(mq.matches ? 0.45 : 1);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return factor;
}

/** Texte clair sur fond sombre : choisi d'après la luminance de la couleur de fond. */
export function isDarkColor(color?: string) {
  const m = color?.trim().match(/^#([0-9a-f]{6})$/i);
  if (!m) return false;
  const n = parseInt(m[1]!, 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b! < 0.28;
}

const DIRECTION: Record<Layer["arriveFrom"], [number, number]> = { top: [0, -1], bottom: [0, 1], left: [-1, 0], right: [1, 0], none: [0, 0] };

/** Un élément détouré de la scène : position/échelle/rotation choisies dans l'éditeur,
 *  mouvement lié au défilement (assemblage, séparation, parallaxe, zoom). */
function SceneLayer({ layer, index, progress, effect, amp, floating, compact }: { layer: Layer; index: number; progress: MotionValue<number>; effect: ImmersiveHeroParams["scrollEffect"]; amp: number; floating: boolean; compact: number }) {
  const [dx, dy] = layer.arriveFrom === "none" ? [Math.sign(layer.offsetX) || 0, Math.sign(layer.offsetY) || -1] : DIRECTION[layer.arriveFrom];
  // Éclatement mesuré : les éléments restent dans la scène (jamais hors du cadre).
  const distance = (36 + layer.depth * 96) * amp * compact;
  const spread = useTransform(progress, (p) => {
    if (amp === 0) return 0;
    if (effect === "assemble") return Math.max(0, 1 - p / 0.32);
    if (effect === "separate") return Math.min(1, p / 0.5);
    return 0;
  });
  const x = useTransform(spread, (s) => dx * distance * s);
  const y = useTransform([spread, progress] as MotionValue<number>[], (values: number[]) => {
    const [s = 0, p = 0] = values;
    return dy * distance * s + (effect === "parallax" ? -layer.depth * 170 * amp * p : 0);
  });
  const scale = useTransform(progress, (p) => layer.scale * (effect === "zoom" ? 1 + 0.14 * amp * p : 1));
  return (
    <motion.div
      className="pointer-events-none absolute"
      style={{ left: `${50 + layer.offsetX}%`, top: `${50 + layer.offsetY}%`, width: "56%", x, y, scale, rotate: layer.rotate, translateX: "-50%", translateY: "-50%", zIndex: 10 + Math.round(layer.depth * 10) }}
    >
      <div className={floating ? "yc-drift" : ""} style={{ animationDuration: `${7 + index * 1.3}s`, animationDelay: `${-index * 0.9}s` } as CSSProperties}>
        {/* Proportions propres de l'élément (largeur réglée par l'échelle) : la scène a
            des dimensions fixes, aucun saut de mise en page au chargement. */}
        <ImmersiveImage src={layer.imageUrl} alt={layer.alt ?? ""} fit="contain" eager={index < 3} className="!h-auto drop-shadow-[0_28px_40px_rgba(10,16,34,0.22)]" />
      </div>
    </motion.div>
  );
}

function Lighting({ mode, dark }: { mode: ImmersiveHeroParams["lighting"]; dark: boolean }) {
  if (mode === "none") return null;
  const accent = "var(--color-accent-primary, var(--color-primary))";
  if (mode === "spotlight") {
    return (
      <span aria-hidden="true" className="pointer-events-none absolute inset-0" style={{ background: `radial-gradient(ellipse 42% 70% at var(--lx, 62%) -8%, ${dark ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.85)"}, transparent 70%)` }} />
    );
  }
  if (mode === "ambient") {
    return (
      <span aria-hidden="true" className="pointer-events-none absolute inset-0" style={{ background: `radial-gradient(40% 50% at 18% 20%, color-mix(in srgb, var(--color-primary) 12%, transparent), transparent 70%), radial-gradient(45% 55% at 85% 80%, color-mix(in srgb, ${accent} 18%, transparent), transparent 70%)` }} />
    );
  }
  // Halo : une LUMIÈRE chaude, à peine teintée par la couleur de la marque (une couleur
  // de marque vive, rouge par exemple, ne doit jamais « rosir » le produit).
  const warm = `color-mix(in srgb, #FFD9A6 82%, ${accent})`;
  return (
    <span aria-hidden="true" className="pointer-events-none absolute inset-0 transition-[background-position] duration-700" style={{ background: `radial-gradient(34% 46% at var(--lx, 66%) var(--ly, 48%), color-mix(in srgb, ${warm} ${dark ? 42 : 55}%, transparent), transparent 72%)` }} />
  );
}

function Actions({ params, dark, className = "" }: { params: ImmersiveHeroParams; dark: boolean; className?: string }) {
  const primary = params.primaryCtaLabel && params.primaryCtaHref;
  const secondary = params.secondaryCtaLabel && params.secondaryCtaHref;
  if (!primary && !secondary) return null;
  return (
    <div className={`flex flex-col gap-3 sm:flex-row sm:flex-wrap ${className}`}>
      {primary && (
        <Link href={params.primaryCtaHref!} className={`inline-flex min-h-[52px] items-center justify-center gap-3 rounded-[var(--radius-full,999px)] px-7 text-[15px] font-semibold transition-transform duration-300 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${dark ? "bg-white text-[var(--color-primary)] focus-visible:ring-white" : "bg-[var(--color-primary)] text-white focus-visible:ring-[var(--color-primary)]"}`}>
          {params.primaryCtaLabel}
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" /></svg>
        </Link>
      )}
      {secondary && (
        <Link href={params.secondaryCtaHref!} className={`inline-flex min-h-[52px] items-center justify-center rounded-[var(--radius-full,999px)] px-7 text-[15px] font-semibold ring-1 ring-inset transition-colors focus-visible:outline-none focus-visible:ring-2 ${dark ? "text-white ring-white/40 hover:bg-white/10" : "text-[var(--color-text-primary)] ring-[var(--color-border)] hover:bg-[var(--color-surface)]"}`}>
          {params.secondaryCtaLabel}
        </Link>
      )}
    </div>
  );
}

function Headline({ params, dark, center = false }: { params: ImmersiveHeroParams; dark: boolean; center?: boolean }) {
  return (
    <>
      {params.eyebrow && (
        <p className={`yc-rise flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.32em] ${center ? "justify-center" : ""} ${dark ? "text-white/75" : "text-[var(--color-text-secondary)]"}`}>
          <span className="h-px w-8 bg-current opacity-60" aria-hidden="true" />
          {params.eyebrow}
        </p>
      )}
      <h1 className="yc-rise mt-5 font-[family-name:var(--font-heading)] text-[clamp(2.6rem,7.4vw,6.4rem)] leading-[0.95] tracking-[-0.03em] [animation-delay:80ms]" style={{ overflowWrap: "anywhere" }}>
        {params.title}
        {params.titleAccent && <em className={`block font-normal italic ${dark ? "text-white/80" : "text-[var(--color-accent-primary,var(--color-primary))]"}`}>{params.titleAccent}</em>}
      </h1>
      {params.subtitle && <p className={`yc-rise mt-6 max-w-xl text-[16px] leading-relaxed sm:text-[18px] [animation-delay:160ms] ${center ? "mx-auto" : ""} ${dark ? "text-white/80" : "text-[var(--color-text-secondary)]"}`}>{params.subtitle}</p>}
    </>
  );
}

/**
 * Hero immersif — voir @yamacommerce/templates `immersive_hero`. Le texte et les
 * boutons sont TOUJOURS rendus et lisibles (animation d'arrivée purement CSS, annulée
 * par `prefers-reduced-motion`) ; seule la scène visuelle bouge. Aucun blocage du
 * défilement : les mouvements suivent simplement la position de la section.
 */
export function ImmersiveHeroSection({ variant, params }: { variant: string; params: ImmersiveHeroParams }) {
  const ref = useRef<HTMLElement>(null);
  const amp = useMotionAmplitude(params.intensity);
  const inView = useInView(ref);
  const visible = usePageVisible();
  const low = useLowPower();
  const fine = useFinePointer();
  const compact = useCompactFactor();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const active = amp > 0 && inView && visible;
  const floating = params.floating && active && !low;
  const dark = variant === "architectural" || isDarkColor(params.backgroundColor);

  // Lumière qui accompagne le sujet : suit le pointeur (souris uniquement), sinon fixe.
  useEffect(() => {
    const el = ref.current;
    if (!el || !fine || low || amp === 0 || !inView) return;
    let frame = 0;
    const onMove = (e: PointerEvent) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const r = el.getBoundingClientRect();
        el.style.setProperty("--lx", `${Math.round(((e.clientX - r.left) / r.width) * 100)}%`);
        el.style.setProperty("--ly", `${Math.round(((e.clientY - r.top) / r.height) * 100)}%`);
      });
    };
    el.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      el.removeEventListener("pointermove", onMove);
    };
  }, [fine, low, amp, inView]);

  const subjectY = useTransform(scrollYProgress, (p) => (params.scrollEffect === "none" ? 0 : -70 * amp * p));
  const subjectScale = useTransform(scrollYProgress, (p) => 1 + (params.scrollEffect === "zoom" ? 0.16 : 0.05) * amp * p);
  const textY = useTransform(scrollYProgress, (p) => 50 * amp * p);
  const imageScale = useTransform(scrollYProgress, (p) => 1.02 + 0.12 * amp * p);

  const background: CSSProperties = { background: params.backgroundColor ?? (variant === "architectural" ? "var(--color-primary)" : "var(--color-surface)") };
  const paused = { animationPlayState: active ? "running" : "paused" } as CSSProperties;

  if (variant === "architectural") {
    const image = params.subjectImage ?? params.backgroundImage;
    return (
      <section ref={ref} className="relative isolate overflow-hidden text-white" style={background} aria-label={params.eyebrow ?? params.title}>
        <div className="relative h-[calc(100svh-72px)] max-h-[900px] min-h-[560px]">
          <motion.div className="yc-reveal-frame absolute inset-0" style={{ scale: imageScale, ...paused }}>
            <picture className="block h-full w-full">
              {params.mobileImage && <source media="(max-width: 640px)" srcSet={params.mobileImage} />}
              <ImmersiveImage src={image} alt={params.subjectAlt ?? ""} eager style={{ objectPosition: `${params.focalX}% ${params.focalY}%` }} />
            </picture>
          </motion.div>
          <span aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(90deg,rgba(6,12,28,0.78),rgba(6,12,28,0.25)_60%,rgba(6,12,28,0.05)),linear-gradient(0deg,rgba(6,12,28,0.55),transparent_45%)]" />
          <Lighting mode={params.lighting} dark />
          <motion.div className="relative z-10 mx-auto flex h-full max-w-[var(--content-max-width,1320px)] flex-col justify-end px-5 pb-14 sm:px-10 sm:pb-20" style={{ y: textY }}>
            <div className="max-w-3xl"><Headline params={params} dark /></div>
            <Actions params={params} dark className="yc-rise mt-9 [animation-delay:240ms]" />
          </motion.div>
        </div>
      </section>
    );
  }

  const stage = (
    <div className="relative mx-auto aspect-square w-full max-w-[640px] max-sm:overflow-hidden" style={{ perspective: "1200px" }}>
      <span aria-hidden="true" className="absolute inset-[14%] rounded-full bg-[radial-gradient(circle,color-mix(in_srgb,#FFE2B8_70%,transparent),transparent_68%)] blur-2xl" />
      {params.subjectImage && params.subjectStyle === "framed" && (
        <motion.div className="absolute inset-x-[12%] inset-y-[4%] z-10" style={{ y: subjectY, scale: subjectScale }}>
          <div className={floating ? "yc-drift h-full" : "h-full"} style={{ animationDuration: "10s", ...paused }}>
            <div className="relative h-full overflow-hidden rounded-[calc(var(--radius-lg,16px)*1.5)] shadow-[0_50px_90px_-40px_rgba(10,16,34,0.55)] ring-1 ring-black/5">
              <ImmersiveImage src={params.subjectImage} alt={params.subjectAlt ?? ""} eager style={{ objectPosition: `${params.focalX}% ${params.focalY}%` }} />
              {/* Reflet qui suit la lumière (pointeur) : la photo « prend » l'éclairage. */}
              <span aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_var(--lx,70%)_var(--ly,20%),rgba(255,255,255,0.28),transparent_70%)] mix-blend-soft-light" />
            </div>
          </div>
        </motion.div>
      )}
      {params.subjectImage && params.subjectStyle !== "framed" && (
        <motion.div className="absolute inset-[6%] z-10" style={{ y: subjectY, scale: subjectScale }}>
          <div className={floating ? "yc-drift h-full" : "h-full"} style={{ animationDuration: "9s", ...paused }}>
            <ImmersiveImage src={params.subjectImage} alt={params.subjectAlt ?? ""} eager fit="contain" className="drop-shadow-[0_40px_60px_rgba(10,16,34,0.30)]" style={{ objectPosition: `${params.focalX}% ${params.focalY}%` }} />
          </div>
        </motion.div>
      )}
      {params.layers.map((layer, i) => (
        <SceneLayer key={`${layer.imageUrl}-${i}`} layer={layer} index={i} progress={scrollYProgress} effect={params.scrollEffect} amp={amp} floating={floating} compact={compact} />
      ))}
      {!params.subjectImage && params.layers.length === 0 && <span className="absolute inset-[18%] rounded-full bg-[color-mix(in_srgb,var(--color-primary)_8%,transparent)]" aria-hidden="true" />}
    </div>
  );
  // Image de remplacement mobile : une photo légère à la place de la scène composée.
  const responsiveStage = params.mobileImage ? (
    <>
      <div className="hidden sm:block">{stage}</div>
      <div className="relative mx-auto aspect-[4/5] w-full max-w-[420px] overflow-hidden rounded-[var(--radius-lg,16px)] sm:hidden">
        <ImmersiveImage src={params.mobileImage} alt={params.subjectAlt ?? ""} />
      </div>
    </>
  ) : (
    stage
  );

  if (variant === "centered") {
    return (
      <section ref={ref} className={`relative isolate overflow-hidden ${dark ? "text-white" : "text-[var(--color-text-primary)]"}`} style={background} aria-label={params.eyebrow ?? params.title}>
        <Lighting mode={params.lighting} dark={dark} />
        <motion.div className="relative z-10 mx-auto max-w-4xl px-5 pt-16 text-center sm:px-8 sm:pt-24" style={{ y: textY }}>
          <Headline params={params} dark={dark} center />
          <Actions params={params} dark={dark} className="yc-rise mt-9 justify-center sm:justify-center [animation-delay:240ms]" />
        </motion.div>
        <div className="relative z-0 mx-auto -mt-4 max-w-[760px] px-5 pb-12 sm:px-8">
          {responsiveStage}
        </div>
      </section>
    );
  }

  return (
    <section ref={ref} className={`relative isolate overflow-hidden ${dark ? "text-white" : "text-[var(--color-text-primary)]"}`} style={background} aria-label={params.eyebrow ?? params.title}>
      {params.backgroundImage && (
        <div className="absolute inset-0 -z-10 opacity-40"><ImmersiveImage src={params.backgroundImage} alt="" /></div>
      )}
      <Lighting mode={params.lighting} dark={dark} />
      <div className="relative z-10 mx-auto grid max-w-[var(--content-max-width,1320px)] items-center gap-6 px-5 pb-12 pt-8 sm:px-10 lg:min-h-[min(calc(100svh-72px),880px)] lg:grid-cols-[1fr_1.05fr] lg:gap-10 lg:py-16">
        <div className="order-2 lg:order-1">
          <motion.div style={{ y: textY }}>
            <Headline params={params} dark={dark} />
            <Actions params={params} dark={dark} className="yc-rise mt-9 [animation-delay:240ms]" />
          </motion.div>
        </div>
        <div className="order-1 lg:order-2">{responsiveStage}</div>
      </div>
    </section>
  );
}
