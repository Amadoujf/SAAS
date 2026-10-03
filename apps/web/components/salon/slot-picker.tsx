"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { clockLabel, dayChip } from "@/lib/salon/labels";

export interface Slot {
  startAt: string;
  minute: number;
  staffIds: string[];
}

const PERIODS = [
  { label: "Matin", test: (m: number) => m < 12 * 60 },
  { label: "Après-midi", test: (m: number) => m >= 12 * 60 && m < 17 * 60 },
  { label: "Soir", test: (m: number) => m >= 17 * 60 },
];

/**
 * Bande des jours (horaires libres comptés par le serveur) puis horaires du jour choisi,
 * groupés matin / après-midi / soir. Tout vient de l'API : rien n'est présumé libre.
 */
export function SlotPicker({
  service,
  staffId,
  today,
  value,
  onChange,
}: {
  service: string;
  staffId: string | null;
  /** Date locale du salon (AAAA-MM-JJ). */
  today: string;
  value: Slot | null;
  onChange: (slot: Slot | null) => void;
}) {
  const [days, setDays] = useState<{ date: string; count: number }[] | null>(null);
  const [date, setDate] = useState<string | null>(null);
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const strip = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    setDays(null);
    setSlots(null);
    setError(null);
    const q = new URLSearchParams({ service, from: today, ...(staffId ? { staff: staffId } : {}) });
    fetch(`/api/storefront/salon/days?${q}`)
      .then(async (r) => {
        const j = (await r.json()) as { data?: { date: string; count: number }[]; error?: string };
        if (!r.ok || !j.data) throw new Error(j.error ?? "Calendrier indisponible.");
        if (!alive) return;
        setDays(j.data);
        const first = j.data.find((d) => d.count > 0)?.date ?? null;
        setDate((current) => (current && j.data!.some((d) => d.date === current && d.count > 0) ? current : first));
      })
      .catch((e: Error) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [service, staffId, today]);

  useEffect(() => {
    if (!date) return;
    let alive = true;
    setSlots(null);
    const q = new URLSearchParams({ service, date, ...(staffId ? { staff: staffId } : {}) });
    fetch(`/api/storefront/salon/slots?${q}`)
      .then(async (r) => {
        const j = (await r.json()) as { data?: Slot[]; error?: string };
        if (!r.ok || !j.data) throw new Error(j.error ?? "Horaires indisponibles.");
        if (alive) setSlots(j.data);
      })
      .catch((e: Error) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [service, staffId, date]);

  const grouped = useMemo(() => PERIODS.map((p) => ({ ...p, items: (slots ?? []).filter((s) => p.test(s.minute)) })).filter((p) => p.items.length), [slots]);
  const anyOpen = days?.some((d) => d.count > 0);

  if (error) return <p role="alert" className="rounded-[var(--radius-md)] bg-[color-mix(in_srgb,var(--color-danger)_8%,white)] px-4 py-3 text-sm font-medium text-[var(--color-danger)]">{error}</p>;

  return (
    <div>
      <div className="relative">
        <div ref={strip} role="radiogroup" aria-label="Jour du rendez-vous" className="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-2">
          {(days ?? Array.from({ length: 10 }, (_, i) => ({ date: `…${i}`, count: -1 }))).map((d) => {
            if (d.count < 0) return <span key={d.date} className="h-[84px] w-[64px] shrink-0 animate-pulse rounded-[var(--radius-md)] bg-[var(--color-surface)] motion-reduce:animate-none" />;
            const chip = dayChip(d.date, today);
            const selected = d.date === date;
            const full = d.count === 0;
            return (
              <button
                key={d.date}
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={full}
                aria-label={`${chip.top} ${chip.num} ${chip.month} — ${full ? "complet" : `${d.count} horaire${d.count > 1 ? "s" : ""} libre${d.count > 1 ? "s" : ""}`}`}
                onClick={() => {
                  setDate(d.date);
                  onChange(null);
                }}
                className={`flex h-[84px] w-[64px] shrink-0 snap-start flex-col items-center justify-center rounded-[var(--radius-md)] text-center ring-1 ring-inset transition-colors ${
                  selected ? "bg-[var(--color-primary)] text-white ring-[var(--color-primary)]" : full ? "cursor-not-allowed text-[var(--color-text-muted)] opacity-45 ring-[var(--color-border)]" : "bg-white ring-[var(--color-border)] hover:ring-[var(--color-text-muted)]"
                }`}
              >
                <span className="text-[11px] font-semibold uppercase tracking-[0.1em] opacity-80">{chip.top}</span>
                <span className="font-[family-name:var(--font-heading)] text-[26px] leading-none">{chip.num}</span>
                <span className="text-[10.5px] opacity-70">{full ? "complet" : chip.month}</span>
              </button>
            );
          })}
        </div>
      </div>

      {days && !anyOpen && <p className="mt-4 text-[15px] text-[var(--color-text-secondary)]">Aucun horaire libre sur les deux prochaines semaines{staffId ? " avec cette personne : essayez « sans préférence »" : ""}. Appelez le salon, il trouvera une solution.</p>}

      {date && (
        <div className="mt-5 min-h-[120px]" aria-live="polite">
          {slots == null ? (
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">{Array.from({ length: 8 }, (_, i) => <span key={i} className="h-11 animate-pulse rounded-[var(--radius-full)] bg-[var(--color-surface)] motion-reduce:animate-none" />)}</div>
          ) : slots.length === 0 ? (
            <p className="text-[15px] text-[var(--color-text-secondary)]">Plus d&apos;horaire libre ce jour-là. Choisissez une autre date.</p>
          ) : (
            <div className="grid gap-5">
              {grouped.map((p) => (
                <fieldset key={p.label}>
                  <legend className="mb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--color-text-muted)]">{p.label}</legend>
                  <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                    {p.items.map((s) => {
                      const on = value?.startAt === s.startAt;
                      return (
                        <button
                          key={s.startAt}
                          type="button"
                          aria-pressed={on}
                          onClick={() => onChange(on ? null : s)}
                          className={`h-11 rounded-[var(--radius-full)] text-[14px] font-semibold tabular-nums ring-1 ring-inset transition-colors ${on ? "bg-[var(--color-accent-primary)] text-white ring-[var(--color-accent-primary)]" : "bg-white ring-[var(--color-border)] hover:ring-[var(--color-accent-primary)]"}`}
                        >
                          {clockLabel(s.minute)}
                        </button>
                      );
                    })}
                  </div>
                </fieldset>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
