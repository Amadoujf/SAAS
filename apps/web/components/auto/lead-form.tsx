"use client";

import { useState } from "react";

const INTERESTS = [
  { key: "purchase", label: "Acheter ce véhicule", short: "Achat" },
  { key: "trade_in", label: "Faire reprendre mon véhicule", short: "Reprise" },
  { key: "financing", label: "Étudier un financement", short: "Financement" },
  { key: "import_request", label: "Faire importer un véhicule", short: "Importation" },
] as const;

type Interest = (typeof INTERESTS)[number]["key"];

/**
 * Demande à la concession (achat, reprise, financement, importation sur commande). La
 * demande arrive dans le suivi des prospects de l'équipe ; rien n'est payé en ligne.
 */
export function LeadForm({ listingId = null, initial = "purchase", choices = ["purchase", "trade_in", "financing", "import_request"], dark = false }: { listingId?: string | null; initial?: Interest; choices?: Interest[]; dark?: boolean }) {
  const [interest, setInterest] = useState<Interest>(initial);
  const [f, setF] = useState({ firstName: "", lastName: "", phone: "", email: "", budget: "", tradeIn: "", message: "" });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const field = `mt-1.5 h-12 w-full rounded-[var(--radius-sm)] px-3.5 text-[15px] font-normal ring-1 ring-inset focus:outline-none focus:ring-2 ${dark ? "bg-white/5 text-white ring-white/15 placeholder:text-white/35 focus:ring-[var(--color-accent-primary)]" : "bg-white ring-[var(--color-border)] focus:ring-[var(--color-primary)]"}`;
  const muted = dark ? "text-white/50" : "text-[var(--color-text-muted)]";

  if (sent) {
    return (
      <div role="status" className={`p-6 ring-1 ring-inset ${dark ? "bg-white/5 ring-white/15" : "bg-white ring-[var(--color-border)]"}`}>
        <p className="text-[20px] font-extrabold tracking-[-0.01em]">Demande envoyée.</p>
        <p className={`mt-1.5 text-[15px] ${muted}`}>Un conseiller vous rappelle au {f.phone}. Rien n&apos;a été payé ni réservé en ligne.</p>
      </div>
    );
  }

  return (
    <form
      className="grid gap-5"
      onSubmit={async (e) => {
        e.preventDefault();
        setPending(true);
        setError(null);
        const budget = Number(f.budget.replace(/\s/g, ""));
        const res = await fetch("/api/storefront/auto/lead", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ listingId, interest, firstName: f.firstName, lastName: f.lastName, phone: f.phone, email: f.email, budget: Number.isInteger(budget) && budget > 0 ? budget : null, tradeIn: interest === "trade_in" ? f.tradeIn : "", message: f.message }),
        });
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        setPending(false);
        if (!res.ok) return setError(json.error ?? "Envoi impossible pour le moment.");
        setSent(true);
      }}
    >
      {choices.length > 1 && (
        <div role="radiogroup" aria-label="Votre demande" className="flex flex-wrap gap-1.5">
          {INTERESTS.filter((i) => choices.includes(i.key)).map((i) => (
            <button key={i.key} type="button" role="radio" aria-checked={interest === i.key} onClick={() => setInterest(i.key)} className={`h-10 px-4 text-[13px] font-bold uppercase tracking-[0.05em] ring-1 ring-inset ${interest === i.key ? "bg-[var(--color-accent-primary)] text-[var(--color-primary)] ring-[var(--color-accent-primary)]" : dark ? "text-white/80 ring-white/20" : "bg-white ring-[var(--color-border)]"}`}>
              {i.short}
            </button>
          ))}
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-[14px] font-semibold">Prénom<input required maxLength={80} autoComplete="given-name" value={f.firstName} onChange={(e) => setF({ ...f, firstName: e.target.value })} className={field} /></label>
        <label className="block text-[14px] font-semibold">Téléphone<input required type="tel" inputMode="tel" autoComplete="tel" maxLength={20} value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder="77 123 45 67" className={field} /></label>
        {interest === "trade_in" && (
          <label className="block text-[14px] font-semibold sm:col-span-2">Votre véhicule actuel<input required maxLength={200} value={f.tradeIn} onChange={(e) => setF({ ...f, tradeIn: e.target.value })} placeholder="Marque, modèle, année, kilométrage" className={field} /></label>
        )}
        {(interest === "financing" || interest === "import_request") && (
          <label className="block text-[14px] font-semibold">Budget <span className={`font-normal ${muted}`}>(FCFA, facultatif)</span><input inputMode="numeric" maxLength={14} value={f.budget} onChange={(e) => setF({ ...f, budget: e.target.value.replace(/[^\d\s]/g, "") })} placeholder="12 000 000" className={field} /></label>
        )}
        <label className={`block text-[14px] font-semibold ${interest === "financing" || interest === "import_request" ? "" : "sm:col-span-2"}`}>E-mail <span className={`font-normal ${muted}`}>(facultatif)</span><input type="email" autoComplete="email" maxLength={160} value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} className={field} /></label>
        <label className="block text-[14px] font-semibold sm:col-span-2">Message <span className={`font-normal ${muted}`}>(facultatif)</span>
          <textarea rows={3} maxLength={800} value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} placeholder={interest === "import_request" ? "Le modèle recherché, l'année, la couleur…" : "Votre question"} className={`${field} h-auto py-3`} />
        </label>
      </div>
      {error && <p role="alert" className="text-[15px] font-semibold text-[var(--color-danger)]">{error}</p>}
      <button type="submit" disabled={pending} className={`flex h-13 min-h-[52px] w-full items-center justify-center text-[14.5px] font-extrabold uppercase tracking-[0.06em] disabled:opacity-60 sm:w-auto sm:px-9 ${dark ? "bg-[var(--color-accent-primary)] text-[var(--color-primary)]" : "bg-[var(--color-primary)] text-white"}`}>
        {pending ? "Envoi…" : "Être rappelé"}
      </button>
    </form>
  );
}
