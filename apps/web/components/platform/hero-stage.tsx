"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { IconCheck, IconTruck, IconWallet } from "@/components/yc/icons";

/** Scène du héros : un téléphone affiche une boutique réelle (visuels de démo
 *  locaux), tandis que les événements d'une vraie commande s'enchaînent autour —
 *  commande reçue, paiement Wave vérifié, livraison. Figée si l'utilisateur réduit
 *  les animations. */
const EVENTS = [
  { icon: <span className="font-display text-[13px] font-bold">+1</span>, tone: "from-yc-electric to-yc-violet", title: "Nouvelle commande", text: "CMD-2026-000124 · 45 000 FCFA" },
  { icon: <IconWallet size={16} />, tone: "from-[#1dc4ff] to-[#1a8cff]", title: "Paiement Wave vérifié", text: "Référence 8K2H4Z9Q" },
  { icon: <IconTruck size={16} />, tone: "from-yc-cyan to-emerald-400", title: "Livrée à Mermoz", text: "Modou · 38 min" },
];

const PRODUCTS = [
  { img: "/demo-commerce/boubou.svg", name: "Boubou brodé", price: "45 000" },
  { img: "/demo-commerce/sac-wax.svg", name: "Cabas wax", price: "22 000" },
  { img: "/demo-commerce/sandales.svg", name: "Sandales Ngor", price: "18 500" },
  { img: "/demo-commerce/huile.svg", name: "Huile karité", price: "7 500" },
];

export function HeroStage() {
  const reduce = useReducedMotion();
  const [step, setStep] = useState(reduce ? EVENTS.length : 0);
  useEffect(() => {
    if (reduce) return;
    const id = setInterval(() => setStep((s) => (s >= EVENTS.length + 1 ? 0 : s + 1)), 1800);
    return () => clearInterval(id);
  }, [reduce]);

  return (
    <div className="relative mx-auto h-[540px] w-full max-w-[520px] sm:h-[600px]" aria-hidden="true">
      <div className="absolute left-1/2 top-1/2 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgb(59_91_255/0.45),transparent_65%)] blur-2xl" />
      {/* Téléphone */}
      <div className="yc-float absolute left-1/2 top-4 w-[270px] -translate-x-1/2 rounded-[44px] bg-gradient-to-b from-white/25 to-white/5 p-[10px] shadow-[0_40px_120px_-30px_rgb(34_211_238/0.5)] ring-1 ring-white/20 sm:w-[290px]">
        <div className="overflow-hidden rounded-[36px] bg-[#fbf7f0]">
          <div className="flex items-center justify-between px-5 pb-2 pt-4 text-[11px] font-semibold text-[#1d2958]">
            <span>9:41</span><span className="h-5 w-20 rounded-full bg-black" /><span>5G</span>
          </div>
          <div className="px-4 pb-4">
            <p className="font-display text-lg font-semibold text-[#1d2958]">Boutique Aïda</p>
            <div className="mt-1 flex gap-1.5 text-[9px] font-semibold">
              {["Tout", "Mode", "Maison", "Beauté"].map((c, i) => (
                <span key={c} className={`rounded-full px-2 py-1 ${i === 0 ? "bg-[#1d2958] text-white" : "bg-[#1d2958]/5 text-[#1d2958]"}`}>{c}</span>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2.5">
              {PRODUCTS.map((p) => (
                <div key={p.name}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.img} alt="" className="aspect-[4/5] w-full rounded-2xl object-cover" loading="eager" />
                  <p className="mt-1 truncate text-[10px] font-semibold text-[#1d2958]">{p.name}</p>
                  <p className="text-[10px] text-[#1d2958]/60">{p.price} F</p>
                </div>
              ))}
            </div>
            <div className="mt-3 rounded-full bg-[#0f766e] py-2.5 text-center text-[11px] font-semibold text-white">Commander · 2 articles</div>
          </div>
        </div>
      </div>
      {/* Flux d'événements réels d'une commande */}
      <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-2.5 sm:bottom-6 sm:items-end">
        <AnimatePresence initial={false}>
          {EVENTS.slice(0, Math.min(step, EVENTS.length)).map((e) => (
            <motion.div
              key={e.title}
              layout
              initial={{ opacity: 0, y: 24, scale: 0.94 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ type: "spring", stiffness: 300, damping: 26 }}
              className="flex w-[290px] items-center gap-3 rounded-2xl bg-white/[0.08] p-3 text-left text-white shadow-yc-float ring-1 ring-inset ring-white/15 backdrop-blur-xl sm:mr-[-12px]"
            >
              <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br text-white ${e.tone}`}>{e.icon}</span>
              <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{e.title}</span><span className="block truncate text-xs text-white/60">{e.text}</span></span>
              <IconCheck size={16} className="text-yc-cyan" />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
