"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { addDaysIso, nightsLabel } from "@/lib/hotel/labels";

/**
 * Barre de dates (élément signature) : arrivée, départ, adultes, enfants. Envoie vers
 * /chambres avec les dates : la disponibilité et le prix y sont calculés par le serveur.
 */
export function DateBar({ today, initial, maxDate, compact = false }: { today: string; initial?: { arrival: string; departure: string; adults: number; children: number }; maxDate: string; compact?: boolean }) {
  const router = useRouter();
  const id = useId();
  const [arrival, setArrival] = useState(initial?.arrival ?? addDaysIso(today, 7));
  const [departure, setDeparture] = useState(initial?.departure ?? addDaysIso(today, 9));
  const [adults, setAdults] = useState(initial?.adults ?? 2);
  const [children, setChildren] = useState(initial?.children ?? 0);
  const nights = Math.round((new Date(`${departure}T00:00:00Z`).getTime() - new Date(`${arrival}T00:00:00Z`).getTime()) / 86_400_000);
  const valid = arrival >= today && nights >= 1;
  const cell = "flex min-w-0 flex-col justify-center gap-0.5 px-4 py-2.5";
  const lab = "text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--color-text-muted)]";
  const field = "w-full min-w-0 bg-transparent text-[16px] font-semibold text-[var(--color-text-primary)] focus:outline-none";
  return (
    <form
      role="search"
      aria-label="Vos dates"
      onSubmit={(e) => {
        e.preventDefault();
        if (!valid) return;
        router.push(`/chambres?arrivee=${arrival}&depart=${departure}&adultes=${adults}&enfants=${children}`);
      }}
      className={`grid overflow-hidden rounded-[var(--radius-lg)] bg-white shadow-[var(--shadow-lg)] ring-1 ring-[var(--color-border)] ${compact ? "sm:grid-cols-[1fr_1fr_auto_auto_auto]" : "grid-cols-2 sm:grid-cols-[1fr_1fr_auto_auto_auto]"} divide-[var(--color-border)] sm:divide-x`}
    >
      <label htmlFor={`${id}-a`} className={`${cell} border-b border-[var(--color-border)] sm:border-b-0`}>
        <span className={lab}>Arrivée</span>
        <input id={`${id}-a`} type="date" required min={today} max={maxDate} value={arrival} onChange={(e) => { const v = e.target.value; setArrival(v); if (v >= departure) setDeparture(addDaysIso(v, 1)); }} className={field} />
      </label>
      <label htmlFor={`${id}-d`} className={`${cell} border-b border-l border-[var(--color-border)] sm:border-b-0 sm:border-l-0`}>
        <span className={lab}>Départ</span>
        <input id={`${id}-d`} type="date" required min={addDaysIso(arrival, 1)} max={maxDate} value={departure} onChange={(e) => setDeparture(e.target.value)} className={field} />
      </label>
      <label htmlFor={`${id}-ad`} className={cell}>
        <span className={lab}>Adultes</span>
        <select id={`${id}-ad`} value={adults} onChange={(e) => setAdults(Number(e.target.value))} className={field}>{[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n}</option>)}</select>
      </label>
      <label htmlFor={`${id}-ch`} className={`${cell} border-l border-[var(--color-border)] sm:border-l-0`}>
        <span className={lab}>Enfants</span>
        <select id={`${id}-ch`} value={children} onChange={(e) => setChildren(Number(e.target.value))} className={field}>{[0, 1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}</option>)}</select>
      </label>
      <div className="col-span-2 flex items-center p-2 sm:col-span-1">
        <button type="submit" disabled={!valid} className="inline-flex h-14 w-full flex-col items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-accent-primary)] px-7 text-white transition-transform hover:-translate-y-0.5 disabled:opacity-50">
          <span className="text-[15px] font-semibold">Voir les chambres</span>
          <span className="text-[11.5px] text-white/80">{valid ? nightsLabel(nights) : "Dates à revoir"}</span>
        </button>
      </div>
    </form>
  );
}
