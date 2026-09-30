import Link from "next/link";
import type { ProgramCardData } from "@/lib/education/education-data";
import { AUDIENCE_LABELS, CATEGORY_LABELS, FORMAT_LABELS, formatXof } from "@/lib/education/labels";

/** Carte d'une formation : visuel, catégorie, niveau, durée, scolarité (frais à part). */
export function ProgramCard({ p, priority = false }: { p: ProgramCardData; priority?: boolean }) {
  const img = p.images[0];
  return (
    <Link href={`/formations/${p.slug}`} className="group flex h-full min-w-0 flex-col overflow-hidden rounded-[var(--radius-lg)] bg-[var(--color-surface)] ring-1 ring-[var(--color-border)] transition-shadow hover:shadow-[var(--shadow-md)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]">
      <div className="relative aspect-[4/3] overflow-hidden bg-[var(--color-surface-muted)]">
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={img.url} alt={img.alt} loading={priority ? "eager" : "lazy"} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
        ) : (
          <span aria-hidden="true" className="grid h-full place-items-center font-[family-name:var(--font-heading)] text-[64px] italic text-[var(--color-text-muted)]">{p.title.charAt(0)}</span>
        )}
        <span className="absolute left-3 top-3 rounded-full bg-[var(--color-surface)] px-3 py-1 text-[12px] font-semibold text-[var(--color-secondary)]">{CATEGORY_LABELS[p.category] ?? p.category}</span>
        {img?.demo && <span className="absolute bottom-2 right-2 rounded bg-black/55 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-white">Visuel de démonstration</span>}
      </div>
      <div className="flex flex-1 flex-col p-5">
        <h3 className="font-[family-name:var(--font-heading)] text-[23px] font-semibold leading-[1.1] tracking-[-0.01em] underline decoration-transparent decoration-2 underline-offset-4 group-hover:decoration-[var(--color-accent-primary)]">{p.title}</h3>
        {p.summary && <p className="mt-2 line-clamp-2 text-[14.5px] leading-relaxed text-[var(--color-text-secondary)]">{p.summary}</p>}
        <p className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[13px] text-[var(--color-text-muted)]">
          {p.level && <span>{p.level}</span>}
          {p.durationLabel && <span>{p.durationLabel}</span>}
          <span>{FORMAT_LABELS[p.format] ?? p.format}</span>
          <span>{AUDIENCE_LABELS[p.audience] ?? p.audience}</span>
        </p>
        <div className="mt-auto flex items-end justify-between gap-3 border-t border-dashed border-[var(--color-border)] pt-4">
          <p>
            <span className="yc-num block text-[20px] font-bold tracking-[-0.01em]">{formatXof(p.tuition)}</span>
            {p.registrationFee > 0 && <span className="yc-num block text-[12.5px] text-[var(--color-text-muted)]">+ {formatXof(p.registrationFee)} d&apos;inscription</span>}
          </p>
          {p.defaultInstallments > 1 && p.tuition != null && <span className="text-right text-[12.5px] font-medium text-[var(--color-secondary)]">Payable en {p.defaultInstallments} fois</span>}
        </div>
      </div>
    </Link>
  );
}
