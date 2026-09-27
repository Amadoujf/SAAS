import Link from "next/link";

export interface BoardRow {
  id: string;
  slug: string;
  day: string;
  month: string;
  title: string;
  destination: string;
  duration: string;
  seats: { text: string; tone: "neutral" | "info" | "success" | "warning" | "danger"; left: number };
  price: string;
}

const DOT: Record<string, string> = { success: "bg-[#4ADE80]", warning: "bg-[#FBBF24]", neutral: "bg-white/40", info: "bg-sky-300", danger: "bg-red-400" };

/** Tableau des départs — l'élément signature du template « Horizons » : les prochains
 *  départs RÉELS de l'agence (dates, places restantes, prix), comme un tableau
 *  d'aéroport. Chaque ligne mène à la réservation de ce départ précis. */
export function DeparturesBoard({ rows, title = "Prochains départs" }: { rows: BoardRow[]; title?: string }) {
  if (!rows.length) return null;
  return (
    <section id="departs" aria-labelledby="departs-titre" className="scroll-mt-24 bg-[var(--color-primary)] text-white">
      <div className="mx-auto max-w-[var(--content-max-width,1320px)] px-5 py-16 sm:px-8 sm:py-24">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-[var(--color-accent-primary)]">Départs confirmés</p>
            <h2 id="departs-titre" className="mt-3 font-[family-name:var(--font-heading)] text-[38px] leading-[1.04] sm:text-[52px]">{title}</h2>
          </div>
          <Link href="/voyages" className="inline-flex items-center gap-2 border-b border-white/60 pb-1 text-[13px] font-semibold uppercase tracking-[0.16em] hover:border-white">Tous les voyages <span aria-hidden="true">→</span></Link>
        </div>
        <ol className="mt-10 divide-y divide-white/10 border-y border-white/10">
          {rows.map((r) => (
            <li key={r.id}>
              <Link href={`/voyages/${r.slug}?depart=${r.id}#reserver`} className="group grid grid-cols-[64px_1fr_auto] items-center gap-4 py-4 transition-colors hover:bg-white/[0.04] focus-visible:bg-white/[0.06] focus-visible:outline-none sm:grid-cols-[88px_1.6fr_1fr_1fr_auto] sm:gap-6 sm:px-3 sm:py-5">
                <span className="flex flex-col items-center rounded-[var(--radius-md)] bg-white/[0.06] py-2 font-[family-name:var(--font-heading)] leading-none tabular-nums ring-1 ring-inset ring-white/10">
                  <span className="text-[26px] sm:text-[30px]">{r.day}</span>
                  <span className="mt-1 text-[11px] uppercase tracking-[0.16em] text-white/65">{r.month}</span>
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[16px] font-semibold sm:text-[18px]">{r.title}</span>
                  <span className="mt-0.5 block truncate text-[13px] text-white/60">{r.destination} · {r.duration}</span>
                </span>
                <span className="hidden items-center gap-2 text-[13.5px] text-white/80 sm:flex">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${DOT[r.seats.tone]}`} aria-hidden="true" />
                  {r.seats.text}
                </span>
                <span className="hidden text-[15px] font-semibold tabular-nums sm:block">{r.price}</span>
                <span className="justify-self-end">
                  <span className="inline-flex h-10 items-center gap-2 rounded-[var(--radius-full)] bg-white/10 px-4 text-[13px] font-semibold transition-colors group-hover:bg-[var(--color-accent-primary)]">
                    <span className="hidden sm:inline">Réserver</span>
                    <span className="sm:hidden">{r.seats.left > 0 ? r.price.replace(" / pers.", "") : "Complet"}</span>
                    <span aria-hidden="true">→</span>
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
