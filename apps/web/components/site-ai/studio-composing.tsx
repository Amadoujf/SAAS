"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { IconCheck } from "@/components/yc/icons";
import { usePrefersReducedMotion } from "@/lib/motion/animation-level-context";
import { vocabularyOf } from "@/lib/site-ai/vocabulary";
import type { CatalogSummary } from "./studio-creation";

/**
 * Pendant la composition : les étapes RÉELLES du traitement (lecture du catalogue,
 * proposition, composition, contrôles), et trois maquettes qui s'assemblent avec les
 * vraies photos. La dernière étape reste « en cours » jusqu'à la réponse du serveur :
 * aucun faux « terminé ».
 */
const PHASES = [
  (c: CatalogSummary) => `Lecture de votre ${vocabularyOf(c.mode).catalog} — ${c.products} ${vocabularyOf(c.mode).item}${c.products > 1 ? "s" : ""}, ${c.illustrated} photo${c.illustrated > 1 ? "s" : ""}`,
  () => "Choix de trois structures de page différentes",
  (c: CatalogSummary) => `Composition avec vos ${vocabularyOf(c.mode).items} et vos photos`,
  () => "Contrôle des textes, des couleurs et de la lisibilité",
];

const FRAMES = [
  { bg: "#F4F2EE", ink: "#1F2A37", rows: ["hero-center", "mosaic", "text", "band"] },
  { bg: "#FBF3EA", ink: "#4A2E20", rows: ["hero-split", "text", "story", "grid"] },
  { bg: "#151515", ink: "#F3EBDD", rows: ["hero-stage", "dark", "grid", "band"] },
];

export function StudioComposing({ catalog }: { catalog: CatalogSummary }) {
  const reduced = usePrefersReducedMotion();
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    const timers = [1400, 3600, 6400].map((ms, i) => setTimeout(() => setPhase(i + 1), ms));
    return () => timers.forEach(clearTimeout);
  }, []);
  const photos = catalog.samples;

  return (
    <section aria-live="polite" aria-busy="true" className="relative isolate overflow-hidden rounded-[28px] bg-yc-night-950 px-6 py-10 text-white shadow-yc-float sm:px-10 lg:px-14 lg:py-14">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(50%_60%_at_50%_0%,rgb(39_73_232/0.45),transparent_70%)]" />
      <div className="mx-auto max-w-5xl">
        <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-white/60">Composition en cours</p>
        <h2 className="mt-3 font-display text-[clamp(1.7rem,3.4vw,2.5rem)] font-semibold leading-tight tracking-[-0.02em]">Trois sites prennent forme avec vos {vocabularyOf(catalog.mode).items}.</h2>

        <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-3" aria-hidden="true">
          {FRAMES.map((frame, f) => (
            <motion.div
              key={f}
              className="overflow-hidden rounded-2xl p-3 shadow-[0_30px_80px_rgb(0_0_0/0.4)]"
              style={{ background: frame.bg, color: frame.ink }}
              initial={reduced ? false : { opacity: 0, y: 40, rotate: f === 0 ? -2 : f === 2 ? 2 : 0 }}
              animate={{ opacity: 1, y: 0, rotate: 0 }}
              transition={{ duration: 0.8, delay: reduced ? 0 : 0.2 + f * 0.15, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="mb-3 flex items-center justify-between px-1 text-[8px] uppercase tracking-[0.2em] opacity-60">
                <span>{"—".repeat(6)}</span>
                <span>● ● ●</span>
              </div>
              <div className="grid gap-2">
                {frame.rows.map((row, r) => (
                  <motion.div
                    key={row + r}
                    initial={reduced ? false : { opacity: 0, x: r % 2 ? 24 : -24 }}
                    animate={{ opacity: phase >= 1 ? 1 : 0.15, x: 0 }}
                    transition={{ duration: 0.7, delay: reduced ? 0 : 0.8 + f * 0.25 + r * 0.35, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <FrameRow kind={row} photos={photos} offset={f * 2 + r} ink={frame.ink} phase={phase} />
                  </motion.div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>

        <ol className="mx-auto mt-10 grid max-w-xl gap-3">
          {PHASES.map((label, i) => {
            const done = i < phase;
            const active = i === phase;
            return (
              <li key={i} className={`flex items-center gap-3 text-[15px] transition-opacity duration-500 ${i > phase ? "opacity-35" : "opacity-100"}`}>
                <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full ${done ? "bg-[#34D399]/20 text-[#6EE7B7]" : "bg-white/10"}`}>
                  {done ? <IconCheck size={13} /> : active ? <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/25 border-t-white" /> : <span className="h-1.5 w-1.5 rounded-full bg-white/50" />}
                </span>
                {label(catalog)}
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}

function FrameRow({ kind, photos, offset, ink, phase }: { kind: string; photos: CatalogSummary["samples"]; offset: number; ink: string; phase: number }) {
  const photo = (i: number) => photos.length ? photos[(offset + i) % photos.length]!.imageUrl : null;
  const img = (i: number, cls: string) => {
    const src = phase >= 2 ? photo(i) : null;
    return (
      <span className={`relative block overflow-hidden rounded-md ${cls}`} style={{ background: `${ink}14` }}>
        {src && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="" className="h-full w-full object-contain p-1 transition-opacity duration-700" />
        )}
      </span>
    );
  };
  const line = (w: string, h = "h-1.5") => <span className={`block ${h} ${w} rounded-full`} style={{ background: `${ink}40` }} />;
  switch (kind) {
    case "hero-center":
      return (
        <div className="grid justify-items-center gap-1.5 py-2">
          {line("w-1/2", "h-2.5")}
          {line("w-2/3")}
          {img(0, "mt-1 h-20 w-16")}
        </div>
      );
    case "hero-split":
      return (
        <div className="grid grid-cols-2 items-center gap-2 py-1">
          <div className="grid gap-1.5">{line("w-full", "h-2.5")}{line("w-3/4")}{line("w-1/2")}</div>
          {img(0, "h-20")}
        </div>
      );
    case "hero-stage":
      return (
        <div className="grid grid-cols-[1fr_0.8fr] items-center gap-2 py-1">
          <div className="grid gap-1.5">{line("w-full", "h-3")}{line("w-2/3")}</div>
          {img(0, "h-20")}
        </div>
      );
    case "mosaic":
      return <div className="grid grid-cols-3 grid-rows-2 gap-1.5">{img(1, "col-span-2 row-span-2 h-[76px]")}{img(2, "h-[35px]")}{img(3, "h-[35px]")}</div>;
    case "grid":
      return <div className="grid grid-cols-3 gap-1.5">{img(1, "h-12")}{img(2, "h-12")}{img(3, "h-12")}</div>;
    case "story":
      return <div className="grid grid-cols-[0.9fr_1fr] gap-2">{img(4, "h-14")}<div className="grid content-center gap-1.5">{line("w-3/4", "h-2")}{line("w-full")}{line("w-2/3")}</div></div>;
    case "dark":
      return <div className="grid grid-cols-[1fr_0.9fr] items-center gap-2 rounded-md bg-black/40 p-2">{line("w-3/4", "h-2.5")}{img(5, "h-14")}</div>;
    case "text":
      return <div className="grid gap-1.5 py-1">{line("w-5/6", "h-2")}{line("w-full")}{line("w-2/3")}</div>;
    default:
      return <div className="grid justify-items-center gap-1.5 rounded-md py-2" style={{ background: `${ink}0d` }}>{line("w-1/2", "h-2")}{line("w-1/4", "h-3")}</div>;
  }
}
