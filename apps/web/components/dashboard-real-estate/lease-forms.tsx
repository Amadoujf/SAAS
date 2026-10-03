"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/yc/button";
import { Field, Input, Select, Textarea } from "@/components/yc/field";
import { RENT_METHOD_LABELS } from "@/lib/real-estate/labels";
import { postRealEstate } from "./property-editor";

const num = (v: string) => (v.trim() === "" ? 0 : Math.max(0, Math.round(Number(v.replace(/\s/g, "")))));
const today = () => new Date().toISOString().slice(0, 10);

function useAction() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<unknown>, ok: string | ((d: unknown) => string), after?: () => void) => {
    setError(null);
    setNotice(null);
    start(async () => {
      try {
        const data = await fn();
        setNotice(typeof ok === "function" ? ok(data) : ok);
        after?.();
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Action impossible.");
      }
    });
  };
  return { error, notice, pending, run };
}

/** Ouverture d'un bail sur un bien à louer sans bail actif. */
export function OpenLeaseForm({ properties }: { properties: { id: string; title: string; price: number | null }[] }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ listingId: properties[0]?.id ?? "", firstName: "", lastName: "", phone: "", email: "", landlordName: "", landlordPhone: "", startDate: today(), endDate: "", monthlyRent: String(properties[0]?.price ?? ""), charges: "0", depositAmount: "", dueDay: "5", notes: "" });
  const { error, notice, pending, run } = useAction();
  const set = (patch: Partial<typeof f>) => setF((s) => ({ ...s, ...patch }));
  if (!properties.length) return <p className="px-5 pb-5 text-sm text-yc-ink-soft">Aucun bien à louer disponible : un bail s&apos;ouvre sur un bien « À louer » qui n&apos;a pas déjà un bail en cours.</p>;
  if (!open) return <div className="px-5 pb-5"><Button variant="royal" onClick={() => setOpen(true)}>Ouvrir un bail</Button>{notice && <p role="status" className="mt-3 text-sm font-medium text-[rgb(4_120_87)]">{notice}</p>}</div>;
  return (
    <form
      className="grid gap-4 px-5 pb-5 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        run(
          () => postRealEstate<{ reference: string }>({
            action: "open_lease",
            lease: {
              listingId: f.listingId,
              occupant: { firstName: f.firstName, lastName: f.lastName || undefined, phone: f.phone, email: f.email || undefined },
              landlordName: f.landlordName || null,
              landlordPhone: f.landlordPhone || null,
              startDate: f.startDate,
              endDate: f.endDate || null,
              monthlyRent: num(f.monthlyRent),
              charges: num(f.charges),
              depositAmount: num(f.depositAmount),
              dueDay: num(f.dueDay) || 5,
              notes: f.notes || null,
            },
          }),
          (d) => `Bail ${(d as { reference: string }).reference} ouvert : l'échéancier des loyers est créé et le bien est retiré du site.`,
          () => setOpen(false),
        );
      }}
    >
      <div className="sm:col-span-2">
        <Field label="Bien">{(p) => (
          <Select {...p} value={f.listingId} onChange={(e) => { const prop = properties.find((x) => x.id === e.target.value); set({ listingId: e.target.value, monthlyRent: String(prop?.price ?? f.monthlyRent) }); }}>
            {properties.map((x) => <option key={x.id} value={x.id}>{x.title}</option>)}
          </Select>
        )}</Field>
      </div>
      <Field label="Prénom du locataire">{(p) => <Input {...p} required maxLength={80} value={f.firstName} onChange={(e) => set({ firstName: e.target.value })} />}</Field>
      <Field label="Nom du locataire" optional>{(p) => <Input {...p} maxLength={80} value={f.lastName} onChange={(e) => set({ lastName: e.target.value })} />}</Field>
      <Field label="Téléphone du locataire">{(p) => <Input {...p} required type="tel" inputMode="tel" maxLength={20} value={f.phone} onChange={(e) => set({ phone: e.target.value })} placeholder="77 123 45 67" />}</Field>
      <Field label="E-mail du locataire" optional>{(p) => <Input {...p} type="email" maxLength={200} value={f.email} onChange={(e) => set({ email: e.target.value })} />}</Field>
      <Field label="Propriétaire (bailleur)" optional>{(p) => <Input {...p} maxLength={120} value={f.landlordName} onChange={(e) => set({ landlordName: e.target.value })} />}</Field>
      <Field label="Téléphone du propriétaire" optional>{(p) => <Input {...p} type="tel" maxLength={20} value={f.landlordPhone} onChange={(e) => set({ landlordPhone: e.target.value })} />}</Field>
      <Field label="Début du bail">{(p) => <Input {...p} required type="date" value={f.startDate} onChange={(e) => set({ startDate: e.target.value })} />}</Field>
      <Field label="Fin du bail" optional hint="Laissez vide pour un bail sans date de fin.">{(p) => <Input {...p} type="date" value={f.endDate} onChange={(e) => set({ endDate: e.target.value })} />}</Field>
      <Field label="Loyer mensuel (FCFA)">{(p) => <Input {...p} required inputMode="numeric" value={f.monthlyRent} onChange={(e) => set({ monthlyRent: e.target.value })} />}</Field>
      <Field label="Charges mensuelles (FCFA)">{(p) => <Input {...p} inputMode="numeric" value={f.charges} onChange={(e) => set({ charges: e.target.value })} />}</Field>
      <Field label="Caution (FCFA)" optional>{(p) => <Input {...p} inputMode="numeric" value={f.depositAmount} onChange={(e) => set({ depositAmount: e.target.value })} />}</Field>
      <Field label="Jour d'échéance" hint="Entre 1 et 28.">{(p) => <Input {...p} required inputMode="numeric" value={f.dueDay} onChange={(e) => set({ dueDay: e.target.value })} />}</Field>
      <div className="sm:col-span-2"><Field label="Notes" optional>{(p) => <Textarea {...p} rows={3} maxLength={1000} value={f.notes} onChange={(e) => set({ notes: e.target.value })} />}</Field></div>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <Button type="submit" variant="royal" loading={pending}>Ouvrir le bail</Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Annuler</Button>
        {error && <p role="alert" className="text-sm font-medium text-yc-danger">{error}</p>}
      </div>
    </form>
  );
}

