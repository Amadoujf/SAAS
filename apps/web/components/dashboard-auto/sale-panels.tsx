"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/yc/button";
import { PAYMENT_METHOD_LABELS, formatNumber } from "@/lib/auto/labels";
import { Feedback, input, label, parseAmount, postAuto, section, useAutoAction } from "./shared";

type Vehicle = { id: string; title: string; price: number | null };
type Prospect = { id: string; name: string; listingId: string | null };

/** Ouvrir un dossier : véhicule disponible, client (prospect ou nouveau), prix convenu, reprise. */
export function OpenSale({ vehicles, prospects, initialVehicle, initialProspect, depositPercent }: { vehicles: Vehicle[]; prospects: Prospect[]; initialVehicle: string | null; initialProspect: string | null; depositPercent: number }) {
  const router = useRouter();
  const [f, setF] = useState({ listingId: initialVehicle ?? vehicles[0]?.id ?? "", leadId: initialProspect ?? "", firstName: "", lastName: "", phone: "", agreed: "", tradeIn: "", tradeInDescription: "", note: "" });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const v = vehicles.find((x) => x.id === f.listingId);
  const agreed = parseAmount(f.agreed) ?? v?.price ?? 0;
  const trade = parseAmount(f.tradeIn) ?? 0;
  const total = Math.max(0, agreed - trade);
  return (
    <section className={section} id="ouvrir" aria-labelledby="ouvrir-titre">
      <h2 id="ouvrir-titre" className="text-[17px] font-bold">Ouvrir un dossier de vente</h2>
      <p className="mt-1 text-sm text-yc-ink-soft">Le véhicule passe « réservé » et disparaît des essais. Il ne sera « vendu » qu&apos;à la remise des clés, une fois tout réglé.</p>
      {vehicles.length === 0 ? <p className="mt-3 text-sm">Aucun véhicule disponible.</p> : (
        <form className="mt-4 grid gap-3" onSubmit={async (e) => {
          e.preventDefault();
          setPending(true);
          setError(null);
          try {
            const data = await postAuto<{ id: string }>({ action: "open_sale", sale: { listingId: f.listingId, leadId: f.leadId || null, customer: f.leadId ? null : { firstName: f.firstName, lastName: f.lastName || null, phone: f.phone }, agreedPrice: parseAmount(f.agreed), tradeInValue: trade, tradeInDescription: f.tradeInDescription || null, note: f.note || null } });
            router.push(`/dashboard/dossiers/${data.id}`);
          } catch (err) {
            setError(err instanceof Error ? err.message : "Ouverture impossible.");
            setPending(false);
          }
        }}>
          <label className={label}>Véhicule<select value={f.listingId} onChange={(e) => setF({ ...f, listingId: e.target.value })} className={input}>{vehicles.map((x) => <option key={x.id} value={x.id}>{x.title}{x.price ? ` — ${formatNumber(x.price)} FCFA` : ""}</option>)}</select></label>
          <label className={label}>Client<select value={f.leadId} onChange={(e) => setF({ ...f, leadId: e.target.value })} className={input}><option value="">Nouveau client</option>{prospects.map((p) => <option key={p.id} value={p.id}>{p.name}{p.listingId === f.listingId ? " (intéressé par ce véhicule)" : ""}</option>)}</select></label>
          {!f.leadId && (
            <div className="grid gap-3 sm:grid-cols-3">
              <label className={label}>Prénom<input required maxLength={80} value={f.firstName} onChange={(e) => setF({ ...f, firstName: e.target.value })} className={input} /></label>
              <label className={label}>Nom<input maxLength={80} value={f.lastName} onChange={(e) => setF({ ...f, lastName: e.target.value })} className={input} /></label>
              <label className={label}>Téléphone<input required type="tel" maxLength={30} value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} className={input} /></label>
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className={label}>Prix convenu (FCFA)<input inputMode="numeric" value={f.agreed} onChange={(e) => setF({ ...f, agreed: e.target.value.replace(/[^\d\s]/g, "") })} placeholder={v?.price ? `${formatNumber(v.price)} (prix affiché)` : "À saisir"} className={input} /></label>
            <label className={label}>Reprise (FCFA)<input inputMode="numeric" value={f.tradeIn} onChange={(e) => setF({ ...f, tradeIn: e.target.value.replace(/[^\d\s]/g, "") })} placeholder="0" className={input} /></label>
          </div>
          {trade > 0 && <label className={label}>Véhicule repris<input required maxLength={200} value={f.tradeInDescription} onChange={(e) => setF({ ...f, tradeInDescription: e.target.value })} placeholder="Marque, modèle, année, kilométrage" className={input} /></label>}
          <p className="rounded-lg bg-yc-ivory-50 px-3 py-2 text-sm ring-1 ring-yc-ink/[0.06]">Reste à payer par le client : <strong className="yc-num">{formatNumber(total)} FCFA</strong>{depositPercent > 0 && total > 0 ? <> · acompte conseillé ({depositPercent} %) : <span className="yc-num">{formatNumber(Math.round((total * depositPercent) / 100))} FCFA</span></> : null}</p>
          <div><Button type="submit" variant="royal" loading={pending}>Ouvrir le dossier</Button>{error && <p role="alert" className="mt-3 text-sm font-medium text-yc-danger">{error}</p>}</div>
        </form>
      )}
    </section>
  );
}

/** Encaisser (acompte, solde) : reçu numéroté, jamais plus que le reste à payer. */
export function SalePayment({ reservationId, remaining }: { reservationId: string; remaining: number }) {
  const a = useAutoAction();
  const [f, setF] = useState({ amount: "", method: "wave", kind: "deposit", reference: "" });
  return (
    <form className="grid gap-3" onSubmit={(e) => { e.preventDefault(); a.run({ action: "payment", payment: { reservationId, amount: parseAmount(f.amount) ?? 0, method: f.method, kind: f.kind, reference: f.reference || null } }, "Encaissement enregistré.", () => setF({ ...f, amount: "", reference: "" })); }}>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={label}>Montant reçu (FCFA)<input required inputMode="numeric" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value.replace(/[^\d\s]/g, "") })} placeholder={formatNumber(remaining)} className={input} /></label>
        <label className={label}>Type<select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })} className={input}><option value="deposit">Acompte</option><option value="balance">Solde</option><option value="other">Autre</option></select></label>
        <label className={label}>Moyen<select value={f.method} onChange={(e) => setF({ ...f, method: e.target.value })} className={input}>{Object.entries(PAYMENT_METHOD_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
        <label className={label}>Référence <span className="font-normal text-yc-ink-soft">(transaction, virement)</span><input maxLength={80} value={f.reference} onChange={(e) => setF({ ...f, reference: e.target.value })} className={input} /></label>
      </div>
      <p className="text-xs text-yc-ink-soft">Enregistrez uniquement un paiement réellement reçu et vérifié (Wave, Orange Money, virement, espèces, terminal). Aucun paiement n&apos;est encaissé en ligne.</p>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="royal" loading={a.pending}>Enregistrer l&apos;encaissement</Button>
        <Button type="button" variant="secondary" onClick={() => setF({ ...f, amount: formatNumber(remaining), kind: "balance" })}>Solde complet</Button>
      </div>
      <Feedback error={a.error} notice={a.notice} />
    </form>
  );
}

