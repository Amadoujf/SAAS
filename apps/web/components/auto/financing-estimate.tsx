"use client";

import { useState } from "react";
import { formatNumber, monthlyEstimate } from "@/lib/auto/labels";

/**
 * Simulation INDICATIVE de mensualité : apport, durée et taux choisis par le visiteur.
 * Ce n'est pas une offre de crédit — la concession étudie le dossier avec le client.
 */
export function FinancingEstimate({ price }: { price: number }) {
  const [down, setDown] = useState(Math.round(price * 0.3));
  const [months, setMonths] = useState(36);
  const [rate, setRate] = useState(9);
  const monthly = monthlyEstimate(price, down, months, rate);
  const range = "mt-2 w-full accent-[var(--color-accent-primary)]";
  return (
    <section aria-labelledby="simulation" className="bg-[var(--color-surface)] p-5 ring-1 ring-[var(--color-border)] sm:p-6">
      <h2 id="simulation" className="text-[12px] font-extrabold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Simulation indicative</h2>
      <p className="yc-num mt-2 text-[34px] font-black leading-none tracking-[-0.03em]">{formatNumber(monthly)} <span className="text-[15px] font-bold">FCFA / mois</span></p>
      <div className="mt-5 grid gap-4 text-[14px]">
        <label className="block font-semibold">
          <span className="flex justify-between"><span>Apport</span><span className="yc-num">{formatNumber(down)} FCFA</span></span>
          <input type="range" min={0} max={price} step={Math.max(50_000, Math.round(price / 100 / 50_000) * 50_000)} value={down} onChange={(e) => setDown(Number(e.target.value))} className={range} />
        </label>
        <label className="block font-semibold">
          <span className="flex justify-between"><span>Durée</span><span className="yc-num">{months} mois</span></span>
          <input type="range" min={12} max={72} step={12} value={months} onChange={(e) => setMonths(Number(e.target.value))} className={range} />
        </label>
        <label className="block font-semibold">
          <span className="flex justify-between"><span>Taux annuel supposé</span><span className="yc-num">{rate} %</span></span>
          <input type="range" min={0} max={18} step={0.5} value={rate} onChange={(e) => setRate(Number(e.target.value))} className={range} />
        </label>
      </div>
      <p className="mt-4 text-[12.5px] leading-relaxed text-[var(--color-text-muted)]">Calcul à titre indicatif avec les valeurs que vous choisissez. Ce n&apos;est pas une offre de crédit : le financement réel dépend de votre banque et de votre dossier.</p>
    </section>
  );
}
