"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/yc/button";
import { Field, Input, Select } from "@/components/yc/field";
import { DOCUMENT_LABELS, DOCUMENT_STATUS_LABELS, PAYMENT_KIND_LABELS, PAYMENT_METHOD_LABELS, documentStatusLabel } from "@/lib/travel/labels";
import { postTravel, section } from "./trip-editor";

function useAction() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const run = (body: unknown, success: string, after?: () => void) => {
    setError(null);
    setNotice(null);
    start(async () => {
      try {
        const data = (await postTravel<{ receiptNumber?: string } | null>(body)) ?? null;
        setNotice(data && "receiptNumber" in data && data.receiptNumber ? `${success} Reçu ${data.receiptNumber}.` : success);
        after?.();
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Action impossible.");
      }
    });
  };
  return { pending, error, notice, run };
}

const Feedback = ({ error, notice }: { error: string | null; notice: string | null }) =>
  error ? <p role="alert" className="mt-3 text-sm font-medium text-yc-danger">{error}</p> : notice ? <p role="status" className="mt-3 text-sm font-medium text-[rgb(4_120_87)]">{notice}</p> : null;

/** Statut d'une réservation, selon son état, la date et les droits du membre. */
export function BookingStatusActions({ reservationId, status, past, canUpdate, canCancel }: { reservationId: string; status: string; past: boolean; canUpdate: boolean; canCancel: boolean }) {
  const a = useAction();
  const go = (to: "confirmed" | "completed" | "canceled" | "no_show") => {
    let note: string | undefined;
    if (to === "canceled") {
      const r = window.prompt("Motif de l'annulation (visible dans l'historique) :");
      if (r === null) return;
      note = r;
    }
    a.run({ action: "booking_status", reservationId, status: to, note }, to === "confirmed" ? "Réservation confirmée." : to === "canceled" ? "Réservation annulée : les places sont libérées." : "Statut mis à jour.");
  };
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {canUpdate && status === "requested" && <Button size="sm" variant="royal" loading={a.pending} onClick={() => go("confirmed")}>Confirmer la réservation</Button>}
        {canUpdate && status === "confirmed" && past && <Button size="sm" variant="secondary" loading={a.pending} onClick={() => go("completed")}>Voyage effectué</Button>}
        {canUpdate && status === "confirmed" && past && <Button size="sm" variant="ghost" loading={a.pending} onClick={() => go("no_show")}>Absent au départ</Button>}
        {canCancel && (status === "requested" || status === "confirmed") && <Button size="sm" variant="danger" loading={a.pending} onClick={() => go("canceled")}>Annuler</Button>}
      </div>
      <Feedback error={a.error} notice={a.notice} />
    </div>
  );
}

export interface TravelerView {
  id: string;
  position: number;
  firstName: string;
  lastName: string;
  birthDate: string | null;
  nationality: string | null;
  passportLast4: string | null;
  passportExpiry: string | null;
  isLead: boolean;
  documents: { kind: string; status: string; note: string | null }[];
}

const STATUS_CHOICES: Record<string, string[]> = { visa: ["missing", "submitted", "approved", "refused"], default: ["missing", "received", "approved", "refused"] };

