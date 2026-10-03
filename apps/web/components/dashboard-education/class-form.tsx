"use client";

import { useState } from "react";
import { Button } from "@/components/yc/button";
import { WEEKDAYS } from "@/lib/education/labels";
import { Feedback, input, label, section, toHHMM, toMinutes, useEduAction } from "./shared";

type Teacher = { id: string; name: string };
type Slot = { weekday: number; startMinute: number; endMinute: number };
export interface ClassFormValue { name: string; teacherUserId: string; room: string; startDate: string; endDate: string; capacity: string; schedule: Slot[]; isActive: boolean }

/** Créer / modifier une classe : enseignant, salle, emploi du temps, période, capacité. */
export function ClassForm({ listingId, classGroupId, initial, teachers, title }: { listingId: string; classGroupId: string | null; initial: ClassFormValue; teachers: Teacher[]; title: string }) {
  const a = useEduAction();
  const [f, setF] = useState(initial);
  const [slot, setSlot] = useState({ weekday: "1", start: "08:00", end: "10:00" });
  const addSlot = () => {
    const s = toMinutes(slot.start);
    const e = toMinutes(slot.end);
    if (s == null || e == null || e <= s) return;
    setF({ ...f, schedule: [...f.schedule, { weekday: Number(slot.weekday), startMinute: s, endMinute: e }] });
  };
  return (
    <section className={section} aria-label={title}>
      <h2 className="text-[17px] font-bold">{title}</h2>
      <form
        className="mt-4 grid gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          a.run({ action: "save_class", classGroupId, classGroup: { listingId, name: f.name, teacherUserId: f.teacherUserId || null, room: f.room || null, schedule: f.schedule, startDate: f.startDate, endDate: f.endDate, capacity: Number(f.capacity), ...(classGroupId ? { isActive: f.isActive } : {}) } }, classGroupId ? "Classe enregistrée." : "Classe créée.", () => {
            if (!classGroupId) setF({ ...initial });
          });
        }}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <label className={label}>Nom<input required maxLength={80} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Terminale S — groupe A" className={input} /></label>
          <label className={label}>Enseignant principal<select value={f.teacherUserId} onChange={(e) => setF({ ...f, teacherUserId: e.target.value })} className={input}><option value="">Non attribué</option>{teachers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
          <label className={label}>Salle<input maxLength={40} value={f.room} onChange={(e) => setF({ ...f, room: e.target.value })} className={input} /></label>
          <label className={label}>Capacité (élèves)<input required type="number" min={1} max={500} value={f.capacity} onChange={(e) => setF({ ...f, capacity: e.target.value })} className={input} /></label>
          <label className={label}>Début<input required type="date" value={f.startDate} onChange={(e) => setF({ ...f, startDate: e.target.value })} className={input} /></label>
          <label className={label}>Fin<input required type="date" value={f.endDate} onChange={(e) => setF({ ...f, endDate: e.target.value })} className={input} /></label>
        </div>
        <fieldset className="rounded-lg p-3 ring-1 ring-yc-ink/10">
          <legend className="px-1 text-[13px] font-semibold">Emploi du temps</legend>
          {f.schedule.length > 0 && (
            <ul className="mb-3 flex flex-wrap gap-2">
              {f.schedule.map((s, i) => (
                <li key={i} className="inline-flex items-center gap-2 rounded-full bg-yc-ivory-50 px-3 py-1 text-sm ring-1 ring-yc-ink/10">
                  <span className="yc-num">{WEEKDAYS[s.weekday]} {toHHMM(s.startMinute)}–{toHHMM(s.endMinute)}</span>
                  <button type="button" aria-label="Retirer ce créneau" onClick={() => setF({ ...f, schedule: f.schedule.filter((_, k) => k !== i) })} className="font-bold text-yc-danger">×</button>
                </li>
              ))}
            </ul>
          )}
          <div className="grid grid-cols-[1.2fr_1fr_1fr_auto] items-end gap-2">
            <label className={label}>Jour<select value={slot.weekday} onChange={(e) => setSlot({ ...slot, weekday: e.target.value })} className={input}>{[1, 2, 3, 4, 5, 6, 0].map((d) => <option key={d} value={d}>{WEEKDAYS[d]}</option>)}</select></label>
            <label className={label}>De<input type="time" value={slot.start} onChange={(e) => setSlot({ ...slot, start: e.target.value })} className={input} /></label>
            <label className={label}>À<input type="time" value={slot.end} onChange={(e) => setSlot({ ...slot, end: e.target.value })} className={input} /></label>
            <Button type="button" variant="secondary" onClick={addSlot}>Ajouter</Button>
          </div>
        </fieldset>
        {classGroupId && <label className="flex items-center gap-3 text-sm font-semibold"><input type="checkbox" checked={f.isActive} onChange={(e) => setF({ ...f, isActive: e.target.checked })} className="h-4 w-4" /> Classe ouverte (visible et inscriptions possibles)</label>}
        <div><Button type="submit" variant="royal" loading={a.pending}>{classGroupId ? "Enregistrer la classe" : "Créer la classe"}</Button></div>
        <Feedback error={a.error} notice={a.notice} />
      </form>
    </section>
  );
}
