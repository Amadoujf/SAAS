"use client";

import { useRouter } from "next/navigation";
import { useId, useMemo, useState } from "react";

export interface DepartureOption {
  id: string;
  dates: string;
  seatsText: string;
  left: number;
  open: boolean;
  price: number | null;
  priceLabel: string;
  label: string | null;
}

const nf = new Intl.NumberFormat("fr-FR");
const input = "h-12 w-full rounded-[var(--radius-md)] bg-white px-3.5 text-[15px] text-[var(--color-text-primary)] ring-1 ring-inset ring-[var(--color-border)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]";
const labelCls = "grid gap-1.5 text-[13px] font-semibold";

interface Traveler {
  firstName: string;
  lastName: string;
  passportNumber: string;
}

/**
 * Réservation d'un départ : date, voyageurs nominatifs (comme sur le passeport),
 * coordonnées. Le récapitulatif reprend les prix de l'agence ; le montant définitif est
 * recalculé par le serveur. Rien n'est débité : l'agence confirme, puis indique comment
 * régler l'acompte.
 */
export function BookingPanel({
  slug,
  departures,
  initialDepartureId,
  depositPercent,
  needsPassport,
}: {
  slug: string;
  departures: DepartureOption[];
  initialDepartureId: string | null;
  depositPercent: number;
  needsPassport: boolean;
}) {
  const router = useRouter();
  const id = useId();
  const bookable = departures.filter((d) => d.open && d.left > 0);
  const [departureId, setDepartureId] = useState<string | null>(
    (initialDepartureId && bookable.some((d) => d.id === initialDepartureId) ? initialDepartureId : bookable[0]?.id) ?? null,
  );
  const [travelers, setTravelers] = useState<Traveler[]>([{ firstName: "", lastName: "", passportNumber: "" }]);
  const [state, setState] = useState<"idle" | "sending">("idle");
  const [error, setError] = useState<string | null>(null);
  const departure = departures.find((d) => d.id === departureId) ?? null;
  const maxTravelers = Math.min(9, departure?.left ?? 1);
  const total = departure?.price != null ? departure.price * travelers.length : null;
  const deposit = total != null ? Math.ceil((total * depositPercent) / 100) : null;

  const setCount = (n: number) =>
    setTravelers((list) => {
      const count = Math.max(1, Math.min(maxTravelers, n));
      return count > list.length ? [...list, ...Array.from({ length: count - list.length }, () => ({ firstName: "", lastName: "", passportNumber: "" }))] : list.slice(0, count);
    });
  const update = (i: number, patch: Partial<Traveler>) => setTravelers((list) => list.map((t, k) => (k === i ? { ...t, ...patch } : t)));
  const summary = useMemo(() => (departure ? `${departure.dates} · ${travelers.length} voyageur${travelers.length > 1 ? "s" : ""}` : null), [departure, travelers.length]);

  if (!bookable.length) {
    return (
      <div id="reserver" className="scroll-mt-24 rounded-[var(--radius-lg)] bg-[var(--color-surface)] p-6 sm:p-7">
        <h2 className="font-[family-name:var(--font-heading)] text-[26px]">Pas de départ ouvert</h2>
        <p className="mt-2 text-[15px] text-[var(--color-text-secondary)]">Tous les départs sont complets ou pas encore programmés. Appelez l&apos;agence : elle peut vous inscrire sur liste d&apos;attente ou vous proposer d&apos;autres dates.</p>
      </div>
    );
  }

  return (
    <form
      id="reserver"
      aria-labelledby={`${id}-title`}
      className="scroll-mt-24 overflow-hidden rounded-[var(--radius-lg)] bg-white shadow-[var(--shadow-lg)] ring-1 ring-[var(--color-border)]"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        setError(null);
        setState("sending");
        try {
          const res = await fetch("/api/storefront/travel-booking", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ slug, departureId, travelers, phone: f.get("phone"), email: f.get("email"), note: f.get("note") }),
          });
          const json = (await res.json().catch(() => ({}))) as { data?: { url: string }; error?: string };
          if (!res.ok || !json.data) throw new Error(json.error ?? "Réservation impossible.");
          router.push(json.data.url);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Réservation impossible.");
          setState("idle");
        }
      }}
    >
      <div className="bg-[var(--color-primary)] px-6 py-5 text-white sm:px-7">
        <h2 id={`${id}-title`} className="font-[family-name:var(--font-heading)] text-[26px] leading-tight">Réserver ce voyage</h2>
        <p className="mt-1 text-[13.5px] text-white/75">Rien n&apos;est débité en ligne : l&apos;agence confirme votre place, puis vous indique comment régler l&apos;acompte.</p>
      </div>
      <div className="grid gap-6 p-6 sm:p-7">
        <fieldset className="grid gap-2.5">
          <legend className="mb-2 text-[13px] font-semibold">1. Date de départ</legend>
          {departures.map((d) => {
            const disabled = !d.open || d.left === 0;
            const checked = d.id === departureId;
            return (
              <label key={d.id} className={`flex cursor-pointer items-center gap-3 rounded-[var(--radius-md)] px-4 py-3 ring-1 ring-inset transition-colors ${disabled ? "cursor-not-allowed opacity-50 ring-[var(--color-border)]" : checked ? "bg-[color-mix(in_srgb,var(--color-accent-primary)_7%,white)] ring-2 ring-[var(--color-accent-primary)]" : "ring-[var(--color-border)] hover:ring-[var(--color-text-muted)]"}`}>
                <input type="radio" name="departure" value={d.id} checked={checked} disabled={disabled} onChange={() => { setDepartureId(d.id); setTravelers((l) => l.slice(0, Math.max(1, Math.min(9, d.left)))); }} className="h-4 w-4 accent-[var(--color-accent-primary)]" />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                  <span className="min-w-0">
                    <span className="block text-[15px] font-semibold">{d.dates}</span>
                    <span className="block text-[12.5px] text-[var(--color-text-muted)]">{d.label ? `${d.label} · ` : ""}{d.seatsText}</span>
                  </span>
                  <span className="shrink-0 text-[14px] font-semibold sm:text-right">{d.priceLabel}</span>
                </span>
              </label>
            );
          })}
        </fieldset>

        <fieldset className="grid gap-3">
          <legend className="mb-2 flex w-full items-center justify-between text-[13px] font-semibold">
            <span>2. Voyageurs <span className="font-normal text-[var(--color-text-muted)]">(noms comme sur la pièce d&apos;identité)</span></span>
          </legend>
          <div className="flex items-center gap-3">
            <button type="button" aria-label="Un voyageur de moins" onClick={() => setCount(travelers.length - 1)} disabled={travelers.length <= 1} className="grid h-11 w-11 place-items-center rounded-full ring-1 ring-inset ring-[var(--color-border)] disabled:opacity-40">−</button>
            <span className="min-w-[7ch] text-center text-[15px] font-semibold" aria-live="polite">{travelers.length} voyageur{travelers.length > 1 ? "s" : ""}</span>
            <button type="button" aria-label="Un voyageur de plus" onClick={() => setCount(travelers.length + 1)} disabled={travelers.length >= maxTravelers} className="grid h-11 w-11 place-items-center rounded-full ring-1 ring-inset ring-[var(--color-border)] disabled:opacity-40">+</button>
          </div>
          {travelers.map((t, i) => (
            <div key={i} className="grid gap-2.5 rounded-[var(--radius-md)] bg-[var(--color-surface)] p-3.5">
              <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">Voyageur {i + 1}{i === 0 ? " · contact principal" : ""}</p>
              <div className="grid grid-cols-2 gap-2.5">
                <label className={labelCls}>Prénom<input required maxLength={80} value={t.firstName} onChange={(e) => update(i, { firstName: e.target.value })} autoComplete={i === 0 ? "given-name" : "off"} className={input} /></label>
                <label className={labelCls}>Nom<input required maxLength={80} value={t.lastName} onChange={(e) => update(i, { lastName: e.target.value })} autoComplete={i === 0 ? "family-name" : "off"} className={input} /></label>
              </div>
              {needsPassport && (
                <label className={labelCls}>N° de passeport <span className="-mt-1 text-xs font-normal text-[var(--color-text-muted)]">(facultatif, chiffré — l&apos;agence peut le demander plus tard)</span>
                  <input maxLength={20} value={t.passportNumber} onChange={(e) => update(i, { passportNumber: e.target.value.toUpperCase() })} autoComplete="off" className={input} />
                </label>
              )}
            </div>
          ))}
        </fieldset>

        <fieldset className="grid gap-3">
          <legend className="mb-2 text-[13px] font-semibold">3. Vos coordonnées</legend>
          <label className={labelCls}>Téléphone<input name="phone" type="tel" required inputMode="tel" maxLength={20} autoComplete="tel" placeholder="77 123 45 67" className={input} /></label>
          <label className={labelCls}>E-mail <span className="-mt-1 text-xs font-normal text-[var(--color-text-muted)]">(facultatif)</span><input name="email" type="email" maxLength={200} autoComplete="email" className={input} /></label>
          <label className={labelCls}>Message <span className="-mt-1 text-xs font-normal text-[var(--color-text-muted)]">(facultatif)</span><textarea name="note" rows={2} maxLength={600} className={`${input} h-auto py-3`} /></label>
        </fieldset>

        <div className="rounded-[var(--radius-md)] bg-[var(--color-surface)] p-4 text-[14px]">
          {summary && <p className="text-[var(--color-text-secondary)]">{summary}</p>}
          <p className="mt-2 flex items-baseline justify-between gap-3"><span>Total</span><span className="font-[family-name:var(--font-heading)] text-[26px]">{total != null ? `${nf.format(total)} FCFA` : "Sur devis"}</span></p>
          {deposit != null && depositPercent > 0 && <p className="mt-1 flex justify-between gap-3 text-[13px] text-[var(--color-text-secondary)]"><span>Acompte à la confirmation ({depositPercent} %)</span><span className="font-semibold text-[var(--color-text-primary)]">{nf.format(deposit)} FCFA</span></p>}
        </div>

        {error && <p role="alert" className="rounded-[var(--radius-md)] bg-[color-mix(in_srgb,var(--color-danger)_8%,white)] px-3.5 py-2.5 text-sm font-medium text-[var(--color-danger)]">{error}</p>}
        <button type="submit" disabled={state === "sending" || !departureId} className="inline-flex h-14 w-full items-center justify-center gap-2 rounded-[var(--radius-full)] bg-[var(--color-accent-primary)] text-[15px] font-semibold text-white transition-transform hover:-translate-y-0.5 disabled:opacity-60">
          {state === "sending" ? "Envoi…" : "Demander ma réservation"}
        </button>
        <p className="-mt-3 text-center text-xs text-[var(--color-text-muted)]">Vos données ne sont transmises qu&apos;à l&apos;agence.</p>
      </div>
    </form>
  );
}
