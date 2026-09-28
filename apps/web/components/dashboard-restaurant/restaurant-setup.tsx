"use client";

import { useState } from "react";
import { Button } from "@/components/yc/button";
import { MediaPickerDialog } from "@/components/media/media-picker-dialog";
import { formatXof } from "@/lib/restaurant/labels";
import { Feedback, section, useRestoAction } from "./shared";

export interface SetupHome {
  coverUrl: string | null;
  coverDemo: boolean;
  eyebrow: string;
  title: string;
  subtitle: string;
  contactPhone: string;
  contactWhatsapp: string;
  contactAddress: string;
}

export interface SetupDish { id: string; name: string; section: string; price: number; imageUrl: string | null; imageDemo: boolean }

const input = "mt-1.5 h-11 w-full rounded-xl bg-white px-3 text-sm font-normal ring-1 ring-inset ring-yc-ink/12";

/**
 * « Mon site » pour un restaurant : l'essentiel en trois gestes — la vitrine (photo de
 * couverture, accroche, coordonnées), les photos des plats, puis logo et couleurs.
 * Aucun réglage technique : le template « Braise » fait le reste.
 */
export function RestaurantSetup({ home, dishes, siteUrl, editorHome }: { home: SetupHome; dishes: SetupDish[]; siteUrl: string | null; editorHome: boolean }) {
  const a = useRestoAction();
  const photo = useRestoAction();
  const [h, setH] = useState(home);
  const [picker, setPicker] = useState<{ kind: "cover" } | { kind: "dish"; dish: SetupDish } | null>(null);
  const missing = dishes.filter((d) => !d.imageUrl || d.imageDemo).length;
  const step = "grid h-7 w-7 shrink-0 place-items-center rounded-full bg-yc-night-900 text-[13px] font-bold text-white";
  return (
    <div className="grid gap-5">
      <section className={section} aria-labelledby="vitrine">
        <div className="flex items-start gap-3">
          <span className={step}>1</span>
          <div className="min-w-0 flex-1">
            <h2 id="vitrine" className="text-[18px] font-bold tracking-[-0.015em]">Votre vitrine</h2>
            <p className="text-sm text-yc-ink-soft">La grande photo et la phrase que vos clients voient en arrivant.</p>
            {editorHome && <p className="mt-2 rounded-lg bg-[#FFF3DC] px-3 py-2 text-[13px] text-[#6B4300]">Votre accueil est actuellement composé dans l&apos;éditeur (scène, carrousel…) : cette vitrine s&apos;affichera si vous revenez à l&apos;accueil standard. Vos coordonnées, elles, s&apos;appliquent partout.</p>}
          </div>
          {siteUrl && <a href={siteUrl} target="_blank" rel="noreferrer" className="shrink-0 text-sm font-semibold text-yc-electric hover:underline">Voir mon site</a>}
        </div>
        <form className="mt-5 grid gap-5 lg:grid-cols-[280px_1fr]" onSubmit={(e) => { e.preventDefault(); a.run({ action: "save_home", home: { coverUrl: h.coverUrl, eyebrow: h.eyebrow, title: h.title, subtitle: h.subtitle, contactPhone: h.contactPhone || null, contactWhatsapp: h.contactWhatsapp || null, contactAddress: h.contactAddress || null } }, "Vitrine enregistrée : votre site est à jour."); }}>
          <div>
            <button type="button" onClick={() => setPicker({ kind: "cover" })} className="group relative block aspect-[4/3] w-full overflow-hidden rounded-xl bg-yc-ink/[0.05] ring-1 ring-yc-ink/10">
              {h.coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={h.coverUrl} alt="Photo de couverture" className="h-full w-full object-cover" />
              ) : (
                <span className="grid h-full place-items-center px-6 text-center text-sm text-yc-ink-soft">Ajoutez une belle photo : votre salle, votre grill, votre plat signature.</span>
              )}
              <span className="absolute inset-x-3 bottom-3 rounded-lg bg-white/95 py-2 text-center text-sm font-semibold shadow">{h.coverUrl ? "Changer la photo" : "Choisir une photo"}</span>
            </button>
            {h.coverDemo && h.coverUrl && <p className="mt-2 text-xs text-yc-ink-soft">Illustration de démonstration : remplacez-la par votre propre photo.</p>}
            {!h.coverUrl && <p className="mt-2 text-xs text-yc-ink-soft">Sans photo, l&apos;accueil utilise celle d&apos;un de vos plats.</p>}
          </div>
          <div className="grid content-start gap-4 sm:grid-cols-2">
            <label className="grid text-[13px] font-semibold sm:col-span-2">Titre<input required maxLength={80} value={h.title} onChange={(e) => setH({ ...h, title: e.target.value })} className={input} placeholder="Le nom de votre restaurant" /></label>
            <label className="grid text-[13px] font-semibold sm:col-span-2">Votre promesse, en une phrase<input maxLength={220} value={h.subtitle} onChange={(e) => setH({ ...h, subtitle: e.target.value })} className={input} placeholder="Grillades au feu de bois, à emporter ou livrées jusqu'à minuit." /></label>
            <label className="grid text-[13px] font-semibold">Petite ligne au-dessus du titre<input maxLength={60} value={h.eyebrow} onChange={(e) => setH({ ...h, eyebrow: e.target.value })} className={input} placeholder="Dibiterie · Ouakam" /></label>
            <label className="grid text-[13px] font-semibold">Adresse<input maxLength={160} value={h.contactAddress} onChange={(e) => setH({ ...h, contactAddress: e.target.value })} className={input} /></label>
            <label className="grid text-[13px] font-semibold">Téléphone<input type="tel" maxLength={30} value={h.contactPhone} onChange={(e) => setH({ ...h, contactPhone: e.target.value })} className={input} /></label>
            <label className="grid text-[13px] font-semibold">WhatsApp<input type="tel" maxLength={30} value={h.contactWhatsapp} onChange={(e) => setH({ ...h, contactWhatsapp: e.target.value })} className={input} /></label>
            <div className="flex items-center gap-3 sm:col-span-2">
              <Button type="submit" variant="royal" loading={a.pending}>Enregistrer la vitrine</Button>
              <Feedback error={a.error} notice={a.notice} />
            </div>
          </div>
        </form>
      </section>

      <section className={section} aria-labelledby="photos-plats">
        <div className="flex items-start gap-3">
          <span className={step}>2</span>
          <div>
            <h2 id="photos-plats" className="text-[18px] font-bold tracking-[-0.015em]">Les photos de vos plats</h2>
            <p className="text-sm text-yc-ink-soft">{missing ? `${missing} plat${missing > 1 ? "s" : ""} sans vraie photo. Touchez un plat pour ajouter la sienne : prise au téléphone, elle suffit.` : "Tous vos plats ont leur photo."}</p>
          </div>
        </div>
        <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {dishes.map((d) => (
            <li key={d.id}>
              <button type="button" onClick={() => setPicker({ kind: "dish", dish: d })} className="group block w-full text-left" aria-label={`Photo de ${d.name}`}>
                <span className="relative block aspect-[4/3] overflow-hidden rounded-lg bg-yc-ink/[0.05] ring-1 ring-yc-ink/10">
                  {d.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={d.imageUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="grid h-full place-items-center text-2xl text-yc-ink-soft">+</span>
                  )}
                  {d.imageDemo && <span className="absolute left-1.5 top-1.5 rounded bg-white/90 px-1.5 py-0.5 text-[10px] font-bold">Démo</span>}
                </span>
                <span className="mt-1.5 block truncate text-[13px] font-semibold">{d.name}</span>
                <span className="yc-num block text-xs text-yc-ink-soft">{d.section} · {formatXof(d.price)}</span>
              </button>
            </li>
          ))}
        </ul>
        {dishes.length === 0 && <p className="mt-4 text-sm text-yc-ink-soft">Ajoutez d&apos;abord vos plats dans « La carte ».</p>}
        <Feedback error={photo.error} notice={photo.notice} />
      </section>

      {picker && (
        <MediaPickerDialog
          size="large"
          onClose={() => setPicker(null)}
          onPick={(url) => {
            if (picker.kind === "cover") setH((x) => ({ ...x, coverUrl: url, coverDemo: false }));
            else photo.run({ action: "dish_photo", dishId: picker.dish.id, imageUrl: url }, `Photo de « ${picker.dish.name} » enregistrée.`);
          }}
        />
      )}
    </div>
  );
}
