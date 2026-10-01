"use client";

import { vocabularyOf, type StudioMode } from "@/lib/site-ai/vocabulary";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { IconArrowRight, IconSparkles } from "@/components/yc/icons";
import { usePrefersReducedMotion } from "@/lib/motion/animation-level-context";
import { FONT_PAIRS, SHAPES, isFontPair, isShape } from "@/lib/storefront/brand-kit";
import { DeviceToggle, PreviewOverlay, StudioPreview, type Device } from "./studio-preview";

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
 * Atelier de création — étape des directions. Chaque direction est un site complet
 * (structure, typographie, formes, palette) rendu par le moteur du site avec les vrais
 * contenus de l'entreprise. Un onglet par direction, un GRAND aperçu (ordinateur ou
 * téléphone, plein écran), et à côté le « directeur artistique » qui présente la
 * direction affichée et les autres. Choisir crée le brouillon — rien n'est en ligne
 * avant la publication.
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
  mode = "commerce",
}: {
  mode?: StudioMode;
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
  const [active, setActive] = useState(0);
  const [device, setDevice] = useState<Device>("desktop");
  const [fullscreen, setFullscreen] = useState(false);
  useEffect(() => {
    if (window.matchMedia?.("(max-width: 767px)").matches) setDevice("phone");
  }, []);
  const d = directions[active] ?? directions[0]!;
  const src = (i: number) => `/editeur/site?job=${jobId}&d=${i}`;
  const names = directions.map((x) => x.archetypeLabel ?? x.name);

  return (
    <section aria-labelledby="directions" className="grid gap-4">
      {/* En-tête compact : le site passe avant le texte. */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="inline-flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.16em] text-yc-electric"><IconSparkles size={13} /> Atelier de création</p>
          <h2 id="directions" className="mt-1 font-display text-[clamp(1.35rem,2.2vw,1.75rem)] font-semibold leading-tight tracking-[-0.02em] text-yc-ink">Trois directions, composées avec vos {vocabularyOf(mode).items}</h2>
        </div>
        <div className="flex items-center gap-2">
          <DeviceToggle device={device} onChange={setDevice} />
          <button type="button" onClick={() => setFullscreen(true)} aria-label="Plein écran" className="inline-flex min-h-11 items-center gap-2 rounded-full bg-white px-3.5 text-[13px] font-semibold text-yc-ink ring-1 ring-inset ring-yc-ink/10 hover:ring-yc-ink/25 sm:px-4">
            <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" /></svg>
            <span className="hidden sm:inline">Plein écran</span>
          </button>
        </div>
      </div>
      {simulated && <p className="w-fit rounded-full bg-yc-warning/[0.14] px-3 py-1 text-[12px] font-semibold text-[rgb(146_84_0)]">Simulation locale — directions produites par des règles de développement, pas par l&apos;IA</p>}
      {unavailableReason && <p className="rounded-xl bg-yc-warning/[0.12] px-3 py-2 text-[13px] text-yc-ink">{unavailableReason} Vous pouvez choisir une direction déjà proposée ou modifier le site à la main.</p>}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid min-w-0 content-start gap-3">
          {/* Onglets : numéro, nom, échantillon typographique et palette. */}
          <div role="tablist" aria-label="Directions proposées" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-3 sm:px-0">
            {directions.map((x, i) => {
              const pair = isFontPair(x.typography) ? FONT_PAIRS[x.typography] : null;
              const selected = i === active;
              return (
                <button
                  key={i}
                  type="button"
                  role="tab"
                  id={`direction-tab-${i}`}
                  aria-selected={selected}
                  aria-controls="direction-panel"
                  onClick={() => setActive(i)}
                  className={`group flex min-w-[230px] items-center gap-3 rounded-2xl p-2.5 pr-4 text-left transition sm:min-w-0 ${selected ? "bg-yc-night-950 text-white shadow-yc-float" : "bg-white text-yc-ink ring-1 ring-inset ring-yc-ink/[0.08] hover:ring-yc-ink/25"}`}
                >
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl text-[22px] leading-none ring-1 ring-inset ring-black/5" style={{ background: x.palette.background, color: x.palette.primary, fontFamily: pair?.headingFont }} aria-hidden="true">
                    Aa
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block font-mono text-[11px] ${selected ? "text-white/55" : "text-yc-ink-soft"}`}>{String(i + 1).padStart(2, "0")}</span>
                    <span className="block truncate text-[15px] font-semibold leading-tight">{names[i]}</span>
                  </span>
                  <span className="flex -space-x-1" aria-hidden="true">
                    {[x.palette.primary, x.palette.accent].map((c) => <span key={c} className={`h-4 w-4 rounded-full ring-2 ${selected ? "ring-yc-night-950" : "ring-white"}`} style={{ background: c }} />)}
                  </span>
                </button>
              );
            })}
          </div>

          <div id="direction-panel" role="tabpanel" aria-labelledby={`direction-tab-${active}`} className="relative">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div key={`${active}-${device}`} initial={reduced ? false : { opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={reduced ? undefined : { opacity: 0, y: -8 }} transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}>
                <StudioPreview src={src(active)} device={device} label={`${String(active + 1).padStart(2, "0")} — ${names[active]}`} />
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* Le directeur artistique présente la direction affichée. */}
        <aside aria-label="Votre directeur artistique" className="grid content-start gap-4 xl:sticky xl:top-[136px]">
          <div className="overflow-hidden rounded-2xl bg-white shadow-yc ring-1 ring-yc-ink/[0.06]">
            <div className="flex items-center gap-3 border-b border-yc-ink/[0.06] px-5 py-4">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-yc-night-950 text-white" aria-hidden="true"><IconSparkles size={15} /></span>
              <div>
                <p className="text-[15px] font-semibold text-yc-ink">Votre directeur artistique</p>
                <p className="text-[12px] text-yc-ink-soft">{simulated ? "Simulation locale" : "Propositions composées pour vous"}</p>
              </div>
            </div>
            <div className="grid gap-4 p-5">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div key={active} initial={reduced ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={reduced ? undefined : { opacity: 0 }} transition={{ duration: 0.25 }} className="grid gap-4">
                  <div className="rounded-2xl rounded-tl-md bg-[#F3F4F8] px-4 py-3 text-[14px] leading-relaxed text-yc-ink">
                    <p className="mb-1 text-[12px] font-semibold uppercase tracking-[0.12em] text-yc-ink-soft">{String(active + 1).padStart(2, "0")} · {names[active]}</p>
                    {d.pitch}
                  </div>
                  <DirectionTraits d={d} />
                </motion.div>
              </AnimatePresence>
              <button type="button" onClick={() => onChoose(active)} disabled={busy} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-yc-night-950 px-5 text-[15px] font-semibold text-white transition hover:bg-yc-night-900 disabled:opacity-50">
                Choisir « {names[active]} » <IconArrowRight size={16} />
              </button>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={onRegenerate} disabled={busy || Boolean(unavailableReason)} className="min-h-10 rounded-full bg-white px-3.5 text-[13px] font-medium text-yc-ink ring-1 ring-inset ring-yc-ink/12 hover:ring-yc-ink/30 disabled:opacity-40">Trois autres propositions</button>
                <button type="button" onClick={onBack} disabled={Boolean(unavailableReason)} className="min-h-10 rounded-full bg-white px-3.5 text-[13px] font-medium text-yc-ink ring-1 ring-inset ring-yc-ink/12 hover:ring-yc-ink/30 disabled:opacity-40">Modifier mes réponses</button>
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-white p-4 shadow-yc ring-1 ring-yc-ink/[0.06]">
            <p className="px-1 text-[12px] font-semibold uppercase tracking-[0.12em] text-yc-ink-soft">Autres directions proposées</p>
            <ul className="mt-2 grid gap-1">
              {directions.map((x, i) =>
                i === active ? null : (
                  <li key={i}>
                    <button type="button" onClick={() => setActive(i)} className="flex w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-[#F6F7FB]">
                      <span className="h-10 w-10 shrink-0 rounded-lg ring-1 ring-inset ring-black/5" style={{ background: `linear-gradient(135deg, ${x.palette.background} 0 50%, ${x.palette.primary} 50% 100%)` }} aria-hidden="true" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-[14px] font-semibold text-yc-ink">{String(i + 1).padStart(2, "0")} · {names[i]}</span>
                        <span className="line-clamp-1 block text-[12px] text-yc-ink-soft">{x.pitch}</span>
                      </span>
                      <IconArrowRight size={14} className="shrink-0 text-yc-ink-soft" />
                    </button>
                  </li>
                ),
              )}
            </ul>
          </div>

          {(advice.length > 0 || d.compiled.notes.length > 0) && (
            <details className="rounded-2xl bg-white px-5 py-4 text-[13px] text-yc-ink-soft shadow-yc ring-1 ring-yc-ink/[0.06]">
              <summary className="cursor-pointer font-semibold text-yc-ink">Conseils et ajustements ({advice.length + d.compiled.notes.length})</summary>
              <ul className="mt-2 grid gap-1 pl-4">{[...advice, ...d.compiled.notes].map((n) => <li key={n} className="list-disc">{n}</li>)}</ul>
            </details>
          )}
        </aside>
      </div>

      {/* Téléphone : le choix reste à portée de pouce. */}
      <div className="fixed inset-x-3 bottom-[76px] z-40 flex items-center gap-2 rounded-2xl bg-yc-night-950 p-2 pl-4 text-white shadow-yc-float md:hidden">
        <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{String(active + 1).padStart(2, "0")} · {names[active]}</span>
        <button type="button" disabled={busy} onClick={() => onChoose(active)} className="min-h-10 rounded-xl bg-white px-4 text-[13px] font-semibold text-yc-night-950 disabled:opacity-50">Choisir</button>
      </div>

      {fullscreen && (
        <PreviewOverlay
          src={src(active)}
          label={names[active]!}
          initialDevice={device}
          tabs={names}
          activeTab={active}
          onTab={setActive}
          onClose={() => setFullscreen(false)}
          actions={
            <button type="button" disabled={busy} onClick={() => { setFullscreen(false); onChoose(active); }} className="inline-flex min-h-10 items-center gap-2 rounded-full bg-white px-4 text-[13px] font-semibold text-[#101114] disabled:opacity-50">
              Choisir <span className="hidden sm:inline">« {names[active]} »</span> <IconArrowRight size={14} />
            </button>
          }
        />
      )}
    </section>
  );
}

function DirectionTraits({ d }: { d: DirectionCard }) {
  const pair = isFontPair(d.typography) ? FONT_PAIRS[d.typography] : null;
  const shape = isShape(d.shape) ? SHAPES[d.shape] : null;
  return (
    <dl className="grid gap-3 text-[13px]">
      <div className="flex items-center justify-between gap-3">
        <dt className="text-yc-ink-soft">Typographie</dt>
        <dd className="text-right font-semibold text-yc-ink" style={{ fontFamily: pair?.headingFont }}>{pair ? pair.label : "Celle du style"}</dd>
      </div>
      <div className="flex items-center justify-between gap-3">
        <dt className="text-yc-ink-soft">Palette</dt>
        <dd className="flex gap-1.5">
          {[d.palette.primary, d.palette.accent, d.palette.background].map((c) => <span key={c} title={c} className="h-5 w-5 rounded-full ring-1 ring-inset ring-black/10" style={{ background: c }} />)}
        </dd>
      </div>
      {shape && (
        <div className="flex items-center justify-between gap-3">
          <dt className="text-yc-ink-soft">Formes</dt>
          <dd className="text-right font-semibold text-yc-ink">{shape.label}</dd>
        </div>
      )}
      {d.outline && d.outline.length > 0 && (
        <div>
          <dt className="text-yc-ink-soft">Plan de la page</dt>
          <dd>
            <ol className="mt-1.5 flex flex-wrap gap-1.5">
              {d.outline.map((s, k) => <li key={k} className="rounded-full bg-[#F3F4F8] px-2.5 py-1 text-[12px] text-yc-ink">{s}</li>)}
            </ol>
          </dd>
        </div>
      )}
    </dl>
  );
}
