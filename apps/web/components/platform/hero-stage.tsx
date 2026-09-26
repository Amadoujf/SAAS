import Image from "next/image";

/** Composition du héros : trois sites réalisés avec les templates, posés dans une
 *  lumière de fin d'après-midi, et la carte « Votre activité » du tableau de bord.
 *  Purement illustrative (aria-hidden) : aucun chiffre réel n'y est affiché.
 *  Les visuels de public/marketing/ sont PROVISOIRES (tirés de la maquette de
 *  direction artistique) : à remplacer par des photos HD sous licence, mêmes noms. */
const BARS = [
  [34, 0], [44, 0], [40, 0], [58, 0], [54, 1], [46, 0], [70, 0], [96, 0], [64, 2], [52, 1], [84, 0], [98, 2], [72, 0], [48, 1], [90, 0], [62, 2], [100, 0], [58, 2],
] as const;
const TONES = ["bg-[#C9D6F6]", "bg-[#8FA9EE]", "bg-yc-royal"];

export function HeroStage() {
  return (
    <div className="relative" aria-hidden="true">
      <div className="relative aspect-[1410/852] w-full overflow-hidden">
        <Image
          src="/marketing/hero-templates.jpg"
          alt=""
          fill
          priority
          sizes="(min-width: 1024px) 720px, 100vw"
          className="object-cover lg:[mask-image:linear-gradient(to_right,transparent,black_5%)]"
        />
      </div>
      <div className="yc-rise absolute left-[46%] top-[70%] lg:left-[36%] xl:left-[46%] w-[50%] min-w-[270px] max-w-[360px] rounded-xl bg-white p-4 shadow-[0_30px_60px_-24px_rgb(12_22_48/0.4)] ring-1 ring-yc-navy/5 [animation-delay:250ms] max-sm:left-auto max-sm:right-3 max-sm:w-[74%] sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <p className="truncate text-[13px] font-semibold text-yc-navy-ink sm:text-sm">Votre activité, en un regard</p>
          <span className="shrink-0 whitespace-nowrap rounded-md bg-yc-paper px-2 py-1 text-[11px] font-medium text-yc-navy-ink">30 jours</span>
        </div>
        <div className="mt-4 flex h-16 items-end gap-[3px] border-b border-yc-navy/10 sm:h-20">
          {BARS.map(([h, tone], i) => (
            <span key={i} className={`yc-bar flex-1 rounded-t-[2px] ${TONES[tone]}`} style={{ height: `${h}%`, animationDelay: `${300 + i * 35}ms` }} />
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-yc-ink-soft">
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#8FA9EE]" /> Visites du site</span>
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-yc-royal" /> Commandes</span>
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#C9D6F6]" /> Clients</span>
        </div>
      </div>
    </div>
  );
}
