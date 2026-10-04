"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/yc/button";
import { Field, Input, Select } from "@/components/yc/field";
import { Feedback, section, useHotelAction } from "./shared";

const METHODS: Record<string, string> = { cash: "Espèces", wave: "Wave", orange_money: "Orange Money", card_terminal: "Carte (terminal)", bank_transfer: "Virement" };
const KINDS: Record<string, string> = { deposit: "Acompte", balance: "Solde", other: "Autre (extras)" };
const nf = new Intl.NumberFormat("fr-FR");

/** Actions du séjour selon son état : confirmer, arrivée, départ, non-présentation, annulation. */
export function StayActions({ reservationId, status, checkedIn, checkedOut, arrivalReached, canUpdate, canCancel }: { reservationId: string; status: string; checkedIn: boolean; checkedOut: boolean; arrivalReached: boolean; canUpdate: boolean; canCancel: boolean }) {
  const a = useHotelAction();
  const active = status === "requested" || status === "confirmed";
  const go = (what: "confirm" | "check_in" | "check_out" | "no_show" | "cancel", done: string) => {
    let note: string | undefined;
    if (what === "cancel") {
      const r = window.prompt("Motif de l'annulation (visible dans l'historique) :");
      if (r === null) return;
      note = r || undefined;
    }
    a.run({ action: "stay", reservationId, do: what, note }, done);
  };
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {canUpdate && status === "requested" && <Button size="sm" variant="royal" loading={a.pending} onClick={() => go("confirm", "Séjour confirmé.")}>Confirmer</Button>}
        {canUpdate && active && !checkedIn && arrivalReached && <Button size="sm" variant="royal" loading={a.pending} onClick={() => go("check_in", "Arrivée enregistrée.")}>Enregistrer l&apos;arrivée</Button>}
        {canUpdate && checkedIn && !checkedOut && <Button size="sm" variant="royal" loading={a.pending} onClick={() => go("check_out", "Départ enregistré : chambre à nettoyer.")}>Enregistrer le départ</Button>}
        {canUpdate && active && !checkedIn && arrivalReached && <Button size="sm" variant="secondary" loading={a.pending} onClick={() => go("no_show", "Non-présentation enregistrée : chambre libérée.")}>Non présenté</Button>}
        {canCancel && active && !checkedIn && <Button size="sm" variant="danger" loading={a.pending} onClick={() => go("cancel", "Séjour annulé : chambre libérée.")}>Annuler</Button>}
      </div>
      {active && !checkedIn && !arrivalReached && canUpdate && <p className="mt-2 text-xs text-yc-ink-soft">L&apos;arrivée s&apos;enregistre à partir du jour prévu.</p>}
      <Feedback error={a.error} notice={a.notice} />
    </div>
  );
}

/** Changer de chambre et/ou de dates ; le serveur vérifie que la chambre est libre et recalcule le prix. */
export function ModifyStayPanel({ reservationId, arrival, departure, roomId, rooms, checkedIn, today }: { reservationId: string; arrival: string; departure: string; roomId: string; rooms: { id: string; label: string }[]; checkedIn: boolean; today: string }) {
  const a = useHotelAction();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ arrival, departure, roomId });
  useEffect(() => setF({ arrival, departure, roomId }), [arrival, departure, roomId]);
  if (!open) {
    return (
      <div>
        <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>Changer de chambre ou de dates</Button>
        <Feedback error={a.error} notice={a.notice} />
      </div>
    );
  }
  return (
    <form
      className="mt-2 grid gap-3 rounded-lg bg-yc-ivory-50 p-4 ring-1 ring-yc-ink/[0.06] sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end"
      onSubmit={(e) => {
        e.preventDefault();
        a.run(
          { action: "modify", reservationId, ...(f.roomId !== roomId ? { roomId: f.roomId } : {}), ...(f.arrival !== arrival ? { arrival: f.arrival } : {}), ...(f.departure !== departure ? { departure: f.departure } : {}) },
          "Séjour modifié.",
          () => setOpen(false),
        );
      }}
    >
      <Field label="Arrivée">{(p) => <Input {...p} type="date" min={today} disabled={checkedIn} value={f.arrival} onChange={(e) => setF({ ...f, arrival: e.target.value })} />}</Field>
      <Field label="Départ">{(p) => <Input {...p} type="date" min={f.arrival} value={f.departure} onChange={(e) => setF({ ...f, departure: e.target.value })} />}</Field>
      <Field label="Chambre">{(p) => <Select {...p} value={f.roomId} onChange={(e) => setF({ ...f, roomId: e.target.value })}>{rooms.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}</Select>}</Field>
      <div className="flex gap-2">
        <Button type="submit" size="sm" variant="royal" loading={a.pending}>Valider</Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>Fermer</Button>
      </div>
      <div className="sm:col-span-4"><Feedback error={a.error} notice={a.notice} /></div>
    </form>
  );
}

export interface PaymentRow {
  id: string;
  receiptNumber: string;
  amount: string;
  kind: string;
  method: string;
  reference: string | null;
  paidAt: string;
  voided: boolean;
  voidReason: string | null;
}

