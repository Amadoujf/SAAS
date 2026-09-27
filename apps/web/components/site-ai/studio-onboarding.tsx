"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/yc/button";
import { IconCheck, IconSparkles, IconUpload } from "@/components/yc/icons";
import { STYLE_WORDS, type SiteBrief } from "@/lib/site-ai/types";

/**
 * Questionnaire court (trois étapes, peu de champs) avant les trois propositions :
 * l'activité, le style, les éléments disponibles — le catalogue et les photos sont lus
 * directement, rien à ressaisir.
 */
export function StudioOnboarding({
  initial,
  catalog,
  hasLogo,
  advice,
  busy,
  disabledReason,
  onChooseLogo,
  onSubmit,
}: {
  initial: SiteBrief | null;
  catalog: { products: number; illustrated: number; categories: number };
  hasLogo: boolean;
  advice: string[];
  busy: boolean;
  disabledReason: string | null;
  onChooseLogo: () => void;
  onSubmit: (brief: SiteBrief) => void;
}) {
  const [step, setStep] = useState(0);
  const [brief, setBrief] = useState<SiteBrief>(initial ?? { activity: "", audience: "", styles: [], likes: "" });
  const canNext = step !== 0 || brief.activity.trim().length >= 10;
  const input = "w-full rounded-xl bg-white px-4 py-3 text-[15px] text-yc-ink ring-1 ring-inset ring-yc-ink/12 placeholder:text-yc-ink-soft/70 focus:outline-none focus:ring-2 focus:ring-yc-electric";
  const toggle = (word: string) =>
    setBrief((b) => ({ ...b, styles: b.styles.includes(word) ? b.styles.filter((w) => w !== word) : b.styles.length >= 3 ? b.styles : [...b.styles, word] }));

  return (
    <section aria-labelledby="creer-ia" className="overflow-hidden rounded-3xl bg-white shadow-yc ring-1 ring-yc-ink/[0.06]">
      <div className="grid gap-0 lg:grid-cols-[1fr_1.15fr]">
        <div className="relative flex flex-col justify-between gap-8 bg-yc-night-950 p-7 text-white sm:p-10">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_60%_at_20%_10%,rgb(39_73_232/0.45),transparent_70%)]" />
          <div className="relative">
            <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[12px] font-semibold uppercase tracking-[0.14em] text-white/80">
              <IconSparkles size={14} /> Créer mon site avec l&apos;IA
            </p>
            <h2 id="creer-ia" className="mt-5 font-display text-[clamp(1.9rem,3.4vw,2.6rem)] font-semibold leading-[1.05] tracking-[-0.02em]">
              Dites-nous qui vous êtes. Nous composons votre boutique.
            </h2>
            <p className="mt-4 max-w-md text-[15px] leading-relaxed text-white/70">
              Trois directions artistiques, avec vos produits et vos photos. Vous choisissez, vous ajustez en conversation, vous publiez quand vous êtes prêt.
            </p>
          </div>
          <ol className="relative flex gap-2" aria-label="Étapes">
            {["Votre activité", "Votre style", "Vos éléments"].map((label, i) => (
              <li key={label} className={`flex-1 rounded-full py-1.5 text-center text-[12px] font-semibold ${i === step ? "bg-white text-yc-night-950" : i < step ? "bg-white/25 text-white" : "bg-white/10 text-white/60"}`} aria-current={i === step ? "step" : undefined}>
                {label}
              </li>
            ))}
          </ol>
        </div>

        <form
          className="flex flex-col gap-6 p-7 sm:p-10"
          onSubmit={(e) => {
            e.preventDefault();
            if (step < 2) {
              if (canNext) setStep(step + 1);
              return;
            }
            onSubmit(brief);
          }}
        >
          {step === 0 && (
            <>
              <label className="grid gap-2 text-[15px] font-semibold text-yc-ink">
                Que vendez-vous, et qu&apos;est-ce qui vous rend différent ?
                <textarea
                  required
                  rows={4}
                  maxLength={400}
                  value={brief.activity}
                  onChange={(e) => setBrief({ ...brief, activity: e.target.value })}
                  placeholder="Ex. : objets de décoration en céramique, tournés à la main dans notre atelier de Dakar."
                  className={`${input} resize-none font-normal`}
                />
              </label>
              <label className="grid gap-2 text-[15px] font-semibold text-yc-ink">
                Pour qui ?
                <input value={brief.audience} maxLength={200} onChange={(e) => setBrief({ ...brief, audience: e.target.value })} placeholder="Ex. : jeunes couples qui aménagent leur premier appartement" className={`${input} font-normal`} />
              </label>
            </>
          )}
          {step === 1 && (
            <>
              <fieldset className="grid gap-3">
                <legend className="text-[15px] font-semibold text-yc-ink">Quelle ambiance ? <span className="font-normal text-yc-ink-soft">(jusqu&apos;à 3)</span></legend>
                <div className="flex flex-wrap gap-2">
                  {STYLE_WORDS.map((word) => {
                    const on = brief.styles.includes(word);
                    return (
                      <button key={word} type="button" aria-pressed={on} onClick={() => toggle(word)} className={`min-h-11 rounded-full px-4 text-[14px] font-medium capitalize ring-1 ring-inset transition-colors ${on ? "bg-yc-night-900 text-white ring-yc-night-900" : "bg-white text-yc-ink ring-yc-ink/15 hover:ring-yc-ink/35"}`}>
                        {on && <IconCheck size={14} className="-ml-1 mr-1 inline" />}
                        {word}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
              <label className="grid gap-2 text-[15px] font-semibold text-yc-ink">
                Une marque, un lieu ou une ambiance qui vous inspire ? <span className="text-[13px] font-normal text-yc-ink-soft">Facultatif</span>
                <input value={brief.likes} maxLength={300} onChange={(e) => setBrief({ ...brief, likes: e.target.value })} placeholder="Ex. : la lumière d'une galerie, des tons sable et bleu" className={`${input} font-normal`} />
              </label>
            </>
          )}
          {step === 2 && (
            <div className="grid gap-3">
              <p className="text-[15px] font-semibold text-yc-ink">Vos éléments</p>
              <Row ok={hasLogo} title="Logo" detail={hasLogo ? "Ajouté" : "Facultatif : il donne tout de suite une identité au site."} action={<Button type="button" size="sm" variant="secondary" onClick={onChooseLogo}><IconUpload size={14} /> {hasLogo ? "Changer" : "Ajouter"}</Button>} />
              <Row ok={catalog.products > 0} title="Catalogue" detail={`${catalog.products} produit${catalog.products > 1 ? "s" : ""} en ligne, ${catalog.categories} catégorie${catalog.categories > 1 ? "s" : ""}`} action={<Link href="/dashboard/produits" className="text-[13px] font-semibold text-yc-electric hover:underline">Gérer</Link>} />
              <Row ok={catalog.illustrated >= 4} title="Photos" detail={`${catalog.illustrated} produit${catalog.illustrated > 1 ? "s" : ""} photographié${catalog.illustrated > 1 ? "s" : ""} sur ${catalog.products}`} action={<Link href="/dashboard/mediatheque" className="text-[13px] font-semibold text-yc-electric hover:underline">Médiathèque</Link>} />
              {advice.length > 0 && (
                <ul className="mt-1 grid gap-1.5 rounded-xl bg-yc-ivory-50 p-4 text-[13px] leading-relaxed text-yc-ink-soft">
                  {advice.map((a) => <li key={a}>{a}</li>)}
                </ul>
              )}
            </div>
          )}

          {disabledReason && <p role="status" className="rounded-xl bg-yc-warning/[0.12] px-4 py-3 text-sm text-yc-ink">{disabledReason}</p>}

          <div className="mt-auto flex items-center justify-between gap-3 pt-2">
            {step > 0 ? <Button type="button" variant="ghost" onClick={() => setStep(step - 1)}>Retour</Button> : <span />}
            {step < 2 ? (
              <Button type="submit" disabled={!canNext}>Continuer</Button>
            ) : (
              <Button type="submit" size="lg" loading={busy} disabled={Boolean(disabledReason) || catalog.products === 0}>
                <IconSparkles size={16} /> {busy ? "Composition en cours…" : "Proposer 3 directions"}
              </Button>
            )}
          </div>
        </form>
      </div>
    </section>
  );
}

function Row({ ok, title, detail, action }: { ok: boolean; title: string; detail: string; action: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-xl px-4 py-3 ring-1 ring-inset ring-yc-ink/[0.08]">
      <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full ${ok ? "bg-yc-success/15 text-yc-success" : "bg-yc-ink/[0.06] text-yc-ink-soft"}`} aria-hidden="true">
        {ok ? <IconCheck size={14} /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-semibold text-yc-ink">{title}</p>
        <p className="text-[13px] text-yc-ink-soft">{detail}</p>
      </div>
      {action}
    </div>
  );
}
