"use client";

import { vocabularyOf, type StudioMode } from "@/lib/site-ai/vocabulary";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { IconArrowRight, IconSparkles } from "@/components/yc/icons";
import { usePrefersReducedMotion } from "@/lib/motion/animation-level-context";
import { StudioPreview, type Device } from "./studio-preview";

export interface DirectionCard {
  name: string;
  pitch: string;
  palette: { primary: string; accent: string; background: string };
  archetypeLabel?: string;
  typography?: string;
  shape?: string;
  outline?: string[];
  cover?: string | null;
  compiled: { notes: string[] };
}

/** Première proposition du pitch (« Contemporain et affirmé : … » → « Contemporain et affirmé. »). */
export function shortPitch(pitch: string): string {
  const head = pitch.split(/\s?[:—–]\s|\.\s/)[0]!.trim().replace(/[.,;]$/, "");
  return head.length > 64 ? `${head.slice(0, 61).trimEnd()}…` : `${head}.`;
}

const pad = (i: number) => String(i + 1).padStart(2, "0");

/**
 * Atelier de création — étape des directions. Chaque direction est un site complet
 * rendu avec les vrais contenus de l'entreprise. Onglets illustrés, grand aperçu
 * (l'appareil se choisit dans la barre de l'atelier), et la colonne du « directeur
 * artistique » : la demande de l'entreprise, la direction affichée, les autres
 * directions, et un champ pour demander un ajustement. Écrire une demande choisit la
 * direction affichée puis prépare la modification — rien n'est en ligne avant la
 * publication.
 */
