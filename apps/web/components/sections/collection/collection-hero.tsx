"use client";

import Link from "next/link";
import { Fragment, type CSSProperties } from "react";
import type { z } from "zod";
import type { sectionParamSchemas } from "@yamacommerce/templates";
import { useAnimationLevel } from "@/lib/motion/animation-level-context";

export type CollectionHeroParams = z.infer<typeof sectionParamSchemas.collection_hero>;

/** Mots du titre, chacun levé depuis un masque (révélation ligne à ligne au chargement). */
export function RisingWords({ text, delay = 0.1, step = 0.07 }: { text: string; delay?: number; step?: number }) {
  return (
    <>
      {text.split(/\s+/).map((word, i) => (
        <Fragment key={`${word}-${i}`}>
          <span className="inline-block overflow-hidden pb-[0.08em] align-bottom">
            <span className="ycc-word" style={{ animationDelay: `${delay + i * step}s` } as CSSProperties}>{word}</span>
          </span>{" "}
        </Fragment>
      ))}
    </>
  );
}

/**
 * Ouverture de collection — trois compositions vraiment différentes :
 * - « cover » (éditorial) : grande photographie à droite qui respire lentement, titre en
 *   didone sur la gauche, vignette décalée qui chevauche la photo ;
 * - « plinth » (sculptural) : la pièce dans une arche, posée sur un socle de pierre,
 *   flotte doucement ; très grand titre grotesque qui glisse au défilement ;
 * - « wordmark » (studio) : nom de la marque en lettres géantes sur aplat de couleur,
 *   traversé par la photo ; lettres levées une à une.
 * Lisibilité : texte jamais posé directement sur une photo sans aplat, tailles bornées.
 */
export function CollectionHeroSection({ variant, params }: { variant: string; params: CollectionHeroParams }) {
  const level = useAnimationLevel();
  const motion = level === "none" ? "off" : "on";
  if (variant === "plinth") return <PlinthHero params={params} motion={motion} />;
  if (variant === "wordmark") return <WordmarkHero params={params} motion={motion} />;
  return <CoverHero params={params} motion={motion} />;
}

function Actions({ params, tone }: { params: CollectionHeroParams; tone: "ink" | "light" | "pill" }) {
  if (!params.ctaLabel && !params.secondaryCtaLabel) return null;
  const primary =
    tone === "ink"
      ? "inline-flex h-12 items-center gap-3 bg-[var(--color-text-primary)] px-7 text-[13px] font-medium uppercase tracking-[0.16em] text-[var(--color-background)] transition-opacity hover:opacity-85"
      : tone === "pill"
        ? "inline-flex h-12 items-center gap-2 rounded-full bg-white px-7 text-[14px] font-bold uppercase tracking-[0.06em] text-[var(--color-primary)] transition-transform hover:-translate-y-0.5"
        : "inline-flex h-12 items-center gap-3 rounded-[var(--radius-md,8px)] bg-[var(--color-text-primary)] px-6 text-[14px] font-medium text-[var(--color-background)] transition-transform hover:-translate-y-0.5";
  const secondary =
    tone === "pill"
      ? "text-[14px] font-bold uppercase tracking-[0.06em] text-white underline-offset-8 hover:underline"
      : "border-b border-current pb-1 text-[13px] font-medium tracking-[0.04em] transition-opacity hover:opacity-60";
  return (
    <div className="mt-9 flex flex-wrap items-center gap-x-8 gap-y-4">
      {params.ctaLabel && params.ctaHref && (
        <Link href={params.ctaHref} className={primary}>
          {params.ctaLabel} <span aria-hidden="true">→</span>
        </Link>
      )}
      {params.secondaryCtaLabel && params.secondaryCtaHref && (
        <Link href={params.secondaryCtaHref} className={secondary}>{params.secondaryCtaLabel}</Link>
      )}
    </div>
  );
}

function CoverHero({ params, motion }: { params: CollectionHeroParams; motion: "on" | "off" }) {
  return (
    <section data-motion={motion} className="relative overflow-hidden">
      <div className="mx-auto grid max-w-[1440px] grid-cols-1 lg:min-h-[min(88vh,860px)] lg:grid-cols-12">
        <div className="relative order-2 flex flex-col justify-center px-5 pb-14 pt-10 sm:px-10 lg:order-1 lg:col-span-5 lg:py-20 lg:pl-14 lg:pr-10">
          {params.eyebrow && <p className="ycc-fade text-[11px] uppercase tracking-[0.34em] text-[var(--color-text-muted)]">{params.eyebrow}</p>}
          <h1 className="mt-6 font-[family-name:var(--font-heading)] text-[clamp(2.8rem,4.9vw,5.4rem)] leading-[0.96] tracking-[-0.02em] text-[var(--color-text-primary)]">
            <RisingWords text={params.title} />
          </h1>
          {params.subtitle && <p className="ycc-fade mt-7 max-w-md text-[16px] leading-relaxed text-[var(--color-text-secondary)]" style={{ animationDelay: "0.5s" }}>{params.subtitle}</p>}
          <div className="ycc-fade" style={{ animationDelay: "0.7s" }}><Actions params={params} tone="ink" /></div>
        </div>
        <div className="relative order-1 lg:order-2 lg:col-span-7">
          <div className="relative h-[60vh] max-h-[560px] overflow-hidden sm:max-h-none lg:absolute lg:inset-0 lg:h-auto">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={params.media.url} alt={params.media.alt ?? ""} className="ycc-kenburns h-full w-full object-cover" loading="eager" />
          </div>
          {params.secondaryMedia && (
            <figure className="ycc-reveal absolute bottom-10 right-10 hidden w-[min(14vw,210px)] bg-[var(--color-background)] p-2.5 shadow-[0_30px_60px_-30px_rgba(0,0,0,0.45)] lg:block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={params.secondaryMedia.url} alt={params.secondaryMedia.alt ?? ""} className="aspect-[3/4] w-full object-cover" loading="lazy" />
            </figure>
          )}
        </div>
      </div>
    </section>
  );
}

