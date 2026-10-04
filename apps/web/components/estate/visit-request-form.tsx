"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";

const TIMES = ["09:00", "10:00", "11:00", "12:00", "14:00", "15:00", "16:00", "17:00", "18:00"];
const input = "h-12 w-full rounded-[var(--radius-md)] bg-white px-3.5 text-[15px] text-[var(--color-text-primary)] ring-1 ring-inset ring-[var(--color-border)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] aria-[invalid=true]:ring-[var(--color-danger)]";
const labelCls = "grid gap-1.5 text-[13px] font-semibold";

function tomorrow() {
  const d = new Date(Date.now() + 86_400_000);
  return d.toISOString().slice(0, 10);
}

/** Demande de visite : date et créneau souhaités, coordonnées. Rien n'est « réservé »
 *  tant que l'agence n'a pas confirmé — le message le dit clairement. */
export function VisitRequestForm({ slug, title }: { slug: string; title: string }) {
  const router = useRouter();
  const id = useId();
  const [state, setState] = useState<"idle" | "sending">("idle");
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      aria-labelledby={`${id}-title`}
      className="rounded-[var(--radius-lg)] bg-[var(--color-surface)] p-6 ring-1 ring-[var(--color-border)] sm:p-7"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        setError(null);
        setState("sending");
        try {
          const res = await fetch("/api/storefront/visit", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ slug, date: f.get("date"), time: f.get("time"), firstName: f.get("firstName"), lastName: f.get("lastName"), phone: f.get("phone"), email: f.get("email"), message: f.get("message") }),
          });
          const json = (await res.json().catch(() => ({}))) as { data?: { url: string }; error?: string };
          if (!res.ok || !json.data) throw new Error(json.error ?? "Envoi impossible.");
          router.push(json.data.url);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Envoi impossible.");
          setState("idle");
        }
      }}
    >
      <h2 id={`${id}-title`} className="font-[family-name:var(--font-heading)] text-[26px] leading-tight">Demander une visite</h2>
      <p className="mt-1.5 text-sm text-[var(--color-text-secondary)]">L&apos;agence vous rappelle pour confirmer l&apos;horaire.</p>
      <div className="mt-5 grid gap-3.5">
        <div className="grid grid-cols-[1.3fr_1fr] gap-3">
          <label className={labelCls}>Date souhaitée<input name="date" type="date" required min={tomorrow()} defaultValue={tomorrow()} className={input} /></label>
          <label className={labelCls}>Heure
            <select name="time" required defaultValue="10:00" className={input}>{TIMES.map((t) => <option key={t} value={t}>{t.replace(":", " h ")}</option>)}</select>
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className={labelCls}>Prénom<input name="firstName" required maxLength={80} autoComplete="given-name" className={input} /></label>
          <label className={labelCls}>Nom<input name="lastName" maxLength={80} autoComplete="family-name" className={input} /></label>
        </div>
        <label className={labelCls}>Téléphone<input name="phone" type="tel" required inputMode="tel" maxLength={20} autoComplete="tel" placeholder="77 123 45 67" className={input} /></label>
        <label className={labelCls}>E-mail <span className="-mt-1 text-xs font-normal text-[var(--color-text-muted)]">(facultatif)</span><input name="email" type="email" maxLength={200} autoComplete="email" className={input} /></label>
        <label className={labelCls}>Message <span className="-mt-1 text-xs font-normal text-[var(--color-text-muted)]">(facultatif)</span><textarea name="message" rows={3} maxLength={600} defaultValue={`Bonjour, je souhaite visiter « ${title} ».`} className={`${input} h-auto py-3`} /></label>
      </div>
      {error && <p role="alert" className="mt-4 rounded-[var(--radius-md)] bg-[color-mix(in_srgb,var(--color-danger)_8%,white)] px-3.5 py-2.5 text-sm font-medium text-[var(--color-danger)]">{error}</p>}
      <button type="submit" disabled={state === "sending"} className="mt-5 inline-flex h-13 w-full items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-primary)] py-3.5 text-[15px] font-semibold text-white transition-transform hover:-translate-y-0.5 disabled:opacity-60">
        {state === "sending" ? "Envoi…" : "Envoyer ma demande"}
      </button>
      <p className="mt-3 text-center text-xs text-[var(--color-text-muted)]">Vos coordonnées ne sont transmises qu&apos;à l&apos;agence.</p>
    </form>
  );
}
