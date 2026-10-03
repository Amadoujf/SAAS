"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/yc/button";
import { Field, Input, Select } from "@/components/yc/field";
import { Feedback, section, useSalonAction } from "./shared";

const METHODS: Record<string, string> = { cash: "Espèces", wave: "Wave", orange_money: "Orange Money", card_terminal: "Carte (terminal)", bank_transfer: "Virement" };
const nf = new Intl.NumberFormat("fr-FR");

/** Statut du rendez-vous selon son état, l'heure et les droits du membre. */
export function AppointmentStatusActions({ reservationId, status, started, canUpdate, canCancel }: { reservationId: string; status: string; started: boolean; canUpdate: boolean; canCancel: boolean }) {
  const a = useSalonAction();
  const go = (to: "confirmed" | "completed" | "canceled" | "no_show", done: string) => {
    let note: string | undefined;
    if (to === "canceled") {
      const r = window.prompt("Motif de l'annulation (visible dans l'historique) :");
      if (r === null) return;
      note = r || undefined;
    }
    a.run({ action: "status", reservationId, status: to, note }, done);
  };
  const active = status === "requested" || status === "confirmed";
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {canUpdate && status === "requested" && <Button size="sm" variant="royal" loading={a.pending} onClick={() => go("confirmed", "Rendez-vous confirmé.")}>Confirmer</Button>}
        {canUpdate && active && started && <Button size="sm" variant="royal" loading={a.pending} onClick={() => go("completed", "Prestation marquée comme réalisée.")}>Prestation réalisée</Button>}
        {canUpdate && active && started && <Button size="sm" variant="secondary" loading={a.pending} onClick={() => go("no_show", "Rendez-vous manqué enregistré.")}>Rendez-vous manqué</Button>}
        {canCancel && active && <Button size="sm" variant="danger" loading={a.pending} onClick={() => go("canceled", "Rendez-vous annulé : l'horaire est libéré.")}>Annuler</Button>}
      </div>
      {!started && active && canUpdate && <p className="mt-2 text-xs text-yc-ink-soft">« Réalisée » et « manqué » se renseignent à partir de l&apos;heure du rendez-vous.</p>}
      <Feedback error={a.error} notice={a.notice} />
    </div>
  );
}

interface StaffOption {
  id: string;
  name: string;
}

/** Horaires libres (vue équipe : sans le délai ni le pas imposés au site). */
export function useDeskSlots(listingId: string | null, date: string, staffId: string | null) {
  const [slots, setSlots] = useState<{ startAt: string; label: string; staffIds: string[] }[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!listingId || !date) return;
    let alive = true;
    setSlots(null);
    setError(null);
    const q = new URLSearchParams({ listingId, date, ...(staffId ? { staffId } : {}) });
    fetch(`/api/dashboard/salon/slots?${q}`)
      .then(async (r) => {
        const j = (await r.json()) as { data?: { startAt: string; label: string; staffIds: string[] }[]; error?: string };
        if (!r.ok || !j.data) throw new Error(j.error ?? "Horaires indisponibles.");
        if (alive) setSlots(j.data);
      })
      .catch((e: Error) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [listingId, date, staffId]);
  return { slots, error };
}

export function SlotGrid({ slots, value, onChange, error }: { slots: { startAt: string; label: string }[] | null; value: string | null; onChange: (v: string) => void; error: string | null }) {
  if (error) return <p role="alert" className="text-sm font-medium text-yc-danger">{error}</p>;
  if (!slots) return <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">{Array.from({ length: 8 }, (_, i) => <span key={i} className="h-9 animate-pulse rounded-lg bg-yc-ink/[0.05]" />)}</div>;
  if (slots.length === 0) return <p className="text-sm text-yc-ink-soft">Aucun horaire libre ce jour-là.</p>;
  return (
    <div role="radiogroup" aria-label="Horaire" className="grid grid-cols-4 gap-2 sm:grid-cols-8">
      {slots.map((s) => (
        <button key={s.startAt} type="button" role="radio" aria-checked={value === s.startAt} onClick={() => onChange(s.startAt)} className={`h-9 rounded-lg text-sm font-semibold tabular-nums ring-1 ring-inset ${value === s.startAt ? "bg-yc-royal text-white ring-yc-royal" : "bg-white ring-yc-ink/12 hover:ring-yc-royal"}`}>
          {s.label}
        </button>
      ))}
    </div>
  );
}

