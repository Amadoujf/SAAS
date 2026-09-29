"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/yc/button";
import { IconArrowLeft, IconArrowRight, IconCheck, IconSparkles, IconUpload } from "@/components/yc/icons";
import { usePrefersReducedMotion } from "@/lib/motion/animation-level-context";
import { STYLE_WORDS, type SiteBrief } from "@/lib/site-ai/types";
import { vocabularyOf } from "@/lib/site-ai/vocabulary";

export interface CatalogSummary {
  /** Métier : « restaurant » (plats de la carte), « automobile » (véhicules du stock) — vocabulaire adapté. */
  mode?: "commerce" | "restaurant" | "automobile";
  products: number;
  illustrated: number;
  categories: number;
  samples: { name: string; imageUrl: string; category: string | null }[];
  categoryNames: string[];
}

/**
 * Ambiance d'APERÇU associée à chaque mot (réaction visuelle immédiate pendant le
 * questionnaire). Ce n'est pas la proposition : les trois directions sont composées
 * ensuite, à partir de l'ensemble des réponses et du catalogue.
 */
const MOODS: Record<string, { font: string; bg: string; ink: string; accent: string }> = {
  épuré: { font: "var(--font-tpl-sans)", bg: "#F4F2EE", ink: "#1F2A37", accent: "#7A5C32" },
  chaleureux: { font: "var(--font-tpl-serif)", bg: "#FBF3EA", ink: "#4A2E20", accent: "#B4572E" },
  luxueux: { font: "var(--font-tpl-didone)", bg: "#141414", ink: "#F3EBDD", accent: "#B89868" },
  coloré: { font: "var(--font-tpl-grotesk)", bg: "#FFF4E6", ink: "#1B1F3B", accent: "#E4572E" },
  artisanal: { font: "var(--font-tpl-serif)", bg: "#F3ECE0", ink: "#3B2A1E", accent: "#8C5A2B" },
  moderne: { font: "var(--font-tpl-grotesk)", bg: "#F5F6F8", ink: "#14213D", accent: "#2749E8" },
  naturel: { font: "var(--font-tpl-serif)", bg: "#F1EEE4", ink: "#2F3A2A", accent: "#5B7A4A" },
  audacieux: { font: "var(--font-tpl-grotesk)", bg: "#111111", ink: "#FFFFFF", accent: "#FF5A36" },
};
const DEFAULT_MOOD = { font: "var(--font-tpl-serif)", bg: "#F6F3EE", ink: "#1A1A1A", accent: "#8A6A3D" };

const STEPS = ["intro", "activite", "public", "ambiance", "elements"] as const;
type Step = (typeof STEPS)[number];

