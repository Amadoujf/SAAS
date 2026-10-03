import Link from "next/link";

export interface EstateCard {
  slug: string;
  title: string;
  summary: string | null;
  imageUrl: string | null;
  imageAlt: string;
  price: string;
  deal: string;
  type: string;
  facts: string;
  place: string | null;
}

/** Carte d'un bien : grande photo (zoom au survol), transaction, prix, caractéristiques. */
export function PropertyCard({ card, priority = false }: { card: EstateCard; priority?: boolean }) {
  return (
    <Link href={`/biens/${card.slug}`} className="group block rounded-[var(--radius-lg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-4">
      <span className="relative block aspect-[4/3] overflow-hidden rounded-[var(--radius-lg)] bg-[var(--color-surface-muted)]">
        {card.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={card.imageUrl} alt={card.imageAlt} loading={priority ? "eager" : "lazy"} decoding="async" className="h-full w-full object-cover transition-transform duration-[900ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.06]" />
        )}
        <span className="absolute left-3 top-3 rounded-[var(--radius-full)] bg-white/95 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-primary)]">{card.deal}</span>
        <span className="absolute inset-x-0 bottom-0 h-1/3 bg-[linear-gradient(0deg,rgba(8,16,34,0.35),transparent)] opacity-0 transition-opacity duration-500 group-hover:opacity-100" aria-hidden="true" />
      </span>
      <span className="mt-4 flex items-baseline justify-between gap-3">
        <span className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[var(--color-accent-primary)]">{card.type}{card.place ? ` · ${card.place}` : ""}</span>
      </span>
      <span className="mt-1.5 block font-[family-name:var(--font-heading)] text-[22px] leading-snug transition-colors group-hover:text-[var(--color-primary)]">{card.title}</span>
      {card.facts && <span className="mt-1 block text-[14px] text-[var(--color-text-secondary)]">{card.facts}</span>}
      <span className="mt-2.5 block text-[16px] font-semibold">{card.price}</span>
    </Link>
  );
}
