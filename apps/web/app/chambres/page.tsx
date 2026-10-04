import type { Metadata } from "next";
import { isIsoDate, utcToLocal } from "@yamacommerce/database";
import { resolveHotel } from "@/lib/hotel/hotel-context";
import { loadRoomTypes, searchRooms } from "@/lib/hotel/hotel-data";
import { addDaysIso, guestsLabel, longDate, nightsLabel } from "@/lib/hotel/labels";
import { HotelShell } from "@/components/hotel/hotel-shell";
import { DateBar } from "@/components/hotel/date-bar";
import { RoomCard } from "@/components/hotel/room-card";
import { PublicSiteSuspended } from "@/components/public-site-suspended";
import { PublicSiteBillingSuspended } from "@/components/public-site-billing-suspended";

export async function generateMetadata(): Promise<Metadata> {
  const r = await resolveHotel("/chambres");
  return r.status === "ok" ? { title: `Chambres et disponibilités — ${r.hotel.tenantName}` } : {};
}
export const dynamic = "force-dynamic";

const int = (v: string | undefined, def: number, min: number, max: number) => {
  const n = Number(v);
  return Number.isInteger(n) && n >= min && n <= max ? n : def;
};

/** Chambres : sans dates, prix de base ; avec dates, disponibilité réelle et prix total. */
export default async function RoomsPage({ searchParams }: { searchParams: { arrivee?: string; depart?: string; adultes?: string; enfants?: string } }) {
  const r = await resolveHotel("/chambres");
  if (r.status === "suspended") return <PublicSiteSuspended tenantName={r.tenantName} />;
  if (r.status === "billing_suspended") return <PublicSiteBillingSuspended tenantName={r.tenantName} />;
  const { hotel } = r;
  const today = utcToLocal(new Date(), hotel.timezone).date;
  const rooms = await loadRoomTypes(hotel.tenantId);
  const q = { arrival: searchParams.arrivee ?? "", departure: searchParams.depart ?? "", adults: int(searchParams.adultes, 2, 1, 30), children: int(searchParams.enfants, 0, 0, 20) };
  const hasDates = isIsoDate(q.arrival) && isIsoDate(q.departure);
  let error: string | null = null;
  let results: Awaited<ReturnType<typeof searchRooms>> | null = null;
  if (hasDates) {
    try {
      results = await searchRooms(hotel.tenantId, q);
    } catch (e) {
      error = e instanceof Error ? e.message : "Recherche impossible.";
    }
  }
  const query = hasDates ? `arrivee=${q.arrival}&depart=${q.departure}&adultes=${q.adults}&enfants=${q.children}` : undefined;
  const byId = new Map(results?.results.map((x) => [x.listing.id, x]) ?? []);
  const ordered = results ? [...rooms].sort((a, b) => Number(byId.get(b.id)?.bookable ?? false) - Number(byId.get(a.id)?.bookable ?? false)) : rooms;
  const anyBookable = results?.results.some((x) => x.bookable && rooms.some((r) => r.id === x.listing.id));
  return (
    <HotelShell hotel={hotel}>
      <div className="bg-[var(--color-surface)] pb-10 pt-12">
        <div className="mx-auto max-w-[var(--content-max-width,1320px)] px-5 sm:px-8">
          <h1 className="font-[family-name:var(--font-heading)] text-[44px] leading-none sm:text-[60px]">Chambres</h1>
          <p className="mt-3 text-[16px] text-[var(--color-text-secondary)]">
            {results ? <>Du <strong>{longDate(q.arrival)}</strong> au <strong>{longDate(q.departure)}</strong> · {nightsLabel(results.nights)} · {guestsLabel(q.adults, q.children)}</> : "Indiquez vos dates pour voir les chambres réellement disponibles et le prix de votre séjour."}
          </p>
          <div className="mt-8"><DateBar compact today={today} maxDate={addDaysIso(today, hotel.rules.maxAdvanceDays)} initial={hasDates ? q : undefined} /></div>
        </div>
      </div>
      <div className="mx-auto mt-10 max-w-[var(--content-max-width,1320px)] px-5 sm:px-8">
        {error && <p role="alert" className="mb-8 rounded-[var(--radius-md)] bg-[color-mix(in_srgb,var(--color-danger)_8%,white)] px-4 py-3 font-medium text-[var(--color-danger)]">{error}</p>}
        {results && !anyBookable && <p className="mb-8 rounded-[var(--radius-md)] bg-white px-5 py-4 text-[15px] ring-1 ring-[var(--color-border)]">Aucune chambre ne correspond à ces dates. Essayez d&apos;autres dates ou appelez-nous{hotel.contact.phone ? ` au ${hotel.contact.phone}` : ""}.</p>}
        <div className="grid gap-8">
          {ordered.map((room, i) => {
            const res = byId.get(room.id);
            return <RoomCard key={room.id} room={room} query={query} priority={i === 0} result={res ? { freeCount: res.freeCount, nights: res.nights, total: res.total, bookable: res.bookable, reason: res.reason } : null} />;
          })}
        </div>
      </div>
    </HotelShell>
  );
}
