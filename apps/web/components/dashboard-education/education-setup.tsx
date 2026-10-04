"use client";

import { useState } from "react";
import { Button } from "@/components/yc/button";
import { MediaPickerDialog } from "@/components/media/media-picker-dialog";
import { Feedback, input, section, useEduAction } from "./shared";

export interface SchoolHomeDraft { coverUrl: string | null; coverDemo: boolean; eyebrow: string; title: string; subtitle: string; contactPhone: string; contactWhatsapp: string; contactAddress: string }

/** Vitrine de l’établissement en un geste : photo d'accueil, accroche, coordonnées. */
export function EducationSetup({ home, siteUrl, editorHome }: { home: SchoolHomeDraft; siteUrl: string | null; editorHome: boolean }) {
  const a = useEduAction();
  const [h, setH] = useState(home);
  const [picker, setPicker] = useState(false);
  const field = (k: keyof SchoolHomeDraft, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}, wide = false) => (
    <label className={`grid text-[13px] font-semibold ${wide ? "sm:col-span-2" : ""}`}>{label}<input {...props} value={String(h[k] ?? "")} onChange={(e) => setH({ ...h, [k]: e.target.value })} className={input} /></label>
  );
  return (
    <section className={section} aria-labelledby="vitrine">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="vitrine" className="text-[18px] font-bold tracking-[-0.015em]">Votre vitrine</h2>
          <p className="text-sm text-yc-ink-soft">La grande photo et la phrase que vos clients voient en arrivant. Vos formations, les inscriptions et les espaces familles sont déjà en place.</p>
          {editorHome && <p className="mt-2 rounded-lg bg-[#FFF3DC] px-3 py-2 text-[13px] text-[#6B4300]">Votre accueil est composé dans l&apos;éditeur : cette vitrine s&apos;affichera si vous revenez à l&apos;accueil standard. Vos coordonnées s&apos;appliquent partout.</p>}
        </div>
        {siteUrl && <a href={siteUrl} target="_blank" rel="noreferrer" className="shrink-0 text-sm font-semibold text-yc-electric hover:underline">Voir mon site</a>}
      </div>
      <form className="mt-5 grid gap-5 lg:grid-cols-[280px_1fr]" onSubmit={(e) => { e.preventDefault(); a.run({ action: "save_home", home: { coverUrl: h.coverUrl, eyebrow: h.eyebrow, title: h.title, subtitle: h.subtitle, contactPhone: h.contactPhone || null, contactWhatsapp: h.contactWhatsapp || null, contactAddress: h.contactAddress || null } }, "Vitrine enregistrée : votre site est à jour."); }}>
        <div>
          <button type="button" onClick={() => setPicker(true)} className="relative block aspect-[16/10] w-full overflow-hidden rounded-xl bg-yc-ink/[0.05] ring-1 ring-yc-ink/10">
            {h.coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={h.coverUrl} alt="Photo d'accueil" className="h-full w-full object-cover" />
            ) : (
              <span className="grid h-full place-items-center px-6 text-center text-sm text-yc-ink-soft">Votre plus belle photo : une salle de classe, la cour, vos élèves au travail.</span>
            )}
            <span className="absolute inset-x-3 bottom-3 rounded-lg bg-white/95 py-2 text-center text-sm font-semibold shadow">{h.coverUrl ? "Changer la photo" : "Choisir une photo"}</span>
          </button>
          {h.coverDemo && h.coverUrl && <p className="mt-2 text-xs text-yc-ink-soft">Illustration de démonstration : remplacez-la par votre propre photo.</p>}
          {!h.coverUrl && <p className="mt-2 text-xs text-yc-ink-soft">Sans photo, l&apos;accueil montre la photo de votre formation vedette.</p>}
        </div>
        <div className="grid content-start gap-4 sm:grid-cols-2">
          {field("title", "Titre", { required: true, maxLength: 80 }, true)}
          {field("subtitle", "Votre promesse, en une phrase", { maxLength: 220, placeholder: "Des classes à taille humaine et un suivi partagé avec les familles." }, true)}
          {field("eyebrow", "Petite ligne au-dessus du titre", { maxLength: 60, placeholder: "Établissement privé · Mermoz" })}
          {field("contactAddress", "Adresse de l'établissement", { maxLength: 160 })}
          {field("contactPhone", "Téléphone", { type: "tel", maxLength: 30 })}
          {field("contactWhatsapp", "WhatsApp", { type: "tel", maxLength: 30 })}
          <div className="flex items-center gap-3 sm:col-span-2"><Button type="submit" variant="royal" loading={a.pending}>Enregistrer la vitrine</Button><Feedback error={a.error} notice={a.notice} /></div>
        </div>
      </form>
      {picker && <MediaPickerDialog size="large" onClose={() => setPicker(false)} onPick={(url) => { setH((x) => ({ ...x, coverUrl: url, coverDemo: false })); setPicker(false); }} />}
    </section>
  );
}