/** Voyageur : identité (passeport chiffré, jamais réaffiché en clair) et suivi des pièces. */
export function TravelerCard({ t, canManage }: { t: TravelerView; canManage: boolean }) {
  const a = useAction();
  const [edit, setEdit] = useState(false);
  const [f, setF] = useState({ firstName: t.firstName, lastName: t.lastName, birthDate: t.birthDate ?? "", nationality: t.nationality ?? "", passportNumber: "", passportExpiry: t.passportExpiry ?? "" });
  return (
    <li className="rounded-lg bg-yc-ivory-50 p-4 ring-1 ring-yc-ink/[0.06]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold">{t.position}. {t.firstName} {t.lastName}{t.isLead && <span className="ml-2 text-xs font-normal text-yc-ink-soft">contact principal</span>}</p>
          <p className="mt-0.5 text-sm text-yc-ink-soft">
            {[t.birthDate && `Né(e) le ${t.birthDate.split("-").reverse().join("/")}`, t.nationality, t.passportLast4 ? `Passeport •••• ${t.passportLast4}` : "Passeport non renseigné", t.passportExpiry && `expire le ${t.passportExpiry.split("-").reverse().join("/")}`].filter(Boolean).join(" · ")}
          </p>
        </div>
        {canManage && <Button size="sm" variant="ghost" onClick={() => setEdit(!edit)}>{edit ? "Fermer" : "Modifier"}</Button>}
      </div>
      {edit && (
        <form className="mt-3 grid gap-3 sm:grid-cols-3" onSubmit={(e) => { e.preventDefault(); a.run({ action: "save_traveler", traveler: { travelerId: t.id, ...f, birthDate: f.birthDate || null, passportExpiry: f.passportExpiry || null, passportNumber: f.passportNumber || null, nationality: f.nationality || null } }, "Voyageur enregistré.", () => setEdit(false)); }}>
          <Field label="Prénom">{(p) => <Input {...p} required value={f.firstName} onChange={(e) => setF({ ...f, firstName: e.target.value })} />}</Field>
          <Field label="Nom">{(p) => <Input {...p} required value={f.lastName} onChange={(e) => setF({ ...f, lastName: e.target.value })} />}</Field>
          <Field label="Nationalité" optional>{(p) => <Input {...p} value={f.nationality} onChange={(e) => setF({ ...f, nationality: e.target.value })} />}</Field>
          <Field label="Date de naissance" optional>{(p) => <Input {...p} type="date" value={f.birthDate} onChange={(e) => setF({ ...f, birthDate: e.target.value })} />}</Field>
          <Field label="N° de passeport" hint={t.passportLast4 ? "Laissez vide pour garder le numéro enregistré." : undefined} optional>{(p) => <Input {...p} value={f.passportNumber} onChange={(e) => setF({ ...f, passportNumber: e.target.value.toUpperCase() })} autoComplete="off" />}</Field>
          <Field label="Expiration du passeport" optional>{(p) => <Input {...p} type="date" value={f.passportExpiry} onChange={(e) => setF({ ...f, passportExpiry: e.target.value })} />}</Field>
          <div className="sm:col-span-3"><Button type="submit" size="sm" variant="royal" loading={a.pending}>Enregistrer</Button></div>
        </form>
      )}
      {t.documents.length > 0 && (
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {t.documents.map((d) => {
            const tone = DOCUMENT_STATUS_LABELS[d.status]?.tone ?? "neutral";
            return (
              <li key={d.kind} className="flex items-center justify-between gap-2 rounded-md bg-white px-3 py-2 ring-1 ring-yc-ink/[0.06]">
                <span className="text-sm">{DOCUMENT_LABELS[d.kind] ?? d.kind}</span>
                {canManage ? (
                  <Select aria-label={`Statut : ${DOCUMENT_LABELS[d.kind]}`} value={d.status} disabled={a.pending} onChange={(e) => a.run({ action: "document_status", travelerId: t.id, kind: d.kind, status: e.target.value }, "Pièce mise à jour.")} className={`h-9 w-auto text-sm ${tone === "warning" ? "text-yc-warning" : tone === "success" ? "text-yc-success" : tone === "danger" ? "text-yc-danger" : ""}`}>
                    {(STATUS_CHOICES[d.kind] ?? STATUS_CHOICES.default!).map((s) => <option key={s} value={s}>{documentStatusLabel(d.kind, s)}</option>)}
                  </Select>
                ) : (
                  <span className="text-sm font-semibold">{documentStatusLabel(d.kind, d.status)}</span>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <Feedback error={a.error} notice={a.notice} />
    </li>
  );
}

export interface PaymentView {
  id: string;
  receiptNumber: string;
  kind: string;
  amount: string;
  method: string;
  reference: string | null;
  paidAt: string;
  voided: boolean;
  voidReason: string | null;
}

/** Encaissements : saisie d'un paiement RÉELLEMENT reçu (montant, moyen, référence, date),
 *  reçu numéroté ; une erreur s'annule avec un motif, la ligne reste visible. */
export function PaymentsPanel({ reservationId, payments, suggested, remaining, canRecord, closed }: { reservationId: string; payments: PaymentView[]; suggested: { kind: "deposit" | "balance"; amount: number } | null; remaining: number | null; canRecord: boolean; closed: boolean }) {
  const a = useAction();
  const today = new Date().toISOString().slice(0, 10);
  const [f, setF] = useState({ amount: suggested ? String(suggested.amount) : "", method: "wave", kind: suggested?.kind ?? "deposit", reference: "", paidAt: today });
  return (
    <section className={section} aria-labelledby="encaissements">
      <h2 id="encaissements" className="text-[18px] font-bold tracking-[-0.015em]">Encaissements</h2>
      <p className="mt-1 text-sm text-yc-ink-soft">Enregistrez uniquement ce que l&apos;agence a réellement reçu. Le client voit le montant reçu et le numéro de reçu.</p>
      {payments.length > 0 && (
        <ul className="mt-4 divide-y divide-yc-ink/[0.06] rounded-lg ring-1 ring-yc-ink/[0.07]">
          {payments.map((p) => (
            <li key={p.id} className={`flex flex-wrap items-center gap-3 px-4 py-3 text-sm ${p.voided ? "text-yc-ink-soft line-through decoration-yc-ink/40" : ""}`}>
              <span className="font-mono text-xs">{p.receiptNumber}</span>
              <span className="font-semibold">{p.amount}</span>
              <span>{PAYMENT_KIND_LABELS[p.kind]} · {PAYMENT_METHOD_LABELS[p.method]}{p.reference ? ` · ${p.reference}` : ""}</span>
              <span className="text-yc-ink-soft">{p.paidAt}</span>
              {p.voided ? (
                <span className="no-underline">Annulé : {p.voidReason}</span>
              ) : (
                canRecord && <button type="button" className="ml-auto text-xs font-semibold text-yc-danger hover:underline" onClick={() => { const r = window.prompt("Motif de l'annulation de cet encaissement :"); if (r?.trim()) a.run({ action: "void_payment", paymentId: p.id, reason: r }, "Encaissement annulé."); }}>Annuler</button>
              )}
            </li>
          ))}
        </ul>
      )}
      {canRecord && !closed && remaining !== 0 && (
        <form
          className="mt-4 grid gap-3 rounded-lg bg-yc-ivory-50 p-4 ring-1 ring-yc-ink/[0.06] sm:grid-cols-3"
          onSubmit={(e) => {
            e.preventDefault();
            a.run({ action: "record_payment", payment: { reservationId, amount: Math.round(Number(f.amount.replace(/\s/g, ""))), method: f.method, kind: f.kind, reference: f.reference || null, paidAt: f.paidAt } }, "Encaissement enregistré.", () => setF({ ...f, amount: "", reference: "" }));
          }}
        >
          <Field label="Montant reçu (FCFA)" hint={remaining != null ? `Reste à payer : ${new Intl.NumberFormat("fr-FR").format(remaining)} FCFA` : undefined}>{(p) => <Input {...p} inputMode="numeric" required value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} />}</Field>
          <Field label="Moyen">{(p) => <Select {...p} value={f.method} onChange={(e) => setF({ ...f, method: e.target.value })}>{Object.entries(PAYMENT_METHOD_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select>}</Field>
          <Field label="Type">{(p) => <Select {...p} value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value as "deposit" | "balance" })}>{Object.entries(PAYMENT_KIND_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select>}</Field>
          <Field label="Référence (transaction, chèque…)" optional>{(p) => <Input {...p} maxLength={80} value={f.reference} onChange={(e) => setF({ ...f, reference: e.target.value })} />}</Field>
          <Field label="Date du paiement">{(p) => <Input {...p} type="date" max={today} value={f.paidAt} onChange={(e) => setF({ ...f, paidAt: e.target.value })} />}</Field>
          <div className="flex items-end"><Button type="submit" variant="royal" size="sm" loading={a.pending} className="w-full">Enregistrer l&apos;encaissement</Button></div>
        </form>
      )}
      <Feedback error={a.error} notice={a.notice} />
    </section>
  );
}