export function StudioDirections({
  jobId,
  directions,
  advice,
  simulated,
  unavailableReason,
  busy,
  device,
  active,
  onActive,
  request,
  initial,
  onChoose,
  onAsk,
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
  device: Device;
  active: number;
  onActive: (i: number) => void;
  /** Ce que l'entreprise a décrit (bulle de départ de la conversation). */
  request: string | null;
  initial: string;
  onChoose: (index: number) => void;
  onAsk: (index: number, message: string) => void;
  onRegenerate: () => void;
  onBack: () => void;
}) {
  const reduced = usePrefersReducedMotion();
  const [message, setMessage] = useState("");
  const [menu, setMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !menuRef.current?.contains(e.target as Node)) setMenu(false);
    };
    window.addEventListener("mousedown", close);
    window.addEventListener("keydown", close);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("keydown", close);
    };
  }, [menu]);
  const d = directions[active] ?? directions[0]!;
  const names = directions.map((x) => x.archetypeLabel ?? x.name);
  const blocked = busy || Boolean(unavailableReason);
  const ask = (text: string) => {
    const value = text.trim();
    if (!value || blocked) return;
    onAsk(active, value);
    setMessage("");
  };

  return (
    <section aria-labelledby="directions" className="grid grid-cols-1 gap-6 pb-20 md:pb-0 xl:grid-cols-[minmax(0,1fr)_400px]">
      <div className="grid min-w-0 content-start gap-5">
        <header>
          <h2 id="directions" className="font-[family-name:var(--font-tpl-serif)] text-[clamp(2rem,3.6vw,3rem)] font-medium leading-[1.02] tracking-[-0.035em] text-yc-ink">
            Votre marque. Votre univers.
          </h2>
          <p className="mt-2 text-[16px] text-yc-ink-soft">Trois directions, une identité qui vous appartient — composées avec vos {vocabularyOf(mode).items}.</p>
          {simulated && <p className="mt-3 w-fit rounded-full bg-yc-warning/[0.14] px-3 py-1 text-[12px] font-semibold text-[rgb(146_84_0)]">Simulation locale — directions produites par des règles de développement, pas par l&apos;IA</p>}
          {unavailableReason && <p className="mt-3 rounded-xl bg-yc-warning/[0.12] px-3 py-2 text-[13px] text-yc-ink">{unavailableReason} Vous pouvez choisir une direction déjà proposée ou modifier le site à la main.</p>}
        </header>

        {/* Onglets illustrés : numéro, nom et la photo qui ouvre la direction. */}
        <div role="tablist" aria-label="Directions proposées" className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-3 sm:px-0">
          {directions.map((x, i) => {
            const selected = i === active;
            return (
              <button
                key={i}
                type="button"
                role="tab"
                id={`direction-tab-${i}`}
                aria-selected={selected}
                aria-controls="direction-panel"
                onClick={() => onActive(i)}
                className={`group relative flex h-[64px] min-w-[270px] items-center overflow-hidden text-left transition sm:min-w-0 ${selected ? "bg-[#EAF0FF] shadow-[inset_0_-2px_0_#2749E8]" : "bg-[#F2F2EF] hover:bg-[#ECECE8]"}`}
              >
                <span className="relative z-10 flex items-baseline gap-3 pl-4 pr-2">
                  <span className={`font-[family-name:var(--font-tpl-serif)] text-[20px] ${selected ? "text-yc-ink" : "text-yc-ink-soft"}`}>{pad(i)}</span>
                  <span className="text-[15px] font-medium text-yc-ink">{names[i]}</span>
                </span>
                {x.cover && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={x.cover} alt="" aria-hidden="true" className="ml-auto h-full w-[42%] object-cover transition-transform duration-500 group-hover:scale-105" />
                )}
              </button>
            );
          })}
        </div>

        <div id="direction-panel" role="tabpanel" aria-labelledby={`direction-tab-${active}`}>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={`${active}-${device}`} initial={reduced ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={reduced ? undefined : { opacity: 0, y: -6 }} transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}>
              <StudioPreview src={`/editeur/site?job=${jobId}&d=${active}`} device={device} label={`${pad(active)} — ${names[active]}`} />
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Le directeur artistique. */}
      <aside aria-label="Votre directeur artistique" className="flex flex-col rounded-2xl bg-white ring-1 ring-yc-ink/[0.07] xl:sticky xl:top-[136px] xl:h-[calc(100vh-152px)]">
        <div className="flex items-center gap-2.5 px-5 pb-3 pt-5">
          <IconSparkles size={20} className="text-yc-electric" />
          <p className="flex-1 text-[16px] font-semibold text-yc-ink">Votre directeur artistique</p>
          <div ref={menuRef} className="relative">
            <button type="button" aria-label="Plus d'options" aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu((o) => !o)} className="grid h-9 w-9 place-items-center rounded-full text-yc-ink-soft hover:bg-yc-ink/5 hover:text-yc-ink">
              <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" /></svg>
            </button>
            {menu && (
              <div role="menu" className="absolute right-0 top-[calc(100%+6px)] z-30 grid w-60 gap-0.5 rounded-2xl bg-white p-1.5 text-[14px] text-yc-ink shadow-yc-float ring-1 ring-yc-ink/[0.08]">
                <button role="menuitem" type="button" disabled={blocked} onClick={() => { setMenu(false); onRegenerate(); }} className="rounded-xl px-3 py-2.5 text-left hover:bg-[#F6F7FB] disabled:opacity-50">Trois autres propositions</button>
                <button role="menuitem" type="button" disabled={Boolean(unavailableReason)} onClick={() => { setMenu(false); onBack(); }} className="rounded-xl px-3 py-2.5 text-left hover:bg-[#F6F7FB] disabled:opacity-50">Modifier mes réponses</button>
              </div>
            )}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4">
          <ol className="grid gap-4">
            {request && (
              <li className="flex items-start gap-3">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#5C6B8A] text-[13px] font-semibold text-white" aria-hidden="true">{initial}</span>
                <p className="rounded-2xl rounded-tl-md bg-[#EEF2FA] px-4 py-3 text-[14px] leading-relaxed text-yc-ink">{request}</p>
              </li>
            )}
            <li className="flex items-start gap-3">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#EAF0FF] text-yc-electric" aria-hidden="true"><IconSparkles size={15} /></span>
              <AnimatePresence mode="wait" initial={false}>
                <motion.div key={active} initial={reduced ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={reduced ? undefined : { opacity: 0 }} transition={{ duration: 0.2 }} className="min-w-0 flex-1">
                  <p className="pt-1 text-[15px] leading-relaxed text-yc-ink">{d.pitch}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" disabled={blocked} onClick={() => ask("Version plus minimaliste.")} className="min-h-10 rounded-lg bg-white px-3.5 text-[13px] font-medium text-yc-ink ring-1 ring-inset ring-yc-ink/15 hover:ring-yc-ink/35 disabled:opacity-40">Plus minimaliste</button>
                    <button type="button" onClick={() => onActive((active + 1) % directions.length)} className="min-h-10 rounded-lg bg-white px-3.5 text-[13px] font-medium text-yc-ink ring-1 ring-inset ring-yc-ink/15 hover:ring-yc-ink/35">Changer l&apos;ambiance</button>
                  </div>
                  <button type="button" disabled={busy} onClick={() => onChoose(active)} className="mt-2 inline-flex min-h-10 items-center gap-1.5 text-[13px] font-semibold text-yc-electric hover:underline disabled:opacity-50">
                    Choisir « {names[active]} » et l&apos;ajuster <IconArrowRight size={14} />
                  </button>
                </motion.div>
              </AnimatePresence>
            </li>
          </ol>

          <div className="mt-6 border-t border-yc-ink/[0.07] pt-5">
            <p className="text-[14px] text-yc-ink-soft">Autres directions proposées</p>
            <ul className="mt-3 grid grid-cols-2 gap-3">
              {directions.map((x, i) =>
                i === active ? null : (
                  <li key={i}>
                    <button type="button" onClick={() => onActive(i)} className="group block w-full rounded-xl bg-white p-1.5 text-left ring-1 ring-yc-ink/[0.08] transition hover:-translate-y-0.5 hover:shadow-yc-float" aria-label={`Afficher la direction ${pad(i)} ${names[i]}`}>
                      <StudioPreview src={`/editeur/site?job=${jobId}&d=${i}`} device="phone" label={names[i]!} compact="portrait" />
                      <span className="mt-2 block px-1 text-[14px] font-medium text-yc-ink">{pad(i)} {names[i]}</span>
                      <span className="block px-1 pb-1 text-[12px] leading-snug text-yc-ink-soft">{shortPitch(x.pitch)}</span>
                    </button>
                  </li>
                ),
              )}
            </ul>
          </div>

          {(advice.length > 0 || d.compiled.notes.length > 0) && (
            <details className="mt-5 text-[13px] text-yc-ink-soft">
              <summary className="cursor-pointer font-medium text-yc-ink">Conseils et ajustements ({advice.length + d.compiled.notes.length})</summary>
              <ul className="mt-2 grid gap-1 pl-4">{[...advice, ...d.compiled.notes].map((n) => <li key={n} className="list-disc">{n}</li>)}</ul>
            </details>
          )}
        </div>

        <div className="border-t border-yc-ink/[0.07] p-4">
          <form className="relative" onSubmit={(e) => { e.preventDefault(); ask(message); }}>
            <label htmlFor="direction-message" className="sr-only">Décrivez votre modification</label>
            <input
              id="direction-message"
              value={message}
              maxLength={500}
              disabled={blocked}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Décrivez votre modification…"
              className="h-14 w-full rounded-2xl bg-white pl-4 pr-14 text-[15px] text-yc-ink ring-1 ring-inset ring-yc-ink/12 placeholder:text-yc-ink-soft/80 focus:outline-none focus:ring-2 focus:ring-yc-electric disabled:opacity-60"
            />
            <button type="submit" disabled={blocked || !message.trim()} aria-label="Envoyer" className="absolute right-2 top-2 grid h-10 w-10 place-items-center rounded-full bg-yc-electric text-white transition hover:bg-[#1F3FD1] disabled:bg-yc-electric/40">
              <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M3.4 20.4 21 12 3.4 3.6l.1 6.5L15 12 3.5 13.9z" /></svg>
            </button>
          </form>
          <p className="mt-2 px-1 text-[12px] text-yc-ink-soft">Votre demande s&apos;applique à la direction affichée ({names[active]}).</p>
          <a href="#reglages-avances" className="mt-3 inline-flex items-center gap-2 px-1 text-[13px] text-yc-ink-soft hover:text-yc-ink">
            <SlidersIcon /> Réglages avancés
          </a>
        </div>
      </aside>

      {/* Téléphone : le choix reste à portée de pouce. */}
      <div className="fixed inset-x-3 bottom-[76px] z-40 flex items-center gap-2 rounded-2xl bg-yc-night-950 p-2 pl-4 text-white shadow-yc-float md:hidden">
        <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{pad(active)} · {names[active]}</span>
        <button type="button" disabled={busy} onClick={() => onChoose(active)} className="min-h-10 rounded-xl bg-white px-4 text-[13px] font-semibold text-yc-night-950 disabled:opacity-50">Choisir</button>
      </div>
    </section>
  );
}

export function SlidersIcon() {
  return (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12" />
      <circle cx="16" cy="6" r="2" /><circle cx="10" cy="12" r="2" /><circle cx="18" cy="18" r="2" />
    </svg>
  );
}
