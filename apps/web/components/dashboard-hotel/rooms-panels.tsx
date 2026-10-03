"use client";

import { useState } from "react";
import { Button } from "@/components/yc/button";
import { Field, Input } from "@/components/yc/field";
import { Feedback, section, useHotelAction } from "./shared";

const HK = [
  { key: "clean", label: "Propre", cls: "bg-[#E8F6EF] text-[#0F4D31] ring-[#3FA176]" },
  { key: "dirty", label: "À nettoyer", cls: "bg-[#FFF3DC] text-[#6B4300] ring-[#EBA93A]" },
  { key: "inspected", label: "Vérifiée", cls: "bg-[#E6EDFF] text-[#15296B] ring-[#5B7FE0]" },
  { key: "out_of_service", label: "Hors service", cls: "bg-[#FDECEC] text-[#7A1717] ring-[#D65A5A]" },
];

export interface RoomTile {
  id: string;
  number: string;
  floor: string | null;
  housekeeping: string;
  note: string | null;
  isActive: boolean;
  occupant: string | null;
}

/** Tableau du ménage : chaque chambre, son occupant éventuel, son état en un toucher. */
export function HousekeepingBoard({ rooms, canChange }: { rooms: RoomTile[]; canChange: boolean }) {
  const a = useHotelAction();
  return (
    <div>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {rooms.map((r) => {
          const cur = HK.find((h) => h.key === r.housekeeping) ?? HK[0]!;
          return (
            <li key={r.id} className={`rounded-lg p-3.5 ring-1 ring-inset ${cur.cls} ${r.isActive ? "" : "opacity-50"}`}>
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-[20px] font-bold">{r.number}</p>
                <p className="text-xs font-semibold">{cur.label}</p>
              </div>
              <p className="mt-0.5 truncate text-xs">{r.occupant ? `Occupée · ${r.occupant}` : "Libre"}{r.floor ? ` · ${r.floor}` : ""}</p>
              {r.note && <p className="mt-1 truncate text-xs italic">{r.note}</p>}
              {canChange && (
                <div className="mt-2.5 flex flex-wrap gap-1">
                  {HK.filter((h) => h.key !== r.housekeeping).map((h) => (
                    <button
                      key={h.key}
                      type="button"
                      disabled={a.pending}
                      onClick={() => {
                        let note: string | null | undefined;
                        if (h.key === "out_of_service") {
                          const n = window.prompt("Raison (visible par l'équipe) :", r.note ?? "");
                          if (n === null) return;
                          note = n || null;
                        } else if (r.housekeeping === "out_of_service") note = null;
                        a.run({ action: "housekeeping", roomId: r.id, status: h.key, note }, `Chambre ${r.number} : ${h.label.toLowerCase()}.`);
                      }}
                      className="rounded-md bg-white/80 px-2 py-1 text-[11.5px] font-semibold text-yc-ink ring-1 ring-inset ring-yc-ink/10 hover:bg-white"
                    >
                      {h.label}
                    </button>
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <Feedback error={a.error} notice={a.notice} />
    </div>
  );
}

export function AddRoomForm({ listingId }: { listingId: string }) {
  const a = useHotelAction();
  const [f, setF] = useState({ number: "", floor: "" });
  return (
    <form className="mt-3 flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); a.run({ action: "add_room", listingId, number: f.number, floor: f.floor || null }, `Chambre ${f.number} ajoutée.`, () => setF({ number: "", floor: "" })); }}>
      <div className="w-28"><Field label="Numéro">{(p) => <Input {...p} required maxLength={20} value={f.number} onChange={(e) => setF({ ...f, number: e.target.value })} />}</Field></div>
      <div className="w-40"><Field label="Étage" optional>{(p) => <Input {...p} maxLength={40} value={f.floor} onChange={(e) => setF({ ...f, floor: e.target.value })} />}</Field></div>
      <Button type="submit" size="sm" variant="secondary" loading={a.pending}>Ajouter la chambre</Button>
      <div className="w-full"><Feedback error={a.error} notice={a.notice} /></div>
    </form>
  );
}

/** Tarifs par période d'un type (fêtes, haute saison) — jamais deux périodes qui se chevauchent. */
export function RatesPanel({ listingId, rates, basePrice }: { listingId: string; rates: { id: string; label: string; period: string; price: string }[]; basePrice: string }) {
  const a = useHotelAction();
  const [f, setF] = useState({ startDate: "", endDate: "", nightlyPrice: "", label: "" });
  return (
    <section className={section}>
      <h2 className="text-[18px] font-bold tracking-[-0.015em]">Tarifs par période</h2>
      <p className="mt-1 text-sm text-yc-ink-soft">Prix de base : {basePrice} par nuit. Une période le remplace pour les nuits concernées (la date de fin n&apos;est pas incluse).</p>
      {rates.length > 0 && (
        <ul className="mt-3 divide-y divide-yc-ink/[0.06] rounded-lg ring-1 ring-yc-ink/[0.07]">
          {rates.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 text-sm">
              <span><strong>{r.label}</strong> · {r.period}</span>
              <span className="flex items-center gap-3"><span className="yc-num font-semibold">{r.price}</span><button type="button" onClick={() => a.run({ action: "delete_rate", rateId: r.id }, "Tarif supprimé.")} className="text-xs font-semibold text-yc-danger hover:underline">Supprimer</button></span>
            </li>
          ))}
        </ul>
      )}
      <form className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_1fr_1.3fr_auto] sm:items-end" onSubmit={(e) => { e.preventDefault(); a.run({ action: "add_rate", rate: { listingId, startDate: f.startDate, endDate: f.endDate, nightlyPrice: Math.round(Number(f.nightlyPrice.replace(/\s/g, ""))), label: f.label || null } }, "Tarif ajouté.", () => setF({ startDate: "", endDate: "", nightlyPrice: "", label: "" })); }}>
        <Field label="Du">{(p) => <Input {...p} type="date" required value={f.startDate} onChange={(e) => setF({ ...f, startDate: e.target.value })} />}</Field>
        <Field label="Au (exclu)">{(p) => <Input {...p} type="date" required min={f.startDate} value={f.endDate} onChange={(e) => setF({ ...f, endDate: e.target.value })} />}</Field>
        <Field label="Prix par nuit">{(p) => <Input {...p} inputMode="numeric" required value={f.nightlyPrice} onChange={(e) => setF({ ...f, nightlyPrice: e.target.value })} />}</Field>
        <Field label="Nom" optional>{(p) => <Input {...p} maxLength={60} value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} placeholder="Fêtes de fin d'année" />}</Field>
        <Button type="submit" size="sm" variant="secondary" loading={a.pending}>Ajouter</Button>
      </form>
      <Feedback error={a.error} notice={a.notice} />
    </section>
  );
}

export function HotelSettingsPanel({ initial }: { initial: { autoConfirm: boolean; cancelFreeHours: number; maxAdvanceDays: number; maxNights: number } }) {
  const a = useHotelAction();
  const [f, setF] = useState(initial);
  const sel = "h-11 w-full rounded-xl bg-white px-3 text-sm ring-1 ring-inset ring-yc-ink/12";
  return (
    <section className={section} aria-labelledby="regles">
      <h2 id="regles" className="text-[18px] font-bold tracking-[-0.015em]">Réservation en ligne</h2>
      <form className="mt-4 grid gap-4 sm:grid-cols-3" onSubmit={(e) => { e.preventDefault(); a.run({ action: "save_settings", settings: f }, "Règles enregistrées."); }}>
        <label className="grid gap-1.5 text-[13px] font-semibold">Annulation en ligne jusqu&apos;à
          <select className={sel} value={f.cancelFreeHours} onChange={(e) => setF({ ...f, cancelFreeHours: Number(e.target.value) })}>{[0, 24, 48, 72, 168, 336].map((v) => <option key={v} value={v}>{v === 0 ? "L'arrivée" : v < 168 ? `${v} h avant l'arrivée` : `${v / 24} jours avant`}</option>)}</select>
        </label>
        <label className="grid gap-1.5 text-[13px] font-semibold">Réservable jusqu&apos;à
          <select className={sel} value={f.maxAdvanceDays} onChange={(e) => setF({ ...f, maxAdvanceDays: Number(e.target.value) })}>{[30, 90, 180, 365, 730].map((v) => <option key={v} value={v}>{v} jours à l&apos;avance</option>)}</select>
        </label>
        <label className="grid gap-1.5 text-[13px] font-semibold">Séjour maximum en ligne
          <select className={sel} value={f.maxNights} onChange={(e) => setF({ ...f, maxNights: Number(e.target.value) })}>{[7, 14, 30, 60, 90].map((v) => <option key={v} value={v}>{v} nuits</option>)}</select>
        </label>
        <label className="flex items-start gap-2.5 text-sm sm:col-span-2"><input type="checkbox" checked={f.autoConfirm} onChange={(e) => setF({ ...f, autoConfirm: e.target.checked })} className="mt-0.5 h-4 w-4 accent-yc-royal" /><span><span className="font-medium">Confirmer automatiquement</span><span className="block text-yc-ink-soft">Sinon, chaque réservation en ligne attend votre confirmation (la chambre reste bloquée en attendant).</span></span></label>
        <div className="flex items-end"><Button type="submit" size="sm" variant="royal" loading={a.pending}>Enregistrer</Button></div>
      </form>
      <Feedback error={a.error} notice={a.notice} />
    </section>
  );
}
