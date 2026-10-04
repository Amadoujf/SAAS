"use client";

import { usePrefersReducedMotion } from "@/lib/motion/animation-level-context";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { IconCheck, IconGlobe } from "@/components/yc/icons";

const STEPS = [
  { title: "Choisissez votre secteur", text: "Mode, restauration, beauté… les modules adaptés s'activent seuls." },
  { title: "Adoptez un template", text: "Une direction artistique complète, pas une simple palette." },
  { title: "Ajoutez vos produits", text: "Photos, variantes, stock : tout se met en page automatiquement." },
  { title: "Publiez et vendez", text: "Votre boutique est en ligne ; les commandes arrivent." },
];
const DURATION = 3200;

/** Démonstration animée de la création d'une boutique, rejouée en boucle. Chaque
 *  étape est aussi cliquable (et au clavier) ; figée sur l'étape choisie quand les
 *  animations sont réduites. */
export function BuilderDemo() {
  const reduce = usePrefersReducedMotion();
  const [step, setStep] = useState(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (reduce || paused) return;
    const id = setTimeout(() => setStep((s) => (s + 1) % STEPS.length), DURATION);
    return () => clearTimeout(id);
  }, [step, reduce, paused]);

  return (
    <div className="grid items-center gap-10 lg:grid-cols-[1.25fr_1fr]" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      {/* Navigateur simulé */}
      <div className="relative overflow-hidden rounded-xl bg-white shadow-[0_40px_90px_-40px_rgb(12_22_48/0.45)] ring-1 ring-yc-ink/10" aria-hidden="true">
        <div className="flex items-center gap-2 border-b border-yc-ink/5 bg-yc-ivory-50 px-4 py-3">
          <span className="flex gap-1.5">{["#ff5f57", "#febc2e", "#28c840"].map((c) => <span key={c} className="h-3 w-3 rounded-full" style={{ background: c }} />)}</span>
          <span className="mx-auto flex max-w-[70%] items-center gap-2 truncate rounded-full bg-white px-3 py-1 text-xs text-yc-ink-soft ring-1 ring-yc-ink/5">
            <IconGlobe size={12} /> {step === 3 ? "boutique-aida.yamacommerce.ai" : "app.yamacommerce.ai/creer"}
          </span>
        </div>
        <div className="relative h-[340px] sm:h-[380px]">
          <AnimatePresence mode="wait">
            <motion.div key={step} className="absolute inset-0 p-6 sm:p-8" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}>
              {step === 0 && (
                <div>
                  <p className="font-display text-xl font-semibold text-yc-ink">Quel est votre secteur ?</p>
                  <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {["Mode & vêtements", "Restauration", "Beauté", "Épicerie", "Électronique", "Maison"].map((s, i) => (
                      <motion.div key={s} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: i === 0 ? [1, 1.06, 1] : 1 }} transition={{ delay: i * 0.06, duration: 0.5 }}
                        className={`rounded-2xl p-4 text-sm font-semibold ${i === 0 ? "bg-yc-navy text-white ring-2 ring-yc-royal" : "bg-yc-ivory-100 text-yc-ink"}`}>
                        {s}
                        {i === 0 && <span className="mt-2 flex items-center gap-1 text-xs font-medium text-[#8FA9EE]"><IconCheck size={13} /> Choisi</span>}
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}
              {step === 1 && (
                <div className="grid h-full grid-cols-3 gap-3">
                  {[
                    { bg: "#FBF6EC", ink: "#2C3A63", acc: "#C1622D", name: "Teranga Atelier", serif: true },
                    { bg: "#16181D", ink: "#FFFFFF", acc: "#FF5A1F", name: "Sunu Kicks", serif: false },
                    { bg: "#F8F2E8", ink: "#1B140F", acc: "#A8823F", name: "Maison Almadies", serif: true },
                  ].map((t, i) => (
                    <motion.div key={t.name} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0, scale: i === 0 ? 1.04 : 0.97 }} transition={{ delay: i * 0.12 }}
                      className={`flex flex-col overflow-hidden rounded-2xl ${i === 0 ? "ring-2 ring-yc-royal shadow-yc-float" : "opacity-70"}`} style={{ background: t.bg, color: t.ink }}>
                      <div className="h-1/2" style={{ background: `linear-gradient(135deg, ${t.acc}55, ${t.ink}22)` }} />
                      <div className="p-3">
                        <p className={`text-sm font-semibold ${t.serif ? "font-serif" : ""}`}>{t.name}</p>
                        <p className="mt-2 h-1.5 w-2/3 rounded-full" style={{ background: t.acc }} />
                        <p className="mt-1.5 h-1.5 w-1/2 rounded-full opacity-30" style={{ background: t.ink }} />
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
              {step === 2 && (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {["boubou", "sac-wax", "sandales", "bracelet"].map((img, i) => (
                    <motion.div key={img} initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 + i * 0.15 }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`/demo-commerce/${img}.svg`} alt="" className="aspect-[4/5] w-full rounded-2xl object-cover" loading="lazy" />
                      <p className="mt-2 h-2 w-3/4 rounded-full bg-yc-ink/15" />
                      <p className="mt-1.5 h-2 w-1/3 rounded-full bg-yc-royal/40" />
                    </motion.div>
                  ))}
                </div>
              )}
              {step === 3 && (
                <div className="flex h-full flex-col items-center justify-center text-center">
                  <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 260, damping: 16 }} className="grid h-16 w-16 place-items-center rounded-full bg-yc-royal text-white shadow-[0_20px_50px_-12px_rgb(12_61_186/0.7)]">
                    <IconCheck size={30} />
                  </motion.span>
                  <p className="mt-5 font-display text-2xl font-semibold text-yc-ink">Boutique Aïda est en ligne</p>
                  <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }} className="mt-5 flex items-center gap-3 rounded-2xl bg-yc-ivory-100 px-4 py-3 text-left">
                    <span className="grid h-9 w-9 place-items-center rounded-xl bg-yc-navy text-xs font-bold text-white">+1</span>
                    <span><span className="block text-sm font-semibold text-yc-ink">Première commande</span><span className="block text-xs text-yc-ink-soft">Fatou N. · 45 000 FCFA · Wave</span></span>
                  </motion.div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
      {/* Étapes */}
      <ol className="flex flex-col gap-2">
        {STEPS.map((s, i) => (
          <li key={s.title}>
            <button type="button" onClick={() => setStep(i)} aria-current={i === step ? "step" : undefined}
              className={`yc-focus relative w-full overflow-hidden rounded-2xl p-5 text-left transition-colors duration-300 ${i === step ? "bg-white shadow-yc ring-1 ring-yc-ink/5" : "hover:bg-white/60"}`}>
              <span className="flex items-start gap-4">
                <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full font-display text-sm font-bold transition-colors ${i === step ? "bg-yc-navy text-white" : i < step ? "bg-yc-royal/10 text-yc-royal" : "bg-yc-ink/5 text-yc-ink-soft"}`}>
                  {i < step ? <IconCheck size={16} /> : i + 1}
                </span>
                <span>
                  <span className="block font-display text-lg font-semibold text-yc-ink">{s.title}</span>
                  <span className={`block text-sm text-yc-ink-soft transition-all duration-300 ${i === step ? "max-h-20 opacity-100" : "max-h-0 opacity-0 lg:max-h-20 lg:opacity-60"}`}>{s.text}</span>
                </span>
              </span>
              {i === step && !reduce && !paused && (
                <motion.span key={`bar-${step}`} className="absolute bottom-0 left-0 h-[3px] bg-yc-royal" initial={{ width: "0%" }} animate={{ width: "100%" }} transition={{ duration: DURATION / 1000, ease: "linear" }} />
              )}
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}