function PlinthHero({ params, motion }: { params: CollectionHeroParams; motion: "on" | "off" }) {
  return (
    <section data-motion={motion} className="relative overflow-hidden bg-[var(--color-surface)]">
      {/* Titre géant derrière la pièce : il glisse lentement au défilement. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-[8%] hidden select-none overflow-hidden lg:block">
        <p className="ycc-drift whitespace-nowrap text-center font-[family-name:var(--font-heading)] text-[clamp(5rem,17vw,16rem)] font-semibold leading-none tracking-[-0.06em] text-[color-mix(in_srgb,var(--color-text-primary)_7%,transparent)]">
          {params.wordmark ?? params.title.split(/[,.]/)[0]}
        </p>
      </div>
      <div className="relative mx-auto grid max-w-[1320px] items-end gap-10 px-5 pb-16 pt-12 sm:px-10 lg:grid-cols-[1fr_minmax(0,460px)_1fr] lg:gap-14 lg:pb-20 lg:pt-20">
        <div className="lg:pb-10">
          {params.eyebrow && <p className="ycc-fade text-[12px] font-medium uppercase tracking-[0.22em] text-[var(--color-text-muted)]">{params.eyebrow}</p>}
          <h1 className="mt-5 font-[family-name:var(--font-heading)] text-[clamp(2.4rem,3.7vw,3.9rem)] font-semibold leading-[0.98] tracking-[-0.045em] text-[var(--color-text-primary)]">
            <RisingWords text={params.title} step={0.09} />
          </h1>
        </div>
        {/* La pièce : arche + socle de pierre ; la pièce flotte, son ombre respire. */}
        <div className="relative mx-auto w-full max-w-[460px]">
          <div className="ycc-float relative z-10">
            <div className="overflow-hidden rounded-t-[999px] bg-[var(--color-surface-muted)] shadow-[0_40px_80px_-40px_rgba(15,23,42,0.55)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={params.media.url} alt={params.media.alt ?? ""} className="aspect-[4/5] w-full object-cover" loading="eager" />
            </div>
          </div>
          <div aria-hidden="true" className="ycc-shadow mx-auto mt-5 h-5 w-[70%] rounded-[50%] bg-black/35 blur-md" />
        </div>
        <div className="lg:pb-10">
          {params.subtitle && <p className="ycc-fade max-w-sm text-[16px] leading-relaxed text-[var(--color-text-secondary)]" style={{ animationDelay: "0.4s" }}>{params.subtitle}</p>}
          <div className="ycc-fade" style={{ animationDelay: "0.6s" }}><Actions params={params} tone="light" /></div>
        </div>
      </div>
    </section>
  );
}

function WordmarkHero({ params, motion }: { params: CollectionHeroParams; motion: "on" | "off" }) {
  const word = (params.wordmark ?? params.title).toUpperCase();
  // Plus le nom est long, plus les lettres sont petites : il tient toujours sur une ligne.
  const size = `clamp(2.4rem, ${Math.round(135 / Math.max(5, word.length))}vw, 24rem)`;
  return (
    <section data-motion={motion} className="relative overflow-hidden bg-[var(--color-primary)] text-white">
      <div className="mx-auto max-w-[1440px] px-4 pt-8 sm:px-8 lg:pt-10">
        <h1 className="sr-only">{params.title}</h1>
        <p aria-hidden="true" className="relative z-0 select-none whitespace-nowrap text-center font-[family-name:var(--font-heading)] font-semibold leading-[0.8] tracking-[-0.05em]" style={{ fontSize: size }}>
          {[...word].map((letter, i) => (
            <span key={i} className="inline-block overflow-hidden align-bottom">
              <span className="ycc-word" style={{ animationDelay: `${0.05 + i * 0.08}s` }}>{letter === " " ? " " : letter}</span>
            </span>
          ))}
        </p>
        <div className="relative z-10 mt-6 md:-mt-[min(3vw,2.2rem)] grid items-end gap-8 pb-12 md:grid-cols-[1fr_minmax(0,380px)_1fr] lg:pb-16">
          <div className="order-2 md:order-1">
            {params.eyebrow && <p className="ycc-fade text-[12px] font-bold uppercase tracking-[0.2em] text-white/70">{params.eyebrow}</p>}
            <p className="ycc-fade mt-3 max-w-xs font-[family-name:var(--font-heading)] text-[clamp(1.6rem,2.6vw,2.4rem)] font-semibold leading-[1.02] tracking-[-0.02em]" style={{ animationDelay: "0.3s" }}>{params.title}</p>
          </div>
          <div className="ycc-wipe order-1 mx-auto w-[min(78vw,380px)] md:order-2" style={{ animationDelay: "0.25s" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={params.media.url} alt={params.media.alt ?? ""} className="aspect-[3/4] w-full object-cover shadow-[0_40px_80px_-30px_rgba(0,0,0,0.6)]" loading="eager" />
          </div>
          <div className="order-3 md:pl-6">
            {params.subtitle && <p className="ycc-fade max-w-xs text-[15px] leading-relaxed text-white/85" style={{ animationDelay: "0.5s" }}>{params.subtitle}</p>}
            <div className="ycc-fade" style={{ animationDelay: "0.65s" }}><Actions params={params} tone="pill" /></div>
          </div>
        </div>
      </div>
    </section>
  );
}