/** Déplacer : autre jour, autre horaire, éventuellement autre personne. */
export function MovePanel({ reservationId, listingId, staff, currentStaffId, today, currentDate }: { reservationId: string; listingId: string; staff: StaffOption[]; currentStaffId: string; today: string; currentDate: string }) {
  const a = useSalonAction();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(currentDate < today ? today : currentDate);
  const [staffId, setStaffId] = useState(currentStaffId);
  const [slot, setSlot] = useState<string | null>(null);
  const { slots, error } = useDeskSlots(open ? listingId : null, date, staffId);
  if (!open) {
    return (
      <div>
        <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>Déplacer</Button>
        <Feedback error={a.error} notice={a.notice} />
      </div>
    );
  }
  return (
    <div className="mt-4 grid gap-4 rounded-lg bg-yc-ivory-50 p-4 ring-1 ring-yc-ink/[0.06]">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Jour">{(p) => <Input {...p} type="date" min={today} value={date} onChange={(e) => { setDate(e.target.value); setSlot(null); }} />}</Field>
        <Field label="Avec">{(p) => <Select {...p} value={staffId} onChange={(e) => { setStaffId(e.target.value); setSlot(null); }}>{staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select>}</Field>
      </div>
      <SlotGrid slots={slots} value={slot} onChange={setSlot} error={error} />
      <div className="flex gap-2">
        <Button size="sm" variant="royal" disabled={!slot} loading={a.pending} onClick={() => slot && a.run({ action: "move", reservationId, startAt: slot, staffId }, "Rendez-vous déplacé.", () => { setOpen(false); setSlot(null); })}>Valider le nouvel horaire</Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Fermer</Button>
      </div>
      <Feedback error={a.error} notice={a.notice} />
    </div>
  );
}

export interface PaymentRow {
  id: string;
  receiptNumber: string;
  amount: string;
  method: string;
  reference: string | null;
  paidAt: string;
  voided: boolean;
  voidReason: string | null;
}

/**
 * Encaissement au salon : prix final (« à partir de » ou sur devis) fixé par l'équipe,
 * puis paiement RÉELLEMENT reçu (reçu numéroté). Jamais au-delà du montant ; une erreur
 * s'annule avec un motif et reste visible.
 */
export function CheckoutPanel({ reservationId, total, paid, priceFrom, payments, canRecord, closed }: { reservationId: string; total: number | null; paid: number; priceFrom: boolean; payments: PaymentRow[]; canRecord: boolean; closed: boolean }) {
  const a = useSalonAction();
  const remaining = total == null ? null : Math.max(0, total - paid);
  const [price, setPrice] = useState(total != null ? String(total) : "");
  const [amount, setAmount] = useState(remaining ? String(remaining) : "");
  const [method, setMethod] = useState("cash");
  const [reference, setReference] = useState("");
  useEffect(() => setAmount(remaining ? String(remaining) : ""), [remaining]);
  const toInt = (v: string) => Math.round(Number(v.replace(/\s/g, "")));
  return (
    <section className={section} aria-labelledby="encaissement">
      <h2 id="encaissement" className="text-[18px] font-bold tracking-[-0.015em]">Encaissement</h2>
      <p className="mt-1 text-sm text-yc-ink-soft">Règlement au salon. Enregistrez uniquement ce qui a réellement été reçu.</p>
      <dl className="mt-4 grid grid-cols-3 gap-3 text-sm">
        <div className="rounded-lg bg-yc-ivory-50 p-3"><dt className="text-yc-ink-soft">Montant</dt><dd className="yc-num mt-0.5 text-[17px] font-bold">{total == null ? "Sur devis" : `${nf.format(total)} FCFA`}</dd></div>
        <div className="rounded-lg bg-yc-ivory-50 p-3"><dt className="text-yc-ink-soft">Encaissé</dt><dd className="yc-num mt-0.5 text-[17px] font-bold text-[rgb(4_120_87)]">{nf.format(paid)} FCFA</dd></div>
        <div className="rounded-lg bg-yc-ivory-50 p-3"><dt className="text-yc-ink-soft">Reste</dt><dd className="yc-num mt-0.5 text-[17px] font-bold">{remaining == null ? "—" : `${nf.format(remaining)} FCFA`}</dd></div>
      </dl>
      {canRecord && !closed && paid === 0 && (priceFrom || total == null) && (
        <form className="mt-4 flex flex-wrap items-end gap-3" onSubmit={(e) => { e.preventDefault(); a.run({ action: "final_price", reservationId, total: toInt(price) }, "Prix final enregistré."); }}>
          <div className="w-48"><Field label="Prix final (FCFA)" hint={priceFrom ? "Prestation « à partir de »." : "Prestation sur devis."}>{(p) => <Input {...p} inputMode="numeric" required value={price} onChange={(e) => setPrice(e.target.value)} />}</Field></div>
          <Button type="submit" size="sm" variant="secondary" loading={a.pending}>Fixer le prix</Button>
        </form>
      )}
      {payments.length > 0 && (
        <ul className="mt-4 divide-y divide-yc-ink/[0.06] rounded-lg ring-1 ring-yc-ink/[0.07]">
          {payments.map((p) => (
            <li key={p.id} className={`flex flex-wrap items-center gap-3 px-4 py-3 text-sm ${p.voided ? "text-yc-ink-soft line-through decoration-yc-ink/40" : ""}`}>
              <span className="font-mono text-xs">{p.receiptNumber}</span>
              <span className="font-semibold">{p.amount}</span>
              <span>{METHODS[p.method] ?? p.method}{p.reference ? ` · ${p.reference}` : ""}</span>
              <span className="text-yc-ink-soft">{p.paidAt}</span>
              {p.voided ? <span className="no-underline">Annulé : {p.voidReason}</span> : canRecord && (
                <button type="button" className="ml-auto text-xs font-semibold text-yc-danger hover:underline" onClick={() => { const r = window.prompt("Motif de l'annulation de cet encaissement :"); if (r?.trim()) a.run({ action: "void_payment", paymentId: p.id, reason: r }, "Encaissement annulé."); }}>Annuler</button>
              )}
            </li>
          ))}
        </ul>
      )}
      {canRecord && remaining != null && remaining > 0 && (
        <form
          className="mt-4 grid gap-3 rounded-lg bg-yc-ivory-50 p-4 ring-1 ring-yc-ink/[0.06] sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end"
          onSubmit={(e) => { e.preventDefault(); a.run({ action: "checkout", payment: { reservationId, amount: toInt(amount), method, reference: reference || null } }, "Encaissement enregistré.", () => setReference("")); }}
        >
          <Field label="Montant reçu (FCFA)">{(p) => <Input {...p} inputMode="numeric" required value={amount} onChange={(e) => setAmount(e.target.value)} />}</Field>
          <Field label="Moyen">{(p) => <Select {...p} value={method} onChange={(e) => setMethod(e.target.value)}>{Object.entries(METHODS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select>}</Field>
          <Field label="Référence" optional>{(p) => <Input {...p} maxLength={80} value={reference} onChange={(e) => setReference(e.target.value)} />}</Field>
          <Button type="submit" variant="royal" size="sm" loading={a.pending}>Encaisser</Button>
        </form>
      )}
      {remaining === 0 && total != null && total > 0 && <p className="mt-4 rounded-lg bg-[#E8F6EF] px-4 py-2.5 text-sm font-semibold text-[#0F4D31]">Réglé en totalité.</p>}
      <Feedback error={a.error} notice={a.notice} />
    </section>
  );
}
