"use client";

import { Button } from "@/components/yc/button";
import { IconArrowRight, IconSparkles } from "@/components/yc/icons";
import { StudioPreview } from "./studio-preview";

export interface DirectionCard {
  name: string;
  pitch: string;
  palette: { primary: string; accent: string; background: string };
  compiled: { notes: string[] };
}

/**
 * Les trois directions artistiques, chacune PRÉVISUALISÉE avec les vrais contenus de
 * l'entreprise (même moteur que le site). Choisir en crée le brouillon — rien n'est en
 * ligne avant la publication.
 */
export function StudioDirections({
  jobId,
  directions,
  advice,
  simulated,
  unavailableReason,
  busy,
  onChoose,
  onRegenerate,
  onBack,
}: {
  jobId: string;
  directions: DirectionCard[];
  advice: string[];
  simulated: boolean;
  unavailableReason: string | null;
  busy: boolean;
  onChoose: (index: number) => void;
  onRegenerate: () => void;
  onBack: () => void;
}) {
  return (
    <section aria-labelledby="directions" className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="inline-flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.14em] text-yc-electric">
            <IconSparkles size={14} /> Trois directions pour votre site
          </p>
          <h2 id="directions" className="mt-2 font-display text-[clamp(1.6rem,3vw,2.2rem)] font-semibold tracking-[-0.02em] text-yc-ink">Choisissez celle qui vous ressemble.</h2>
          <p className="mt-1.5 max-w-2xl text-[15px] text-yc-ink-soft">Chacune utilise vos produits et vos photos. Vous pourrez tout ajuster ensuite, en conversation ou à la main.</p>
          {simulated && <p className="mt-2 inline-flex rounded-full bg-yc-warning/[0.14] px-3 py-1 text-[12px] font-semibold text-[rgb(146_84_0)]">Simulation locale — propositions produites par des règles de développement, pas par l&apos;IA</p>}
          {unavailableReason && <p className="mt-2 max-w-2xl rounded-xl bg-yc-warning/[0.12] px-3 py-2 text-[13px] text-yc-ink">{unavailableReason} Vous pouvez choisir une direction déjà proposée ou modifier le site à la main.</p>}
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onBack} disabled={Boolean(unavailableReason)}>Modifier ma description</Button>
          <Button variant="secondary" onClick={onRegenerate} loading={busy} disabled={Boolean(unavailableReason)}>Nouvelles propositions</Button>
        </div>
      </div>
      <div className="grid gap-5 lg:grid-cols-3">
        {directions.map((d, i) => (
          <article key={i} className="flex flex-col overflow-hidden rounded-2xl bg-white shadow-yc ring-1 ring-yc-ink/[0.06]">
            <div className="bg-[#EEF0F5] p-3">
              <StudioPreview src={`/editeur/site?job=${jobId}&d=${i}`} device="desktop" label={d.name} compact />
            </div>
            <div className="flex flex-1 flex-col gap-3 p-5">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-display text-xl font-semibold text-yc-ink">{d.name}</h3>
                <span className="flex gap-1" aria-label="Palette">
                  {[d.palette.primary, d.palette.accent, d.palette.background].map((c) => (
                    <span key={c} className="h-5 w-5 rounded-full ring-1 ring-yc-ink/10" style={{ background: c }} title={c} />
                  ))}
                </span>
              </div>
              <p className="text-[14px] leading-relaxed text-yc-ink-soft">{d.pitch}</p>
              {d.compiled.notes.length > 0 && (
                <details className="text-[13px] text-yc-ink-soft">
                  <summary className="cursor-pointer font-medium text-yc-ink">Ajustements faits par Y-COM ({d.compiled.notes.length})</summary>
                  <ul className="mt-2 grid gap-1 pl-4">{d.compiled.notes.map((n) => <li key={n} className="list-disc">{n}</li>)}</ul>
                </details>
              )}
              <div className="mt-auto flex flex-wrap items-center gap-2 pt-2">
                <Button onClick={() => onChoose(i)} disabled={busy} className="flex-1">
                  Choisir cette direction <IconArrowRight size={16} />
                </Button>
                <a href={`/editeur/site?job=${jobId}&d=${i}`} target="_blank" rel="noreferrer" className="px-2 text-[13px] font-semibold text-yc-electric hover:underline">Voir en grand ↗</a>
              </div>
            </div>
          </article>
        ))}
      </div>
      {advice.length > 0 && (
        <aside className="rounded-2xl bg-yc-ivory-50 p-5 ring-1 ring-yc-ink/[0.05]">
          <h3 className="text-[14px] font-semibold text-yc-ink">Pour un rendu encore meilleur</h3>
          <ul className="mt-2 grid gap-1.5 text-[13px] leading-relaxed text-yc-ink-soft">{advice.map((a) => <li key={a}>{a}</li>)}</ul>
        </aside>
      )}
    </section>
  );
}
