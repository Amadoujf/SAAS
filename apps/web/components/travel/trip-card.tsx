import Link from "next/link";

export interface TripCardData {
  slug: string;
  title: string;
  type: string;
  destination: string;
  duration: string;
  price: string;
  nextDeparture: string | null;
  imageUrl: string | null;
  imageAlt: string;
}

/** Carte d'un voyage : grande image verticale, type et durée, destination, prochain
 *  départ et prix « à partir de » — tous tirés des données de l'agence. */
export function TripCard({ trip, priority = false }: { trip: TripCardData; priority?: boolean }) {
  return (
    <Link href={`/voyages/${trip.slug}`} className="group block rounded-[var(--radius-lg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-4">
      <span className="relative block aspect-[4/5] overflow-hidden rounded-[var(--radius-lg)] bg-[var(--color-surface-muted)]">
        {trip.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={trip.imageUrl} alt={trip.imageAlt} loading={priority ? "eager" : "lazy"} decoding="async" className="h-full w-full object-cover transition-transform duration-[1100ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.07]" />
        )}
        <span className="absolute inset-0 bg-[linear-gradient(180deg,rgba(10,16,32,0)_45%,rgba(10,16,32,0.72)_100%)]" aria-hidden="true" />
        <span className="absolute left-4 top-4 rounded-[var(--radius-full)] bg-white/95 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-primary)]">{trip.type}</span>
        <span className="absolute inset-x-4 bottom-4 text-white">
          <span className="block text-[12px] font-semibold uppercase tracking-[0.18em] text-white/80">{trip.destination}</span>
          <span className="mt-1.5 block font-[family-name:var(--font-heading)] text-[26px] leading-[1.08]">{trip.title}</span>
        </span>
      </span>
      <span className="mt-3.5 flex items-center justify-between gap-3 text-[13.5px]">
        <span className="text-[var(--color-text-secondary)]">{trip.duration}</span>
        <span className="font-semibold">{trip.price}</span>
      </span>
      <span className="mt-1 block text-[13px] text-[var(--color-text-muted)]">{trip.nextDeparture ? `Prochain départ : ${trip.nextDeparture}` : "Dates sur demande"}</span>
    </Link>
  );
}
