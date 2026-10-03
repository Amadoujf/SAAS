"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/yc/button";
import { MediaPickerDialog } from "@/components/media/media-picker-dialog";
import { AUDIENCE_LABELS, CATEGORY_LABELS, FORMAT_LABELS, formatNumber } from "@/lib/education/labels";
import { input, label, parseAmount, postEdu, section } from "./shared";

export interface ProgramForm {
  title: string;
  summary: string;
  description: string;
  tuition: string;
  registrationFee: string;
  defaultInstallments: string;
  category: string;
  level: string;
  format: string;
  durationLabel: string;
  audience: string;
  featured: boolean;
  media: { url: string; alt: string; demo?: boolean }[];
  published: boolean;
}

export const EMPTY_PROGRAM: ProgramForm = { title: "", summary: "", description: "", tuition: "", registrationFee: "0", defaultInstallments: "1", category: "training", level: "", format: "onsite", durationLabel: "", audience: "all", featured: false, media: [], published: false };

/** Fiche d'une formation : scolarité, frais d'inscription et échéances fixés ici — jamais par le navigateur du client. */
export function ProgramEditor({ listingId, initial, canPublish }: { listingId: string | null; initial: ProgramForm; canPublish: boolean }) {
  const router = useRouter();
  const [f, setF] = useState(initial);
  const [picker, setPicker] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const set = <K extends keyof ProgramForm>(k: K, v: ProgramForm[K]) => setF({ ...f, [k]: v });
  const tuition = f.tuition.trim() === "" ? null : parseAmount(f.tuition);
  const fee = parseAmount(f.registrationFee) ?? 0;
  return (
    <form
      className="grid gap-5"
      onSubmit={async (e) => {
        e.preventDefault();
        setPending(true);
        setError(null);
        setNotice(null);
        try {
          const data = await postEdu<{ id: string }>({
            action: "save_program",
            listingId,
            program: { title: f.title, summary: f.summary || null, description: f.description || null, tuition, registrationFee: fee, defaultInstallments: Number(f.defaultInstallments), category: f.category, level: f.level || null, format: f.format, durationLabel: f.durationLabel || null, audience: f.audience, featured: f.featured, media: f.media, ...(canPublish ? { publish: f.published } : {}) },
          });
          if (!listingId) router.push(`/dashboard/formations/${data.id}`);
          else {
            setNotice("Formation enregistrée.");
            router.refresh();
          }
        } catch (err) {
          setError(err instanceof Error ? err.message : "Enregistrement impossible.");
        }
        setPending(false);
      }}
    >
      <section className={section}>
        <h2 className="text-[17px] font-bold">La formation</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className={`${label} sm:col-span-2`}>Intitulé<input required maxLength={120} value={f.title} onChange={(e) => set("title", e.target.value)} placeholder="Anglais — niveau B1" className={input} /></label>
          <label className={label}>Domaine<select value={f.category} onChange={(e) => set("category", e.target.value)} className={input}>{Object.entries(CATEGORY_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
          <label className={label}>Niveau<input maxLength={40} value={f.level} onChange={(e) => set("level", e.target.value)} placeholder="Terminale, B1, Débutant…" className={input} /></label>
          <label className={label}>Format<select value={f.format} onChange={(e) => set("format", e.target.value)} className={input}>{Object.entries(FORMAT_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
          <label className={label}>Public<select value={f.audience} onChange={(e) => set("audience", e.target.value)} className={input}>{Object.entries(AUDIENCE_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
          <label className={label}>Durée affichée<input maxLength={40} value={f.durationLabel} onChange={(e) => set("durationLabel", e.target.value)} placeholder="9 mois, 12 semaines…" className={input} /></label>
          <label className={`${label} sm:col-span-2`}>Résumé<input maxLength={300} value={f.summary} onChange={(e) => set("summary", e.target.value)} className={input} /></label>
          <label className={`${label} sm:col-span-2`}>Programme détaillé<textarea rows={6} maxLength={4000} value={f.description} onChange={(e) => set("description", e.target.value)} className={`${input} h-auto py-2.5`} /></label>
        </div>
      </section>

      <section className={section}>
        <h2 className="text-[17px] font-bold">Frais</h2>
        <p className="mt-1 text-sm text-yc-ink-soft">Ces montants s&apos;appliquent à chaque nouvelle inscription. Une remise se décide dossier par dossier, avec son motif.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <label className={label}>Scolarité (FCFA)<input inputMode="numeric" value={f.tuition} onChange={(e) => set("tuition", e.target.value.replace(/[^\d\s]/g, ""))} placeholder="Vide = sur devis" className={input} /></label>
          <label className={label}>Frais d&apos;inscription (FCFA)<input inputMode="numeric" value={f.registrationFee} onChange={(e) => set("registrationFee", e.target.value.replace(/[^\d\s]/g, ""))} className={input} /></label>
          <label className={label}>Échéances de scolarité<select value={f.defaultInstallments} onChange={(e) => set("defaultInstallments", e.target.value)} className={input}>{Array.from({ length: 12 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n === 1 ? "Paiement unique" : `${n} mensualités`}</option>)}</select></label>
        </div>
        {tuition != null && <p className="mt-3 rounded-lg bg-yc-ivory-50 px-3 py-2 text-sm ring-1 ring-yc-ink/[0.06]">Total par élève : <strong className="yc-num">{formatNumber(tuition + fee)} FCFA</strong>{Number(f.defaultInstallments) > 1 ? <> · soit {f.defaultInstallments} mensualités d&apos;environ <span className="yc-num">{formatNumber(Math.floor(tuition / Number(f.defaultInstallments)))} FCFA</span> après l&apos;inscription</> : null}</p>}
      </section>

      <section className={section}>
        <h2 className="text-[17px] font-bold">Photos</h2>
        {f.media.length === 0 ? <p className="mt-2 text-sm text-yc-ink-soft">Aucune photo : la carte affiche l&apos;initiale de la formation.</p> : (
          <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {f.media.map((m, i) => (
              <li key={m.url} className="overflow-hidden rounded-lg ring-1 ring-yc-ink/10">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={m.url} alt={m.alt} className="aspect-[4/3] w-full object-cover" />
                <div className="flex justify-between px-1.5 py-1 text-xs">
                  <button type="button" disabled={i === 0} onClick={() => set("media", [m, ...f.media.filter((_, k) => k !== i)])} className="font-semibold text-yc-electric disabled:text-yc-ink-soft">Principale</button>
                  <button type="button" onClick={() => set("media", f.media.filter((_, k) => k !== i))} className="font-semibold text-yc-danger">Retirer</button>
                </div>
              </li>
            ))}
          </ul>
        )}
        <Button type="button" variant="secondary" className="mt-3" onClick={() => setPicker(true)}>Ajouter depuis la médiathèque</Button>
      </section>

      <section className={section}>
        <label className="flex items-center gap-3 text-sm font-semibold"><input type="checkbox" checked={f.featured} onChange={(e) => set("featured", e.target.checked)} className="h-4 w-4" /> Mettre en avant sur l&apos;accueil</label>
        {canPublish && <label className="mt-3 flex items-center gap-3 text-sm font-semibold"><input type="checkbox" checked={f.published} onChange={(e) => set("published", e.target.checked)} className="h-4 w-4" /> Publiée sur le site (inscriptions en ligne possibles)</label>}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button type="submit" variant="royal" loading={pending}>{listingId ? "Enregistrer" : "Créer la formation"}</Button>
          {error && <p role="alert" className="text-sm font-medium text-yc-danger">{error}</p>}
          {notice && <p role="status" className="text-sm font-medium text-[rgb(4_120_87)]">{notice}</p>}
        </div>
      </section>
      {picker && (
        <MediaPickerDialog
          size="large"
          onClose={() => setPicker(false)}
          onPick={(url, alt) => {
            set("media", [...f.media, { url, alt: alt || f.title }]);
            setPicker(false);
          }}
        />
      )}
    </form>
  );
}
