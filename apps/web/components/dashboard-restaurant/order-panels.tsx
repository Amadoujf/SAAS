"use client";

import { useState } from "react";
import { Button } from "@/components/yc/button";
import { KITCHEN_LABELS, NEXT_STATUS, PAYMENT_METHOD_LABELS, formatXof } from "@/lib/restaurant/labels";
import { Feedback, section, useRestoAction } from "./shared";

/** Étape suivante ou annulation motivée d'une commande. */
export function OrderActions({ orderId, status, canMove, canCancel }: { orderId: string; status: string; canMove: boolean; canCancel: boolean }) {
  const a = useRestoAction();
  const next = NEXT_STATUS[status];
  const [reason, setReason] = useState("");
  const [cancelOpen, setCancelOpen] = useState(false);
  if (!next) return null;
  return (
    <section className={section} aria-labelledby="etape">
      <h2 id="etape" className="text-[18px] font-bold tracking-[-0.015em]">Service</h2>
      <div className="mt-4 flex flex-wrap gap-2">
        {canMove && next && <Button type="button" variant="royal" loading={a.pending} onClick={() => a.run({ action: "order_status", orderId, to: next }, `Commande : ${KITCHEN_LABELS[next]?.label.toLowerCase()}.`)}>{KITCHEN_LABELS[status]?.action}</Button>}
        {canCancel && !cancelOpen && <Button type="button" variant="secondary" onClick={() => setCancelOpen(true)}>Annuler la commande</Button>}
      </div>
      {cancelOpen && (
        <form className="mt-4 flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); a.run({ action: "order_status", orderId, to: "canceled", note: reason }, "Commande annulée.", () => setCancelOpen(false)); }}>
          <label className="grid min-w-[240px] flex-1 gap-1.5 text-[13px] font-semibold">Motif (visible par le client)
            <input required maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Plat indisponible, client injoignable…" className="h-11 rounded-xl bg-white px-3 text-sm font-normal ring-1 ring-inset ring-yc-ink/12" />
          </label>
          <Button type="submit" variant="danger" loading={a.pending}>Confirmer l&apos;annulation</Button>
        </form>
      )}
      <Feedback error={a.error} notice={a.notice} />
    </section>
  );
}

export interface PaymentRow { id: string; receiptNumber: string; amount: number; method: string; reference: string | null; paidAt: string; voidedAt: string | null; voidReason: string | null }

/** Encaissements réels d'une commande : jamais de trop-perçu, annulation motivée. */
export function PaymentsPanel({ orderId, total, payments, canRecord, canVoid, canceled }: { orderId: string; total: number; payments: PaymentRow[]; canRecord: boolean; canVoid: boolean; canceled: boolean }) {
  const a = useRestoAction();
  const paid = payments.filter((p) => !p.voidedAt).reduce((s, p) => s + p.amount, 0);
  const due = Math.max(0, total - paid);
  const [f, setF] = useState({ amount: String(due), method: "cash", reference: "" });
  return (
    <section className={section} aria-labelledby="encaissements">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="encaissements" className="text-[18px] font-bold tracking-[-0.015em]">Encaissements</h2>
        <p className="yc-num text-sm"><strong>{formatXof(paid)}</strong> sur {formatXof(total)}{due > 0 && !canceled ? <span className="text-[#C2410C]"> · reste {formatXof(due)}</span> : null}</p>
      </div>
      {payments.length > 0 && (
        <ul className="mt-3 divide-y divide-yc-ink/[0.06] rounded-lg ring-1 ring-yc-ink/[0.07]">
          {payments.map((p) => (
            <li key={p.id} className={`flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 text-sm ${p.voidedAt ? "text-yc-ink-soft line-through" : ""}`}>
              <span><span className="font-mono text-xs">{p.receiptNumber}</span> · {PAYMENT_METHOD_LABELS[p.method] ?? p.method}{p.reference ? ` · ${p.reference}` : ""}</span>
              <span className="flex items-center gap-3">
                <span className="yc-num font-semibold">{formatXof(p.amount)}</span>
                {!p.voidedAt && canVoid && (
                  <button type="button" onClick={() => { const r = window.prompt("Motif de l'annulation de l'encaissement :"); if (r) a.run({ action: "void_payment", paymentId: p.id, reason: r }, "Encaissement annulé."); }} className="text-xs font-semibold text-yc-danger hover:underline">Annuler</button>
                )}
              </span>
              {p.voidedAt && <span className="w-full text-xs no-underline">Annulé : {p.voidReason}</span>}
            </li>
          ))}
        </ul>
      )}
      {canRecord && !canceled && due > 0 && (
        <form className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_1.2fr_auto] sm:items-end" onSubmit={(e) => { e.preventDefault(); a.run({ action: "payment", payment: { orderId, amount: Math.round(Number(f.amount.replace(/\s/g, ""))), method: f.method, reference: f.reference || null } }, "Encaissement enregistré.", () => setF({ amount: "", method: "cash", reference: "" })); }}>
          <label className="grid gap-1.5 text-[13px] font-semibold">Montant (FCFA)<input inputMode="numeric" required value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} className="h-11 rounded-xl bg-white px-3 text-sm font-normal ring-1 ring-inset ring-yc-ink/12" /></label>
          <label className="grid gap-1.5 text-[13px] font-semibold">Moyen
            <select value={f.method} onChange={(e) => setF({ ...f, method: e.target.value })} className="h-11 rounded-xl bg-white px-3 text-sm font-normal ring-1 ring-inset ring-yc-ink/12">
              {Object.entries(PAYMENT_METHOD_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <label className="grid gap-1.5 text-[13px] font-semibold">Référence <span className="font-normal text-yc-ink-soft">(facultatif)</span><input maxLength={80} value={f.reference} onChange={(e) => setF({ ...f, reference: e.target.value })} placeholder="N° de transaction" className="h-11 rounded-xl bg-white px-3 text-sm font-normal ring-1 ring-inset ring-yc-ink/12" /></label>
          <Button type="submit" variant="royal" loading={a.pending}>Encaisser</Button>
        </form>
      )}
      <Feedback error={a.error} notice={a.notice} />
    </section>
  );
}
