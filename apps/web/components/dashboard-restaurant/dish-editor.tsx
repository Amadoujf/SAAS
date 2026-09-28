"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/yc/button";
import { Field, Input, Select, Textarea } from "@/components/yc/field";
import { IconPlus, IconX } from "@/components/yc/icons";
import { MediaPickerDialog } from "@/components/media/media-picker-dialog";
import { BADGE_LABELS } from "@/lib/restaurant/labels";
import { Feedback, postResto, section } from "./shared";

export interface DishDraft {
  sectionId: string;
  name: string;
  description: string;
  price: string;
  imageUrl: string | null;
  imageDemo: boolean;
  badges: string[];
  isAvailable: boolean;
  isActive: boolean;
  prepMinutes: number;
  groups: { name: string; minChoices: number; maxChoices: number; options: { name: string; priceDelta: string; isAvailable: boolean }[] }[];
}

const int = (v: string) => Math.round(Number(v.replace(/\s/g, "")) || 0);

/** Fiche d'un plat : prix, photo, pastilles, groupes d'options bornés. Le serveur revalide tout. */
export function DishEditor({ dishId, initial, sections }: { dishId: string | null; initial: DishDraft; sections: { id: string; name: string }[] }) {
  const router = useRouter();
  const [d, setD] = useState(initial);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [picker, setPicker] = useState(false);
  const set = (patch: Partial<DishDraft>) => setD((x) => ({ ...x, ...patch }));
  const setGroup = (gi: number, patch: Partial<DishDraft["groups"][number]>) => set({ groups: d.groups.map((g, i) => (i === gi ? { ...g, ...patch } : g)) });
  const save = () => {
    setError(null);
    setNotice(null);
    start(async () => {
      try {
        const data = await postResto<{ id: string }>({
          action: "save_dish",
          dishId,
          dish: {
            sectionId: d.sectionId,
            name: d.name,
            description: d.description || null,
            price: int(d.price),
            imageUrl: d.imageUrl,
            badges: d.badges,
            isAvailable: d.isAvailable,
            isActive: d.isActive,
            prepMinutes: d.prepMinutes,
            optionGroups: d.groups.map((g) => ({ name: g.name, minChoices: g.minChoices, maxChoices: g.maxChoices, options: g.options.map((o) => ({ name: o.name, priceDelta: int(o.priceDelta), isAvailable: o.isAvailable })) })),
          },
        });
        setNotice(dishId ? "Plat enregistré." : "Plat ajouté à la carte.");
        if (!dishId) router.push(`/dashboard/carte/plat/${data.id}`);
        else router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Enregistrement impossible.");
      }
    });
  };
  return (
    <form className="grid gap-5 pb-24" onSubmit={(e) => { e.preventDefault(); save(); }}>
      <section className={section}>
        <h2 className="text-[18px] font-bold tracking-[-0.015em]">Le plat</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Nom">{(p) => <Input {...p} required maxLength={120} value={d.name} onChange={(e) => set({ name: e.target.value })} placeholder="Poulet yassa" />}</Field>
          <Field label="Rubrique">{(p) => <Select {...p} value={d.sectionId} onChange={(e) => set({ sectionId: e.target.value })}>{sections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select>}</Field>
          <Field label="Prix (FCFA)">{(p) => <Input {...p} required inputMode="numeric" value={d.price} onChange={(e) => set({ price: e.target.value })} />}</Field>
          <Field label="Temps de préparation (min)">{(p) => <Input {...p} type="number" min={0} max={240} value={d.prepMinutes} onChange={(e) => set({ prepMinutes: Number(e.target.value) })} />}</Field>
          <div className="sm:col-span-2"><Field label="Description" optional>{(p) => <Textarea {...p} rows={2} maxLength={600} value={d.description} onChange={(e) => set({ description: e.target.value })} placeholder="Ce qui le rend bon, en une phrase." />}</Field></div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {Object.entries(BADGE_LABELS).map(([k, v]) => {
            const on = d.badges.includes(k);
            return <button key={k} type="button" aria-pressed={on} onClick={() => set({ badges: on ? d.badges.filter((x) => x !== k) : [...d.badges, k] })} className={`rounded-full px-3.5 py-1.5 text-sm font-medium ring-1 ring-inset ${on ? "bg-[#EAF0FF] text-yc-royal ring-yc-royal" : "bg-white text-yc-ink-soft ring-yc-ink/12"}`}>{on ? "✓ " : ""}{v}</button>;
          })}
        </div>
        <div className="mt-4 flex flex-wrap gap-5 text-sm font-medium">
          <label className="flex items-center gap-2"><input type="checkbox" checked={d.isAvailable} onChange={(e) => set({ isAvailable: e.target.checked })} className="h-4 w-4 accent-yc-royal" /> Disponible aujourd&apos;hui</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={d.isActive} onChange={(e) => set({ isActive: e.target.checked })} className="h-4 w-4 accent-yc-royal" /> À la carte</label>
        </div>
      </section>

      <section className={section}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-[18px] font-bold tracking-[-0.015em]">Photo</h2>
            <p className="text-sm text-yc-ink-soft">Facultative, mais elle fait vendre.</p>
          </div>
          <Button type="button" variant="secondary" size="sm" onClick={() => setPicker(true)}>{d.imageUrl ? "Remplacer" : "Choisir une photo"}</Button>
        </div>
        {d.imageUrl && (
          <div className="relative mt-4 w-48 overflow-hidden rounded-lg ring-1 ring-yc-ink/10">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={d.imageUrl} alt={d.name} className="aspect-[4/3] w-full object-cover" />
            {d.imageDemo && <span className="absolute left-2 top-2 rounded bg-white/90 px-1.5 py-0.5 text-[10px] font-bold">Illustration de démonstration</span>}
            <button type="button" aria-label="Retirer la photo" onClick={() => set({ imageUrl: null, imageDemo: false })} className="absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-full bg-white/90 shadow"><IconX size={14} /></button>
          </div>
        )}
      </section>

      <section className={section}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-[18px] font-bold tracking-[-0.015em]">Options</h2>
            <p className="text-sm text-yc-ink-soft">Accompagnement au choix, cuisson, suppléments payants… Le client ne peut pas commander sans respecter le minimum.</p>
          </div>
          <Button type="button" variant="secondary" size="sm" disabled={d.groups.length >= 10} onClick={() => set({ groups: [...d.groups, { name: "", minChoices: 1, maxChoices: 1, options: [{ name: "", priceDelta: "0", isAvailable: true }] }] })}><IconPlus size={16} /> Groupe</Button>
        </div>
        {d.groups.map((g, gi) => (
          <fieldset key={gi} className="mt-4 min-w-0 rounded-lg p-4 ring-1 ring-yc-ink/[0.08]">
            <legend className="sr-only">Groupe {gi + 1}</legend>
            <div className="grid gap-3 sm:grid-cols-[1.5fr_0.7fr_0.7fr_auto] sm:items-end">
              <Field label="Nom du groupe">{(p) => <Input {...p} required maxLength={80} value={g.name} onChange={(e) => setGroup(gi, { name: e.target.value })} placeholder="Accompagnement" />}</Field>
              <Field label="Minimum">{(p) => <Select {...p} value={g.minChoices} onChange={(e) => setGroup(gi, { minChoices: Number(e.target.value), maxChoices: Math.max(g.maxChoices, Number(e.target.value), 1) })}>{[0, 1, 2, 3].map((n) => <option key={n} value={n}>{n === 0 ? "Facultatif" : n}</option>)}</Select>}</Field>
              <Field label="Maximum">{(p) => <Select {...p} value={g.maxChoices} onChange={(e) => setGroup(gi, { maxChoices: Number(e.target.value) })}>{[1, 2, 3, 4, 5, 6].filter((n) => n >= g.minChoices).map((n) => <option key={n} value={n}>{n}</option>)}</Select>}</Field>
              <button type="button" onClick={() => set({ groups: d.groups.filter((_, i) => i !== gi) })} className="h-11 text-sm font-semibold text-yc-danger hover:underline">Supprimer</button>
            </div>
            <ul className="mt-3 grid gap-2">
              {g.options.map((o, oi) => (
                <li key={oi} className="grid grid-cols-[1fr_110px_auto_auto] items-center gap-2">
                  <input aria-label={`Choix ${oi + 1}`} required maxLength={80} value={o.name} onChange={(e) => setGroup(gi, { options: g.options.map((x, k) => (k === oi ? { ...x, name: e.target.value } : x)) })} placeholder="Riz blanc" className="h-10 rounded-lg bg-white px-3 text-sm ring-1 ring-inset ring-yc-ink/12" />
                  <input aria-label={`Supplément du choix ${oi + 1} (FCFA)`} inputMode="numeric" value={o.priceDelta} onChange={(e) => setGroup(gi, { options: g.options.map((x, k) => (k === oi ? { ...x, priceDelta: e.target.value } : x)) })} className="h-10 rounded-lg bg-white px-3 text-right text-sm ring-1 ring-inset ring-yc-ink/12" />
                  <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={!o.isAvailable} onChange={(e) => setGroup(gi, { options: g.options.map((x, k) => (k === oi ? { ...x, isAvailable: !e.target.checked } : x)) })} className="h-4 w-4" /> Épuisé</label>
                  <button type="button" aria-label={`Retirer le choix ${oi + 1}`} disabled={g.options.length <= 1} onClick={() => setGroup(gi, { options: g.options.filter((_, k) => k !== oi) })} className="grid h-9 w-9 place-items-center rounded-lg text-yc-ink-soft hover:bg-yc-ink/[0.05] disabled:opacity-30"><IconX size={14} /></button>
                </li>
              ))}
            </ul>
            <button type="button" onClick={() => setGroup(gi, { options: [...g.options, { name: "", priceDelta: "0", isAvailable: true }] })} className="mt-2 text-sm font-semibold text-yc-electric hover:underline">+ Ajouter un choix</button>
            <p className="mt-1 text-xs text-yc-ink-soft">Deuxième colonne : supplément en FCFA (0 si inclus).</p>
          </fieldset>
        ))}
      </section>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-yc-ink/10 bg-white/95 px-5 py-3 backdrop-blur lg:left-[268px]">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
          <div className="min-w-0 text-sm"><Feedback error={error} notice={notice} /></div>
          <Button type="submit" variant="royal" loading={pending}>{dishId ? "Enregistrer" : "Ajouter à la carte"}</Button>
        </div>
      </div>
      {picker && <MediaPickerDialog size="medium" onClose={() => setPicker(false)} onPick={(url) => set({ imageUrl: url, imageDemo: false })} />}
    </form>
  );
}
