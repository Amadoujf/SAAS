"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { IconArrowRight, IconSparkles, IconX } from "@/components/yc/icons";
import { usePrefersReducedMotion } from "@/lib/motion/animation-level-context";
import { FONT_PAIRS, SHAPES, isFontPair, isShape } from "@/lib/storefront/brand-kit";
import { StudioPreview, type Device } from "./studio-preview";
import { ycFontVariables } from "@/lib/yc-fonts";

export interface DirectionCard {
  name: string;
  pitch: string;
  palette: { primary: string; accent: string; background: string };
  archetypeLabel?: string;
  typography?: string;
  shape?: string;
  outline?: string[];
  compiled: { notes: string[] };
}

/**
 * Révélation des trois directions : chacune est un site complet (structure, typographie,
 * formes, palette), PRÉVISUALISÉ avec les vrais contenus de l'entreprise par le moteur du
 * site. « Comparer » ouvre l'aperçu plein écran, ordinateur ou téléphone. Choisir crée le
 * brouillon — rien n'est en ligne avant la publication.
 */
export function StudioDirections({
  jobId,
  directions,
  advice,
  simulated,
  unavailableReason,
  busy,
  onChoose,
  onRegenerate,
  onBack,
}: {
  jobId: string;
  directions: DirectionCard[];
  advice: string[];
  simulated: boolean;
  unavailableReason: string | null;
  busy: boolean;
  onChoose: (index: number) => void;
  onRegenerate: () => void;
  onBack: () => void;
}) {
  const reduced = usePrefersReducedMotion();
  const [open, setOpen] = useState<number | null>(null);

  return (
    <section aria-labelledby="directions" className="relative isolate overflow-hidden rounded-[28px] bg-yc-night-950 px-5 py-8 text-white shadow-yc-float sm:px-8 lg:px-10 lg:py-12">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(45%_55%_at_15%_0%,rgb(39_73_232/0.45),transparent_70%)]" />
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div className="max-w-2xl">
          <p className="inline-flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.18em] text-white/60">
            <IconSparkles size={14} /> Trois sites pour vous
          </p>
          <h2 id="directions" className="mt-3 font-display text-[clamp(1.8rem,3.6vw,2.7rem)] font-semibold leading-[1.05] tracking-[-0.025em]">
            Choisissez celui qui vous ressemble.
          </h2>
          <p className="mt-3 text-[15px] leading-relaxed text-white/65">Trois structures, trois typographies, trois ambiances — toutes avec vos produits. Vous ajusterez ensuite en conversation.</p>
          {simulated && <p className="mt-3 inline-flex rounded-full bg-[#FFB020]/15 px-3 py-1 text-[12px] font-semibold text-[#FFD27A]">Simulation locale — propositions produites par des règles de développement, pas par l&apos;IA</p>}
          {unavailableReason && <p className="mt-3 rounded-xl bg-[#FFB020]/15 px-3 py-2 text-[13px] text-[#FFE2A8]">{unavailableReason} Vous pouvez choisir une direction déjà proposée ou modifier le site à la main.</p>}
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={onBack} disabled={Boolean(unavailableReason)} className="min-h-11 rounded-full px-4 text-[14px] font-semibold text-white/70 hover:text-white disabled:opacity-40">
            Modifier mes réponses
          </button>
          <button type="button" onClick={onRegenerate} disabled={busy || Boolean(unavailableReason)} className="min-h-11 rounded-full bg-white/10 px-4 text-[14px] font-semibold text-white ring-1 ring-inset ring-white/15 hover:bg-white/15 disabled:opacity-40">
            Trois autres propositions
          </button>
        </div>
      </div>

      <div className="mt-9 grid grid-cols-1 gap-5 lg:grid-cols-3">
        {directions.map((d, i) => {
          const pair = isFontPair(d.typography) ? FONT_PAIRS[d.typography] : null;
          const shape = isShape(d.shape) ? SHAPES[d.shape] : null;
          return (
            <motion.article
              key={i}
              className="group flex flex-col overflow-hidden rounded-3xl bg-white text-yc-ink shadow-[0_30px_80px_rgb(0_0_0/0.35)]"
              initial={reduced ? false : { opacity: 0, y: 48, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.8, delay: reduced ? 0 : 0.1 + i * 0.14, ease: [0.22, 1, 0.36, 1] }}
            >
              <button type="button" onClick={() => setOpen(i)} className="relative block bg-[#EEF0F5] p-3 text-left" aria-label={`Voir « ${d.name} » en grand`}>
                <StudioPreview src={`/editeur/site?job=${jobId}&d=${i}`} device="desktop" label={d.name} compact="tall" />
                <span className="pointer-events-none absolute inset-3 grid place-items-center rounded-2xl bg-yc-night-950/0 text-[14px] font-semibold text-white opacity-0 transition group-hover:bg-yc-night-950/45 group-hover:opacity-100">
                  Voir en grand
                </span>
              </button>
              <div className="flex flex-1 flex-col gap-4 p-6">
                <div>
                  {d.archetypeLabel && <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-yc-electric">Structure {d.archetypeLabel}</p>}
                  <h3 className="mt-1 font-display text-[22px] font-semibold tracking-[-0.01em]">{d.name}</h3>
                  <p className="mt-1.5 text-[14px] leading-relaxed text-yc-ink-soft">{d.pitch}</p>
                </div>
                <div className="flex items-center gap-3 rounded-2xl bg-[#F6F7FB] p-3">
                  <span className="grid h-14 w-14 shrink-0 place-items-center rounded-xl text-[26px] leading-none" style={{ background: d.palette.background, color: d.palette.primary, fontFamily: pair ? pair.headingFont : undefined, borderRadius: shape?.radii.lg }}>
                    Aa
                  </span>
                  <div className="min-w-0 flex-1 text-[12px] leading-snug text-yc-ink-soft">
                    <p className="font-semibold text-yc-ink">{pair ? pair.label : "Typographie du style"}</p>
                    <p>{shape ? shape.label : "Formes du style"}</p>
                  </div>
                  <span className="flex -space-x-1.5" aria-label="Palette">
                    {[d.palette.primary, d.palette.accent, d.palette.background].map((c) => (
                      <span key={c} className="h-6 w-6 rounded-full ring-2 ring-white" style={{ background: c }} title={c} />
                    ))}
                  </span>
                </div>
                {d.outline && d.outline.length > 0 && (
                  <ol className="grid gap-1 text-[13px] text-yc-ink-soft" aria-label="Plan de la page">
                    {d.outline.map((s, k) => (
                      <li key={k} className="flex items-center gap-2">
                        <span className="w-5 text-right font-mono text-[11px] text-yc-ink-soft/60">{String(k + 1).padStart(2, "0")}</span> {s}
                      </li>
                    ))}
                  </ol>
                )}
                {d.compiled.notes.length > 0 && (
                  <details className="text-[12px] text-yc-ink-soft">
                    <summary className="cursor-pointer font-medium text-yc-ink">Ajustements faits par Y-COM ({d.compiled.notes.length})</summary>
                    <ul className="mt-2 grid gap-1 pl-4">{d.compiled.notes.map((n) => <li key={n} className="list-disc">{n}</li>)}</ul>
                  </details>
                )}
                <div className="mt-auto flex items-center gap-2 pt-1">
                  <button type="button" onClick={() => onChoose(i)} disabled={busy} className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-full bg-yc-night-950 px-5 text-[15px] font-semibold text-white transition hover:bg-yc-night-900 disabled:opacity-50">
                    Choisir ce site <IconArrowRight size={16} />
                  </button>
                  <button type="button" onClick={() => setOpen(i)} className="min-h-12 shrink-0 rounded-full px-3 text-[14px] font-semibold text-yc-electric hover:bg-yc-electric/5">
                    Comparer
                  </button>
                </div>
              </div>
            </motion.article>
          );
        })}
      </div>

      {advice.length > 0 && (
        <aside className="mt-6 rounded-2xl bg-white/[0.05] p-5 ring-1 ring-inset ring-white/10">
          <h3 className="text-[14px] font-semibold text-white">Pour un rendu encore meilleur</h3>
          <ul className="mt-2 grid gap-1.5 text-[13px] leading-relaxed text-white/65">{advice.map((a) => <li key={a}>{a}</li>)}</ul>
        </aside>
      )}

      <AnimatePresence>
        {open !== null && (
          <CompareOverlay
            jobId={jobId}
            directions={directions}
            index={open}
            busy={busy}
            onIndex={setOpen}
            onClose={() => setOpen(null)}
            onChoose={(i) => {
              setOpen(null);
              onChoose(i);
            }}
          />
        )}
      </AnimatePresence>
    </section>
  );
}

