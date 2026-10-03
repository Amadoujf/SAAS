import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { resolveRestaurant } from "@/lib/restaurant/restaurant-context";
import { getBookingForGuest } from "@/lib/restaurant/public-pipeline";
import { loadService } from "@/lib/restaurant/restaurant-data";
import { BOOKING_LABELS, coversLabel, dateIn, longDate, timeIn } from "@/lib/restaurant/labels";
import { RestaurantShell } from "@/components/restaurant/restaurant-shell";
import { GuestCancelButton } from "@/components/restaurant/guest-actions";
import { PublicSiteSuspended } from "@/components/public-site-suspended";
import { PublicSiteBillingSuspended } from "@/components/public-site-billing-suspended";

export const metadata: Metadata = { title: "Ma réservation", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** Réservation de table par son jeton : le client ne voit que LA SIENNE. */
export default async function MyTablePage({ params }: { params: { token: string } }) {
  const r = await resolveRestaurant(`/ma-table/${params.token}`);
  if (r.status === "suspended") return <PublicSiteSuspended tenantName={r.tenantName} />;
  if (r.status === "billing_suspended") return <PublicSiteBillingSuspended tenantName={r.tenantName} />;
  const { restaurant } = r;
  const [b, service] = await Promise.all([getBookingForGuest(restaurant.tenantId, params.token), loadService(restaurant.tenantId)]);
  if (!b?.tableBooking) notFound();
  const tz = restaurant.timezone;
  const active = b.status === "requested" || b.status === "confirmed";
  const upcoming = active && b.startAt.getTime() > Date.now();
  return (
    <RestaurantShell restaurant={restaurant} open={service.open}>
      <div className="mx-auto max-w-2xl px-4 pt-10 sm:px-8">
        <p className="text-[13px] font-bold uppercase tracking-[0.16em] text-[var(--color-accent-secondary)]">Réservation {b.reference}</p>
        <h1 className="mt-2 font-[family-name:var(--font-heading)] text-[44px] uppercase leading-[0.95] tracking-[-0.02em] sm:text-[60px]">{b.status === "canceled" ? "Réservation annulée" : b.status === "confirmed" ? "Votre table est réservée" : BOOKING_LABELS[b.status]?.guest}</h1>
        <article className={`mt-8 overflow-hidden rounded-[var(--radius-lg)] bg-[var(--color-primary)] text-white ${b.status === "canceled" ? "opacity-60" : ""}`}>
          <div className="grid grid-cols-3 divide-x divide-white/10">
            <div className="p-5"><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/55">Jour</p><p className="mt-1 font-[family-name:var(--font-heading)] text-[22px] leading-tight first-letter:uppercase">{longDate(dateIn(b.startAt, tz))}</p></div>
            <div className="p-5"><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/55">Heure</p><p className="yc-num mt-1 font-[family-name:var(--font-heading)] text-[30px] leading-none text-[var(--color-accent-primary)]">{timeIn(b.startAt, tz)}</p></div>
            <div className="p-5"><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/55">Couverts</p><p className="mt-1 font-[family-name:var(--font-heading)] text-[22px] leading-tight">{coversLabel(b.tableBooking.partySize)}</p></div>
          </div>
          <div className="border-t border-white/10 px-5 py-4 text-[14px] text-white/75">
            Au nom de {[b.customer.firstName, b.customer.lastName].filter(Boolean).join(" ")}
            {b.tableBooking.occasion ? ` · ${b.tableBooking.occasion}` : ""}
            {b.tableBooking.table ? ` · table ${b.tableBooking.table.label}` : ""}
          </div>
        </article>
        {b.customerNote && <p className="mt-4 text-[14px] text-[var(--color-text-secondary)]">Votre demande : « {b.customerNote} »</p>}
        <div className="mt-8 flex flex-wrap items-center gap-3">
          {upcoming && <GuestCancelButton token={b.accessToken} kind="booking" />}
          {restaurant.contact.phone && <a href={`tel:${restaurant.contact.phone.replace(/\s/g, "")}`} className="inline-flex h-12 items-center rounded-full bg-[var(--color-primary)] px-6 text-[14px] font-bold text-white">Appeler le restaurant</a>}
          <Link href="/carte" className="inline-flex h-12 items-center rounded-full px-5 text-[14px] font-bold underline-offset-4 hover:underline">Voir la carte</Link>
        </div>
        <p className="mt-6 text-[13px] text-[var(--color-text-muted)]">Gardez ce lien : il vous permet de retrouver ou d&apos;annuler votre réservation. Il est personnel.</p>
      </div>
    </RestaurantShell>
  );
}
