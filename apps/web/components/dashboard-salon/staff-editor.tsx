"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/yc/button";
import { Field, Input, Textarea } from "@/components/yc/field";
import { IconPlus, IconX } from "@/components/yc/icons";
import { MediaPickerDialog } from "@/components/media/media-picker-dialog";
import { Feedback, postSalon, section, useSalonAction } from "./shared";

export interface StaffDraft {
  displayName: string;
  title: string;
  bio: string;
  photoUrl: string | null;
  isActive: boolean;
  acceptsOnline: boolean;
  serviceIds: string[];
  hours: { weekday: number; start: string; end: string }[];
}

const DAYS = [1, 2, 3, 4, 5, 6, 0];
const DAY_NAMES = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};

/** Fiche d'un membre de l'équipe : identité, prestations, horaires de la semaine. */
export function StaffEditor({ staffId, initial, services }: { staffId: string | null; initial: StaffDraft; services: { id: string; title: string; category: string }[] }) {
  const router = useRouter();
  const [draft, setDraft] = useState(initial);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [picker, setPicker] = useState(false);
  const set = (patch: Partial<StaffDraft>) => setDraft((d) => ({ ...d, ...patch }));
  const categories = [...new Set(services.map((s) => s.category))];

  const setDay = (weekday: number, ranges: { start: string; end: string }[]) => set({ hours: [...draft.hours.filter((h) => h.weekday !== weekday), ...ranges.map((r) => ({ weekday, ...r }))] });
  const copyToWeek = (weekday: number) => {
    const ranges = draft.hours.filter((h) => h.weekday === weekday);
    set({ hours: DAYS.filter((d) => d !== 0).flatMap((d) => ranges.map((r) => ({ ...r, weekday: d }))).concat(draft.hours.filter((h) => h.weekday === 0 && weekday !== 0)) });
  };

  const save = () => {
    setError(null);
    setNotice(null);
    start(async () => {
      try {
        const payload = {
          ...draft,
          title: draft.title || null,
          bio: draft.bio || null,
          hours: draft.hours.map((h) => ({ weekday: h.weekday, startMinute: toMin(h.start), endMinute: toMin(h.end) })),
        };
        const data = await postSalon<{ id: string }>({ action: "save_staff", staffId, staff: payload });
        setNotice(staffId ? "Fiche enregistrée." : "Membre ajouté.");
        if (!staffId) router.push(`/dashboard/horaires/${data.id}`);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Enregistrement impossible.");
      }
    });
  };

  return (
    <form className="grid gap-5 pb-24" onSubmit={(e) => { e.preventDefault(); save(); }}>
      <section className={section}>
        <h2 className="text-[18px] font-bold tracking-[-0.015em]">Identité</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-[auto_1fr_1fr] sm:items-start">
          <div className="flex flex-col items-center gap-2">
            {draft.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={draft.photoUrl} alt="" className="h-20 w-20 rounded-full object-cover ring-1 ring-yc-ink/10" />
            ) : (
              <span className="grid h-20 w-20 place-items-center rounded-full bg-[#F4E7EA] text-3xl font-bold text-[#8E3A52]" aria-hidden="true">{draft.displayName.slice(0, 1) || "?"}</span>
            )}
            <div className="flex gap-1">
              <Button type="button" size="sm" variant="ghost" onClick={() => setPicker(true)}>{draft.photoUrl ? "Changer" : "Photo"}</Button>
              {draft.photoUrl && <Button type="button" size="sm" variant="ghost" onClick={() => set({ photoUrl: null })} aria-label="Retirer la photo"><IconX size={14} /></Button>}
            </div>
          </div>
          <Field label="Prénom ou nom affiché">{(p) => <Input {...p} required maxLength={80} value={draft.displayName} onChange={(e) => set({ displayName: e.target.value })} />}</Field>
          <Field label="Spécialité" optional>{(p) => <Input {...p} maxLength={80} value={draft.title} onChange={(e) => set({ title: e.target.value })} placeholder="Tresses et locks" />}</Field>
          <div className="sm:col-span-3"><Field label="Présentation" optional hint="Affichée sur le site, dans « L'équipe ».">{(p) => <Textarea {...p} rows={2} maxLength={400} value={draft.bio} onChange={(e) => set({ bio: e.target.value })} />}</Field></div>
        </div>
        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <label className="flex items-center gap-2.5 font-medium"><input type="checkbox" checked={draft.isActive} onChange={(e) => set({ isActive: e.target.checked })} className="h-4 w-4 accent-yc-royal" /> Visible dans l&apos;agenda</label>
          <label className="flex items-center gap-2.5 font-medium"><input type="checkbox" checked={draft.acceptsOnline} onChange={(e) => set({ acceptsOnline: e.target.checked })} className="h-4 w-4 accent-yc-royal" /> Réservable en ligne sur le site</label>
        </div>
      </section>

      <section className={section}>
        <h2 className="text-[18px] font-bold tracking-[-0.015em]">Horaires de la semaine</h2>
        <p className="mt-1 text-sm text-yc-ink-soft">Plusieurs plages par jour pour une pause. Les horaires proposés en ligne en découlent directement.</p>
        <ul className="mt-4 divide-y divide-yc-ink/[0.06]">
          {DAYS.map((d) => {
            const ranges = draft.hours.filter((h) => h.weekday === d);
            return (
              <li key={d} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center">
                <span className="w-28 shrink-0 text-sm font-semibold">{DAY_NAMES[d]}</span>
                <div className="flex flex-1 flex-wrap items-center gap-2">
                  {ranges.length === 0 && <span className="text-sm text-yc-ink-soft">Repos</span>}
                  {ranges.map((r, i) => (
                    <span key={i} className="inline-flex items-center gap-1 rounded-lg bg-yc-ivory-50 px-2 py-1 ring-1 ring-yc-ink/[0.07]">
                      <input type="time" step={900} aria-label={`${DAY_NAMES[d]} : début de la plage ${i + 1}`} value={r.start} onChange={(e) => setDay(d, ranges.map((x, k) => (k === i ? { ...x, start: e.target.value } : x)))} className="h-8 rounded-md bg-white px-1.5 text-sm ring-1 ring-inset ring-yc-ink/12" />
                      <span aria-hidden="true">–</span>
                      <input type="time" step={900} aria-label={`${DAY_NAMES[d]} : fin de la plage ${i + 1}`} value={r.end} onChange={(e) => setDay(d, ranges.map((x, k) => (k === i ? { ...x, end: e.target.value } : x)))} className="h-8 rounded-md bg-white px-1.5 text-sm ring-1 ring-inset ring-yc-ink/12" />
                      <button type="button" aria-label={`Retirer la plage ${i + 1} du ${DAY_NAMES[d]!.toLowerCase()}`} onClick={() => setDay(d, ranges.filter((_, k) => k !== i))} className="grid h-7 w-7 place-items-center rounded-md text-yc-ink-soft hover:bg-yc-ink/5"><IconX size={13} /></button>
                    </span>
                  ))}
                  <button type="button" onClick={() => setDay(d, [...ranges, ranges.length ? { start: "15:00", end: "19:00" } : { start: "09:00", end: "13:00" }])} className="inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-sm font-semibold text-yc-electric hover:bg-yc-electric/5"><IconPlus size={14} /> Plage</button>
                  {ranges.length > 0 && d !== 0 && <button type="button" onClick={() => copyToWeek(d)} className="text-xs font-semibold text-yc-ink-soft underline-offset-2 hover:underline">Copier du lundi au samedi</button>}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section className={section}>
        <h2 className="text-[18px] font-bold tracking-[-0.015em]">Prestations réalisées</h2>
        {services.length === 0 ? (
          <p className="mt-2 text-sm text-yc-ink-soft">Aucune prestation pour l&apos;instant.</p>
        ) : (
          <div className="mt-4 grid gap-4">
            {categories.map((c) => (
              <div key={c}>
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-yc-ink-soft">{c}</p>
                <div className="flex flex-wrap gap-2">
                  {services.filter((s) => s.category === c).map((s) => {
                    const on = draft.serviceIds.includes(s.id);
                    return (
                      <button key={s.id} type="button" aria-pressed={on} onClick={() => set({ serviceIds: on ? draft.serviceIds.filter((x) => x !== s.id) : [...draft.serviceIds, s.id] })} className={`rounded-full px-3.5 py-1.5 text-sm font-medium ring-1 ring-inset ${on ? "bg-[#EAF0FF] text-yc-royal ring-yc-royal" : "bg-white text-yc-ink-soft ring-yc-ink/12 hover:text-yc-ink"}`}>
                        {on ? "✓ " : ""}{s.title}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-yc-ink/10 bg-white/95 px-5 py-3 backdrop-blur lg:left-[268px]">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
          <div className="min-w-0 text-sm"><Feedback error={error} notice={notice} /></div>
          <Button type="submit" variant="royal" loading={pending}>{staffId ? "Enregistrer" : "Ajouter à l'équipe"}</Button>
        </div>
      </div>
      {picker && <MediaPickerDialog onClose={() => setPicker(false)} onPick={(url) => set({ photoUrl: url })} />}
    </form>
  );
}

/** Absences (congés, formation) : journées entières ; refusées si des rendez-vous y sont prévus. */
export function TimeOffPanel({ staffId, items, today }: { staffId: string; items: { id: string; label: string; reason: string | null }[]; today: string }) {
  const a = useSalonAction();
  const [f, setF] = useState({ from: today, to: today, reason: "" });
  return (
    <section className={section}>
      <h2 className="text-[18px] font-bold tracking-[-0.015em]">Absences</h2>
      {items.length > 0 ? (
        <ul className="mt-3 divide-y divide-yc-ink/[0.06] rounded-lg ring-1 ring-yc-ink/[0.07]">
          {items.map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
              <span><strong>{t.label}</strong>{t.reason ? ` · ${t.reason}` : ""}</span>
              <button type="button" onClick={() => a.run({ action: "remove_time_off", timeOffId: t.id }, "Absence retirée.")} className="text-xs font-semibold text-yc-danger hover:underline">Retirer</button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-yc-ink-soft">Aucune absence prévue.</p>
      )}
      <form className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_1.5fr_auto] sm:items-end" onSubmit={(e) => { e.preventDefault(); a.run({ action: "add_time_off", timeOff: { staffId, from: f.from, to: f.to, reason: f.reason || null } }, "Absence ajoutée."); }}>
        <Field label="Du">{(p) => <Input {...p} type="date" min={today} required value={f.from} onChange={(e) => setF({ ...f, from: e.target.value, to: e.target.value > f.to ? e.target.value : f.to })} />}</Field>
        <Field label="Au (inclus)">{(p) => <Input {...p} type="date" min={f.from} required value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} />}</Field>
        <Field label="Motif" optional>{(p) => <Input {...p} maxLength={120} value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} placeholder="Congés" />}</Field>
        <Button type="submit" size="sm" variant="secondary" loading={a.pending}>Ajouter</Button>
      </form>
      <Feedback error={a.error} notice={a.notice} />
    </section>
  );
}

/** Règles de réservation en ligne du salon. */
export function BookingSettingsPanel({ initial }: { initial: { slotStepMinutes: number; minLeadMinutes: number; maxAdvanceDays: number; cancelCutoffHours: number; autoConfirm: boolean } }) {
  const a = useSalonAction();
  const [f, setF] = useState(initial);
  const sel = "h-11 w-full rounded-xl bg-white px-3 text-sm ring-1 ring-inset ring-yc-ink/12";
  return (
    <section className={section} aria-labelledby="regles">
      <h2 id="regles" className="text-[18px] font-bold tracking-[-0.015em]">Réservation en ligne</h2>
      <p className="mt-1 text-sm text-yc-ink-soft">Ces règles s&apos;appliquent au site ; au comptoir, l&apos;équipe peut placer n&apos;importe quel horaire libre.</p>
      <form className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4" onSubmit={(e) => { e.preventDefault(); a.run({ action: "save_settings", settings: f }, "Règles enregistrées."); }}>
        <label className="grid gap-1.5 text-[13px] font-semibold">Horaires proposés toutes les
          <select className={sel} value={f.slotStepMinutes} onChange={(e) => setF({ ...f, slotStepMinutes: Number(e.target.value) })}>{[10, 15, 20, 30, 60].map((v) => <option key={v} value={v}>{v} minutes</option>)}</select>
        </label>
        <label className="grid gap-1.5 text-[13px] font-semibold">Délai minimal avant le rendez-vous
          <select className={sel} value={f.minLeadMinutes} onChange={(e) => setF({ ...f, minLeadMinutes: Number(e.target.value) })}>{[0, 30, 60, 120, 240, 1440].map((v) => <option key={v} value={v}>{v === 0 ? "Aucun" : v < 60 ? `${v} min` : v === 1440 ? "La veille" : `${v / 60} h`}</option>)}</select>
        </label>
        <label className="grid gap-1.5 text-[13px] font-semibold">Réservable jusqu&apos;à
          <select className={sel} value={f.maxAdvanceDays} onChange={(e) => setF({ ...f, maxAdvanceDays: Number(e.target.value) })}>{[7, 14, 30, 45, 60, 90].map((v) => <option key={v} value={v}>{v} jours à l&apos;avance</option>)}</select>
        </label>
        <label className="grid gap-1.5 text-[13px] font-semibold">Annulation en ligne jusqu&apos;à
          <select className={sel} value={f.cancelCutoffHours} onChange={(e) => setF({ ...f, cancelCutoffHours: Number(e.target.value) })}>{[0, 1, 2, 3, 6, 12, 24, 48].map((v) => <option key={v} value={v}>{v === 0 ? "L'heure du rendez-vous" : `${v} h avant`}</option>)}</select>
        </label>
        <label className="flex items-start gap-2.5 text-sm sm:col-span-2 lg:col-span-3"><input type="checkbox" checked={f.autoConfirm} onChange={(e) => setF({ ...f, autoConfirm: e.target.checked })} className="mt-0.5 h-4 w-4 accent-yc-royal" /><span><span className="font-medium">Confirmer automatiquement</span><span className="block text-yc-ink-soft">Sinon, chaque rendez-vous en ligne attend votre confirmation (l&apos;horaire reste bloqué en attendant).</span></span></label>
        <div className="flex items-end"><Button type="submit" size="sm" variant="royal" loading={a.pending}>Enregistrer</Button></div>
      </form>
      <Feedback error={a.error} notice={a.notice} />
    </section>
  );
}