function CompareOverlay({
  jobId,
  directions,
  index,
  busy,
  onIndex,
  onClose,
  onChoose,
}: {
  jobId: string;
  directions: DirectionCard[];
  index: number;
  busy: boolean;
  onIndex: (i: number) => void;
  onClose: () => void;
  onChoose: (i: number) => void;
}) {
  const [device, setDevice] = useState<Device>("desktop");
  useEffect(() => {
    if (window.matchMedia?.("(max-width: 767px)").matches) setDevice("phone");
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") onIndex((index + 1) % directions.length);
      if (e.key === "ArrowLeft") onIndex((index + directions.length - 1) % directions.length);
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [index, directions.length, onClose, onIndex]);
  const d = directions[index]!;
  return createPortal(
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label={`Aperçu : ${d.name}`}
      className={`${ycFontVariables} fixed inset-0 z-[80] flex flex-col bg-yc-night-950/95 font-ui text-white backdrop-blur`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="flex flex-wrap items-center gap-3 border-b border-white/10 px-4 py-3 sm:px-6">
        <div className="flex rounded-full bg-white/10 p-1" role="tablist" aria-label="Directions">
          {directions.map((x, i) => (
            <button key={i} type="button" role="tab" aria-selected={i === index} onClick={() => onIndex(i)} className={`min-h-9 rounded-full px-3 text-[13px] font-semibold sm:px-4 ${i === index ? "bg-white text-yc-night-950" : "text-white/70 hover:text-white"}`}>
              {x.name}
            </button>
          ))}
        </div>
        <div className="flex rounded-full bg-white/10 p-1" role="group" aria-label="Appareil">
          {(["desktop", "phone"] as const).map((v) => (
            <button key={v} type="button" aria-pressed={device === v} onClick={() => setDevice(v)} className={`min-h-9 rounded-full px-3 text-[13px] font-semibold ${device === v ? "bg-white text-yc-night-950" : "text-white/70 hover:text-white"}`}>
              {v === "desktop" ? "Ordinateur" : "Téléphone"}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button type="button" disabled={busy} onClick={() => onChoose(index)} className="inline-flex min-h-10 items-center gap-2 rounded-full bg-white px-5 text-[14px] font-semibold text-yc-night-950 disabled:opacity-50">
            Choisir « {d.name} » <IconArrowRight size={15} />
          </button>
          <button type="button" onClick={onClose} aria-label="Fermer" className="grid h-10 w-10 place-items-center rounded-full bg-white/10 hover:bg-white/20">
            <IconX size={16} />
          </button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-6">
        <div className={device === "phone" ? "mx-auto w-full max-w-[420px]" : "mx-auto w-full max-w-[1400px]"}>
          <StudioPreview key={`${index}-${device}`} src={`/editeur/site?job=${jobId}&d=${index}`} device={device} label={d.name} />
        </div>
      </div>
    </motion.div>,
    document.body,
  );
}
