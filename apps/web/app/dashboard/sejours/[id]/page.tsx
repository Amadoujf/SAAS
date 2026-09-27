import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasPermission } from "@yamacommerce/auth";
import { withTenant, getStay, utcToLocal } from "@yamacommerce/database";
import { requireHotelPage } from "@/lib/hotel/guard";
import { HOUSEKEEPING_LABELS, STAY_STATUS_LABELS, dateOnly, formatXof, guestsLabel, longDate, nightsLabel, shortDate } from "@/lib/hotel/labels";
import { PageHeader, Panel, PanelHeader } from "@/components/yc/panel";
import { Pill } from "@/components/yc/status-pill";
import { IconArrowLeft, IconPhone } from "@/components/yc/icons";
import { ModifyStayPanel, StayActions, StayPaymentsPanel } from "@/components/dashboard-hotel/stay-panels";

export const metadata: Metadata = { title: "Séjour — Y-COM", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const CHANNELS: Record<string, string> = { web: "réservé en ligne", phone: "réservé au téléphone", dashboard: "réservé à la réception", whatsapp: "réservé sur WhatsApp" };

/** Fiche séjour : dates, chambre, voyageurs, arrivée/départ, modifications, encaissements, historique. */
export default async function StayPage({ params }: { params: { id: string } }) {
  const membership = await requireHotelPage("reservations.view");
  const data = await withTenant(membership.tenantId, async (tx) => ({
    tz: (await tx.tenant.findUnique({ where: { id: membership.tenantId }, select: { timezone: true } }))?.timezone || "Africa/Dakar",
    s: await getStay(tx, membership.tenantId, params.id),
    rooms: await tx.hotelRoom.findMany({ where: { tenantId: membership.tenantId, isActive: true }, include: { roomType: { select: { listing: { select: { title: true } } } } }, orderBy: { number: "asc" } }),
  }));
  const { s, tz } = data;
  if (!s?.stay) notFound();
  const can = (p: Parameters<typeof hasPermission>[1]) => hasPermission(membership.permissions, p);
  const today = utcToLocal(new Date(), tz).date;
  const arrival = dateOnly(s.stay.arrival);
  const departure = dateOnly(s.stay.departure);
  const inHouse = Boolean(s.stay.checkedInAt && !s.stay.checkedOutAt);
  const st = inHouse ? { label: "Client sur place", tone: "success" as const } : STAY_STATUS_LABELS[s.status] ?? STAY_STATUS_LABELS.requested!;
  const paid = s.payments.filter((p) => !p.voidedAt).reduce((t, p) => t + p.amount, 0);
  const deposit = s.listing?.roomType?.depositPercent && s.totalAmount ? Math.ceil((s.totalAmount * s.listing.roomType.depositPercent) / 100) : 0;
  const nightly = (Array.isArray(s.stay.nightly) ? s.stay.nightly : []) as { date: string; price: number }[];
  const active = s.status === "requested" || s.status === "confirmed";
  const fmt = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: tz });
  const hk = HOUSEKEEPING_LABELS[s.stay.room.housekeeping]!;
  return (
    <>
      <Link href="/dashboard/sejours" className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-yc-ink-soft hover:text-yc-ink"><IconArrowLeft size={16} /> Séjours</Link>
      <PageHeader title={`${s.customer.firstName} ${s.customer.lastName ?? ""}`.trim()} description={<span className="flex flex-wrap items-center gap-2"><span className="font-mono text-xs">{s.reference}</span><Pill tone={st.tone}>{st.label}</Pill><span>· {CHANNELS[s.channel] ?? s.channel}</span></span>} />
      <div className="grid gap-5 xl:grid-cols-[1fr_340px]">
        <div className="flex min-w-0 flex-col gap-5">
          <section className="rounded-xl bg-white p-5 shadow-[0_1px_2px_rgb(12_22_48/0.04),0_8px_24px_-16px_rgb(12_22_48/0.12)] ring-1 ring-yc-ink/[0.07] sm:p-6" aria-labelledby="sejour">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 id="sejour" className="text-[22px] font-bold tracking-[-0.02em] first-letter:uppercase">{longDate(arrival)} → {shortDate(departure, { weekday: "long", day: "numeric", month: "long" })}</h2>
                <p className="mt-1 text-[15px]">{s.listing?.title} · <strong>chambre {s.stay.room.number}</strong> <Pill tone={hk.tone}>{hk.label}</Pill></p>
                <p className="mt-1 text-sm text-yc-ink-soft">{nightsLabel(s.stay.nights)} · {guestsLabel(s.stay.adults, s.stay.children)}{s.stay.checkedInAt ? ` · arrivé le ${fmt.format(s.stay.checkedInAt)}` : ""}{s.stay.checkedOutAt ? ` · parti le ${fmt.format(s.stay.checkedOutAt)}` : ""}</p>
                <Link href={`/dashboard/planning?du=${arrival}`} className="mt-2 inline-block text-sm font-semibold text-yc-electric hover:underline">Voir sur le planning</Link>
              </div>
              <StayActions reservationId={s.id} status={s.status} checkedIn={Boolean(s.stay.checkedInAt)} checkedOut={Boolean(s.stay.checkedOutAt)} arrivalReached={arrival <= today} canUpdate={can("reservations.update_status")} canCancel={can("reservations.cancel")} />
            </div>
            {s.customerNote && <p className="mt-4 rounded-lg bg-yc-ivory-50 px-3 py-2 text-sm ring-1 ring-yc-ink/[0.05]">« {s.customerNote} »</p>}
            {active && can("reservations.update_status") && (
              <div className="mt-4">
                <ModifyStayPanel reservationId={s.id} arrival={arrival} departure={departure} roomId={s.stay.room.id} checkedIn={Boolean(s.stay.checkedInAt)} today={today} rooms={data.rooms.map((r) => ({ id: r.id, label: `Ch. ${r.number} — ${r.roomType.listing.title}${r.housekeeping === "out_of_service" ? " (hors service)" : ""}` }))} />
              </div>
            )}
            {nightly.length > 0 && nightly.length <= 14 && (
              <ul className="mt-4 grid gap-1 text-sm sm:grid-cols-2">
                {nightly.map((n) => <li key={n.date} className="flex justify-between rounded-md bg-yc-ivory-50 px-3 py-1.5"><span className="first-letter:uppercase">{shortDate(n.date)}</span><span className="yc-num">{formatXof(n.price)}</span></li>)}
              </ul>
            )}
          </section>
          <StayPaymentsPanel
            reservationId={s.id}
            total={s.totalAmount}
            paid={paid}
            deposit={deposit}
            canRecord={can("reservation_payments.record")}
            closed={s.status === "canceled"}
            payments={s.payments.map((p) => ({ id: p.id, receiptNumber: p.receiptNumber, amount: formatXof(p.amount), kind: p.kind, method: p.method, reference: p.reference, paidAt: fmt.format(p.paidAt), voided: Boolean(p.voidedAt), voidReason: p.voidReason }))}
          />
        </div>
        <aside className="flex flex-col gap-4">
          <Panel>
            <PanelHeader title="Client" />
            <div className="grid gap-1.5 px-5 pb-5 text-sm">
              <p className="font-semibold">{s.customer.firstName} {s.customer.lastName ?? ""}</p>
              {s.customer.phone && <a href={`tel:${s.customer.phone}`} className="inline-flex items-center gap-1.5 text-yc-electric hover:underline"><IconPhone size={15} /> {s.customer.phone}</a>}
              {s.customer.phone && <a href={`https://wa.me/${s.customer.phone.replace(/[^\d]/g, "")}`} target="_blank" rel="noreferrer" className="text-yc-electric hover:underline">WhatsApp</a>}
              {s.customer.email && <a href={`mailto:${s.customer.email}`} className="text-yc-electric hover:underline">{s.customer.email}</a>}
            </div>
          </Panel>
          <Panel>
            <PanelHeader title="Historique" description="Chaque changement est conservé." />
            <ol className="grid gap-2 px-5 pb-5 text-sm">
              {s.history.map((h) => (
                <li key={h.id} className="flex justify-between gap-2">
                  <span>{h.fromStatus === h.toStatus ? (h.note?.startsWith("Arrivée") ? "Arrivée" : "Modifié") : STAY_STATUS_LABELS[h.toStatus]?.label ?? h.toStatus}{h.note ? <span className="block text-xs text-yc-ink-soft">{h.note}</span> : null}</span>
                  <span className="shrink-0 text-right text-yc-ink-soft">{fmt.format(h.createdAt)}</span>
                </li>
              ))}
            </ol>
          </Panel>
        </aside>
      </div>
    </>
  );
}
