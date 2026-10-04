"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/yc/button";
import { Field, Input, Select, Textarea } from "@/components/yc/field";
import { IconPlus, IconX } from "@/components/yc/icons";
import { MediaPickerDialog } from "@/components/media/media-picker-dialog";
import { Feedback, postSalon, section } from "./shared";

export interface ServiceDraft {
  title: string;
  summary: string;
  description: string;
  category: string;
  durationMinutes: number;
  bufferMinutes: number;
  price: string;
  priceFrom: boolean;
  onlineBooking: boolean;
  featured: boolean;
  staffIds: string[];
  media: { url: string; alt: string; demo?: boolean }[];
}

const DURATIONS = [15, 20, 30, 45, 60, 75, 90, 120, 150, 180, 240, 300, 360];
const BUFFERS = [0, 5, 10, 15, 20, 30, 45, 60];
const label = (m: number) => (m < 60 ? `${m} min` : `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60}` : ""}`);

/** Création / modification d'une prestation. Le serveur revalide tout. */
export function ServiceEditor({
  listingId,
  initial,
  staff,
  categories,
  status,
  canPublish,
  canDelete,
}: {
  listingId: string | null;
  initial: ServiceDraft;
  staff: { id: string; name: string; title: string | null }[];
  categories: string[];
  status: string | null;
  canPublish: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState(initial);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [picker, setPicker] = useState(false);
  const set = (patch: Partial<ServiceDraft>) => setDraft((d) => ({ ...d, ...patch }));
  const durations = DURATIONS.includes(draft.durationMinutes) ? DURATIONS : [...DURATIONS, draft.durationMinutes].sort((a, b) => a - b);

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
        ...draft,
        summary: draft.summary || null,
        description: draft.description || null,
        price: draft.price.trim() === "" ? null : Math.round(Number(draft.price.replace(/\s/g, ""))),
      };
      const data = await postSalon<{ id: string }>({ action: "save_service", listingId, service: payload });
      if (!listingId) router.push(`/dashboard/prestations/${data.id}`);
    }, listingId ? "Prestation enregistrée." : "Prestation créée.");

  return (
    <form className="grid gap-5 pb-24" onSubmit={(e) => { e.preventDefault(); save(); }}>
      <section className={section}>
        <h2 className="text-[18px] font-bold tracking-[-0.015em]">La prestation</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Nom">{(p) => <Input {...p} required maxLength={120} value={draft.title} onChange={(e) => set({ title: e.target.value })} placeholder="Tresses collées" />}</Field>
          <Field label="Rubrique" hint="Regroupe les prestations sur la carte du site.">
            {(p) => (
              <>
                <Input {...p} required maxLength={60} list="rubriques" value={draft.category} onChange={(e) => set({ category: e.target.value })} placeholder="Coiffure" />
                <datalist id="rubriques">{categories.map((c) => <option key={c} value={c} />)}</datalist>
              </>
            )}
          </Field>
          <div className="sm:col-span-2"><Field label="Accroche" optional hint="Une ligne affichée sous le nom, sur la carte.">{(p) => <Input {...p} maxLength={220} value={draft.summary} onChange={(e) => set({ summary: e.target.value })} />}</Field></div>
          <div className="sm:col-span-2"><Field label="Description" optional>{(p) => <Textarea {...p} rows={3} maxLength={3000} value={draft.description} onChange={(e) => set({ description: e.target.value })} />}</Field></div>
        </div>
      </section>

      <section className={section}>
        <h2 className="text-[18px] font-bold tracking-[-0.015em]">Durée et prix</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-4">
          <Field label="Durée" hint="Temps réel de la prestation.">{(p) => <Select {...p} value={draft.durationMinutes} onChange={(e) => set({ durationMinutes: Number(e.target.value) })}>{durations.map((d) => <option key={d} value={d}>{label(d)}</option>)}</Select>}</Field>
          <Field label="Préparation après" hint="Bloquée dans l'agenda, invisible pour le client.">{(p) => <Select {...p} value={draft.bufferMinutes} onChange={(e) => set({ bufferMinutes: Number(e.target.value) })}>{BUFFERS.map((d) => <option key={d} value={d}>{d ? `${d} min` : "Aucune"}</option>)}</Select>}</Field>
          <Field label="Prix (FCFA)" optional hint="Vide : sur devis.">{(p) => <Input {...p} inputMode="numeric" value={draft.price} onChange={(e) => set({ price: e.target.value })} />}</Field>
          <label className="flex items-center gap-2.5 self-center pt-5 text-sm font-medium"><input type="checkbox" checked={draft.priceFrom} onChange={(e) => set({ priceFrom: e.target.checked })} className="h-4 w-4 accent-yc-royal" /> Prix « à partir de »</label>
        </div>
      </section>

      <section className={section}>
        <h2 className="text-[18px] font-bold tracking-[-0.015em]">Qui la réalise</h2>
        <p className="mt-1 text-sm text-yc-ink-soft">Seules ces personnes pourront recevoir ce rendez-vous (en ligne comme au comptoir).</p>
        {staff.length === 0 ? (
          <p className="mt-4 text-sm text-yc-ink-soft">Ajoutez d&apos;abord les membres de l&apos;équipe dans « Équipe et horaires ».</p>
        ) : (
          <div className="mt-4 flex flex-wrap gap-2">
            {staff.map((s) => {
              const on = draft.staffIds.includes(s.id);
              return (
                <button key={s.id} type="button" aria-pressed={on} onClick={() => set({ staffIds: on ? draft.staffIds.filter((x) => x !== s.id) : [...draft.staffIds, s.id] })} className={`rounded-full px-4 py-2 text-sm font-medium ring-1 ring-inset transition-colors ${on ? "bg-[#EAF0FF] text-yc-royal ring-yc-royal" : "bg-white text-yc-ink-soft ring-yc-ink/12 hover:text-yc-ink"}`}>
                  {on ? "✓ " : ""}{s.name}
                </button>
              );
            })}
          </div>
        )}
        <label className="mt-5 flex items-start gap-2.5 text-sm"><input type="checkbox" checked={draft.onlineBooking} onChange={(e) => set({ onlineBooking: e.target.checked })} className="mt-0.5 h-4 w-4 accent-yc-royal" /><span><span className="font-medium">Réservable en ligne</span><span className="block text-yc-ink-soft">Sinon, affichée sur la carte avec « par téléphone ».</span></span></label>
      </section>

      <section className={section}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-[18px] font-bold tracking-[-0.015em]">Photos</h2>
            <p className="text-sm text-yc-ink-soft">Facultatif : la première illustre la rubrique sur la carte.</p>
          </div>
          <Button type="button" variant="secondary" size="sm" onClick={() => setPicker(true)} disabled={draft.media.length >= 8}><IconPlus size={16} /> Ajouter une photo</Button>
        </div>
        {draft.media.length > 0 && (
          <ul className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-6">
            {draft.media.map((m, i) => (
              <li key={`${m.url}-${i}`} className="relative overflow-hidden rounded-lg ring-1 ring-yc-ink/10">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={m.url} alt={m.alt} className="aspect-[4/5] w-full object-cover" />
                <button type="button" aria-label={`Retirer la photo ${i + 1}`} onClick={() => set({ media: draft.media.filter((_, k) => k !== i) })} className="absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-full bg-white/90 shadow"><IconX size={14} /></button>
              </li>
            ))}
          </ul>
        )}
        <label className="mt-4 flex items-center gap-2.5 text-sm font-medium"><input type="checkbox" checked={draft.featured} onChange={(e) => set({ featured: e.target.checked })} className="h-4 w-4 accent-yc-royal" /> Mettre en avant</label>
      </section>

      {listingId && (canPublish || canDelete) && (
        <section className={section}>
          <h2 className="text-[18px] font-bold tracking-[-0.015em]">Publication</h2>
          <p className="mt-1 text-sm text-yc-ink-soft">{status === "published" ? "Visible sur la carte du site." : "Brouillon : visible uniquement dans votre espace."}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {canPublish && status !== "published" && <Button type="button" size="sm" variant="royal" loading={pending} onClick={() => run(() => postSalon({ action: "service_status", listingId, status: "published" }), "Prestation en ligne.")}>Mettre en ligne</Button>}
            {canPublish && status === "published" && <Button type="button" size="sm" variant="secondary" loading={pending} onClick={() => run(() => postSalon({ action: "service_status", listingId, status: "unavailable" }), "Prestation retirée du site.")}>Retirer du site</Button>}
            {canDelete && <Button type="button" size="sm" variant="danger" loading={pending} onClick={() => { if (window.confirm("Supprimer cette prestation ? Impossible si des rendez-vous à venir y sont liés.")) run(() => postSalon({ action: "delete_service", listingId }), "Prestation supprimée.", () => router.push("/dashboard/prestations")); }}>Supprimer</Button>}
          </div>
        </section>
      )}

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-yc-ink/10 bg-white/95 px-5 py-3 backdrop-blur lg:left-[268px]">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
          <div className="min-w-0 text-sm"><Feedback error={error} notice={notice} /></div>
          <Button type="submit" variant="royal" loading={pending}>{listingId ? "Enregistrer" : "Créer la prestation"}</Button>
        </div>
      </div>
      {picker && <MediaPickerDialog onClose={() => setPicker(false)} onPick={(url, alt) => set({ media: [...draft.media, { url, alt: alt || draft.title }] })} />}
    </form>
  );
}
