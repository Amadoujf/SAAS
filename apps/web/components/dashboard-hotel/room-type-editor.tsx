"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/yc/button";
import { Field, Input, Select, Textarea } from "@/components/yc/field";
import { IconPlus, IconX } from "@/components/yc/icons";
import { MediaPickerDialog } from "@/components/media/media-picker-dialog";
import { AMENITY_LABELS } from "@/lib/hotel/labels";
import { Feedback, postHotel, section } from "./shared";

export interface RoomTypeDraft {
  title: string;
  summary: string;
  description: string;
  nightlyPrice: string;
  maxAdults: number;
  maxChildren: number;
  bedSummary: string;
  sizeM2: string;
  amenities: string[];
  minNights: number;
  checkIn: string;
  checkOut: string;
  depositPercent: number;
  featured: boolean;
  media: { url: string; alt: string; demo?: boolean }[];
}

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};

/** Création / modification d'un type de chambre. Le serveur revalide tout. */
export function RoomTypeEditor({ listingId, initial, status, canPublish, canDelete }: { listingId: string | null; initial: RoomTypeDraft; status: string | null; canPublish: boolean; canDelete: boolean }) {
  const router = useRouter();
  const [d, setD] = useState(initial);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [picker, setPicker] = useState(false);
  const set = (patch: Partial<RoomTypeDraft>) => setD((x) => ({ ...x, ...patch }));
  const run = (fn: () => Promise<unknown>, success: string, after?: () => void) => {
    setError(null);
    setNotice(null);
    start(async () => {
      try {
        await fn();
        setNotice(success);
        after?.();
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Action impossible.");
      }
    });
  };
  const save = () =>
    run(async () => {
      const payload = {
        title: d.title,
        summary: d.summary || null,
        description: d.description || null,
        nightlyPrice: d.nightlyPrice.trim() === "" ? null : Math.round(Number(d.nightlyPrice.replace(/\s/g, ""))),
        maxAdults: d.maxAdults,
        maxChildren: d.maxChildren,
        bedSummary: d.bedSummary,
        sizeM2: d.sizeM2.trim() === "" ? null : Math.round(Number(d.sizeM2)),
        amenities: d.amenities,
        minNights: d.minNights,
        checkInMinute: toMin(d.checkIn),
        checkOutMinute: toMin(d.checkOut),
        depositPercent: d.depositPercent,
        featured: d.featured,
        media: d.media,
      };
      const data = await postHotel<{ id: string }>({ action: "save_room_type", listingId, roomType: payload });
      if (!listingId) router.push(`/dashboard/chambres/${data.id}`);
    }, listingId ? "Type de chambre enregistré." : "Type de chambre créé.");

  return (
    <form className="grid gap-5 pb-24" onSubmit={(e) => { e.preventDefault(); save(); }}>
      <section className={section}>
        <h2 className="text-[18px] font-bold tracking-[-0.015em]">Le type de chambre</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Nom">{(p) => <Input {...p} required maxLength={120} value={d.title} onChange={(e) => set({ title: e.target.value })} placeholder="Chambre Océan" />}</Field>
          <Field label="Prix de base par nuit (FCFA)" optional hint="Vide : sur demande (non réservable en ligne).">{(p) => <Input {...p} inputMode="numeric" value={d.nightlyPrice} onChange={(e) => set({ nightlyPrice: e.target.value })} />}</Field>
          <div className="sm:col-span-2"><Field label="Accroche" optional>{(p) => <Input {...p} maxLength={220} value={d.summary} onChange={(e) => set({ summary: e.target.value })} />}</Field></div>
          <div className="sm:col-span-2"><Field label="Description" optional>{(p) => <Textarea {...p} rows={3} maxLength={3000} value={d.description} onChange={(e) => set({ description: e.target.value })} />}</Field></div>
        </div>
      </section>
      <section className={section}>
        <h2 className="text-[18px] font-bold tracking-[-0.015em]">Capacité et règles</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-4">
          <Field label="Adultes max">{(p) => <Select {...p} value={d.maxAdults} onChange={(e) => set({ maxAdults: Number(e.target.value) })}>{Array.from({ length: 10 }, (_, i) => i + 1).map((n) => <option key={n}>{n}</option>)}</Select>}</Field>
          <Field label="Enfants max">{(p) => <Select {...p} value={d.maxChildren} onChange={(e) => set({ maxChildren: Number(e.target.value) })}>{Array.from({ length: 7 }, (_, i) => i).map((n) => <option key={n}>{n}</option>)}</Select>}</Field>
          <Field label="Literie">{(p) => <Input {...p} required maxLength={80} value={d.bedSummary} onChange={(e) => set({ bedSummary: e.target.value })} placeholder="1 grand lit" />}</Field>
          <Field label="Surface (m²)" optional>{(p) => <Input {...p} inputMode="numeric" value={d.sizeM2} onChange={(e) => set({ sizeM2: e.target.value })} />}</Field>
          <Field label="Nuits minimum">{(p) => <Select {...p} value={d.minNights} onChange={(e) => set({ minNights: Number(e.target.value) })}>{[1, 2, 3, 4, 5, 7].map((n) => <option key={n}>{n}</option>)}</Select>}</Field>
          <Field label="Arrivée à partir de">{(p) => <Input {...p} type="time" step={900} value={d.checkIn} onChange={(e) => set({ checkIn: e.target.value })} />}</Field>
          <Field label="Départ avant">{(p) => <Input {...p} type="time" step={900} value={d.checkOut} onChange={(e) => set({ checkOut: e.target.value })} />}</Field>
          <Field label="Acompte demandé">{(p) => <Select {...p} value={d.depositPercent} onChange={(e) => set({ depositPercent: Number(e.target.value) })}>{[0, 20, 30, 50, 100].map((n) => <option key={n} value={n}>{n ? `${n} %` : "Aucun"}</option>)}</Select>}</Field>
        </div>
      </section>
      <section className={section}>
        <h2 className="text-[18px] font-bold tracking-[-0.015em]">Équipements</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          {Object.entries(AMENITY_LABELS).map(([k, v]) => {
            const on = d.amenities.includes(k);
            return <button key={k} type="button" aria-pressed={on} onClick={() => set({ amenities: on ? d.amenities.filter((x) => x !== k) : [...d.amenities, k] })} className={`rounded-full px-3.5 py-1.5 text-sm font-medium ring-1 ring-inset ${on ? "bg-[#EAF0FF] text-yc-royal ring-yc-royal" : "bg-white text-yc-ink-soft ring-yc-ink/12 hover:text-yc-ink"}`}>{on ? "✓ " : ""}{v}</button>;
          })}
        </div>
      </section>
      <section className={section}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-[18px] font-bold tracking-[-0.015em]">Photos</h2>
            <p className="text-sm text-yc-ink-soft">La première illustre la chambre sur le site. Obligatoire pour la mise en ligne.</p>
          </div>
          <Button type="button" variant="secondary" size="sm" onClick={() => setPicker(true)} disabled={d.media.length >= 12}><IconPlus size={16} /> Ajouter une photo</Button>
        </div>
        {d.media.length > 0 && (
          <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {d.media.map((m, i) => (
              <li key={`${m.url}-${i}`} className="relative overflow-hidden rounded-lg ring-1 ring-yc-ink/10">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={m.url} alt={m.alt} className="aspect-[16/10] w-full object-cover" />
                {i === 0 && <span className="absolute left-2 top-2 rounded bg-white/90 px-1.5 py-0.5 text-[11px] font-bold">Couverture</span>}
                <button type="button" aria-label={`Retirer la photo ${i + 1}`} onClick={() => set({ media: d.media.filter((_, k) => k !== i) })} className="absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-full bg-white/90 shadow"><IconX size={14} /></button>
              </li>
            ))}
          </ul>
        )}
        <label className="mt-4 flex items-center gap-2.5 text-sm font-medium"><input type="checkbox" checked={d.featured} onChange={(e) => set({ featured: e.target.checked })} className="h-4 w-4 accent-yc-royal" /> Mettre en avant</label>
      </section>
      {listingId && (canPublish || canDelete) && (
        <section className={section}>
          <h2 className="text-[18px] font-bold tracking-[-0.015em]">Publication</h2>
          <p className="mt-1 text-sm text-yc-ink-soft">{status === "published" ? "Visible et réservable sur le site." : "Brouillon : visible uniquement dans votre espace."}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {canPublish && status !== "published" && <Button type="button" size="sm" variant="royal" loading={pending} onClick={() => run(() => postHotel({ action: "room_type_status", listingId, status: "published" }), "Type de chambre en ligne.")}>Mettre en ligne</Button>}
            {canPublish && status === "published" && <Button type="button" size="sm" variant="secondary" loading={pending} onClick={() => run(() => postHotel({ action: "room_type_status", listingId, status: "unavailable" }), "Retiré du site.")}>Retirer du site</Button>}
            {canDelete && <Button type="button" size="sm" variant="danger" loading={pending} onClick={() => { if (window.confirm("Supprimer ce type ? Impossible si des séjours à venir y sont liés.")) run(() => postHotel({ action: "delete_room_type", listingId }), "Supprimé.", () => router.push("/dashboard/chambres")); }}>Supprimer</Button>}
          </div>
        </section>
      )}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-yc-ink/10 bg-white/95 px-5 py-3 backdrop-blur lg:left-[268px]">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
          <div className="min-w-0 text-sm"><Feedback error={error} notice={notice} /></div>
          <Button type="submit" variant="royal" loading={pending}>{listingId ? "Enregistrer" : "Créer le type"}</Button>
        </div>
      </div>
      {picker && <MediaPickerDialog onClose={() => setPicker(false)} onPick={(url, alt) => set({ media: [...d.media, { url, alt: alt || d.title }] })} />}
    </form>
  );
}