/** Encaissements du séjour (acompte, solde, extras) — reçus numérotés, jamais au-delà du total. */
export function StayPaymentsPanel({ reservationId, total, paid, deposit, payments, canRecord, closed }: { reservationId: string; total: number | null; paid: number; deposit: number; payments: PaymentRow[]; canRecord: boolean; closed: boolean }) {
  const a = useHotelAction();
  const remaining = total == null ? null : Math.max(0, total - paid);
  const suggestedKind = deposit > 0 && paid < deposit ? "deposit" : "balance";
  const suggestedAmount = remaining == null ? 0 : suggestedKind === "deposit" ? deposit - paid : remaining;
  const [amount, setAmount] = useState(suggestedAmount ? String(suggestedAmount) : "");
  const [kind, setKind] = useState(suggestedKind);
  const [method, setMethod] = useState("cash");
  const [reference, setReference] = useState("");
  useEffect(() => { setAmount(suggestedAmount ? String(suggestedAmount) : ""); setKind(suggestedKind); }, [suggestedAmount, suggestedKind]);
  return (
    <section className={section} aria-labelledby="encaissements">
      <h2 id="encaissements" className="text-[18px] font-bold tracking-[-0.015em]">Encaissements</h2>
      <p className="mt-1 text-sm text-yc-ink-soft">Enregistrez uniquement ce qui a réellement été reçu. Le client voit le montant réglé sur son lien de suivi.</p>
      <dl className="mt-4 grid grid-cols-3 gap-3 text-sm">
        <div className="rounded-lg bg-yc-ivory-50 p-3"><dt className="text-yc-ink-soft">Total</dt><dd className="yc-num mt-0.5 text-[17px] font-bold">{total == null ? "Sur demande" : `${nf.format(total)} FCFA`}</dd></div>
        <div className="rounded-lg bg-yc-ivory-50 p-3"><dt className="text-yc-ink-soft">Réglé</dt><dd className="yc-num mt-0.5 text-[17px] font-bold text-[rgb(4_120_87)]">{nf.format(paid)} FCFA</dd></div>
        <div className="rounded-lg bg-yc-ivory-50 p-3"><dt className="text-yc-ink-soft">Reste</dt><dd className="yc-num mt-0.5 text-[17px] font-bold">{remaining == null ? "—" : `${nf.format(remaining)} FCFA`}</dd></div>
      </dl>
      {payments.length > 0 && (
        <ul className="mt-4 divide-y divide-yc-ink/[0.06] rounded-lg ring-1 ring-yc-ink/[0.07]">
          {payments.map((p) => (
            <li key={p.id} className={`flex flex-wrap items-center gap-3 px-4 py-3 text-sm ${p.voided ? "text-yc-ink-soft line-through decoration-yc-ink/40" : ""}`}>
              <span className="font-mono text-xs">{p.receiptNumber}</span>
              <span className="font-semibold">{p.amount}</span>
              <span>{KINDS[p.kind] ?? p.kind} · {METHODS[p.method] ?? p.method}{p.reference ? ` · ${p.reference}` : ""}</span>
              <span className="text-yc-ink-soft">{p.paidAt}</span>
              {p.voided ? <span className="no-underline">Annulé : {p.voidReason}</span> : canRecord && (
                <button type="button" className="ml-auto text-xs font-semibold text-yc-danger hover:underline" onClick={() => { const r = window.prompt("Motif de l'annulation de cet encaissement :"); if (r?.trim()) a.run({ action: "void_payment", paymentId: p.id, reason: r }, "Encaissement annulé."); }}>Annuler</button>
              )}
            </li>
          ))}
        </ul>
      )}
      {canRecord && !closed && remaining != null && remaining > 0 && (
        <form
          className="mt-4 grid gap-3 rounded-lg bg-yc-ivory-50 p-4 ring-1 ring-yc-ink/[0.06] sm:grid-cols-[1fr_1fr_1fr_1fr_auto] sm:items-end"
          onSubmit={(e) => { e.preventDefault(); a.run({ action: "payment", payment: { reservationId, amount: Math.round(Number(amount.replace(/\s/g, ""))), kind, method, reference: reference || null } }, "Encaissement enregistré.", () => setReference("")); }}
        >
          <Field label="Montant (FCFA)">{(p) => <Input {...p} inputMode="numeric" required value={amount} onChange={(e) => setAmount(e.target.value)} />}</Field>
          <Field label="Type">{(p) => <Select {...p} value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>{Object.entries(KINDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select>}</Field>
          <Field label="Moyen">{(p) => <Select {...p} value={method} onChange={(e) => setMethod(e.target.value)}>{Object.entries(METHODS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select>}</Field>
          <Field label="Référence" optional>{(p) => <Input {...p} maxLength={80} value={reference} onChange={(e) => setReference(e.target.value)} />}</Field>
          <Button type="submit" variant="royal" size="sm" loading={a.pending}>Encaisser</Button>
        </form>
      )}
      {remaining === 0 && total != null && total > 0 && <p className="mt-4 rounded-lg bg-[#E8F6EF] px-4 py-2.5 text-sm font-semibold text-[#0F4D31]">Séjour réglé en totalité.</p>}
      <Feedback error={a.error} notice={a.notice} />
    </section>
  );
}
