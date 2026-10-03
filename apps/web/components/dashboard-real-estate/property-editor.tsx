"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/yc/button";
import { Field, Input, Select, Textarea } from "@/components/yc/field";
import { IconArrowLeft, IconArrowRight, IconPlus, IconX } from "@/components/yc/icons";
import { MediaPickerDialog } from "@/components/media/media-picker-dialog";
import { AMENITY_LABELS, DEAL_TYPE_LABELS, PROPERTY_TYPE_LABELS } from "@/lib/real-estate/labels";

export interface PropertyDraft {
  title: string;
  summary: string;
  description: string;
  price: number | null;
  propertyType: string;
  dealType: string;
  bedrooms: number | null;
  bathrooms: number | null;
  surfaceM2: number | null;
  landSurfaceM2: number | null;
  furnished: boolean;
  amenities: string[];
  agencyReference: string;
  featured: boolean;
  location: { region?: string; commune?: string; neighborhood?: string };
  media: { url: string; alt: string; demo?: boolean }[];
}

export async function postRealEstate<T = unknown>(body: unknown): Promise<T> {
  const res = await fetch("/api/dashboard/real-estate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const json = (await res.json().catch(() => ({}))) as { data?: T; error?: string };
  if (!res.ok) throw new Error(json.error ?? "Action impossible.");
  return json.data as T;
}

const num = (v: string) => (v.trim() === "" ? null : Math.max(0, Math.round(Number(v.replace(/\s/g, "")))));
const section = "rounded-xl bg-white p-5 shadow-[0_1px_2px_rgb(12_22_48/0.04),0_8px_24px_-16px_rgb(12_22_48/0.12)] ring-1 ring-yc-ink/[0.07] sm:p-6";

export function PropertyEditor({
  listingId,
  status,
  initial,
  can,
}: {
  listingId: string | null;
  status: string | null;
  initial: PropertyDraft;
  can: { edit: boolean; publish: boolean; remove: boolean };
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<PropertyDraft>(initial);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [picker, setPicker] = useState(false);
  const [pending, start] = useTransition();
  const set = (patch: Partial<PropertyDraft>) => setDraft((d) => ({ ...d, ...patch }));
  const land = draft.propertyType === "land";

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

  function save() {
    run(
      () => postRealEstate<{ id: string }>({ action: "save_property", listingId, property: draft }),
      listingId ? "Bien enregistré." : "Bien créé.",
      (data) => {
        if (!listingId) router.push(`/dashboard/biens/${(data as { id: string }).id}`);
      },
    );
  }

  const disabled = !can.edit;
  return (
    <form
      className="flex flex-col gap-5 pb-28"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <fieldset disabled={disabled} className="contents">
        <section className={section} aria-labelledby="bien-infos">
          <h2 id="bien-infos" className="mb-4 text-[18px] font-bold tracking-[-0.015em]">Informations</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2"><Field label="Titre de l'annonce">{(p) => <Input {...p} required minLength={3} maxLength={120} value={draft.title} onChange={(e) => set({ title: e.target.value })} placeholder="Villa contemporaine avec piscine aux Almadies" />}</Field></div>
            <Field label="Transaction">{(p) => <Select {...p} value={draft.dealType} onChange={(e) => set({ dealType: e.target.value })}>{Object.entries(DEAL_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select>}</Field>
            <Field label="Type de bien">{(p) => <Select {...p} value={draft.propertyType} onChange={(e) => set({ propertyType: e.target.value })}>{Object.entries(PROPERTY_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select>}</Field>
            <Field label={draft.dealType === "rent" ? "Loyer mensuel (FCFA)" : "Prix de vente (FCFA)"} hint="Laissez vide pour « Prix sur demande »." optional>
              {(p) => <Input {...p} inputMode="numeric" value={draft.price ?? ""} onChange={(e) => set({ price: num(e.target.value) })} placeholder={draft.dealType === "rent" ? "450000" : "650000000"} />}
            </Field>
            <Field label="Référence agence" optional>{(p) => <Input {...p} maxLength={40} value={draft.agencyReference} onChange={(e) => set({ agencyReference: e.target.value })} placeholder="ALM-0042" />}</Field>
            <div className="sm:col-span-2"><Field label="Accroche" hint="Une phrase affichée sur la carte du bien." optional>{(p) => <Input {...p} maxLength={220} value={draft.summary} onChange={(e) => set({ summary: e.target.value })} />}</Field></div>
            <div className="sm:col-span-2"><Field label="Description" optional>{(p) => <Textarea {...p} rows={6} maxLength={5000} value={draft.description} onChange={(e) => set({ description: e.target.value })} />}</Field></div>
          </div>
        </section>

        <section className={section} aria-labelledby="bien-carac">
          <h2 id="bien-carac" className="mb-4 text-[18px] font-bold tracking-[-0.015em]">Caractéristiques</h2>
          <div className="grid gap-4 sm:grid-cols-4">
            {!land && <Field label="Chambres" optional>{(p) => <Input {...p} inputMode="numeric" value={draft.bedrooms ?? ""} onChange={(e) => set({ bedrooms: num(e.target.value) })} />}</Field>}
            {!land && <Field label="Salles de bain" optional>{(p) => <Input {...p} inputMode="numeric" value={draft.bathrooms ?? ""} onChange={(e) => set({ bathrooms: num(e.target.value) })} />}</Field>}
            {!land && <Field label="Surface habitable (m²)" optional>{(p) => <Input {...p} inputMode="numeric" value={draft.surfaceM2 ?? ""} onChange={(e) => set({ surfaceM2: num(e.target.value) || null })} />}</Field>}
            <Field label="Terrain (m²)" optional>{(p) => <Input {...p} inputMode="numeric" value={draft.landSurfaceM2 ?? ""} onChange={(e) => set({ landSurfaceM2: num(e.target.value) || null })} />}</Field>
          </div>
          {!land && (
            <label className="mt-4 flex w-fit items-center gap-2.5 text-sm font-medium">
              <input type="checkbox" checked={draft.furnished} onChange={(e) => set({ furnished: e.target.checked })} className="h-4 w-4 accent-yc-electric" /> Meublé
            </label>
          )}
          <fieldset className="mt-5">
            <legend className="text-[13px] font-semibold">Équipements</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {Object.entries(AMENITY_LABELS).map(([key, label]) => {
                const on = draft.amenities.includes(key);
                return (
                  <label key={key} className={`cursor-pointer rounded-full px-3.5 py-2 text-sm ring-1 ring-inset transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-yc-electric ${on ? "bg-yc-electric/10 font-semibold text-yc-electric ring-yc-electric/40" : "bg-white text-yc-ink-soft ring-yc-ink/12 hover:ring-yc-ink/25"}`}>
                    <input type="checkbox" className="sr-only" checked={on} onChange={() => set({ amenities: on ? draft.amenities.filter((a) => a !== key) : [...draft.amenities, key] })} />
                    {label}
                  </label>
                );
              })}
            </div>
          </fieldset>
        </section>

        <section className={section} aria-labelledby="bien-lieu">
          <h2 id="bien-lieu" className="mb-4 text-[18px] font-bold tracking-[-0.015em]">Localisation</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Région" optional>{(p) => <Input {...p} maxLength={60} value={draft.location.region ?? ""} onChange={(e) => set({ location: { ...draft.location, region: e.target.value } })} placeholder="Dakar" />}</Field>
            <Field label="Commune" optional>{(p) => <Input {...p} maxLength={80} value={draft.location.commune ?? ""} onChange={(e) => set({ location: { ...draft.location, commune: e.target.value } })} placeholder="Almadies" />}</Field>
            <Field label="Quartier" optional>{(p) => <Input {...p} maxLength={80} value={draft.location.neighborhood ?? ""} onChange={(e) => set({ location: { ...draft.location, neighborhood: e.target.value } })} placeholder="Ngor Virage" />}</Field>
          </div>
          <p className="mt-3 text-xs text-yc-ink-soft">L&apos;adresse exacte n&apos;est jamais publiée : seuls la commune et le quartier apparaissent sur le site.</p>
        </section>

        <section className={section} aria-labelledby="bien-photos">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 id="bien-photos" className="text-[18px] font-bold tracking-[-0.015em]">Photos</h2>
              <p className="text-sm text-yc-ink-soft">La première photo sert de couverture. Des photos fidèles du bien, prises sur place.</p>
            </div>
            <Button type="button" variant="secondary" size="sm" onClick={() => setPicker(true)} disabled={draft.media.length >= 20}><IconPlus size={16} /> Ajouter une photo</Button>
          </div>
          {draft.media.length === 0 ? (
            <p className="rounded-lg bg-yc-ivory-50 px-4 py-6 text-center text-sm text-yc-ink-soft ring-1 ring-yc-ink/[0.06]">Aucune photo. Un bien sans photo ne peut pas être mis en ligne.</p>
          ) : (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {draft.media.map((m, i) => (
                <li key={`${m.url}-${i}`} className="group relative overflow-hidden rounded-lg ring-1 ring-yc-ink/10">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={m.url} alt={m.alt} className="aspect-[4/3] w-full object-cover" />
                  {i === 0 && <span className="absolute left-2 top-2 rounded bg-white/90 px-1.5 py-0.5 text-[11px] font-bold">Couverture</span>}
                  {m.demo && <span className="absolute inset-x-0 bottom-0 bg-yc-warning px-1 py-0.5 text-center text-[10px] font-bold uppercase text-white">Démo</span>}
                  <span className="absolute right-1.5 top-1.5 flex gap-1">
                    {i > 0 && (
                      <button type="button" aria-label={`Utiliser la photo ${i + 1} comme couverture`} onClick={() => set({ media: [m, ...draft.media.filter((_, j) => j !== i)] })} className="grid h-8 w-8 place-items-center rounded-full bg-white/90 shadow"><IconArrowLeft size={15} /></button>
                    )}
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
        <section className={section} aria-labelledby="bien-publication">
          <h2 id="bien-publication" className="text-[18px] font-bold tracking-[-0.015em]">Publication</h2>
          <p className="mt-1 text-sm text-yc-ink-soft">
            {status === "published" ? "Ce bien est visible sur votre site et peut recevoir des demandes de visite." : status === "unavailable" ? "Ce bien n'est plus proposé (loué, vendu ou retiré momentanément)." : status === "archived" ? "Ce bien est archivé." : "Ce bien est un brouillon : il n'est visible que dans votre espace."}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {can.publish && status !== "published" && status !== "archived" && (
              <Button type="button" variant="royal" size="sm" loading={pending} onClick={() => run(() => postRealEstate({ action: "property_status", listingId, status: "published" }), "Bien mis en ligne.")}>Mettre en ligne</Button>
            )}
            {can.publish && status === "published" && (
              <Button type="button" variant="secondary" size="sm" loading={pending} onClick={() => run(() => postRealEstate({ action: "property_status", listingId, status: "unavailable" }), "Bien retiré du site.")}>Retirer du site (loué, vendu…)</Button>
            )}
            {can.publish && status !== "archived" && (
              <Button type="button" variant="ghost" size="sm" loading={pending} onClick={() => run(() => postRealEstate({ action: "property_status", listingId, status: "archived" }), "Bien archivé.")}>Archiver</Button>
            )}
            {can.publish && status === "archived" && (
              <Button type="button" variant="secondary" size="sm" loading={pending} onClick={() => run(() => postRealEstate({ action: "property_status", listingId, status: "draft" }), "Bien remis en brouillon.")}>Remettre en brouillon</Button>
            )}
            {can.remove && (
              <Button
                type="button"
                variant="danger"
                size="sm"
                loading={pending}
                onClick={() => {
                  if (!window.confirm("Supprimer définitivement ce bien ? Son historique est conservé, mais il ne compte plus dans votre formule.")) return;
                  run(() => postRealEstate({ action: "delete_property", listingId }), "Bien supprimé.", () => router.push("/dashboard/biens"));
                }}
              >
                Supprimer
              </Button>
            )}
          </div>
        </section>
      )}

      <div className="fixed inset-x-0 bottom-[calc(64px+env(safe-area-inset-bottom))] z-30 border-t border-yc-ink/[0.08] bg-white/95 backdrop-blur lg:bottom-0 lg:left-[268px]">
        <div className="mx-auto flex max-w-[1240px] flex-wrap items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <div role="status" aria-live="polite" className="min-w-0 flex-1 text-sm">
            {error ? <span role="alert" className="font-medium text-yc-danger">{error}</span> : notice ? <span className="font-medium text-[rgb(4_120_87)]">{notice}</span> : <span className="text-yc-ink-soft">{DEAL_TYPE_LABELS[draft.dealType]} · {PROPERTY_TYPE_LABELS[draft.propertyType]}</span>}
          </div>
          {can.edit && <Button type="submit" variant="royal" loading={pending} className="rounded-lg">{listingId ? "Enregistrer" : "Créer le bien"} <IconArrowRight size={16} /></Button>}
        </div>
      </div>

      {picker && <MediaPickerDialog onClose={() => setPicker(false)} onPick={(url, alt) => set({ media: [...draft.media, { url, alt: alt || draft.title }] })} />}
    </form>
  );
}
