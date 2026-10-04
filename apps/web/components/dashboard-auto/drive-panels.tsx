"use client";

import { useState } from "react";
import { Button } from "@/components/yc/button";
import { clockLabel } from "@/lib/auto/labels";
import { Feedback, input, label, section, useAutoAction } from "./shared";

/** Résultat d'un essai : effectué, absent, ou annulé avec motif. */
export function DriveOutcome({ reservationId, canCancel, canSettle = true }: { reservationId: string; canCancel: boolean; canSettle?: boolean }) {
  const a = useAutoAction();
  const btn = "rounded-lg px-3 py-1.5 text-[13px] font-semibold ring-1 ring-inset ring-yc-ink/12 hover:bg-yc-ivory-50 disabled:opacity-50";
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {canSettle && <button type="button" disabled={a.pending} className={btn} onClick={() => a.run({ action: "drive_outcome", reservationId, outcome: "done" }, "Essai effectué.")}>Effectué</button>}
        {canSettle && <button type="button" disabled={a.pending} className={btn} onClick={() => a.run({ action: "drive_outcome", reservationId, outcome: "no_show" }, "Client absent noté.")}>Absent</button>}
        {canCancel && (
          <button type="button" disabled={a.pending} className={`${btn} text-yc-danger`} onClick={() => {
            const note = window.prompt("Motif de l'annulation (transmis au client) :");
            if (note?.trim()) a.run({ action: "drive_outcome", reservationId, outcome: "canceled", note }, "Essai annulé : le client est prévenu si un canal est configuré.");
          }}>Annuler</button>
        )}
      </div>
      <Feedback error={a.error} notice={a.notice} />
    </div>
  );
}

/** Essai saisi par l'équipe (appel, WhatsApp, showroom) : mêmes règles que le site (jamais de chevauchement). */
export function DeskDrive({ vehicles, today, hours }: { vehicles: { id: string; title: string }[]; today: string; hours: { weekday: number; startMinute: number; endMinute: number }[] }) {
  const a = useAutoAction();
  const [f, setF] = useState({ listingId: vehicles[0]?.id ?? "", date: today, time: "10:00", firstName: "", lastName: "", phone: "", license: true, note: "", channel: "phone" });
  const wd = new Date(`${f.date}T12:00:00Z`).getUTCDay();
  const open = hours.filter((h) => h.weekday === wd);
  return (
    <section className={section} aria-labelledby="saisir-essai" id="saisir">
      <h2 id="saisir-essai" className="text-[17px] font-bold">Saisir un essai</h2>
      <p className="mt-1 text-sm text-yc-ink-soft">Showroom ce jour-là : {open.length ? open.map((h) => `${clockLabel(h.startMinute)} – ${clockLabel(h.endMinute)}`).join(", ") : "fermé"}.</p>
      {vehicles.length === 0 ? <p className="mt-3 text-sm">Aucun véhicule disponible à l&apos;essai.</p> : (
        <form className="mt-4 grid gap-3 sm:grid-cols-2" onSubmit={(e) => {
          e.preventDefault();
          const [h, m] = f.time.split(":").map(Number);
          a.run({ action: "desk_drive", drive: { listingId: f.listingId, date: f.date, minute: (h ?? 0) * 60 + (m ?? 0), customer: { firstName: f.firstName, lastName: f.lastName || null, phone: f.phone }, licenseConfirmed: f.license, note: f.note || null, channel: f.channel } }, "Essai réservé.", () => setF((x) => ({ ...x, firstName: "", lastName: "", phone: "", note: "" })));
        }}>
          <label className={`${label} sm:col-span-2`}>Véhicule<select value={f.listingId} onChange={(e) => setF({ ...f, listingId: e.target.value })} className={input}>{vehicles.map((v) => <option key={v.id} value={v.id}>{v.title}</option>)}</select></label>
          <label className={label}>Date<input type="date" required min={today} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} className={input} /></label>
          <label className={label}>Heure<input type="time" required step={900} value={f.time} onChange={(e) => setF({ ...f, time: e.target.value })} className={input} /></label>
          <label className={label}>Prénom<input required maxLength={80} value={f.firstName} onChange={(e) => setF({ ...f, firstName: e.target.value })} className={input} /></label>
          <label className={label}>Nom<input maxLength={80} value={f.lastName} onChange={(e) => setF({ ...f, lastName: e.target.value })} className={input} /></label>
          <label className={label}>Téléphone<input required type="tel" maxLength={30} value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} className={input} /></label>
          <label className={label}>Demande reçue par<select value={f.channel} onChange={(e) => setF({ ...f, channel: e.target.value })} className={input}><option value="phone">Téléphone</option><option value="whatsapp">WhatsApp</option><option value="dashboard">Au showroom</option></select></label>
          <label className={`${label} sm:col-span-2`}>Note<input maxLength={400} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} className={input} /></label>
          <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" checked={f.license} onChange={(e) => setF({ ...f, license: e.target.checked })} className="h-4 w-4" />Permis de conduire vérifié ou annoncé par le client</label>
          <div className="sm:col-span-2"><Button type="submit" variant="royal" loading={a.pending}>Réserver l&apos;essai</Button><Feedback error={a.error} notice={a.notice} /></div>
        </form>
      )}
    </section>
  );
}
