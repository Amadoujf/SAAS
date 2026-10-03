"use client";

import { useState } from "react";
import { Button } from "@/components/yc/button";
import { Pill } from "@/components/yc/status-pill";
import { BOOKING_LABELS, coversLabel } from "@/lib/restaurant/labels";
import { Feedback, section, useRestoAction } from "./shared";

export interface BookingRow {
  id: string;
  time: string;
  reference: string;
  name: string;
  phone: string | null;
  partySize: number;
  status: string;
  tableId: string | null;
  occasion: string | null;
  note: string | null;
  channel: string;
}

/** Réservations d'une journée : placement à table, arrivée, absence, annulation motivée. */
export function BookingList({ rows, tables, canUpdate, canCancel }: { rows: BookingRow[]; tables: { id: string; label: string; seats: number }[]; canUpdate: boolean; canCancel: boolean }) {
  const a = useRestoAction();
  return (
    <div>
      <Feedback error={a.error} notice={a.notice} />
      <ul className="mt-2 divide-y divide-yc-ink/[0.06] rounded-xl bg-white ring-1 ring-yc-ink/[0.07]">
        {rows.map((b) => {
          const st = BOOKING_LABELS[b.status] ?? BOOKING_LABELS.requested!;
          const active = b.status === "requested" || b.status === "confirmed";
          return (
            <li key={b.id} className={`flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center ${active ? "" : "opacity-60"}`}>
              <span className="yc-num w-16 shrink-0 text-[20px] font-extrabold">{b.time}</span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2 font-semibold">{b.name} · {coversLabel(b.partySize)}<Pill tone={st.tone}>{st.label}</Pill></span>
                <span className="mt-0.5 block text-sm text-yc-ink-soft">
                  {[b.phone && <a key="p" href={`tel:${b.phone}`} className="text-yc-electric">{b.phone}</a>, b.occasion, b.channel === "web" ? "en ligne" : b.channel === "phone" ? "téléphone" : null].filter(Boolean).map((x, i) => <span key={i}>{i > 0 ? " · " : ""}{x}</span>)}
                </span>
                {b.note && <span className="mt-0.5 block text-sm italic">« {b.note} »</span>}
              </span>
              <span className="flex flex-wrap items-center gap-2">
                <select aria-label={`Table pour ${b.name}`} disabled={!canUpdate || !active || a.pending} value={b.tableId ?? ""} onChange={(e) => a.run({ action: "booking_table", reservationId: b.id, tableId: e.target.value || null }, e.target.value ? `${b.name} placé${b.partySize > 1 ? "s" : ""} à la table ${tables.find((t) => t.id === e.target.value)?.label}.` : "Table retirée.")} className="h-10 rounded-lg bg-white px-2.5 text-sm ring-1 ring-inset ring-yc-ink/12">
                  <option value="">Table…</option>
                  {tables.map((t) => <option key={t.id} value={t.id} disabled={t.seats < b.partySize}>Table {t.label} ({t.seats} pl.)</option>)}
                </select>
                {active && canUpdate && <Button type="button" size="sm" variant="royal" loading={a.pending} onClick={() => a.run({ action: "booking_outcome", reservationId: b.id, outcome: "arrived" }, `${b.name} : arrivé${b.partySize > 1 ? "s" : ""}.`)}>Arrivés</Button>}
                {active && canUpdate && <Button type="button" size="sm" variant="secondary" onClick={() => { if (window.confirm(`${b.name} ne s'est pas présenté ?`)) a.run({ action: "booking_outcome", reservationId: b.id, outcome: "no_show" }, "Absence notée."); }}>Absents</Button>}
                {active && canCancel && <button type="button" onClick={() => { const r = window.prompt("Motif de l'annulation :", "Annulé par le client au téléphone"); if (r) a.run({ action: "booking_outcome", reservationId: b.id, outcome: "canceled", note: r }, "Réservation annulée."); }} className="text-sm font-semibold text-yc-danger hover:underline">Annuler</button>}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Réservation prise au téléphone ou au comptoir (sans les limites du site, table au choix). */
export function DeskBookingForm({ date, tables }: { date: string; tables: { id: string; label: string; seats: number }[] }) {
  const a = useRestoAction();
  const [f, setF] = useState({ date, time: "20:00", partySize: "2", firstName: "", lastName: "", phone: "", tableId: "", occasion: "", note: "", channel: "phone" as "phone" | "dashboard" | "whatsapp" });
  const input = "h-10 w-full rounded-lg bg-white px-3 text-sm font-normal ring-1 ring-inset ring-yc-ink/12";
  return (
    <section className={section} aria-labelledby="nouvelle-resa">
      <h2 id="nouvelle-resa" className="text-[18px] font-bold tracking-[-0.015em]">Nouvelle réservation</h2>
      <form
        className="mt-4 grid gap-3 sm:grid-cols-4"
        onSubmit={(e) => {
          e.preventDefault();
          const [h, m] = f.time.split(":").map(Number);
          a.run({ action: "desk_booking", booking: { date: f.date, minute: (h ?? 0) * 60 + (m ?? 0), partySize: Number(f.partySize), firstName: f.firstName, lastName: f.lastName || null, phone: f.phone, tableId: f.tableId || null, occasion: f.occasion || null, note: f.note || null, channel: f.channel } }, "Réservation enregistrée.", () => setF({ ...f, firstName: "", lastName: "", phone: "", tableId: "", occasion: "", note: "" }));
        }}
      >
        <label className="grid gap-1.5 text-[13px] font-semibold">Date<input type="date" required value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} className={input} /></label>
        <label className="grid gap-1.5 text-[13px] font-semibold">Heure<input type="time" required step={900} value={f.time} onChange={(e) => setF({ ...f, time: e.target.value })} className={input} /></label>
        <label className="grid gap-1.5 text-[13px] font-semibold">Couverts<input type="number" required min={1} max={60} value={f.partySize} onChange={(e) => setF({ ...f, partySize: e.target.value })} className={input} /></label>
        <label className="grid gap-1.5 text-[13px] font-semibold">Table <span className="font-normal text-yc-ink-soft">(facultatif)</span>
          <select value={f.tableId} onChange={(e) => setF({ ...f, tableId: e.target.value })} className={input}>
            <option value="">Plus tard</option>
            {tables.map((t) => <option key={t.id} value={t.id}>Table {t.label} ({t.seats} pl.)</option>)}
          </select>
        </label>
        <label className="grid gap-1.5 text-[13px] font-semibold">Prénom<input required maxLength={80} value={f.firstName} onChange={(e) => setF({ ...f, firstName: e.target.value })} className={input} /></label>
        <label className="grid gap-1.5 text-[13px] font-semibold">Nom <span className="font-normal text-yc-ink-soft">(facultatif)</span><input maxLength={80} value={f.lastName} onChange={(e) => setF({ ...f, lastName: e.target.value })} className={input} /></label>
        <label className="grid gap-1.5 text-[13px] font-semibold">Téléphone<input required type="tel" maxLength={20} value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} className={input} /></label>
        <label className="grid gap-1.5 text-[13px] font-semibold">Reçue par
          <select value={f.channel} onChange={(e) => setF({ ...f, channel: e.target.value as typeof f.channel })} className={input}>
            <option value="phone">Téléphone</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="dashboard">Sur place</option>
          </select>
        </label>
        <label className="grid gap-1.5 text-[13px] font-semibold sm:col-span-3">Note <span className="font-normal text-yc-ink-soft">(facultatif)</span><input maxLength={400} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="Anniversaire, chaise bébé…" className={input} /></label>
        <div className="flex items-end"><Button type="submit" size="sm" variant="royal" loading={a.pending}>Réserver</Button></div>
      </form>
      <Feedback error={a.error} notice={a.notice} />
    </section>
  );
}
