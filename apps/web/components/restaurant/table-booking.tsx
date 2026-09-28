"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { addDaysIso, clockLabel, shortDate } from "@/lib/restaurant/labels";

type Slot = { minute: number; available: boolean };

/**
 * Réservation d'une table : date, nombre de couverts, créneaux réellement disponibles
 * (recalculés par le serveur), coordonnées. La table est confirmée immédiatement.
 */
export function TableBooking({ today, maxParty, phone }: { today: string; maxParty: number; phone: string | null }) {
  const router = useRouter();
  const days = Array.from({ length: 14 }, (_, i) => addDaysIso(today, i));
  const [date, setDate] = useState(days[0]!);
  const [party, setParty] = useState(2);
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [minute, setMinute] = useState<number | null>(null);
  const [f, setF] = useState({ firstName: "", lastName: "", phone: "", occasion: "", note: "" });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setMinute(null);
    fetch(`/api/storefront/restaurant/booking-slots?date=${date}&couverts=${party}`)
      .then((r) => r.json())
      .then((j: { data?: { slots: Slot[] }; error?: string }) => {
        if (!alive) return;
        setSlots(j.data?.slots ?? []);
        setError(j.error ?? null);
      })
      .catch(() => alive && setError("Créneaux indisponibles pour le moment."))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [date, party]);

  const field = "mt-1.5 h-12 w-full rounded-[var(--radius-md)] bg-white px-3.5 text-[15px] font-normal ring-1 ring-inset ring-[var(--color-border)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]";
  const submit = async () => {
    if (minute == null) return setError("Choisissez une heure.");
    setPending(true);
    setError(null);
    const res = await fetch("/api/storefront/restaurant/booking", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ date, minute, partySize: party, ...f }) });
    const json = (await res.json().catch(() => ({}))) as { data?: { url: string }; error?: string };
    if (!res.ok || !json.data) {
      setPending(false);
      return setError(json.error ?? "Réservation impossible pour le moment.");
    }
    router.push(json.data.url);
  };
  const open = slots?.filter((s) => s.available) ?? [];

  return (
    <form className="grid gap-8" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
      <fieldset>
        <legend className="text-[13px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">1 · Le jour</legend>
        <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0">
          {days.map((d, i) => (
            <button key={d} type="button" aria-pressed={date === d} onClick={() => setDate(d)} className={`flex h-[68px] w-[64px] shrink-0 flex-col items-center justify-center rounded-[var(--radius-md)] text-center ring-1 ring-inset ${date === d ? "bg-[var(--color-primary)] text-white ring-[var(--color-primary)]" : "bg-white ring-[var(--color-border)]"}`}>
              <span className="text-[11px] font-semibold uppercase">{i === 0 ? "Auj." : i === 1 ? "Dem." : shortDate(d, { weekday: "short" }).replace(".", "")}</span>
              <span className="yc-num text-[22px] font-bold leading-none">{Number(d.slice(8))}</span>
              <span className="text-[10.5px] opacity-70">{shortDate(d, { month: "short" }).replace(".", "")}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-[13px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">2 · Combien serez-vous ?</legend>
        <div className="mt-3 flex flex-wrap gap-2">
          {Array.from({ length: Math.min(maxParty, 8) }, (_, i) => i + 1).map((n) => (
            <button key={n} type="button" aria-pressed={party === n} onClick={() => setParty(n)} className={`yc-num grid h-12 w-12 place-items-center rounded-full text-[16px] font-bold ring-1 ring-inset ${party === n ? "bg-[var(--color-primary)] text-white ring-[var(--color-primary)]" : "bg-white ring-[var(--color-border)]"}`}>{n}</button>
          ))}
        </div>
        <p className="mt-2 text-[13px] text-[var(--color-text-muted)]">Au-delà de {Math.min(maxParty, 8)} personnes, {phone ? `appelez-nous au ${phone}` : "appelez le restaurant"}.</p>
      </fieldset>

      <fieldset>
        <legend className="text-[13px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">3 · L&apos;heure</legend>
        <div className="mt-3 min-h-[52px]" aria-busy={loading}>
          {loading && !slots ? (
            <p className="text-[15px] text-[var(--color-text-muted)]">Recherche des tables libres…</p>
          ) : slots && slots.length === 0 ? (
            <p className="text-[15px]">Fermé ce jour-là. Choisissez une autre date.</p>
          ) : slots && open.length === 0 ? (
            <p className="text-[15px]">Complet pour {party} personne{party > 1 ? "s" : ""} ce jour-là. Essayez une autre date{phone ? ` ou appelez-nous au ${phone}` : ""}.</p>
          ) : (
            <div className={`grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-8 ${loading ? "opacity-50" : ""}`}>
              {slots?.map((s) => (
                <button key={s.minute} type="button" disabled={!s.available} aria-pressed={minute === s.minute} onClick={() => setMinute(s.minute)} className={`yc-num h-12 rounded-[var(--radius-md)] text-[15px] font-bold ring-1 ring-inset disabled:cursor-not-allowed disabled:text-[var(--color-text-muted)] disabled:line-through disabled:opacity-50 ${minute === s.minute ? "bg-[var(--color-accent-primary)] text-[var(--color-primary)] ring-[var(--color-accent-primary)]" : "bg-white ring-[var(--color-border)]"}`}>
                  {clockLabel(s.minute)}
                </button>
              ))}
            </div>
          )}
        </div>
      </fieldset>

      <fieldset className={minute == null ? "opacity-50" : ""} disabled={minute == null}>
        <legend className="text-[13px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">4 · Vos coordonnées</legend>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <label className="block text-[14px] font-semibold">Prénom<input required maxLength={80} autoComplete="given-name" value={f.firstName} onChange={(e) => setF({ ...f, firstName: e.target.value })} className={field} /></label>
          <label className="block text-[14px] font-semibold">Nom <span className="font-normal text-[var(--color-text-muted)]">(facultatif)</span><input maxLength={80} autoComplete="family-name" value={f.lastName} onChange={(e) => setF({ ...f, lastName: e.target.value })} className={field} /></label>
          <label className="block text-[14px] font-semibold">Téléphone<input required type="tel" inputMode="tel" autoComplete="tel" maxLength={20} value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder="77 123 45 67" className={field} /></label>
          <label className="block text-[14px] font-semibold">Occasion <span className="font-normal text-[var(--color-text-muted)]">(facultatif)</span>
            <select value={f.occasion} onChange={(e) => setF({ ...f, occasion: e.target.value })} className={field}>
              <option value="">—</option>
              {["Anniversaire", "Dîner en amoureux", "Repas d'affaires", "Famille", "Entre amis"].map((o) => <option key={o}>{o}</option>)}
            </select>
          </label>
          <label className="block text-[14px] font-semibold sm:col-span-2">Une demande particulière <span className="font-normal text-[var(--color-text-muted)]">(facultatif)</span><input maxLength={400} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="Chaise bébé, en terrasse si possible…" className={field} /></label>
        </div>
      </fieldset>

      {error && <p role="alert" className="text-[15px] font-semibold text-[var(--color-danger)]">{error}</p>}
      <button type="submit" disabled={pending || minute == null} className="flex h-14 w-full items-center justify-center rounded-full bg-[var(--color-primary)] text-[16px] font-bold text-white disabled:opacity-50 sm:w-auto sm:px-10">
        {pending ? "Réservation…" : minute == null ? "Choisissez une heure" : `Réserver pour ${party} à ${clockLabel(minute)}`}
      </button>
    </form>
  );
}
