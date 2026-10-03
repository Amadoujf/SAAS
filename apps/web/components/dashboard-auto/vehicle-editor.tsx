"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/yc/button";
import { MediaPickerDialog } from "@/components/media/media-picker-dialog";
import { BODY_LABELS, CONDITION_LABELS, FEATURE_LABELS, FUEL_LABELS, TRANSMISSION_LABELS } from "@/lib/auto/labels";
import { Feedback, input, label, parseAmount, postAuto, section } from "./shared";

export interface VehicleForm {
  make: string;
  model: string;
  version: string;
  year: string;
  mileageKm: string;
  fuel: string;
  transmission: string;
  bodyType: string;
  condition: string;
  color: string;
  engine: string;
  seats: string;
  features: string[];
  negotiable: boolean;
  vin: string;
  plate: string;
  price: string;
  summary: string;
  description: string;
  featured: boolean;
  media: { url: string; alt: string; demo?: boolean }[];
  published: boolean;
}

export const EMPTY_VEHICLE: VehicleForm = { make: "", model: "", version: "", year: String(new Date().getFullYear() - 3), mileageKm: "", fuel: "essence", transmission: "automatique", bodyType: "suv", condition: "used", color: "", engine: "", seats: "5", features: [], negotiable: false, vin: "", plate: "", price: "", summary: "", description: "", featured: false, media: [], published: false };