/** Enregistrement d'un encaissement RÉEL sur une échéance (jamais automatique). */
export function RecordRentForm({ rentPaymentId, remaining, period }: { rentPaymentId: string; remaining: number; period: string }) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(String(remaining));
  const [method, setMethod] = useState("wave");
  const [reference, setReference] = useState("");
  const [paidAt, setPaidAt] = useState(today());
  const { error, notice, pending, run } = useAction();
  if (!open) {
    return (
      <div className="flex flex-col items-start gap-1 sm:items-end">
        <Button size="sm" variant="secondary" onClick={() => { setAmount(String(remaining)); setOpen(true); }}>Enregistrer un paiement</Button>
        {notice && <p role="status" className="text-xs font-medium text-[rgb(4_120_87)]">{notice}</p>}
      </div>
    );
  }
  return (
    <form
      aria-label={`Paiement du loyer ${period}`}
      className="grid w-full gap-2 rounded-lg bg-yc-ivory-50 p-3 ring-1 ring-yc-ink/[0.06] sm:w-auto sm:grid-cols-[120px_140px_130px_140px_auto] sm:items-end"
      onSubmit={(e) => {
        e.preventDefault();
        run(
          () => postRealEstate<{ status: string; receiptNumber: string | null }>({ action: "record_rent", payment: { rentPaymentId, amountPaid: num(amount), method, paymentReference: reference || null, paidAt } }),
          (d) => ((d as { status: string; receiptNumber: string | null }).status === "paid" ? `Loyer soldé — quittance ${(d as { receiptNumber: string }).receiptNumber}.` : "Paiement partiel enregistré."),
          () => setOpen(false),
        );
      }}
    >
      <label className="grid gap-1 text-xs font-semibold">Montant<input required inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} className="h-9 rounded-md bg-white px-2 text-sm ring-1 ring-inset ring-yc-ink/15" /></label>
      <label className="grid gap-1 text-xs font-semibold">Moyen
        <select value={method} onChange={(e) => setMethod(e.target.value)} className="h-9 rounded-md bg-white px-2 text-sm ring-1 ring-inset ring-yc-ink/15">
          {Object.entries(RENT_METHOD_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </label>
      <label className="grid gap-1 text-xs font-semibold">Date<input required type="date" max={today()} value={paidAt} onChange={(e) => setPaidAt(e.target.value)} className="h-9 rounded-md bg-white px-2 text-sm ring-1 ring-inset ring-yc-ink/15" /></label>
      <label className="grid gap-1 text-xs font-semibold">Référence<input maxLength={80} value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Facultatif" className="h-9 rounded-md bg-white px-2 text-sm ring-1 ring-inset ring-yc-ink/15" /></label>
      <span className="flex gap-1.5">
        <Button type="submit" size="sm" variant="royal" loading={pending}>Valider</Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>Annuler</Button>
      </span>
      {error && <p role="alert" className="text-xs font-medium text-yc-danger sm:col-span-5">{error}</p>}
    </form>
  );
}

export function EndLeaseButton({ leaseId, reference }: { leaseId: string; reference: string }) {
  const [endDate, setEndDate] = useState(today());
  const [open, setOpen] = useState(false);
  const { error, pending, run } = useAction();
  if (!open) return <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>Terminer le bail</Button>;
  return (
    <div className="flex flex-wrap items-end gap-2">
      <label className="grid gap-1 text-xs font-semibold">Date de fin<input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-9 rounded-md bg-white px-2 text-sm ring-1 ring-inset ring-yc-ink/15" /></label>
      <Button size="sm" variant="danger" loading={pending} onClick={() => {
        if (!window.confirm(`Terminer le bail ${reference} ? Les échéances postérieures seront annulées ; les loyers impayés passés restent dus.`)) return;
        run(() => postRealEstate({ action: "close_lease", leaseId, endDate, status: "ended" }), "Bail terminé.", () => setOpen(false));
      }}>Confirmer la fin</Button>
      <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Annuler</Button>
      {error && <p role="alert" className="w-full text-xs font-medium text-yc-danger">{error}</p>}
    </div>
  );
}
