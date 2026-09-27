"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/yc/button";
import { Field, Input, Select, Textarea } from "@/components/yc/field";
import { IconArrowLeft, IconArrowRight, IconPlus, IconX } from "@/components/yc/icons";
import { MediaPickerDialog } from "@/components/media/media-picker-dialog";
import { DOCUMENT_LABELS, INCLUSION_LABELS, TRIP_TYPE_LABELS } from "@/lib/travel/labels";

export interface TripDraft {
  title: string;
  summary: string;
  description: string;
  pricePerPerson: number | null;
  tripType: string;
  destinationCountry: string;
  destinationCity: string;
  durationDays: number;
  durationNights: number;
  included: string[];
  excludedNote: string;
  depositPercent: number;
  requiredDocuments: string[];
  meetingPoint: string;
  featured: boolean;
  media: { url: string; alt: string; demo?: boolean }[];
  itinerary: { dayNumber: number; title: string; description: string }[];
}

export async function postTravel<T = unknown>(body: unknown): Promise<T> {
  const res = await fetch("/api/dashboard/travel", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const json = (await res.json().catch(() => ({}))) as { data?: T; error?: string };
  if (!res.ok) throw new Error(json.error ?? "Action impossible.");
  return json.data as T;
}

const num = (v: string) => (v.trim() === "" ? null : Math.max(0, Math.round(Number(v.replace(/\s/g, "")))));
export const section = "rounded-xl bg-white p-5 shadow-[0_1px_2px_rgb(12_22_48/0.04),0_8px_24px_-16px_rgb(12_22_48/0.12)] ring-1 ring-yc-ink/[0.07] sm:p-6";

function Chips({ options, value, onChange }: { options: Record<string, string>; value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {Object.entries(options).map(([key, label]) => {
        const on = value.includes(key);
        return (
          <label key={key} className={`cursor-pointer rounded-full px-3.5 py-2 text-sm ring-1 ring-inset transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-yc-electric ${on ? "bg-yc-electric/10 font-semibold text-yc-electric ring-yc-electric/40" : "bg-white text-yc-ink-soft ring-yc-ink/12 hover:ring-yc-ink/25"}`}>
            <input type="checkbox" className="sr-only" checked={on} onChange={() => onChange(on ? value.filter((a) => a !== key) : [...value, key])} />
            {label}
          </label>
        );
      })}
    </div>
  );
}

/** Fiche d'un voyage : informations, destination et durée, prix, prestations, pièces
 *  demandées, programme jour par jour, photos, publication. */
export function TripEditor({ listingId, status, initial, can }: { listingId: string | null; status: string | null; initial: TripDraft; can: { edit: boolean; publish: boolean; remove: boolean } }) {
  const router = useRouter();
  const [draft, setDraft] = useState<TripDraft>(initial);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [picker, setPicker] = useState(false);
  const [pending, start] = useTransition();
  const set = (patch: Partial<TripDraft>) => setDraft((d) => ({ ...d, ...patch }));

  function run(action: () => Promise<unknown>, success: string, after?: (data: unknown) => void) {
    setError(null);
    setNotice(null);
    start(async () => {
      try {
        const data = await action();
        setNotice(success);
        after?.(data);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Action impossible.");
      }
    });
  }

  const save = () =>
    run(
      () => postTravel<{ id: string }>({ action: "save_trip", listingId, trip: { ...draft, itinerary: draft.itinerary.map((d) => ({ ...d, description: d.description || null })) } }),
      listingId ? "Voyage enregistré." : "Voyage créé. Ajoutez maintenant ses dates de départ.",
      (data) => {
        if (!listingId) router.push(`/dashboard/voyages/${(data as { id: string }).id}`);
      },
    );

  const addDay = () => {
    const next = Math.min(draft.durationDays, (draft.itinerary.at(-1)?.dayNumber ?? 0) + 1) || draft.itinerary.length + 1;
    set({ itinerary: [...draft.itinerary, { dayNumber: next, title: "", description: "" }] });
  };

  return (
    <form className="flex flex-col gap-5 pb-28" onSubmit={(e) => { e.preventDefault(); save(); }}>
      <fieldset disabled={!can.edit} className="contents">
        <section className={section} aria-labelledby="voyage-infos">
          <h2 id="voyage-infos" className="mb-4 text-[18px] font-bold tracking-[-0.015em]">Informations</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2"><Field label="Titre du voyage">{(p) => <Input {...p} required minLength={3} maxLength={120} value={draft.title} onChange={(e) => set({ title: e.target.value })} placeholder="Casamance, rivières et forêts sacrées" />}</Field></div>
            <Field label="Type de voyage">{(p) => <Select {...p} value={draft.tripType} onChange={(e) => set({ tripType: e.target.value })}>{Object.entries(TRIP_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select>}</Field>
            <Field label="Prix par voyageur (FCFA)" hint="Laissez vide pour « Prix sur demande ». Un départ peut avoir son propre prix." optional>
              {(p) => <Input {...p} inputMode="numeric" value={draft.pricePerPerson ?? ""} onChange={(e) => set({ pricePerPerson: num(e.target.value) || null })} placeholder="385000" />}
            </Field>
            <div className="sm:col-span-2"><Field label="Accroche" hint="Une phrase affichée sur la carte du voyage." optional>{(p) => <Input {...p} maxLength={220} value={draft.summary} onChange={(e) => set({ summary: e.target.value })} />}</Field></div>
            <div className="sm:col-span-2"><Field label="Description" optional>{(p) => <Textarea {...p} rows={5} maxLength={5000} value={draft.description} onChange={(e) => set({ description: e.target.value })} />}</Field></div>
          </div>
        </section>

        <section className={section} aria-labelledby="voyage-dest">
          <h2 id="voyage-dest" className="mb-4 text-[18px] font-bold tracking-[-0.015em]">Destination et durée</h2>
          <div className="grid gap-4 sm:grid-cols-4">
            <Field label="Pays">{(p) => <Input {...p} required maxLength={60} value={draft.destinationCountry} onChange={(e) => set({ destinationCountry: e.target.value })} placeholder="Sénégal" />}</Field>
            <Field label="Ville / région" optional>{(p) => <Input {...p} maxLength={80} value={draft.destinationCity} onChange={(e) => set({ destinationCity: e.target.value })} placeholder="Ziguinchor" />}</Field>
            <Field label="Jours">{(p) => <Input {...p} inputMode="numeric" required value={draft.durationDays || ""} onChange={(e) => set({ durationDays: num(e.target.value) ?? 0 })} />}</Field>
            <Field label="Nuits">{(p) => <Input {...p} inputMode="numeric" value={draft.durationNights} onChange={(e) => set({ durationNights: num(e.target.value) ?? 0 })} />}</Field>
            <div className="sm:col-span-2"><Field label="Point de rendez-vous" optional>{(p) => <Input {...p} maxLength={200} value={draft.meetingPoint} onChange={(e) => set({ meetingPoint: e.target.value })} placeholder="Aéroport Blaise-Diagne, 4 h avant le vol" />}</Field></div>
            <Field label="Acompte demandé (%)" hint="Pourcentage du total demandé à la confirmation.">{(p) => <Input {...p} inputMode="numeric" value={draft.depositPercent} onChange={(e) => set({ depositPercent: Math.min(100, num(e.target.value) ?? 0) })} />}</Field>
          </div>
        </section>

        <section className={section} aria-labelledby="voyage-presta">
          <h2 id="voyage-presta" className="text-[18px] font-bold tracking-[-0.015em]">Prestations et pièces</h2>
          <fieldset className="mt-4"><legend className="text-[13px] font-semibold">Compris dans le prix</legend><Chips options={INCLUSION_LABELS} value={draft.included} onChange={(v) => set({ included: v })} /></fieldset>
          <div className="mt-4"><Field label="Non compris" optional>{(p) => <Input {...p} maxLength={400} value={draft.excludedNote} onChange={(e) => set({ excludedNote: e.target.value })} placeholder="Dépenses personnelles, boissons…" />}</Field></div>
          <fieldset className="mt-5"><legend className="text-[13px] font-semibold">Pièces demandées à chaque voyageur</legend><Chips options={DOCUMENT_LABELS} value={draft.requiredDocuments} onChange={(v) => set({ requiredDocuments: v })} /></fieldset>
          <p className="mt-2 text-xs text-yc-ink-soft">Pour chaque réservation, ces pièces apparaissent « à fournir » pour chaque voyageur ; vous suivez leur réception depuis la réservation.</p>
        </section>

        <section className={section} aria-labelledby="voyage-programme">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 id="voyage-programme" className="text-[18px] font-bold tracking-[-0.015em]">Programme</h2>
              <p className="text-sm text-yc-ink-soft">Un jour par étape importante ; les jours sans étape peuvent être omis.</p>
            </div>
            <Button type="button" variant="secondary" size="sm" onClick={addDay} disabled={draft.itinerary.length >= 90}><IconPlus size={16} /> Ajouter un jour</Button>
          </div>
          {draft.itinerary.length === 0 ? (
            <p className="rounded-lg bg-yc-ivory-50 px-4 py-6 text-center text-sm text-yc-ink-soft ring-1 ring-yc-ink/[0.06]">Aucune étape pour l&apos;instant.</p>
          ) : (
            <ol className="grid gap-3">
              {draft.itinerary.map((day, i) => (
                <li key={i} className="grid gap-2 rounded-lg bg-yc-ivory-50 p-3 ring-1 ring-yc-ink/[0.06] sm:grid-cols-[90px_1fr_auto] sm:items-start">
                  <Field label="Jour">{(p) => <Input {...p} inputMode="numeric" value={day.dayNumber} onChange={(e) => set({ itinerary: draft.itinerary.map((d, k) => (k === i ? { ...d, dayNumber: num(e.target.value) ?? 1 } : d)) })} />}</Field>
                  <div className="grid gap-2">
                    <Field label="Étape">{(p) => <Input {...p} required maxLength={120} value={day.title} onChange={(e) => set({ itinerary: draft.itinerary.map((d, k) => (k === i ? { ...d, title: e.target.value } : d)) })} placeholder="Bolongs en pirogue" />}</Field>
                    <Field label="Détail" optional>{(p) => <Input {...p} maxLength={800} value={day.description} onChange={(e) => set({ itinerary: draft.itinerary.map((d, k) => (k === i ? { ...d, description: e.target.value } : d)) })} />}</Field>
                  </div>
                  <button type="button" aria-label={`Retirer le jour ${day.dayNumber}`} onClick={() => set({ itinerary: draft.itinerary.filter((_, k) => k !== i) })} className="grid h-10 w-10 place-items-center self-end rounded-full text-yc-ink-soft hover:bg-white sm:mt-6"><IconX size={16} /></button>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className={section} aria-labelledby="voyage-photos">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 id="voyage-photos" className="text-[18px] font-bold tracking-[-0.015em]">Photos</h2>
              <p className="text-sm text-yc-ink-soft">La première photo sert de couverture sur le site.</p>
            </div>
            <Button type="button" variant="secondary" size="sm" onClick={() => setPicker(true)} disabled={draft.media.length >= 20}><IconPlus size={16} /> Ajouter une photo</Button>
          </div>
          {draft.media.length === 0 ? (
            <p className="rounded-lg bg-yc-ivory-50 px-4 py-6 text-center text-sm text-yc-ink-soft ring-1 ring-yc-ink/[0.06]">Aucune photo. Un voyage sans photo ne peut pas être mis en ligne.</p>
          ) : (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {draft.media.map((m, i) => (
                <li key={`${m.url}-${i}`} className="relative overflow-hidden rounded-lg ring-1 ring-yc-ink/10">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={m.url} alt={m.alt} className="aspect-[4/3] w-full object-cover" />
                  {i === 0 && <span className="absolute left-2 top-2 rounded bg-white/90 px-1.5 py-0.5 text-[11px] font-bold">Couverture</span>}
                  {m.demo && <span className="absolute inset-x-0 bottom-0 bg-yc-warning px-1 py-0.5 text-center text-[10px] font-bold uppercase text-white">Démo</span>}
                  <span className="absolute right-1.5 top-1.5 flex gap-1">
                    {i > 0 && <button type="button" aria-label={`Utiliser la photo ${i + 1} comme couverture`} onClick={() => set({ media: [m, ...draft.media.filter((_, j) => j !== i)] })} className="grid h-8 w-8 place-items-center rounded-full bg-white/90 shadow"><IconArrowLeft size={15} /></button>}
                    <button type="button" aria-label={`Retirer la photo ${i + 1}`} onClick={() => set({ media: draft.media.filter((_, j) => j !== i) })} className="grid h-8 w-8 place-items-center rounded-full bg-white/90 shadow"><IconX size={15} /></button>
                  </span>
                </li>
              ))}
            </ul>
          )}
          <label className="mt-5 flex w-fit items-center gap-2.5 text-sm font-medium">
            <input type="checkbox" checked={draft.featured} onChange={(e) => set({ featured: e.target.checked })} className="h-4 w-4 accent-yc-electric" /> Mettre en avant sur l&apos;accueil du site
          </label>
        </section>
      </fieldset>

      {listingId && status && (
        <section className={section} aria-labelledby="voyage-publication">
          <h2 id="voyage-publication" className="text-[18px] font-bold tracking-[-0.015em]">Publication</h2>
          <p className="mt-1 text-sm text-yc-ink-soft">
            {status === "published" ? "Ce voyage est visible sur votre site et ses départs ouverts peuvent être réservés." : status === "unavailable" ? "Ce voyage n'est plus proposé sur le site." : status === "archived" ? "Ce voyage est archivé." : "Ce voyage est un brouillon : il n'est visible que dans votre espace."}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {can.publish && status !== "published" && status !== "archived" && <Button type="button" variant="royal" size="sm" loading={pending} onClick={() => run(() => postTravel({ action: "trip_status", listingId, status: "published" }), "Voyage mis en ligne.")}>Mettre en ligne</Button>}
            {can.publish && status === "published" && <Button type="button" variant="secondary" size="sm" loading={pending} onClick={() => run(() => postTravel({ action: "trip_status", listingId, status: "unavailable" }), "Voyage retiré du site.")}>Retirer du site</Button>}
            {can.publish && status !== "archived" && <Button type="button" variant="ghost" size="sm" loading={pending} onClick={() => run(() => postTravel({ action: "trip_status", listingId, status: "archived" }), "Voyage archivé.")}>Archiver</Button>}
            {can.publish && status === "archived" && <Button type="button" variant="secondary" size="sm" loading={pending} onClick={() => run(() => postTravel({ action: "trip_status", listingId, status: "draft" }), "Voyage remis en brouillon.")}>Remettre en brouillon</Button>}
            {can.remove && (
              <Button type="button" variant="danger" size="sm" loading={pending} onClick={() => { if (!window.confirm("Supprimer définitivement ce voyage ? Impossible s'il a des réservations en cours.")) return; run(() => postTravel({ action: "delete_trip", listingId }), "Voyage supprimé.", () => router.push("/dashboard/voyages")); }}>
                Supprimer
              </Button>
            )}
          </div>
        </section>
      )}

      <div className="fixed inset-x-0 bottom-[calc(64px+env(safe-area-inset-bottom))] z-30 border-t border-yc-ink/[0.08] bg-white/95 backdrop-blur lg:bottom-0 lg:left-[268px]">
        <div className="mx-auto flex max-w-[1240px] flex-wrap items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <div role="status" aria-live="polite" className="min-w-0 flex-1 text-sm">
            {error ? <span role="alert" className="font-medium text-yc-danger">{error}</span> : notice ? <span className="font-medium text-[rgb(4_120_87)]">{notice}</span> : <span className="text-yc-ink-soft">{TRIP_TYPE_LABELS[draft.tripType]} · {draft.durationDays || "?"} jours</span>}
          </div>
          {can.edit && <Button type="submit" variant="royal" loading={pending} className="rounded-lg">{listingId ? "Enregistrer" : "Créer le voyage"} <IconArrowRight size={16} /></Button>}
        </div>
      </div>

      {picker && <MediaPickerDialog onClose={() => setPicker(false)} onPick={(url, alt) => set({ media: [...draft.media, { url, alt: alt || draft.title }] })} />}
    </form>
  );
}
