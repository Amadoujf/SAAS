"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { SIZE_LABELS, formatXof } from "@/lib/courier/labels";

type Zone = { id: string; label: string };

/**
 * Demande de course. Aucun tarif n'est envoyé : le serveur le calcule (zone + format) ;
 * l'estimation affichée vient du même calcul. Rien n'est payé en ligne.
 */
export function SendForm({ zones, maxCod, initialZone, initialSize }: { zones: Zone[]; maxCod: number; initialZone: string | null; initialSize: string | null }) {
  const router = useRouter();
  const [f, setF] = useState({ senderName: "", senderPhone: "", senderEmail: "", pickupAddress: "", pickupCommune: "", recipientName: "", recipientPhone: "", dropoffAddress: "", zoneId: initialZone && zones.some((z) => z.id === initialZone) ? initialZone : zones[0]?.id ?? "", packageDescription: "", cod: "", instructions: "", scheduledDate: "" });
  const [size, setSize] = useState<"small" | "medium" | "large">(initialSize === "medium" || initialSize === "large" ? initialSize : "small");
  const [feePaidBy, setFeePaidBy] = useState<"sender" | "recipient">("sender");
  const [consent, setConsent] = useState(false);
  const [fee, setFee] = useState<number | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!f.zoneId) return;
    let alive = true;
    fetch("/api/storefront/courier/quote", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ zoneId: f.zoneId, size }) })
      .then(async (r) => { const j = (await r.json().catch(() => ({}))) as { data?: { fee: number } }; if (alive) setFee(r.ok && j.data ? j.data.fee : null); })
      .catch(() => alive && setFee(null));
    return () => { alive = false; };
  }, [f.zoneId, size]);
  const field = "mt-1.5 h-12 w-full rounded-[var(--radius-md)] bg-white px-3.5 text-[15px] font-normal ring-1 ring-inset ring-[var(--color-border)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]";
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  const cod = Number(f.cod.replace(/\s/g, "")) || 0;
  const toCollect = cod + (feePaidBy === "recipient" && fee ? fee : 0);
  const block = "rounded-[var(--radius-lg)] bg-[var(--color-surface)] p-5 ring-1 ring-[var(--color-border)] sm:p-6";
  return (
    <form
      className="grid gap-5"
      onSubmit={async (e) => {
        e.preventDefault();
        setPending(true);
        setError(null);
        const res = await fetch("/api/storefront/courier/request", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ ...f, codAmount: cod, size, feePaidBy, consent }),
        });
        const json = (await res.json().catch(() => ({}))) as { error?: string; data?: { senderToken: string } };
        if (!res.ok || !json.data) {
          setPending(false);
          return setError(json.error ?? "Envoi impossible pour le moment.");
        }
        router.push(`/colis/${json.data.senderToken}?nouvelle=1`);
      }}
    >
      <fieldset className={block}>
        <legend className="px-1 font-[family-name:var(--font-heading)] text-[22px]">1. Retrait</legend>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <label className="block text-[14px] font-semibold">Votre nom ou votre boutique<input required maxLength={80} autoComplete="organization" value={f.senderName} onChange={set("senderName")} className={field} /></label>
          <label className="block text-[14px] font-semibold">Votre téléphone<input required type="tel" inputMode="tel" autoComplete="tel" maxLength={20} value={f.senderPhone} onChange={set("senderPhone")} placeholder="77 123 45 67" className={field} /></label>
          <label className="block text-[14px] font-semibold sm:col-span-2">Adresse de retrait<input required maxLength={200} value={f.pickupAddress} onChange={set("pickupAddress")} placeholder="Rue, repère, étage" className={field} /></label>
          <label className="block text-[14px] font-semibold">Quartier / commune <span className="font-normal text-[var(--color-text-muted)]">(facultatif)</span><input maxLength={60} value={f.pickupCommune} onChange={set("pickupCommune")} className={field} /></label>
          <label className="block text-[14px] font-semibold">E-mail <span className="font-normal text-[var(--color-text-muted)]">(facultatif)</span><input type="email" maxLength={160} value={f.senderEmail} onChange={set("senderEmail")} className={field} /></label>
        </div>
      </fieldset>

      <fieldset className={block}>
        <legend className="px-1 font-[family-name:var(--font-heading)] text-[22px]">2. Destinataire</legend>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <label className="block text-[14px] font-semibold">Nom du destinataire<input required maxLength={80} value={f.recipientName} onChange={set("recipientName")} className={field} /></label>
          <label className="block text-[14px] font-semibold">Téléphone du destinataire<input required type="tel" inputMode="tel" maxLength={20} value={f.recipientPhone} onChange={set("recipientPhone")} placeholder="77 123 45 67" className={field} /></label>
          <label className="block text-[14px] font-semibold sm:col-span-2">Adresse de livraison<input required maxLength={200} value={f.dropoffAddress} onChange={set("dropoffAddress")} placeholder="Rue, repère, étage" className={field} /></label>
          <label className="block text-[14px] font-semibold">Zone<select required value={f.zoneId} onChange={set("zoneId")} className={field}>{zones.map((z) => <option key={z.id} value={z.id}>{z.label}</option>)}</select></label>
          <label className="block text-[14px] font-semibold">Date souhaitée <span className="font-normal text-[var(--color-text-muted)]">(facultatif)</span><input type="date" value={f.scheduledDate} onChange={set("scheduledDate")} className={field} /></label>
          <label className="block text-[14px] font-semibold sm:col-span-2">Consignes <span className="font-normal text-[var(--color-text-muted)]">(facultatif)</span><input maxLength={300} value={f.instructions} onChange={set("instructions")} placeholder="Appeler avant de passer, portail bleu…" className={field} /></label>
        </div>
      </fieldset>

      <fieldset className={block}>
        <legend className="px-1 font-[family-name:var(--font-heading)] text-[22px]">3. Colis et paiement</legend>
        <label className="mt-3 block text-[14px] font-semibold">Contenu<input required maxLength={160} value={f.packageDescription} onChange={set("packageDescription")} placeholder="Ex. : deux robes, un téléphone" className={field} /></label>
        <div role="radiogroup" aria-label="Format du colis" className="mt-4 grid grid-cols-3 gap-2">
          {(["small", "medium", "large"] as const).map((k) => (
            <button key={k} type="button" role="radio" aria-checked={size === k} onClick={() => setSize(k)} className={`rounded-[var(--radius-md)] px-2 py-2.5 text-center ring-1 ring-inset ${size === k ? "bg-[var(--color-primary)] text-white ring-[var(--color-primary)]" : "bg-white ring-[var(--color-border)]"}`}>
              <span className="block text-[14px] font-bold">{SIZE_LABELS[k]!.label}</span>
              <span className={`block text-[11px] leading-tight ${size === k ? "text-white/70" : "text-[var(--color-text-muted)]"}`}>{SIZE_LABELS[k]!.hint}</span>
            </button>
          ))}
        </div>
        <label className="mt-4 block text-[14px] font-semibold">Somme à encaisser auprès du destinataire <span className="font-normal text-[var(--color-text-muted)]">(FCFA, 0 si rien)</span>
          <input inputMode="numeric" maxLength={12} value={f.cod} onChange={(e) => setF({ ...f, cod: e.target.value.replace(/[^\d\s]/g, "") })} placeholder="0" className={field} />
        </label>
        {cod > maxCod && <p className="mt-1 text-[13px] text-[var(--color-danger)]">Plafond : {formatXof(maxCod)} par course.</p>}
        <div role="radiogroup" aria-label="Qui paie la course ?" className="mt-4 flex flex-wrap gap-2">
          {([["sender", "Je paie la course"], ["recipient", "Le destinataire paie la course"]] as const).map(([k, l]) => (
            <button key={k} type="button" role="radio" aria-checked={feePaidBy === k} onClick={() => setFeePaidBy(k)} className={`h-10 rounded-full px-4 text-[14px] font-medium ring-1 ring-inset ${feePaidBy === k ? "bg-[var(--color-primary)] text-white ring-[var(--color-primary)]" : "bg-white ring-[var(--color-border)]"}`}>{l}</button>
          ))}
        </div>
        <dl className="yc-num mt-5 grid gap-1.5 rounded-[var(--radius-md)] bg-[var(--color-background)] p-4 text-[15px]">
          <div className="flex justify-between gap-3"><dt>Tarif de la course</dt><dd className="font-bold">{fee == null ? "…" : formatXof(fee)}</dd></div>
          <div className="flex justify-between gap-3"><dt>Le livreur encaissera</dt><dd className="font-bold">{formatXof(toCollect)}</dd></div>
          <div className="flex justify-between gap-3 text-[13px] text-[var(--color-text-muted)]"><dt>{feePaidBy === "sender" ? "Tarif déduit de ce qui vous est reversé (ou réglé au bureau)" : "Tarif payé par le destinataire à la livraison"}</dt></div>
        </dl>
      </fieldset>

      <label className="flex items-start gap-3 text-[14px] leading-relaxed">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1 h-4 w-4 accent-[var(--color-primary)]" />
        <span>Je confirme que le colis ne contient rien d&apos;interdit ni de dangereux. Aucun paiement n&apos;est demandé en ligne.</span>
      </label>
      {error && <p role="alert" className="text-[15px] font-semibold text-[var(--color-danger)]">{error}</p>}
      <button type="submit" disabled={pending || !zones.length} className="flex min-h-[54px] w-full items-center justify-center rounded-full bg-[var(--color-accent-primary)] text-[16px] font-bold text-[var(--color-primary)] disabled:opacity-60 sm:w-auto sm:px-10">
        {pending ? "Envoi…" : "Demander la course"}
      </button>
    </form>
  );
}
