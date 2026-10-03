import Link from "next/link";
import type { VehicleCardData } from "@/lib/auto/auto-data";
import { FUEL_LABELS, STOCK_LABELS, TRANSMISSION_LABELS, formatKm, formatXof } from "@/lib/auto/labels";

/** Badge d'état du stock : couleur ET texte (jamais la couleur seule). */
export function StockBadge({ status, className = "" }: { status: string; className?: string }) {
  const tone = status === "available" ? "bg-[#1F7A4A] text-white" : status === "incoming" ? "bg-[var(--color-accent-secondary)] text-[var(--color-primary)]" : "bg-[var(--color-primary)] text-white";
  return <span className={`inline-flex items-center px-2 py-0.5 text-[10.5px] font-extrabold uppercase tracking-[0.12em] ${tone} ${className}`}>{STOCK_LABELS[status]?.guest ?? status}</span>;
}

/** Carte d'un véhicule : photo sur « piste », fiche technique en trois chiffres, prix. */
export function VehicleCard({ v, priority = false }: { v: VehicleCardData; priority?: boolean }) {
  const img = v.images[0];
  return (
    <Link href={`/vehicules/${v.slug}`} className="group flex h-full flex-col bg-[var(--color-surface)] ring-1 ring-[var(--color-border)] transition-shadow hover:shadow-[var(--shadow-md)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent-primary)]">
      <div className="relative aspect-[16/10] overflow-hidden bg-[linear-gradient(180deg,#E3E6E8_0%,#C9CED1_100%)]">
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={img.url} alt={img.alt} loading={priority ? "eager" : "lazy"} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]" />
        ) : (
          <span className="grid h-full place-items-center text-[13px] font-semibold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">Photo à venir</span>
        )}
        <StockBadge status={v.stockStatus} className="absolute left-0 top-3" />
        {img?.demo && <span className="absolute right-2 top-2 bg-black/55 px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-[0.12em] text-white">Illustration</span>}
      </div>
      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <p className="text-[11.5px] font-bold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">{v.make}</p>
        <h3 className="mt-0.5 text-[20px] font-extrabold leading-tight tracking-[-0.02em]">{v.model}{v.version ? <span className="font-semibold text-[var(--color-text-secondary)]"> {v.version}</span> : null}</h3>
        <dl className="mt-4 grid grid-cols-3 border-y border-[var(--color-border)] text-[12.5px]">
          <div className="py-2 pr-2"><dt className="sr-only">Année</dt><dd className="yc-num font-bold">{v.year}</dd></div>
          <div className="border-x border-[var(--color-border)] px-2 py-2"><dt className="sr-only">Kilométrage</dt><dd className="yc-num truncate font-bold">{formatKm(v.mileageKm)}</dd></div>
          <div className="py-2 pl-2"><dt className="sr-only">Motorisation</dt><dd className="truncate font-bold">{FUEL_LABELS[v.fuel] ?? v.fuel} · {v.transmission === "automatique" ? "Auto" : TRANSMISSION_LABELS[v.transmission]}</dd></div>
        </dl>
        <div className="mt-auto flex items-end justify-between gap-3 pt-4">
          <p className="yc-num text-[20px] font-black tracking-[-0.02em]">{formatXof(v.price)}</p>
          <span aria-hidden="true" className="text-[22px] text-[var(--color-accent-primary)] transition-transform group-hover:translate-x-1">→</span>
        </div>
      </div>
    </Link>
  );
}
