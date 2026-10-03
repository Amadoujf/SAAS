"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { addDaysIso, clockLabel, shortDate } from "@/lib/auto/labels";

type Slot = { minute: number; available: boolean };

/**
 * Essai sur rendez-vous : jour, heure réellement libre pour CE véhicule (recalculée par
 * le serveur), coordonnées et permis. L'essai est confirmé immédiatement.
 */
export function TestDriveBooking({ listingId, today, days: maxDays, minutes, phone }: { listingId: string; today: string; days: number; minutes: number; phone: string | null }) {
  const router = useRouter();
  const days = Array.from({ length: Math.min(14, maxDays + 1) }, (_, i) => addDaysIso(today, i));
  const [date, setDate] = useState(days[1] ?? days[0]!);
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [minute, setMinute] = useState<number | null>(null);
  const [f, setF] = useState({ firstName: "", lastName: "", phone: "", email: "", note: "" });
  const [license, setLicense] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setMinute(null);
    fetch(`/api/storefront/auto/slots?vehicule=${listingId}&date=${date}`)
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
  }, [date, listingId]);

  const field = "mt-1.5 h-12 w-full rounded-[var(--radius-sm)] bg-white px-3.5 text-[15px] font-normal ring-1 ring-inset ring-[var(--color-border)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]";
  const submit = async () => {
    if (minute == null) return setError("Choisissez une heure.");
    if (!license) return setError("Confirmez que vous avez un permis de conduire valide.");
    setPending(true);
    setError(null);
    const res = await fetch("/api/storefront/auto/test-drive", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ listingId, date, minute, licenseConfirmed: license, ...f }) });
    const json = (await res.json().catch(() => ({}))) as { data?: { url: string }; error?: string };
    if (!res.ok || !json.data) {
      setPending(false);
      return setError(json.error ?? "Réservation impossible pour le moment.");
    }
    router.push(json.data.url);
  };
  const open = slots?.filter((s) => s.available) ?? [];
  const legend = "text-[12px] font-extrabold uppercase tracking-[0.16em] text-[var(--color-text-muted)]";

  return (
    <form className="grid gap-7" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
      <fieldset className="min-w-0">
        <legend className={legend}>1 · Le jour</legend>
        <div className="-mx-4 mt-3 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0">
          {days.map((d, i) => (
            <button key={d} type="button" aria-pressed={date === d} onClick={() => setDate(d)} className={`flex h-[66px] w-[58px] shrink-0 flex-col items-center justify-center text-center ring-1 ring-inset ${date === d ? "bg-[var(--color-primary)] text-white ring-[var(--color-primary)]" : "bg-white ring-[var(--color-border)]"}`}>
              <span className="text-[10.5px] font-bold uppercase">{i === 0 ? "Auj." : i === 1 ? "Dem." : shortDate(d, { weekday: "short" }).replace(".", "")}</span>
              <span className="yc-num text-[21px] font-black leading-none">{Number(d.slice(8))}</span>
              <span className="text-[10px] opacity-70">{shortDate(d, { month: "short" }).replace(".", "")}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="min-w-0">
        <legend className={legend}>2 · L&apos;heure <span className="normal-case tracking-normal">(essai de {minutes} min)</span></legend>
        <div className="mt-3 min-h-[52px]" aria-busy={loading}>
          {loading && !slots ? (
            <p className="text-[15px] text-[var(--color-text-muted)]">Recherche des créneaux libres…</p>
          ) : slots && slots.length === 0 ? (
            <p className="text-[15px]">Showroom fermé ce jour-là. Choisissez une autre date.</p>
          ) : slots && open.length === 0 ? (
            <p className="text-[15px]">Plus de créneau libre ce jour-là. Essayez une autre date{phone ? ` ou appelez-nous au ${phone}` : ""}.</p>
          ) : (
            <div className={`grid grid-cols-4 gap-1.5 sm:grid-cols-6 ${loading ? "opacity-50" : ""}`}>
              {slots?.map((s) => (
                <button key={s.minute} type="button" disabled={!s.available} aria-pressed={minute === s.minute} onClick={() => setMinute(s.minute)} className={`yc-num h-11 text-[14.5px] font-bold ring-1 ring-inset disabled:cursor-not-allowed disabled:text-[var(--color-text-muted)] disabled:line-through disabled:opacity-50 ${minute === s.minute ? "bg-[var(--color-accent-primary)] text-[var(--color-primary)] ring-[var(--color-accent-primary)]" : "bg-white ring-[var(--color-border)]"}`}>
                  {clockLabel(s.minute)}
                </button>
              ))}
            </div>
          )}
        </div>
      </fieldset>

      <fieldset className={`min-w-0 ${minute == null ? "opacity-50" : ""}`} disabled={minute == null}>
        <legend className={legend}>3 · Vos coordonnées</legend>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <label className="block text-[14px] font-semibold">Prénom<input required maxLength={80} autoComplete="given-name" value={f.firstName} onChange={(e) => setF({ ...f, firstName: e.target.value })} className={field} /></label>
          <label className="block text-[14px] font-semibold">Nom <span className="font-normal text-[var(--color-text-muted)]">(facultatif)</span><input maxLength={80} autoComplete="family-name" value={f.lastName} onChange={(e) => setF({ ...f, lastName: e.target.value })} className={field} /></label>
          <label className="block text-[14px] font-semibold">Téléphone<input required type="tel" inputMode="tel" autoComplete="tel" maxLength={20} value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder="77 123 45 67" className={field} /></label>
          <label className="block text-[14px] font-semibold">E-mail <span className="font-normal text-[var(--color-text-muted)]">(facultatif)</span><input type="email" autoComplete="email" maxLength={160} value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} className={field} /></label>
          <label className="block text-[14px] font-semibold sm:col-span-2">Une question <span className="font-normal text-[var(--color-text-muted)]">(facultatif)</span><input maxLength={400} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="Reprise de mon véhicule, financement…" className={field} /></label>
          <label className="flex items-start gap-3 text-[14.5px] sm:col-span-2">
            <input type="checkbox" checked={license} onChange={(e) => setLicense(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--color-primary)]" />
            <span>J&apos;ai un permis de conduire valide et je le présenterai au showroom.</span>
          </label>
        </div>
      </fieldset>

      {error && <p role="alert" className="text-[15px] font-semibold text-[var(--color-danger)]">{error}</p>}
      <button type="submit" disabled={pending || minute == null} className="flex h-14 w-full items-center justify-center bg-[var(--color-primary)] text-[15px] font-extrabold uppercase tracking-[0.06em] text-white disabled:opacity-50 sm:w-auto sm:px-10">
        {pending ? "Réservation…" : minute == null ? "Choisissez une heure" : `Réserver l'essai · ${shortDate(date)} à ${clockLabel(minute)}`}
      </button>
    </form>
  );
}