export function StudioCreation({
  tenantName,
  initial,
  catalog,
  logoUrl,
  advice,
  busy,
  disabledReason,
  onChooseLogo,
  onSubmit,
  onCancel,
}: {
  tenantName: string;
  initial: SiteBrief | null;
  catalog: CatalogSummary;
  logoUrl: string | null;
  advice: string[];
  busy: boolean;
  disabledReason: string | null;
  onChooseLogo: () => void;
  onSubmit: (brief: SiteBrief) => void;
  onCancel?: () => void;
}) {
  const reduced = usePrefersReducedMotion();
  const [stepIndex, setStepIndex] = useState(initial ? 1 : 0);
  const vocab = vocabularyOf(catalog.mode);
  const [direction, setDirection] = useState(1);
  const [brief, setBrief] = useState<SiteBrief>(initial ?? { activity: "", audience: "", styles: [], likes: "" });
  const step: Step = STEPS[stepIndex]!;
  const canNext = step !== "activite" || brief.activity.trim().length >= 10;
  const field = useRef<HTMLTextAreaElement | HTMLInputElement | null>(null);

  useEffect(() => {
    field.current?.focus({ preventScroll: true });
  }, [stepIndex]);

  const go = (delta: number) => {
    setDirection(delta);
    setStepIndex((i) => Math.max(0, Math.min(STEPS.length - 1, i + delta)));
  };
  const next = () => {
    if (step === "elements") onSubmit(brief);
    else if (canNext) go(1);
  };
  const toggle = (word: string) =>
    setBrief((b) => ({ ...b, styles: b.styles.includes(word) ? b.styles.filter((w) => w !== word) : b.styles.length >= 3 ? b.styles : [...b.styles, word] }));

  const mood = MOODS[brief.styles[0] ?? ""] ?? DEFAULT_MOOD;
  const slide = reduced
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : {
        initial: { opacity: 0, y: direction * 28, filter: "blur(6px)" },
        animate: { opacity: 1, y: 0, filter: "blur(0px)" },
        exit: { opacity: 0, y: direction * -20, filter: "blur(6px)" },
      };
  const questionClass = "font-display text-[clamp(1.7rem,3.6vw,2.6rem)] font-semibold leading-[1.08] tracking-[-0.025em] text-white";
  const inputClass =
    "w-full rounded-2xl bg-white/[0.06] px-5 py-4 text-[17px] leading-relaxed text-white ring-1 ring-inset ring-white/15 placeholder:text-white/35 focus:bg-white/[0.09] focus:outline-none focus:ring-2 focus:ring-[#7C93FF]";

  return (
    <section aria-labelledby="creation-titre" className="relative isolate overflow-hidden rounded-[28px] bg-yc-night-950 text-white shadow-yc-float">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -left-40 -top-40 h-[520px] w-[520px] rounded-full bg-[radial-gradient(closest-side,rgb(39_73_232/0.55),transparent)]" />
        <motion.div
          className="absolute -bottom-48 right-[-10%] h-[560px] w-[560px] rounded-full opacity-60"
          animate={{ background: `radial-gradient(closest-side, ${mood.accent}66, transparent)` }}
          transition={{ duration: 0.8 }}
        />
      </div>

      <div className="grid min-h-[620px] grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)]">
        {/* Questions */}
        <form
          className="flex min-w-0 flex-col gap-8 p-6 sm:p-10 lg:p-14"
          onSubmit={(e) => {
            e.preventDefault();
            next();
          }}
        >
          <div className="flex items-center justify-between gap-3">
            <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[12px] font-semibold uppercase tracking-[0.16em] text-white/75">
              <IconSparkles size={14} /> Créer mon site avec l&apos;IA
            </p>
            <ol className="flex gap-1.5" aria-label={`Étape ${stepIndex + 1} sur ${STEPS.length}`}>
              {STEPS.map((s, i) => (
                <li key={s} className={`h-1.5 rounded-full transition-all duration-500 ${i === stepIndex ? "w-7 bg-white" : i < stepIndex ? "w-3 bg-white/60" : "w-3 bg-white/20"}`} />
              ))}
            </ol>
          </div>

          <div className="relative flex-1">
            <AnimatePresence mode="wait" initial={false} custom={direction}>
              <motion.div key={step} {...slide} transition={{ duration: reduced ? 0.15 : 0.45, ease: [0.22, 1, 0.36, 1] }} className="grid gap-6">
                {step === "intro" && (
                  <>
                    <h2 id="creation-titre" className={questionClass}>
                      Bonjour {tenantName}.<br />
                      <span className="text-white/55">Composons votre site ensemble.</span>
                    </h2>
                    <p className="max-w-md text-[16px] leading-relaxed text-white/70">
                      <>J&apos;ai lu votre {vocab.catalog} : {catalog.products} {vocab.item}{catalog.products > 1 ? "s" : ""}, {catalog.illustrated} {vocab.illustrated(catalog.illustrated)}{catalog.categoryNames.length ? `, en ${catalog.categoryNames.slice(0, 3).join(", ")}` : ""}. Quatre questions, puis je vous propose trois sites complets, construits avec vos {vocab.items}.</>
                    </p>
                  </>
                )}
                {step === "activite" && (
                  <label className="grid gap-5">
                    <span id="creation-titre" className={questionClass}>{vocab.question}</span>
                    <textarea
                      ref={(el) => {
                        field.current = el;
                      }}
                      rows={4}
                      maxLength={400}
                      value={brief.activity}
                      onChange={(e) => setBrief({ ...brief, activity: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) next();
                      }}
                      placeholder={vocab.activityPlaceholder}
                      className={`${inputClass} resize-none`}
                    />
                    <span className="text-[13px] text-white/45">Vos mots servent de base aux textes du site. Rien n&apos;est inventé à votre place.</span>
                  </label>
                )}
                {step === "public" && (
                  <label className="grid gap-5">
                    <span id="creation-titre" className={questionClass}>Pour qui ?</span>
                    <input
                      ref={(el) => {
                        field.current = el;
                      }}
                      value={brief.audience}
                      maxLength={200}
                      onChange={(e) => setBrief({ ...brief, audience: e.target.value })}
                      placeholder={vocab.audiencePlaceholder}
                      className={inputClass}
                    />
                    <span className="text-[13px] text-white/45">Facultatif. Cela oriente le ton et la mise en avant.</span>
                  </label>
                )}
                {step === "ambiance" && (
                  <div className="grid gap-5">
                    <h2 id="creation-titre" className={questionClass}>Quelle ambiance vous ressemble ?</h2>
                    <div className="flex flex-wrap gap-2.5" role="group" aria-label="Ambiances, jusqu'à trois">
                      {STYLE_WORDS.map((word) => {
                        const on = brief.styles.includes(word);
                        const m = MOODS[word] ?? DEFAULT_MOOD;
                        return (
                          <button
                            key={word}
                            type="button"
                            aria-pressed={on}
                            onClick={() => toggle(word)}
                            className={`group inline-flex min-h-12 items-center gap-2.5 rounded-full py-1.5 pl-1.5 pr-4 text-[15px] ring-1 ring-inset transition-all ${on ? "bg-white text-yc-night-950 ring-white" : "bg-white/[0.04] text-white/85 ring-white/15 hover:ring-white/40"}`}
                          >
                            <span className="grid h-9 w-9 place-items-center rounded-full text-[15px]" style={{ background: m.bg, color: m.ink, fontFamily: m.font }} aria-hidden="true">
                              Aa
                            </span>
                            <span className="capitalize">{word}</span>
                            {on && <IconCheck size={14} />}
                          </button>
                        );
                      })}
                    </div>
                    <input
                      value={brief.likes}
                      maxLength={300}
                      onChange={(e) => setBrief({ ...brief, likes: e.target.value })}
                      placeholder="Une marque, un lieu, une matière qui vous inspire ? (facultatif)"
                      aria-label="Inspiration (facultatif)"
                      className={inputClass}
                    />
                  </div>
                )}
                {step === "elements" && (
                  <div className="grid gap-5">
                    <h2 id="creation-titre" className={questionClass}>Vos éléments</h2>
                    <div className="grid gap-2.5">
                      <Row ok={Boolean(logoUrl)} title="Logo" detail={logoUrl ? "Ajouté" : "Facultatif, mais il donne tout de suite une identité."} action={<Button type="button" size="sm" variant="secondary" onClick={onChooseLogo}><IconUpload size={14} /> {logoUrl ? "Changer" : "Ajouter"}</Button>} />
                      <Row ok={catalog.products > 0} title={vocab.catalog[0]!.toUpperCase() + vocab.catalog.slice(1)} detail={`${catalog.products} ${vocab.item}${catalog.products > 1 ? "s" : ""}, ${catalog.categories} ${vocab.groups}${catalog.categories > 1 ? "s" : ""}`} action={<Link href={vocab.manageHref} className="text-[13px] font-semibold text-[#9DB0FF] hover:underline">Gérer</Link>} />
                      <Row ok={catalog.illustrated >= 4} title="Photos" detail={`${catalog.illustrated} ${vocab.item}${catalog.illustrated > 1 ? "s" : ""} photographié${catalog.illustrated > 1 ? "s" : ""} sur ${catalog.products}`} action={<Link href="/dashboard/mediatheque" className="text-[13px] font-semibold text-[#9DB0FF] hover:underline">Médiathèque</Link>} />
                    </div>
                    {advice.length > 0 && (
                      <ul className="grid gap-1.5 rounded-2xl bg-white/[0.05] p-4 text-[13px] leading-relaxed text-white/65 ring-1 ring-inset ring-white/10">
                        {advice.map((a) => (
                          <li key={a}>{a}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {disabledReason && <p role="status" className="rounded-2xl bg-[#FFB020]/15 px-4 py-3 text-[14px] text-[#FFE2A8]">{disabledReason}</p>}

          <div className="flex items-center justify-between gap-3">
            {stepIndex > 0 ? (
              <button type="button" onClick={() => go(-1)} className="inline-flex min-h-11 items-center gap-2 rounded-full px-3 text-[14px] font-semibold text-white/70 hover:text-white">
                <IconArrowLeft size={16} /> Retour
              </button>
            ) : onCancel ? (
              <button type="button" onClick={onCancel} className="min-h-11 rounded-full px-3 text-[14px] font-semibold text-white/60 hover:text-white">
                Revenir à mon site
              </button>
            ) : (
              <span />
            )}
            {step === "elements" ? (
              <button
                type="submit"
                disabled={busy || Boolean(disabledReason) || catalog.products === 0}
                className="inline-flex min-h-12 items-center gap-2 rounded-full bg-white px-6 text-[15px] font-semibold text-yc-night-950 shadow-[0_10px_40px_rgb(124_147_255/0.35)] transition hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-40"
              >
                <IconSparkles size={16} /> Composer mes trois sites
              </button>
            ) : (
              <button type="submit" disabled={!canNext} className="inline-flex min-h-12 items-center gap-2 rounded-full bg-white px-6 text-[15px] font-semibold text-yc-night-950 transition hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-40">
                {step === "intro" ? "Commencer" : "Continuer"} <IconArrowRight size={16} />
              </button>
            )}
          </div>
        </form>

        {/* Aperçu vivant : se construit avec les réponses et les vraies photos */}
        <div className="relative hidden min-w-0 items-center justify-center p-10 lg:flex" aria-hidden="true">
          <LiveCanvas tenantName={tenantName} logoUrl={logoUrl} brief={brief} step={step} catalog={catalog} mood={mood} reduced={reduced} />
        </div>
      </div>
    </section>
  );
}

function LiveCanvas({
  tenantName,
  logoUrl,
  brief,
  step,
  catalog,
  mood,
  reduced,
}: {
  tenantName: string;
  logoUrl: string | null;
  brief: SiteBrief;
  step: Step;
  catalog: CatalogSummary;
  mood: { font: string; bg: string; ink: string; accent: string };
  reduced: boolean;
}) {
  const subtitle = brief.activity.split(/(?<=[.!?])\s/)[0]?.slice(0, 110) ?? "";
  const photos = catalog.samples.slice(0, 6);
  const t = { duration: reduced ? 0 : 0.7, ease: [0.22, 1, 0.36, 1] as const };
  return (
    <div className="relative w-full max-w-[440px]">
      <motion.div
        className="overflow-hidden rounded-[28px] shadow-[0_40px_120px_rgb(0_0_0/0.45)] ring-1 ring-white/10"
        animate={{ backgroundColor: mood.bg, color: mood.ink }}
        transition={t}
      >
        <div className="flex items-center justify-between px-6 pt-5 text-[11px] uppercase tracking-[0.18em] opacity-60">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="" className="h-6 w-auto object-contain" />
          ) : (
            <span>{tenantName}</span>
          )}
          <span className="flex gap-3">
            {catalog.categoryNames.slice(0, 2).map((c) => (
              <span key={c}>{c}</span>
            ))}
          </span>
        </div>
        <div className="px-6 pb-6 pt-10">
          <motion.p className="text-[11px] uppercase tracking-[0.22em]" animate={{ color: mood.accent }} transition={t}>
            {brief.styles.length ? brief.styles.join(" · ") : catalog.categoryNames[0] ?? "Collection"}
          </motion.p>
          <motion.h3 className="mt-3 text-[40px] leading-[1.02] tracking-[-0.02em]" style={{ fontFamily: `${mood.font}, Georgia, serif` }} key={mood.font} initial={reduced ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={t}>
            {tenantName}
          </motion.h3>
          <AnimatePresence>
            {subtitle && (
              <motion.p className="mt-3 max-w-[32ch] text-[14px] leading-relaxed opacity-75" initial={reduced ? false : { opacity: 0 }} animate={{ opacity: 0.75 }} exit={{ opacity: 0 }}>
                {subtitle}
              </motion.p>
            )}
          </AnimatePresence>
          <motion.span className="mt-5 inline-flex rounded-full px-4 py-2 text-[12px] font-semibold text-white" animate={{ backgroundColor: mood.ink === "#FFFFFF" || mood.ink === "#F3EBDD" ? mood.accent : mood.ink }} transition={t}>
            {vocabularyOf(catalog.mode).cta}
          </motion.span>
        </div>
        <div className="grid grid-cols-3 gap-2 px-6 pb-6">
          {photos.map((p, i) => (
            <motion.div
              key={p.imageUrl}
              className="relative aspect-[4/5] overflow-hidden rounded-xl"
              style={{ background: `${mood.accent}1f` }}
              initial={reduced ? false : { opacity: 0, y: 30, scale: 0.94 }}
              animate={{ opacity: step === "intro" && i > 2 ? 0.35 : 1, y: 0, scale: 1 }}
              transition={{ ...t, delay: reduced ? 0 : 0.15 + i * 0.08 }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.imageUrl} alt="" className="h-full w-full object-contain p-2" />
            </motion.div>
          ))}
        </div>
      </motion.div>
      <p className="mt-4 text-center text-[12px] text-white/45">Aperçu d&apos;ambiance, avec vos {vocabularyOf(catalog.mode).items}. Les trois sites complets arrivent ensuite.</p>
    </div>
  );
}

function Row({ ok, title, detail, action }: { ok: boolean; title: string; detail: string; action: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-white/[0.04] px-4 py-3 ring-1 ring-inset ring-white/10">
      <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full ${ok ? "bg-[#34D399]/20 text-[#6EE7B7]" : "bg-white/10 text-white/50"}`} aria-hidden="true">
        {ok ? <IconCheck size={14} /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-semibold text-white">{title}</p>
        <p className="text-[13px] text-white/55">{detail}</p>
      </div>
      {action}
    </div>
  );
}
