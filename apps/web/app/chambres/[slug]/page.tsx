import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { withTenant, getPublishedRoomTypeBySlug, isIsoDate, utcToLocal } from "@yamacommerce/database";
import { resolveHotel } from "@/lib/hotel/hotel-context";
import { AMENITY_LABELS, addDaysIso, clockLabel, formatXof, guestsLabel, nightsLabel } from "@/lib/hotel/labels";
import { HotelShell } from "@/components/hotel/hotel-shell";
import { StayPlanner } from "@/components/hotel/stay-planner";
import { PublicSiteSuspended } from "@/components/public-site-suspended";
import { PublicSiteBillingSuspended } from "@/components/public-site-billing-suspended";

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const r = await resolveHotel(`/chambres/${params.slug}`);
  if (r.status !== "ok") return {};
  const t = await withTenant(r.hotel.tenantId, (tx) => getPublishedRoomTypeBySlug(tx, r.hotel.tenantId, params.slug));
  return t ? { title: `${t.title} — ${r.hotel.tenantName}`, description: t.summary ?? undefined } : {};
}
export const dynamic = "force-dynamic";

/** Fiche d'un type de chambre PUBLIÉ : photos, équipements, calendrier, réservation. */
export default async function RoomPage({ params, searchParams }: { params: { slug: string }; searchParams: { arrivee?: string; depart?: string; adultes?: string; enfants?: string } }) {
  const r = await resolveHotel(`/chambres/${params.slug}`);
  if (r.status === "suspended") return <PublicSiteSuspended tenantName={r.tenantName} />;
  if (r.status === "billing_suspended") return <PublicSiteBillingSuspended tenantName={r.tenantName} />;
  const { hotel } = r;
  const t = await withTenant(hotel.tenantId, (tx) => getPublishedRoomTypeBySlug(tx, hotel.tenantId, params.slug));
  if (!t?.roomType || !t.roomType.rooms.some((x) => x.isActive)) notFound();
  const rt = t.roomType;
  const today = utcToLocal(new Date(), hotel.timezone).date;
  const media = (Array.isArray(t.media) ? t.media : []) as { url: string; alt?: string; demo?: boolean }[];
  const arrival = isIsoDate(searchParams.arrivee) && searchParams.arrivee >= today ? searchParams.arrivee : null;
  const departure = arrival && isIsoDate(searchParams.depart) && searchParams.depart > arrival ? searchParams.depart : null;
  const n = (v: string | undefined, d: number) => (Number.isInteger(Number(v)) && Number(v) >= 0 ? Number(v) : d);
  return (
    <HotelShell hotel={hotel}>
      <div className="mx-auto max-w-[var(--content-max-width,1320px)] px-5 pt-8 sm:px-8">
        <nav aria-label="Fil d'Ariane" className="text-[13px] text-[var(--color-text-muted)]"><Link href="/" className="hover:underline">Accueil</Link> / <Link href="/chambres" className="hover:underline">Chambres</Link></nav>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-[family-name:var(--font-heading)] text-[44px] leading-none sm:text-[64px]">{t.title}</h1>
            <p className="mt-3 text-[15px] text-[var(--color-text-secondary)]">{guestsLabel(rt.maxAdults, rt.maxChildren)} max · {rt.bedSummary}{rt.sizeM2 ? ` · ${rt.sizeM2} m²` : ""}{rt.minNights > 1 ? ` · ${nightsLabel(rt.minNights)} minimum` : ""}</p>
          </div>
          <p className="text-right"><span className="block text-[12.5px] text-[var(--color-text-muted)]">À partir de</span><span className="font-[family-name:var(--font-heading)] text-[32px] leading-none">{t.price == null ? "Sur demande" : formatXof(t.price)}</span><span className="block text-[12.5px] text-[var(--color-text-muted)]">par nuit</span></p>
        </div>
        {media.length > 0 && (
          <div className="mt-8 grid gap-3 md:grid-cols-[2fr_1fr] md:grid-rows-2">
            {media.slice(0, 3).map((m, i) => (
              <div key={m.url} className={`relative overflow-hidden rounded-[var(--radius-lg)] bg-[var(--color-surface)] ${i === 0 ? "aspect-[16/10] md:row-span-2 md:aspect-auto" : "hidden aspect-[16/10] md:block"}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={m.url} alt={m.alt || t.title} className="absolute inset-0 h-full w-full object-cover" />
                {m.demo && i === 0 && <span className="absolute bottom-3 left-3 rounded-sm bg-black/50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-white">Visuel de démonstration</span>}
              </div>
            ))}
          </div>
        )}
        <div className="mt-12 grid gap-10 lg:grid-cols-[1.4fr_1fr]">
          <div>
            {t.summary && <p className="font-[family-name:var(--font-heading)] text-[26px] leading-snug">{t.summary}</p>}
            {t.description && <div className="mt-5 grid gap-4 text-[16px] leading-relaxed text-[var(--color-text-secondary)]">{t.description.split(/\n{2,}/).map((p) => <p key={p}>{p}</p>)}</div>}
          </div>
          <div className="grid gap-6 self-start">
            {rt.amenities.length > 0 && (
              <div>
                <h2 className="text-[13px] font-semibold uppercase tracking-[0.16em]">Dans la chambre</h2>
                <ul className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-[15px]">{rt.amenities.map((a) => <li key={a} className="border-b border-[var(--color-border)] pb-2">{AMENITY_LABELS[a] ?? a}</li>)}</ul>
              </div>
            )}
            <p className="text-[14.5px] text-[var(--color-text-secondary)]">Arrivée à partir de <strong>{clockLabel(rt.checkInMinute)}</strong> · départ avant <strong>{clockLabel(rt.checkOutMinute)}</strong>{rt.depositPercent ? ` · acompte de ${rt.depositPercent} % à la confirmation` : ""}.</p>
          </div>
        </div>
        <div className="mt-14">
          <StayPlanner
            type={t.slug}
            today={today}
            maxDate={addDaysIso(today, hotel.rules.maxAdvanceDays)}
            initial={{ arrival, departure, adults: Math.max(1, n(searchParams.adultes, 2)), children: n(searchParams.enfants, 0) }}
            minNights={rt.minNights}
            maxAdults={rt.maxAdults}
            maxChildren={rt.maxChildren}
            depositPercent={rt.depositPercent}
            autoConfirm={hotel.rules.autoConfirm}
            payWays={hotel.payWays}
          />
        </div>
      </div>
    </HotelShell>
  );
}
