import Link from "next/link";
import type { RoomCardData } from "@/lib/hotel/hotel-data";
import { AMENITY_LABELS, formatXof, guestsLabel, nightsLabel } from "@/lib/hotel/labels";

/**
 * Carte d'un type de chambre, horizontale. Avec des dates : chambres restantes et prix
 * TOTAL calculé par le serveur ; sans dates : prix de base par nuit.
 */
export function RoomCard({ room, query, result, priority = false }: {
  room: RoomCardData;
  query?: string;
  result?: { freeCount: number; nights: number; total: number | null; bookable: boolean; reason: string | null } | null;
  priority?: boolean;
}) {
  const img = room.images[0];
  const href = `/chambres/${room.slug}${query ? `?${query}` : ""}`;
  const unavailable = result && !result.bookable;
  return (
    <article className={`group grid overflow-hidden rounded-[var(--radius-lg)] bg-white shadow-[var(--shadow-sm)] ring-1 ring-[var(--color-border)] md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] ${unavailable ? "opacity-75" : ""}`}>
      <Link href={href} className="relative block aspect-[16/10] overflow-hidden bg-[var(--color-surface)] md:aspect-auto md:min-h-[300px]" tabIndex={-1} aria-hidden="true">
        {img && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={img.url} alt="" loading={priority ? "eager" : "lazy"} className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03] motion-reduce:transition-none" />
        )}
        {img?.demo && <span className="absolute bottom-3 left-3 rounded-sm bg-black/50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-white">Visuel de démonstration</span>}
      </Link>
      <div className="flex flex-col p-6 sm:p-8">
        <h3 className="font-[family-name:var(--font-heading)] text-[30px] leading-tight"><Link href={href} className="hover:underline hover:decoration-1 hover:underline-offset-4">{room.title}</Link></h3>
        <p className="mt-2 text-[14px] text-[var(--color-text-secondary)]">{guestsLabel(room.maxAdults, room.maxChildren)} max · {room.bedSummary}{room.sizeM2 ? ` · ${room.sizeM2} m²` : ""}</p>
        {room.summary && <p className="mt-4 text-[15.5px] leading-relaxed text-[var(--color-text-secondary)]">{room.summary}</p>}
        {room.amenities.length > 0 && (
          <ul className="mt-5 flex flex-wrap gap-x-4 gap-y-1.5 text-[13px] text-[var(--color-text-secondary)]">
            {room.amenities.slice(0, 5).map((a) => <li key={a} className="flex items-center gap-1.5"><span aria-hidden="true" className="h-1 w-1 rounded-full bg-[var(--color-accent-secondary)]" />{AMENITY_LABELS[a] ?? a}</li>)}
          </ul>
        )}
        <div className="mt-auto flex flex-wrap items-end justify-between gap-4 border-t border-[var(--color-border)] pt-5">
          {result ? (
            <div>
              {result.bookable ? (
                <>
                  <p className="text-[12.5px] font-semibold text-[var(--color-success)]">{result.freeCount === 1 ? "Dernière chambre disponible" : `${result.freeCount} chambres disponibles`}</p>
                  <p className="mt-0.5 font-[family-name:var(--font-heading)] text-[28px] leading-none">{formatXof(result.total)}</p>
                  <p className="mt-1 text-[12.5px] text-[var(--color-text-muted)]">total pour {nightsLabel(result.nights)}</p>
                </>
              ) : (
                <p className="text-[14px] font-semibold text-[var(--color-text-secondary)]">
                  {result.reason === "full" ? "Complet à ces dates" : result.reason === "capacity" ? "Capacité insuffisante pour votre groupe" : result.reason?.startsWith("min_nights") ? `Séjour minimum : ${nightsLabel(Number(result.reason.split(":")[1]))}` : "Indisponible"}
                </p>
              )}
            </div>
          ) : (
            <div>
              <p className="text-[12.5px] text-[var(--color-text-muted)]">À partir de</p>
              <p className="font-[family-name:var(--font-heading)] text-[28px] leading-none">{room.price == null ? "Sur demande" : formatXof(room.price)}</p>
              <p className="mt-1 text-[12.5px] text-[var(--color-text-muted)]">par nuit</p>
            </div>
          )}
          <Link href={href} className={`inline-flex h-12 items-center rounded-[var(--radius-md)] px-6 text-[14px] font-semibold transition-transform hover:-translate-y-0.5 ${unavailable ? "ring-1 ring-inset ring-[var(--color-border)]" : "bg-[var(--color-primary)] text-white"}`}>
            {result?.bookable ? "Réserver" : unavailable ? "Voir le calendrier" : "Voir les disponibilités"}
          </Link>
        </div>
      </div>
    </article>
  );
}
