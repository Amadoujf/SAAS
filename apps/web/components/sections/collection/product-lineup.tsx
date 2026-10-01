"use client";

import Link from "next/link";
import type { z } from "zod";
import type { sectionParamSchemas } from "@yamacommerce/templates";
import type { ResolvedProductsContent } from "../content-types";
import { useAnimationLevel } from "@/lib/motion/animation-level-context";

export type ProductLineupParams = z.infer<typeof sectionParamSchemas.product_lineup>;

const fmt = (n: number) => `${new Intl.NumberFormat("fr-SN").format(n)} FCFA`;

/**
 * Présentation des pièces — produits RÉELS (prix, photos, disponibilité lus au rendu) :
 * - « editorial » : grands portraits, colonne centrale décalée, noms en titre ;
 * - « plinth » : chaque pièce isolée sur un socle clair, qui se soulève au survol ;
 * - « index » : grille dense numérotée ; au survol, seconde photo et aplat de couleur.
 */
export function ProductLineupSection({ variant, params, content }: { variant: string; params: ProductLineupParams; content: ResolvedProductsContent }) {
  const level = useAnimationLevel();
  const products = content.products.filter((p) => p.imageUrl).slice(0, params.displayCount);
  if (products.length < 2) return null;
  const title = params.title ?? content.title;
  const header = (tone: "serif" | "sans" | "bold") => (
    <div className={`mb-10 flex flex-wrap items-end justify-between gap-4 lg:mb-14 ${tone === "bold" ? "border-b-2 border-[var(--color-text-primary)] pb-5" : ""}`}>
      <div>
        {params.eyebrow && <p className={`text-[11px] uppercase ${tone === "bold" ? "font-bold tracking-[0.2em] text-[var(--color-primary)]" : "tracking-[0.3em] text-[var(--color-text-muted)]"}`}>{params.eyebrow}</p>}
        {title && (
          <h2
            className={
              tone === "serif"
                ? "mt-3 font-[family-name:var(--font-heading)] text-[clamp(2.1rem,3.6vw,3.4rem)] leading-none tracking-[-0.01em]"
                : tone === "sans"
                  ? "mt-3 font-[family-name:var(--font-heading)] text-[clamp(2rem,3.4vw,3.2rem)] font-semibold leading-none tracking-[-0.04em]"
                  : "mt-2 font-[family-name:var(--font-heading)] text-[clamp(2.2rem,4.4vw,4.2rem)] font-semibold uppercase leading-[0.9] tracking-[-0.04em]"
            }
          >
            {title}
          </h2>
        )}
      </div>
      {params.linkLabel && params.linkHref && (
        <Link
          href={params.linkHref}
          className={tone === "bold" ? "rounded-full bg-[var(--color-text-primary)] px-5 py-2.5 text-[12px] font-bold uppercase tracking-[0.12em] text-[var(--color-background)] transition-opacity hover:opacity-80" : "border-b border-current pb-1 text-[13px] tracking-[0.04em] transition-opacity hover:opacity-60"}
        >
          {params.linkLabel} <span aria-hidden="true">→</span>
        </Link>
      )}
    </div>
  );

  if (variant === "plinth") {
    return (
      <section data-motion={level === "none" ? "off" : "on"} className="mx-auto max-w-[1320px] px-5 py-20 sm:px-10 lg:py-28">
        {header("sans")}
        <ul className="grid grid-cols-2 gap-x-4 gap-y-12 sm:gap-x-8 lg:grid-cols-3 lg:gap-x-12 lg:gap-y-16">
          {products.map((p, i) => (
            <li key={p.id} className="ycc-reveal" style={{ animationDelay: `${i * 0.05}s` }}>
              <Link href={p.href ?? "#"} className="group block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-4">
                <span className="block bg-[var(--color-surface-muted)] p-[9%] transition-[transform,box-shadow] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:-translate-y-2 group-hover:shadow-[0_40px_70px_-40px_rgba(15,23,42,0.5)]">
                  <span className="block overflow-hidden rounded-t-[999px]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.imageUrl} alt={p.name} loading="lazy" className="aspect-[4/5] w-full object-cover transition-transform duration-700 group-hover:scale-[1.04]" />
                  </span>
                </span>
                <span className="mt-4 flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
                  <span className="text-[14px] font-medium leading-snug tracking-[-0.01em] sm:text-[15px]">{p.name}</span>
                  <span className="shrink-0 text-[13px] tabular-nums text-[var(--color-text-secondary)] sm:text-[14px]">{fmt(p.price)}</span>
                </span>
                {p.inStock === false && <span className="mt-1 block text-[12px] text-[var(--color-text-muted)]">Épuisé</span>}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    );
  }

  if (variant === "index") {
    return (
      <section data-motion={level === "none" ? "off" : "on"} className="mx-auto max-w-[1440px] px-4 py-20 sm:px-8 lg:py-24">
        {header("bold")}
        <ul className="grid grid-cols-2 border-l border-t border-[var(--color-text-primary)] lg:grid-cols-4">
          {products.map((p, i) => (
            <li key={p.id} className="border-b border-r border-[var(--color-text-primary)]">
              <Link href={p.href ?? "#"} className="group relative block overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-primary)]">
                <span className="relative block aspect-[4/5] overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.imageUrl} alt={p.name} loading="lazy" className="h-full w-full object-cover transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.06]" />
                  {p.hoverImageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.hoverImageUrl} alt="" aria-hidden="true" loading="lazy" className="absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                  )}
                  <span className="absolute left-3 top-2 font-[family-name:var(--font-heading)] text-[clamp(2rem,4vw,3.4rem)] font-semibold leading-none tracking-[-0.05em] text-white mix-blend-difference">{String(i + 1).padStart(2, "0")}</span>
                  <span className="absolute inset-x-0 bottom-0 translate-y-full bg-[var(--color-primary)] px-4 py-3 text-[12px] font-bold uppercase tracking-[0.14em] text-white transition-transform duration-300 group-hover:translate-y-0 group-focus-visible:translate-y-0">Voir la pièce →</span>
                </span>
                <span className="flex flex-col gap-0.5 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:px-4 sm:py-3.5">
                  <span className="text-[12px] font-bold uppercase leading-snug tracking-[0.02em] sm:truncate sm:text-[13px]">{p.name}</span>
                  <span className="shrink-0 text-[12px] font-semibold tabular-nums sm:text-[13px]">{fmt(p.price)}</span>
                </span>
              </Link>
            </li>
          ))}
          {/* Rangée incomplète : la dernière case invite vers toute la collection. */}
          {products.length % 4 !== 0 && params.linkHref && (
            <li className={`border-b border-r border-[var(--color-text-primary)] ${products.length % 2 === 0 ? "hidden lg:block" : ""}`}>
              <Link href={params.linkHref} className="group flex h-full min-h-[220px] flex-col justify-between bg-[var(--color-primary)] p-5 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white">
                <span className="text-[12px] font-bold uppercase tracking-[0.18em] text-white/70">La collection</span>
                <span className="font-[family-name:var(--font-heading)] text-[clamp(1.25rem,3vw,2.8rem)] font-semibold uppercase leading-[0.95] tracking-[-0.03em] [overflow-wrap:anywhere]">
                  {params.linkLabel ?? "Tout voir"} <span aria-hidden="true" className="inline-block transition-transform duration-300 group-hover:translate-x-2">→</span>
                </span>
              </Link>
            </li>
          )}
        </ul>
      </section>
    );
  }

  // « editorial »
  return (
    <section data-motion={level === "none" ? "off" : "on"} className="mx-auto max-w-[1320px] px-5 py-20 sm:px-10 lg:py-32">
      {header("serif")}
      <ul className="grid grid-cols-2 gap-x-5 gap-y-14 lg:grid-cols-3 lg:gap-x-10">
        {products.map((p, i) => (
          <li key={p.id} className={`ycc-reveal ${i % 3 === 1 ? "lg:mt-24" : ""}`}>
            <Link href={p.href ?? "#"} className="group block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-4">
              <span className="block overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.imageUrl} alt={p.name} loading="lazy" className="aspect-[3/4] w-full object-cover transition-transform duration-[1200ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.035]" />
              </span>
              <span className="mt-5 flex items-baseline gap-3">
                <span className="font-[family-name:var(--font-heading)] text-[13px] italic text-[var(--color-text-muted)]">N°{String(i + 1).padStart(2, "0")}</span>
                <span className="font-[family-name:var(--font-heading)] text-[21px] leading-tight decoration-1 underline-offset-[6px] group-hover:underline">{p.name}</span>
              </span>
              <span className="mt-1.5 block pl-[2.6rem] text-[13px] tracking-[0.04em] text-[var(--color-text-secondary)] tabular-nums">{fmt(p.price)}{p.inStock === false ? " — épuisé" : ""}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
