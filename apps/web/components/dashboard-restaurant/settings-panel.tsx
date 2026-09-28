"use client";

import { useState } from "react";
import { Button } from "@/components/yc/button";
import { WEEKDAYS } from "@/lib/restaurant/labels";
import { Feedback, section, useRestoAction } from "./shared";

type Range = { weekday: number; startMinute: number; endMinute: number };
export interface SettingsDraft {
  openingHours: Range[];
  acceptTakeaway: boolean;
  acceptDelivery: boolean;
  acceptDineInQr: boolean;
  acceptBookings: boolean;
  deliveryFee: number;
  minDeliveryOrder: number;
  prepMinutes: number;
  maxCoversPerSlot: number;
  bookingSlotMinutes: 15 | 30 | 60;
  bookingDuration: number;
  maxPartySize: number;
}

const hhmm = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const mins = (v: string, end = false) => {
  const [h, m] = v.split(":").map(Number);
  const x = (h ?? 0) * 60 + (m ?? 0);
  return end && x === 0 ? 1440 : x;
};

/** Horaires d'ouverture (jusqu'à deux services par jour) et règles de commande et de réservation. */
export function RestaurantSettingsPanel({ initial }: { initial: SettingsDraft }) {
  const a = useRestoAction();
  const [f, setF] = useState(initial);
  const days = [1, 2, 3, 4, 5, 6, 0];
  const rangesOf = (d: number) => f.openingHours.filter((h) => h.weekday === d).sort((x, y) => x.startMinute - y.startMinute);
  const setDay = (d: number, ranges: Range[]) => setF({ ...f, openingHours: [...f.openingHours.filter((h) => h.weekday !== d), ...ranges] });
  const num = "h-11 w-full rounded-xl bg-white px-3 text-sm ring-1 ring-inset ring-yc-ink/12";
  return (
    <form className="grid gap-5 pb-24" onSubmit={(e) => { e.preventDefault(); a.run({ action: "save_settings", settings: f }, "Horaires et règles enregistrés."); }}>
      <section className={section} aria-labelledby="horaires">
        <h2 id="horaires" className="text-[18px] font-bold tracking-[-0.015em]">Horaires d&apos;ouverture</h2>
        <p className="mt-1 text-sm text-yc-ink-soft">Hors de ces horaires, le site n&apos;accepte ni commande immédiate ni réservation.</p>
        <ul className="mt-4 divide-y divide-yc-ink/[0.06]">
          {days.map((d) => {
            const r = rangesOf(d);
            return (
              <li key={d} className="flex flex-wrap items-center gap-3 py-3">
                <span className="w-24 text-sm font-semibold">{WEEKDAYS[d]}</span>
                {r.length === 0 && <span className="text-sm text-yc-ink-soft">Fermé</span>}
                {r.map((x, i) => (
                  <span key={i} className="flex items-center gap-1.5 text-sm">
                    <input aria-label={`${WEEKDAYS[d]} service ${i + 1} début`} type="time" step={900} value={hhmm(x.startMinute)} onChange={(e) => setDay(d, r.map((y, k) => (k === i ? { ...y, startMinute: mins(e.target.value) } : y)))} className="h-9 rounded-lg bg-white px-2 ring-1 ring-inset ring-yc-ink/12" />
                    –
                    <input aria-label={`${WEEKDAYS[d]} service ${i + 1} fin`} type="time" step={900} value={hhmm(x.endMinute)} onChange={(e) => setDay(d, r.map((y, k) => (k === i ? { ...y, endMinute: mins(e.target.value, true) } : y)))} className="h-9 rounded-lg bg-white px-2 ring-1 ring-inset ring-yc-ink/12" />
                    <button type="button" aria-label={`Retirer le service ${i + 1} du ${WEEKDAYS[d]}`} onClick={() => setDay(d, r.filter((_, k) => k !== i))} className="px-1 text-yc-ink-soft hover:text-yc-danger">✕</button>
                  </span>
                ))}
                {r.length < 2 && <button type="button" onClick={() => setDay(d, [...r, r.length ? { weekday: d, startMinute: 19 * 60, endMinute: 23 * 60 } : { weekday: d, startMinute: 12 * 60, endMinute: 15 * 60 }])} className="text-sm font-semibold text-yc-electric hover:underline">+ {r.length ? "second service" : "ouvrir"}</button>}
              </li>
            );
          })}
        </ul>
      </section>

      <section className={section} aria-labelledby="commandes">
        <h2 id="commandes" className="text-[18px] font-bold tracking-[-0.015em]">Commandes en ligne</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {([["acceptTakeaway", "À emporter"], ["acceptDelivery", "Livraison"], ["acceptDineInQr", "À table par QR code"]] as const).map(([k, l]) => (
            <label key={k} className="flex items-center gap-2.5 text-sm font-medium"><input type="checkbox" checked={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.checked })} className="h-4 w-4 accent-yc-royal" /> {l}</label>
          ))}
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <label className="grid gap-1.5 text-[13px] font-semibold">Temps de préparation annoncé (min)<input type="number" min={5} max={240} value={f.prepMinutes} onChange={(e) => setF({ ...f, prepMinutes: Number(e.target.value) })} className={num} /></label>
          <label className="grid gap-1.5 text-[13px] font-semibold">Frais de livraison (FCFA)<input type="number" min={0} max={100000} step={100} value={f.deliveryFee} onChange={(e) => setF({ ...f, deliveryFee: Number(e.target.value) })} className={num} /></label>
          <label className="grid gap-1.5 text-[13px] font-semibold">Livraison à partir de (FCFA)<input type="number" min={0} step={500} value={f.minDeliveryOrder} onChange={(e) => setF({ ...f, minDeliveryOrder: Number(e.target.value) })} className={num} /></label>
        </div>
      </section>

      <section className={section} aria-labelledby="resa">
        <h2 id="resa" className="text-[18px] font-bold tracking-[-0.015em]">Réservations de table</h2>
        <label className="mt-4 flex items-center gap-2.5 text-sm font-medium"><input type="checkbox" checked={f.acceptBookings} onChange={(e) => setF({ ...f, acceptBookings: e.target.checked })} className="h-4 w-4 accent-yc-royal" /> Accepter les réservations en ligne</label>
        <div className="mt-4 grid gap-4 sm:grid-cols-4">
          <label className="grid gap-1.5 text-[13px] font-semibold">Arrivées par créneau (couverts)<input type="number" min={1} max={1000} value={f.maxCoversPerSlot} onChange={(e) => setF({ ...f, maxCoversPerSlot: Number(e.target.value) })} className={num} /></label>
          <label className="grid gap-1.5 text-[13px] font-semibold">Créneaux toutes les
            <select value={f.bookingSlotMinutes} onChange={(e) => setF({ ...f, bookingSlotMinutes: Number(e.target.value) as 15 | 30 | 60 })} className={num}>{[15, 30, 60].map((v) => <option key={v} value={v}>{v} min</option>)}</select>
          </label>
          <label className="grid gap-1.5 text-[13px] font-semibold">Durée d&apos;une table
            <select value={f.bookingDuration} onChange={(e) => setF({ ...f, bookingDuration: Number(e.target.value) })} className={num}>{[60, 75, 90, 105, 120, 150, 180].map((v) => <option key={v} value={v}>{Math.floor(v / 60)} h{v % 60 ? String(v % 60).padStart(2, "0") : ""}</option>)}</select>
          </label>
          <label className="grid gap-1.5 text-[13px] font-semibold">Groupe max en ligne<input type="number" min={1} max={60} value={f.maxPartySize} onChange={(e) => setF({ ...f, maxPartySize: Number(e.target.value) })} className={num} /></label>
        </div>
        <p className="mt-3 text-sm text-yc-ink-soft">Le site ne propose une heure que s&apos;il reste de la place à la fois dans le créneau et dans la salle (places des tables actives, pendant la durée d&apos;une table).</p>
      </section>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-yc-ink/10 bg-white/95 px-5 py-3 backdrop-blur lg:left-[268px]">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
          <div className="min-w-0 text-sm"><Feedback error={a.error} notice={a.notice} /></div>
          <Button type="submit" variant="royal" loading={a.pending}>Enregistrer</Button>
        </div>
      </div>
    </form>
  );
}