export function VoidPayment({ paymentId }: { paymentId: string }) {
  const a = useAutoAction();
  return (
    <span>
      <button type="button" disabled={a.pending} onClick={() => { const r = window.prompt("Motif de l'annulation de cet encaissement (remboursement, erreur de saisie…) :"); if (r?.trim()) a.run({ action: "void_payment", paymentId, reason: r }, "Encaissement annulé."); }} className="text-xs font-semibold text-yc-danger hover:underline">Annuler</button>
      {a.error && <span role="alert" className="block text-xs text-yc-danger">{a.error}</span>}
    </span>
  );
}

export function SaleClose({ reservationId, paidInFull, hasPayments, canCancel }: { reservationId: string; paidInFull: boolean; hasPayments: boolean; canCancel: boolean }) {
  const a = useAutoAction();
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="royal" disabled={!paidInFull} loading={a.pending} onClick={() => window.confirm("Confirmer la remise des clés ? Le véhicule passera « vendu ».") && a.run({ action: "deliver", reservationId }, "Véhicule remis : vendu.")}>Remettre les clés</Button>
        {canCancel && <Button type="button" variant="danger" disabled={hasPayments || a.pending} onClick={() => { const r = window.prompt("Motif de l'annulation du dossier :"); if (r?.trim()) a.run({ action: "cancel_sale", reservationId, reason: r }, "Dossier annulé : véhicule remis en stock."); }}>Annuler le dossier</Button>}
      </div>
      {!paidInFull && <p className="mt-2 text-xs text-yc-ink-soft">La remise des clés s&apos;active quand tout est réglé.</p>}
      {hasPayments && canCancel && <p className="mt-1 text-xs text-yc-ink-soft">Pour annuler, annulez d&apos;abord chaque encaissement (remboursement) avec son motif.</p>}
      <Feedback error={a.error} notice={a.notice} />
    </div>
  );
}