const Select = ({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: Record<string, string> }) => (
  <select value={value} onChange={(e) => onChange(e.target.value)} className={input}>{Object.entries(options).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
);

/** Fiche d'un véhicule : identité, fiche technique, équipements, prix, photos, publication. */
export function VehicleEditor({ listingId, initial, canPublish }: { listingId: string | null; initial: VehicleForm; canPublish: boolean }) {
  const router = useRouter();
  const [f, setF] = useState(initial);
  const [picker, setPicker] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const set = <K extends keyof VehicleForm>(k: K, v: VehicleForm[K]) => setF((x) => ({ ...x, [k]: v }));

  const submit = async () => {
    setPending(true);
    setError(null);
    setNotice(null);
    try {
      const price = f.price.trim() ? parseAmount(f.price) : null;
      if (f.price.trim() && !price) throw new Error("Prix invalide.");
      const data = await postAuto<{ id: string }>({
        action: "save_vehicle",
        listingId,
        vehicle: {
          make: f.make, model: f.model, version: f.version || null, year: Number(f.year), mileageKm: Number(f.mileageKm.replace(/\s/g, "") || 0),
          fuel: f.fuel, transmission: f.transmission, bodyType: f.bodyType, condition: f.condition, color: f.color || null, engine: f.engine || null,
          seats: f.seats ? Number(f.seats) : null, features: f.features, negotiable: f.negotiable, vin: f.vin || null, plate: f.plate || null,
          price, summary: f.summary || null, description: f.description || null, featured: f.featured, media: f.media, ...(canPublish ? { publish: f.published } : {}),
        },
      });
      setNotice(listingId ? "Véhicule enregistré." : "Véhicule ajouté au stock.");
      if (!listingId) router.push(`/dashboard/vehicules/${data.id}`);
      else router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Enregistrement impossible.");
    } finally {
      setPending(false);
    }
  };

  return (
    <form className="grid gap-5 lg:grid-cols-[1fr_340px]" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
      <div className="grid gap-5">
        <section className={section} aria-labelledby="identite">
          <h2 id="identite" className="text-[17px] font-bold">Le véhicule</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <label className={label}>Marque<input required maxLength={40} value={f.make} onChange={(e) => set("make", e.target.value)} className={input} placeholder="Toyota" /></label>
            <label className={label}>Modèle<input required maxLength={60} value={f.model} onChange={(e) => set("model", e.target.value)} className={input} placeholder="RAV4" /></label>
            <label className={label}>Version <span className="font-normal text-yc-ink-soft">(facultatif)</span><input maxLength={40} value={f.version} onChange={(e) => set("version", e.target.value)} className={input} /></label>
            <label className={label}>Année<input required inputMode="numeric" maxLength={4} value={f.year} onChange={(e) => set("year", e.target.value.replace(/\D/g, ""))} className={input} /></label>
            <label className={label}>Kilométrage<input required inputMode="numeric" maxLength={9} value={f.mileageKm} onChange={(e) => set("mileageKm", e.target.value.replace(/[^\d\s]/g, ""))} className={input} placeholder="45 000" /></label>
            <label className={label}>État<Select value={f.condition} onChange={(v) => set("condition", v)} options={CONDITION_LABELS} /></label>
            <label className={label}>Énergie<Select value={f.fuel} onChange={(v) => set("fuel", v)} options={FUEL_LABELS} /></label>
            <label className={label}>Boîte<Select value={f.transmission} onChange={(v) => set("transmission", v)} options={TRANSMISSION_LABELS} /></label>
            <label className={label}>Carrosserie<Select value={f.bodyType} onChange={(v) => set("bodyType", v)} options={BODY_LABELS} /></label>
            <label className={label}>Moteur <span className="font-normal text-yc-ink-soft">(facultatif)</span><input maxLength={40} value={f.engine} onChange={(e) => set("engine", e.target.value)} className={input} placeholder="2.5 hybride 218 ch" /></label>
            <label className={label}>Couleur<input maxLength={30} value={f.color} onChange={(e) => set("color", e.target.value)} className={input} /></label>
            <label className={label}>Places<input inputMode="numeric" maxLength={2} value={f.seats} onChange={(e) => set("seats", e.target.value.replace(/\D/g, ""))} className={input} /></label>
            <label className={label}>N° de châssis (VIN) <span className="font-normal text-yc-ink-soft">(interne)</span><input maxLength={30} value={f.vin} onChange={(e) => set("vin", e.target.value)} className={input} /></label>
            <label className={label}>Immatriculation <span className="font-normal text-yc-ink-soft">(interne)</span><input maxLength={20} value={f.plate} onChange={(e) => set("plate", e.target.value)} className={input} /></label>
          </div>
        </section>

        <section className={section} aria-labelledby="equipements">
          <h2 id="equipements" className="text-[17px] font-bold">Équipements</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {Object.entries(FEATURE_LABELS).map(([k, l]) => {
              const on = f.features.includes(k);
              return (
                <button key={k} type="button" aria-pressed={on} onClick={() => set("features", on ? f.features.filter((x) => x !== k) : [...f.features, k])} className={`rounded-full px-3 py-1.5 text-[13px] font-semibold ring-1 ring-inset ${on ? "bg-yc-night-900 text-white ring-yc-night-900" : "bg-white ring-yc-ink/15 hover:ring-yc-ink/30"}`}>{l}</button>
              );
            })}
          </div>
        </section>

        <section className={section} aria-labelledby="annonce">
          <h2 id="annonce" className="text-[17px] font-bold">L&apos;annonce</h2>
          <div className="mt-4 grid gap-4">
            <label className={label}>En une phrase<input maxLength={300} value={f.summary} onChange={(e) => set("summary", e.target.value)} className={input} placeholder="Première main, entretien complet, pneus récents." /></label>
            <label className={label}>Description<textarea rows={5} maxLength={4000} value={f.description} onChange={(e) => set("description", e.target.value)} className={`${input} h-auto py-2.5`} /></label>
          </div>
        </section>

        <section className={section} aria-labelledby="photos">
          <div className="flex items-center justify-between gap-3">
            <h2 id="photos" className="text-[17px] font-bold">Photos</h2>
            <Button type="button" variant="secondary" onClick={() => setPicker(true)}>Ajouter une photo</Button>
          </div>
          {f.media.length === 0 ? (
            <p className="mt-3 text-sm text-yc-ink-soft">Ajoutez au moins une photo de profil, prise en plein jour. La première est la photo principale.</p>
          ) : (
            <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {f.media.map((m, i) => (
                <li key={m.url + i} className="overflow-hidden rounded-lg ring-1 ring-yc-ink/10">
                  <div className="relative aspect-[4/3] bg-yc-ink/[0.04]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={m.url} alt={m.alt} className="h-full w-full object-cover" />
                    {i === 0 && <span className="absolute left-1.5 top-1.5 rounded bg-yc-night-900 px-1.5 py-0.5 text-[10px] font-bold text-white">Principale</span>}
                    {m.demo && <span className="absolute right-1.5 top-1.5 rounded bg-white/90 px-1.5 py-0.5 text-[10px] font-bold">Démo</span>}
                  </div>
                  <div className="flex justify-between gap-1 p-1.5 text-xs">
                    <button type="button" disabled={i === 0} onClick={() => set("media", [m, ...f.media.filter((_, k) => k !== i)])} className="rounded px-1.5 py-1 font-semibold text-yc-electric disabled:text-yc-ink-soft">Principale</button>
                    <button type="button" onClick={() => set("media", f.media.filter((_, k) => k !== i))} className="rounded px-1.5 py-1 font-semibold text-yc-danger">Retirer</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <aside className="grid content-start gap-5 lg:sticky lg:top-24">
        <section className={section} aria-labelledby="prix">
          <h2 id="prix" className="text-[17px] font-bold">Prix</h2>
          <label className={`${label} mt-3`}>Prix affiché (FCFA)<input inputMode="numeric" maxLength={14} value={f.price} onChange={(e) => set("price", e.target.value.replace(/[^\d\s]/g, ""))} className={input} placeholder="Vide = prix sur demande" /></label>
          <label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={f.negotiable} onChange={(e) => set("negotiable", e.target.checked)} className="h-4 w-4" />Prix à débattre</label>
          <label className="mt-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={f.featured} onChange={(e) => set("featured", e.target.checked)} className="h-4 w-4" />Mettre en avant sur l&apos;accueil</label>
          {canPublish && (
            <label className="mt-4 flex items-start gap-2 rounded-lg bg-yc-ivory-50 p-3 text-sm ring-1 ring-yc-ink/[0.06]">
              <input type="checkbox" checked={f.published} onChange={(e) => set("published", e.target.checked)} className="mt-0.5 h-4 w-4" />
              <span><span className="font-semibold">Visible sur le site</span><br /><span className="text-yc-ink-soft">Décoché : brouillon, visible par l&apos;équipe seulement.</span></span>
            </label>
          )}
          <Button type="submit" variant="royal" loading={pending} className="mt-5 w-full">{listingId ? "Enregistrer" : "Ajouter au stock"}</Button>
          <Feedback error={error} notice={notice} />
        </section>
      </aside>

      {picker && (
        <MediaPickerDialog
          size="large"
          onClose={() => setPicker(false)}
          onPick={(url, alt) => {
            set("media", [...f.media, { url, alt: alt || `${f.make} ${f.model}`.trim() }]);
            setPicker(false);
          }}
        />
      )}
    </form>
  );
}
