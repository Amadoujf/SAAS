"use client";

import { useState } from "react";
import { IconArrowRight, IconCheck } from "@/components/yc/icons";

const input = "h-12 w-full rounded-lg border border-yc-navy/15 bg-white px-3.5 text-[15px] text-yc-navy-ink outline-none transition-colors focus:border-yc-royal focus:ring-2 focus:ring-yc-royal/20";

/** Formulaire de devis « Sur mesure » : la demande est réellement enregistrée pour
 *  l'équipe commerciale — le message de confirmation ne promet rien de plus. */
export function QuoteForm({ sectors }: { sectors: { key: string; name: string }[] }) {
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);
  if (state === "sent") {
    return (
      <div role="status" className="rounded-xl bg-white p-8 text-center ring-1 ring-yc-navy/10">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-yc-royal text-white"><IconCheck size={22} /></span>
        <p className="mt-4 font-editorial text-[28px] leading-tight">Demande bien reçue.</p>
        <p className="mt-2 text-sm text-yc-ink-soft">L&apos;équipe Y-COM vous répondra à l&apos;adresse indiquée.</p>
      </div>
    );
  }
  return (
    <form
      className="grid gap-4 rounded-xl bg-white p-5 ring-1 ring-yc-navy/10 sm:grid-cols-2 sm:p-7"
      onSubmit={async (e) => {
        e.preventDefault();
        setError(null);
        setState("sending");
        const body = Object.fromEntries(new FormData(e.currentTarget).entries());
        const res = await fetch("/api/platform/inquiry", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
        if (res.ok) return setState("sent");
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        setError(json.error ?? "Envoi impossible pour le moment.");
        setState("idle");
      }}
    >
      <label className="grid gap-1.5 text-sm font-semibold">Nom complet<input name="fullName" required minLength={2} autoComplete="name" className={input} /></label>
      <label className="grid gap-1.5 text-sm font-semibold">E-mail<input name="email" type="email" required autoComplete="email" className={input} /></label>
      <label className="grid gap-1.5 text-sm font-semibold">Téléphone <span className="font-normal text-yc-ink-soft">(facultatif)</span><input name="phone" type="tel" autoComplete="tel" className={input} /></label>
      <label className="grid gap-1.5 text-sm font-semibold">Entreprise <span className="font-normal text-yc-ink-soft">(facultatif)</span><input name="companyName" autoComplete="organization" className={input} /></label>
      <label className="grid gap-1.5 text-sm font-semibold sm:col-span-2">Secteur
        <select name="sectorKey" className={input} defaultValue="">
          <option value="">Choisir…</option>
          {sectors.map((s) => <option key={s.key} value={s.key}>{s.name}</option>)}
        </select>
      </label>
      <label className="grid gap-1.5 text-sm font-semibold sm:col-span-2">Votre besoin
        <textarea name="message" required minLength={10} rows={4} placeholder="Nombre d'établissements, intégrations souhaitées, volume…" className={`${input} h-auto py-3`} />
      </label>
      <input name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />
      {error && <p role="alert" className="rounded-lg bg-yc-danger/[0.07] px-3 py-2 text-sm text-[rgb(185_28_28)] sm:col-span-2">{error}</p>}
      <button type="submit" disabled={state === "sending"} className="inline-flex items-center justify-center gap-2 rounded-lg bg-yc-royal px-6 py-3.5 text-[15px] font-semibold text-white transition-colors hover:bg-yc-royal-strong disabled:opacity-60 sm:col-span-2 sm:w-fit">
        {state === "sending" ? "Envoi…" : <>Demander un devis <IconArrowRight size={18} /></>}
      </button>
    </form>
  );
}
