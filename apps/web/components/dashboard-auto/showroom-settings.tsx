"use client";

import { useState } from "react";
import { Button } from "@/components/yc/button";
import { WEEKDAYS } from "@/lib/auto/labels";
import { Feedback, section, useAutoAction } from "./shared";

type Range = { weekday: number; startMinute: number; endMinute: number };
export interface ShowroomDraft { openingHours: Range[]; testDriveMinutes: number; slotStepMinutes: 15 | 30 | 60; maxAdvanceDays: number; depositPercent: number }

const hhmm = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const mins = (v: string, end = false) => {
  const [h, m] = v.split(":").map(Number);
  const t = (h ?? 0) * 60 + (m ?? 0);
  return end && t === 0 ? 1440 : t;
};

/** Horaires du showroom (créneaux d'essai) et règles de vente. */
export function ShowroomSettings({ initial }: { initial: ShowroomDraft }) {
  const a = useAutoAction();
  const [f, setF] = useState(initial);
  const rangesOf = (d: number) => f.openingHours.filter((h) => h.weekday === d).sort((x, y) => x.startMinute - y.startMinute);
  const setDay = (d: number, ranges: Range[]) => setF({ ...f, openingHours: [...f.openingHours.filter((h) => h.weekday !== d), ...ranges] });
  const num = "h-11 w-full rounded-lg bg-white px-3 text-sm ring-1 ring-inset ring-yc-ink/12";
  return (
    <form className="grid gap-5 pb-24" onSubmit={(e) => { e.preventDefault(); a.run({ action: "settings", settings: f }, "Réglages du showroom enregistrés."); }}>
      <section className={section} aria-labelledby="horaires">
        <h2 id="horaires" className="text-[18px] font-bold tracking-[-0.015em]">Horaires du showroom</h2>
        <p className="mt-1 text-sm text-yc-ink-soft">Les essais ne se réservent en ligne que dans ces horaires, au plus tôt deux heures à l&apos;avance.</p>
        <ul className="mt-4 divide-y divide-yc-ink/[0.06]">
          {[1, 2, 3, 4, 5, 6, 0].map((d) => {
            const r = rangesOf(d);
            return (
              <li key={d} className="flex flex-wrap items-center gap-3 py-3">
                <span className="w-24 text-sm font-semibold">{WEEKDAYS[d]}</span>
                {r.length === 0 && <span className="text-sm text-yc-ink-soft">Fermé</span>}
                {r.map((x, i) => (
                  <span key={i} className="flex items-center gap-1.5 text-sm">
                    <input aria-label={`${WEEKDAYS[d]} plage ${i + 1} début`} type="time" step={900} value={hhmm(x.startMinute)} onChange={(e) => setDay(d, r.map((y, k) => (k === i ? { ...y, startMinute: mins(e.target.value) } : y)))} className="h-9 rounded-lg bg-white px-2 ring-1 ring-inset ring-yc-ink/12" />
                    –
                    <input aria-label={`${WEEKDAYS[d]} plage ${i + 1} fin`} type="time" step={900} value={hhmm(x.endMinute)} onChange={(e) => setDay(d, r.map((y, k) => (k === i ? { ...y, endMinute: mins(e.target.value, true) } : y)))} className="h-9 rounded-lg bg-white px-2 ring-1 ring-inset ring-yc-ink/12" />
                    <button type="button" aria-label={`Retirer la plage ${i + 1} du ${WEEKDAYS[d]}`} onClick={() => setDay(d, r.filter((_, k) => k !== i))} className="px-1 text-yc-ink-soft hover:text-yc-danger">✕</button>
                  </span>
                ))}
                {r.length < 2 && <button type="button" onClick={() => setDay(d, [...r, r.length ? { weekday: d, startMinute: 15 * 60, endMinute: 18 * 60 } : { weekday: d, startMinute: 8 * 60 + 30, endMinute: 18 * 60 + 30 }])} className="text-sm font-semibold text-yc-electric hover:underline">+ {r.length ? "seconde plage" : "ouvrir"}</button>}
              </li>
            );
          })}
        </ul>
      </section>
      <section className={section} aria-labelledby="regles">
        <h2 id="regles" className="text-[18px] font-bold tracking-[-0.015em]">Essais et ventes</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-4">
          <label className="grid gap-1.5 text-[13px] font-semibold">Durée d&apos;un essai<select value={f.testDriveMinutes} onChange={(e) => setF({ ...f, testDriveMinutes: Number(e.target.value) })} className={num}>{[30, 45, 60, 90].map((v) => <option key={v} value={v}>{v} min</option>)}</select></label>
          <label className="grid gap-1.5 text-[13px] font-semibold">Créneaux toutes les<select value={f.slotStepMinutes} onChange={(e) => setF({ ...f, slotStepMinutes: Number(e.target.value) as 15 | 30 | 60 })} className={num}>{[15, 30, 60].map((v) => <option key={v} value={v}>{v} min</option>)}</select></label>
          <label className="grid gap-1.5 text-[13px] font-semibold">Réservable jusqu&apos;à (jours)<input type="number" min={1} max={180} value={f.maxAdvanceDays} onChange={(e) => setF({ ...f, maxAdvanceDays: Number(e.target.value) })} className={num} /></label>
          <label className="grid gap-1.5 text-[13px] font-semibold">Acompte conseillé (%)<input type="number" min={0} max={100} value={f.depositPercent} onChange={(e) => setF({ ...f, depositPercent: Number(e.target.value) })} className={num} /></label>
        </div>
        <p className="mt-3 text-xs text-yc-ink-soft">L&apos;acompte est indiqué sur le site et au dossier de vente ; il se règle au showroom (aucun paiement en ligne).</p>
      </section>
      <div className="fixed inset-x-0 bottom-[68px] z-30 border-t border-yc-ink/10 bg-white/95 px-4 py-3 backdrop-blur lg:static lg:border-0 lg:bg-transparent lg:p-0">
        <Button type="submit" variant="royal" loading={a.pending}>Enregistrer</Button>
        <Feedback error={a.error} notice={a.notice} />
      </div>
    </form>
  );
}
