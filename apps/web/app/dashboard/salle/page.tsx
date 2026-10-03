import Link from "next/link";
import type { Metadata } from "next";
import { withTenant, isIsoDate, listTableBookings, listTables, utcToLocal } from "@yamacommerce/database";
import { hasPermission } from "@yamacommerce/auth";
import { requireRestaurantPage } from "@/lib/restaurant/guard";
import { addDaysIso, coversLabel, longDate, timeIn } from "@/lib/restaurant/labels";
import { PageHeader, Panel } from "@/components/yc/panel";
import { EmptyState } from "@/components/yc/empty-state";
import { BookingList, DeskBookingForm } from "@/components/dashboard-restaurant/booking-panels";

export const metadata: Metadata = { title: "Réservations — Y-COM", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** Réservations de table d'une journée : couverts, placement, arrivées. */
export default async function DiningRoomPage({ searchParams }: { searchParams: { date?: string } }) {
  const membership = await requireRestaurantPage("reservations.view");
  const data = await withTenant(membership.tenantId, async (tx) => {
    const tz = (await tx.tenant.findUnique({ where: { id: membership.tenantId }, select: { timezone: true } }))?.timezone || "Africa/Dakar";
    const today = utcToLocal(new Date(), tz).date;
    const date = searchParams.date && isIsoDate(searchParams.date) ? searchParams.date : today;
    return { tz, today, date, rows: await listTableBookings(tx, membership.tenantId, { date }), tables: (await listTables(tx, membership.tenantId)).filter((t) => t.isActive) };
  });
  const { date, tz } = data;
  const live = data.rows.filter((r) => ["requested", "confirmed", "completed"].includes(r.status));
  const covers = live.reduce((s, r) => s + r.quantity, 0);
  const lunch = live.filter((r) => utcToLocal(r.startAt, tz).minute < 16 * 60).reduce((s, r) => s + r.quantity, 0);
  const tables = data.tables.map((t) => ({ id: t.id, label: t.label, seats: t.seats }));
  return (
    <>
      <PageHeader eyebrow="Service" title="Réservations" description="Les réservations du site arrivent confirmées : le site ne propose que les heures où il reste de la place." />
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <Link href={`/dashboard/salle?date=${addDaysIso(date, -1)}`} className="grid h-10 w-10 place-items-center rounded-lg bg-white ring-1 ring-yc-ink/10" aria-label="Jour précédent">‹</Link>
        <p className="min-w-[220px] text-center text-[17px] font-bold first-letter:uppercase">{longDate(date)}{date === data.today ? " · aujourd'hui" : ""}</p>
        <Link href={`/dashboard/salle?date=${addDaysIso(date, 1)}`} className="grid h-10 w-10 place-items-center rounded-lg bg-white ring-1 ring-yc-ink/10" aria-label="Jour suivant">›</Link>
        {date !== data.today && <Link href="/dashboard/salle" className="ml-2 text-sm font-semibold text-yc-electric hover:underline">Aujourd&apos;hui</Link>}
        <p className="ml-auto text-sm text-yc-ink-soft"><strong className="text-yc-ink">{coversLabel(covers)}</strong> · midi {lunch} · soir {covers - lunch}</p>
      </div>
      {data.rows.length === 0 ? (
        <Panel><EmptyState title="Aucune réservation ce jour-là" description="Les réservations du site et du téléphone apparaissent ici." /></Panel>
      ) : (
        <BookingList
          canUpdate={hasPermission(membership.permissions, "reservations.update_status")}
          canCancel={hasPermission(membership.permissions, "reservations.cancel")}
          tables={tables}
          rows={data.rows.map((r) => ({
            id: r.id,
            time: timeIn(r.startAt, tz),
            reference: r.reference,
            name: [r.customer.firstName, r.customer.lastName].filter(Boolean).join(" "),
            phone: r.customer.phone,
            partySize: r.quantity,
            status: r.status,
            tableId: r.tableBooking?.tableId ?? null,
            occasion: r.tableBooking?.occasion ?? null,
            note: r.customerNote,
            channel: r.channel,
          }))}
        />
      )}
      {hasPermission(membership.permissions, "reservations.update_status") && <div className="mt-6"><DeskBookingForm key={date} date={date} tables={tables} /></div>}
    </>
  );
}
