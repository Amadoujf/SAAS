"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { addDaysIso, formatXof, guestsLabel, nightsLabel, shortDate } from "@/lib/hotel/labels";

interface Day {
  date: string;
  free: number;
  price: number | null;
}

const WEEK = ["lun.", "mar.", "mer.", "jeu.", "ven.", "sam.", "dim."];
const monthStart = (iso: string) => `${iso.slice(0, 7)}-01`;
const addMonths = (iso: string, n: number) => {
  const d = new Date(`${iso.slice(0, 7)}-01T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 10);
};
const input = "h-12 w-full rounded-[var(--radius-sm)] bg-white px-3.5 text-[15px] ring-1 ring-inset ring-[var(--color-border)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]";
const labelCls = "grid gap-1.5 text-[13px] font-semibold";

/**
 * Calendrier sur deux mois (chambres libres et prix de chaque nuit, fournis par le
 * serveur) : un clic pour l'arrivée, un second pour le départ — seules des nuits
 * disponibles peuvent être sélectionnées. Puis voyageurs et coordonnées. Le prix final
 * est recalculé par le serveur à l'envoi ; rien n'est débité en ligne.
 */
export function StayPlanner({
  type,
  today,
  maxDate,
  initial,
  minNights,
  maxAdults,
  maxChildren,
  depositPercent,
  autoConfirm,
  payWays,
}: {
  type: string;
  today: string;
  maxDate: string;
  initial: { arrival: string | null; departure: string | null; adults: number; children: number };
  minNights: number;
  maxAdults: number;
  maxChildren: number;
  depositPercent: number;
  autoConfirm: boolean;
  payWays: string[];
}) {
  const router = useRouter();
  const [month, setMonth] = useState(monthStart(initial.arrival ?? today));
  const [days, setDays] = useState<Map<string, Day>>(new Map());
  const [loading, setLoading] = useState(true);
  const [arrival, setArrival] = useState<string | null>(initial.arrival);
  const [departure, setDeparture] = useState<string | null>(initial.departure);
  const [adults, setAdults] = useState(Math.min(initial.adults, maxAdults));
  const [children, setChildren] = useState(Math.min(initial.children, maxChildren));
  const [state, setState] = useState<"idle" | "sending">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    const from = month < today ? today : month;
    fetch(`/api/storefront/hotel/calendar?type=${encodeURIComponent(type)}&from=${from}`)
      .then(async (r) => {
        const j = (await r.json()) as { data?: Day[]; error?: string };
        if (!r.ok || !j.data) throw new Error(j.error ?? "Calendrier indisponible.");
        if (!alive) return;
        setDays((prev) => {
          const next = new Map(prev);
          for (const d of j.data!) next.set(d.date, d);
          return next;
        });
      })
      .catch((e: Error) => alive && setError(e.message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [month, today, type]);

  const nights = arrival && departure ? Math.round((new Date(`${departure}T00:00:00Z`).getTime() - new Date(`${arrival}T00:00:00Z`).getTime()) / 86_400_000) : 0;
  const selectedNights = useMemo(() => {
    if (!arrival || !departure) return [];
    const out: Day[] = [];
    for (let d = arrival; d < departure; d = addDaysIso(d, 1)) out.push(days.get(d) ?? { date: d, free: -1, price: null });
    return out;
  }, [arrival, departure, days]);
  const rangeOk = selectedNights.length > 0 && selectedNights.every((n) => n.free > 0);
  const total = rangeOk && selectedNights.every((n) => n.price != null) ? selectedNights.reduce((s, n) => s + (n.price ?? 0), 0) : null;
  const tooShort = nights > 0 && nights < minNights;

  const pick = (d: Day) => {
    setError(null);
    if (!arrival || (arrival && departure) || d.date <= arrival) {
      if (d.free <= 0) return;
      setArrival(d.date);
      setDeparture(null);
      return;
    }
    // Départ : toutes les nuits entre l'arrivée et ce jour doivent être libres.
    for (let x = arrival; x < d.date; x = addDaysIso(x, 1)) {
      if ((days.get(x)?.free ?? 0) <= 0) {
        setError("Une des nuits choisies est complète : choisissez d'autres dates.");
        return;
      }
    }
    setDeparture(d.date);
  };

  const renderMonth = (start: string) => {
    const first = new Date(`${start}T00:00:00Z`);
    const offset = (first.getUTCDay() + 6) % 7;
    const count = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
    const cells: (string | null)[] = [...Array.from({ length: offset }, () => null), ...Array.from({ length: count }, (_, i) => addDaysIso(start, i))];
    return (
      <div key={start}>
        <p className="mb-3 text-center font-[family-name:var(--font-heading)] text-[20px] capitalize">{new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" }).format(first)}</p>
        <div className="grid grid-cols-7 gap-1 text-center" role="grid" aria-label="Calendrier des disponibilités">
          {WEEK.map((w) => <span key={w} className="pb-1 text-[11px] font-semibold uppercase text-[var(--color-text-muted)]">{w}</span>)}
          {cells.map((c, i) => {
            if (!c) return <span key={`x${i}`} />;
            const d = days.get(c);
            const past = c < today || c > maxDate;
            const full = !d || d.free <= 0;
            const isStart = c === arrival;
            const isEnd = c === departure;
            const inRange = arrival && departure && c > arrival && c < departure;
            // Un jour complet peut servir de DÉPART (on ne dort pas la nuit de ce jour).
            const canBeDeparture = arrival && !departure && c > arrival;
            const disabled = past || (!d && !canBeDeparture) || (full && !canBeDeparture);
            return (
              <button
                key={c}
                type="button"
                disabled={disabled}
                onClick={() => d ? pick(d) : pick({ date: c, free: 0, price: null })}
                aria-pressed={Boolean(isStart || isEnd || inRange)}
                aria-label={`${shortDate(c, { weekday: "long", day: "numeric", month: "long" })} — ${full ? "complet" : `${d!.free} chambre${d!.free > 1 ? "s" : ""} libre${d!.free > 1 ? "s" : ""}${d!.price != null ? `, ${d!.price} FCFA la nuit` : ""}`}`}
                className={`flex h-14 flex-col items-center justify-center rounded-[var(--radius-sm)] text-[14px] transition-colors ${
                  isStart || isEnd ? "bg-[var(--color-primary)] font-semibold text-white" : inRange ? "bg-[color-mix(in_srgb,var(--color-primary)_14%,white)] font-semibold" : disabled ? "cursor-not-allowed text-[var(--color-text-muted)] opacity-40" : full ? "text-[var(--color-text-muted)]" : "hover:bg-[var(--color-surface)]"
                }`}
              >
                <span className={full && !past ? "line-through" : ""}>{Number(c.slice(8))}</span>
                {!past && d && !full && d.price != null && <span className={`text-[9.5px] tabular-nums ${isStart || isEnd ? "text-white/75" : "text-[var(--color-text-muted)]"}`}>{Math.round(d.price / 1000)}k</span>}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const submit = async (form: HTMLFormElement) => {
    if (!arrival || !departure || !rangeOk) return;
    const f = new FormData(form);
    setError(null);
    setState("sending");
    try {
      const res = await fetch("/api/storefront/hotel/book", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type, arrival, departure, adults, children, firstName: f.get("firstName"), lastName: f.get("lastName"), phone: f.get("phone"), email: f.get("email"), note: f.get("note") }),
      });
      const json = (await res.json().catch(() => ({}))) as { data?: { url: string }; error?: string };
      if (!res.ok || !json.data) throw new Error(json.error ?? "Réservation impossible.");
      router.push(json.data.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Réservation impossible.");
      setState("idle");
    }
  };

  const canPrev = month > monthStart(today);
  return (
    <div id="reserver" className="grid scroll-mt-24 gap-8 lg:grid-cols-[1fr_400px]">
      <section aria-labelledby="dispo" className="rounded-[var(--radius-lg)] bg-white p-5 ring-1 ring-[var(--color-border)] sm:p-7">
        <div className="mb-5 flex items-center justify-between gap-3">
          <h2 id="dispo" className="font-[family-name:var(--font-heading)] text-[28px]">Disponibilités</h2>
          <div className="flex gap-1">
            <button type="button" disabled={!canPrev} onClick={() => setMonth(addMonths(month, -1))} aria-label="Mois précédent" className="grid h-10 w-10 place-items-center rounded-full ring-1 ring-inset ring-[var(--color-border)] disabled:opacity-40">‹</button>
            <button type="button" onClick={() => setMonth(addMonths(month, 1))} aria-label="Mois suivant" className="grid h-10 w-10 place-items-center rounded-full ring-1 ring-inset ring-[var(--color-border)]">›</button>
          </div>
        </div>
        <div className={`grid gap-8 md:grid-cols-2 ${loading ? "opacity-60" : ""}`} aria-busy={loading}>
          {renderMonth(month)}
          <div>{renderMonth(addMonths(month, 1))}</div>
        </div>
        <p className="mt-5 text-[13px] text-[var(--color-text-muted)]">Touchez votre jour d&apos;arrivée, puis votre jour de départ. Prix par nuit en milliers de FCFA ; jours barrés : complet.</p>
      </section>

      <form className="h-fit overflow-hidden rounded-[var(--radius-lg)] bg-white shadow-[var(--shadow-lg)] ring-1 ring-[var(--color-border)] lg:sticky lg:top-[96px]" onSubmit={(e) => { e.preventDefault(); void submit(e.currentTarget); }}>
        <div className="bg-[var(--color-primary)] px-6 py-5 text-white">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/60">Votre séjour</p>
          <p className="mt-2 font-[family-name:var(--font-heading)] text-[24px] leading-tight">
            {arrival ? shortDate(arrival) : "Arrivée ?"} <span className="text-white/50">→</span> {departure ? shortDate(departure) : "Départ ?"}
          </p>
          {nights > 0 && <p className="mt-1 text-[14px] text-white/75">{nightsLabel(nights)} · {guestsLabel(adults, children)}</p>}
        </div>
        <div className="grid gap-4 p-6">
          <div className="grid grid-cols-2 gap-3">
            <label className={labelCls}>Adultes<select value={adults} onChange={(e) => setAdults(Number(e.target.value))} className={input}>{Array.from({ length: maxAdults }, (_, i) => i + 1).map((n) => <option key={n}>{n}</option>)}</select></label>
            <label className={labelCls}>Enfants<select value={children} onChange={(e) => setChildren(Number(e.target.value))} className={input} disabled={maxChildren === 0}>{Array.from({ length: maxChildren + 1 }, (_, i) => i).map((n) => <option key={n}>{n}</option>)}</select></label>
          </div>
          {rangeOk && !tooShort && (
            <>
              <div className="rounded-[var(--radius-md)] bg-[var(--color-surface)] p-4 text-[14px]">
                {selectedNights.length <= 7 && selectedNights.map((n) => (
                  <p key={n.date} className="flex justify-between text-[var(--color-text-secondary)]"><span className="first-letter:uppercase">{shortDate(n.date)}</span><span className="tabular-nums">{formatXof(n.price)}</span></p>
                ))}
                <p className="mt-2 flex items-baseline justify-between border-t border-[var(--color-border)] pt-2"><span className="font-semibold">Total</span><span className="font-[family-name:var(--font-heading)] text-[26px]">{total == null ? "Sur demande" : formatXof(total)}</span></p>
                {depositPercent > 0 && total != null && <p className="mt-1 flex justify-between text-[13px] text-[var(--color-text-secondary)]"><span>Acompte demandé ({depositPercent} %)</span><span>{formatXof(Math.ceil((total * depositPercent) / 100))}</span></p>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className={labelCls}>Prénom<input name="firstName" required maxLength={80} autoComplete="given-name" className={input} /></label>
                <label className={labelCls}>Nom<input name="lastName" required maxLength={80} autoComplete="family-name" className={input} /></label>
              </div>
              <label className={labelCls}>Téléphone<input name="phone" type="tel" required inputMode="tel" maxLength={20} autoComplete="tel" placeholder="77 123 45 67" className={input} /></label>
              <label className={labelCls}>E-mail <span className="-mt-1 text-xs font-normal text-[var(--color-text-muted)]">(facultatif)</span><input name="email" type="email" maxLength={200} autoComplete="email" className={input} /></label>
              <label className={labelCls}>Heure d&apos;arrivée prévue, demande particulière <span className="-mt-1 text-xs font-normal text-[var(--color-text-muted)]">(facultatif)</span><textarea name="note" rows={2} maxLength={600} className={`${input} h-auto py-3`} /></label>
            </>
          )}
          {tooShort && <p className="text-[14px] font-medium text-[var(--color-warning)]">Séjour minimum pour cette chambre : {nightsLabel(minNights)}.</p>}
          {!arrival && <p className="text-[14px] text-[var(--color-text-secondary)]">Choisissez vos dates dans le calendrier.</p>}
          {arrival && !departure && <p className="text-[14px] text-[var(--color-text-secondary)]">Choisissez maintenant votre jour de départ.</p>}
          {error && <p role="alert" className="rounded-[var(--radius-sm)] bg-[color-mix(in_srgb,var(--color-danger)_8%,white)] px-3.5 py-2.5 text-sm font-medium text-[var(--color-danger)]">{error}</p>}
          <button type="submit" disabled={!rangeOk || tooShort || state === "sending"} className="inline-flex h-14 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-accent-primary)] text-[15px] font-semibold text-white transition-transform hover:-translate-y-0.5 disabled:opacity-50">
            {state === "sending" ? "Envoi…" : autoConfirm ? "Réserver" : "Envoyer ma demande"}
          </button>
          <p className="-mt-1 text-center text-xs text-[var(--color-text-muted)]">Rien n&apos;est débité en ligne. Règlement : {payWays.join(", ")}.</p>
        </div>
      </form>
    </div>
  );
}
