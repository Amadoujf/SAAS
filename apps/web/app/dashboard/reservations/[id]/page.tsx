import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasPermission } from "@yamacommerce/auth";
import { withTenant, getTravelBooking, summarizePayments } from "@yamacommerce/database";
import { requireTravelPage } from "@/lib/travel/guard";
import { BOOKING_STATUS_LABELS, PAYMENT_STATE_LABELS, formatDateRange, formatLongDate, formatXof } from "@/lib/travel/labels";
import { destinationOf } from "@/lib/travel/travel-cards";
import { PageHeader, Panel, PanelHeader } from "@/components/yc/panel";
import { Pill } from "@/components/yc/status-pill";
import { IconArrowLeft, IconPhone } from "@/components/yc/icons";
import { BookingStatusActions, PaymentsPanel, TravelerCard } from "@/components/dashboard-travel/booking-panels";
import { section } from "@/components/dashboard-travel/trip-editor";

export const metadata: Metadata = { title: "Réservation — Y-COM", robots: { index: false, follow: false } };

const dateOnly = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

/** Réservation : statut, voyageurs et pièces, encaissements (reçus numérotés), historique. */
export default async function BookingPage({ params }: { params: { id: string } }) {
  const membership = await requireTravelPage("reservations.view");
  const b = await withTenant(membership.tenantId, (tx) => getTravelBooking(tx, membership.tenantId, params.id));
  if (!b) notFound();
  const can = (p: Parameters<typeof hasPermission>[1]) => hasPermission(membership.permissions, p);
  const t = b.listing?.travel;
  const pay = summarizePayments(b.totalAmount, t?.depositPercent ?? 0, b.payments);
  const status = BOOKING_STATUS_LABELS[b.status] ?? BOOKING_STATUS_LABELS.requested!;
  const payMeta = PAYMENT_STATE_LABELS[pay.state]!;
  const closed = !["requested", "confirmed"].includes(b.status);
  const suggested = pay.total == null || closed ? null : pay.depositDue != null && pay.paid < pay.depositDue ? { kind: "deposit" as const, amount: pay.depositDue - pay.paid } : pay.remaining ? { kind: "balance" as const, amount: pay.remaining } : null;
  return (
    <>
      <Link href="/dashboard/reservations" className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-yc-ink-soft hover:text-yc-ink"><IconArrowLeft size={16} /> Réservations</Link>
      <PageHeader
        title={`${b.customer.firstName} ${b.customer.lastName ?? ""}`.trim()}
        description={<span className="flex flex-wrap items-center gap-2"><span className="font-mono text-xs">{b.reference}</span><Pill tone={status.tone}>{status.label}</Pill><Pill tone={payMeta.tone}>{payMeta.label}</Pill><span>· {b.channel === "web" ? "reçue du site" : "saisie par l'agence"}</span></span>}
      />
      <div className="grid gap-5 xl:grid-cols-[1fr_340px]">
        <div className="flex min-w-0 flex-col gap-5">
          <section className={section} aria-labelledby="resa-voyage">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 id="resa-voyage" className="text-[18px] font-bold tracking-[-0.015em]">{b.listing ? <Link href={`/dashboard/voyages/${b.listing.id}`} className="hover:underline">{b.listing.title}</Link> : "Voyage supprimé"}</h2>
                <p className="mt-1 text-sm text-yc-ink-soft">{destinationOf(t)} · {formatDateRange(b.startAt, b.endAt)} · {b.quantity} voyageur{b.quantity > 1 ? "s" : ""}</p>
                {b.availabilityId && <Link href={`/dashboard/departs/${b.availabilityId}`} className="mt-1 inline-block text-sm font-semibold text-yc-electric hover:underline">Manifeste du départ</Link>}
              </div>
              <BookingStatusActions reservationId={b.id} status={b.status} past={b.startAt < new Date()} canUpdate={can("reservations.update_status")} canCancel={can("reservations.cancel")} />
            </div>
            {b.customerNote && <p className="mt-4 rounded-lg bg-yc-ivory-50 px-3 py-2 text-sm ring-1 ring-yc-ink/[0.05]">« {b.customerNote} »</p>}
          </section>

          <section className={section} aria-labelledby="resa-voyageurs">
            <h2 id="resa-voyageurs" className="text-[18px] font-bold tracking-[-0.015em]">Voyageurs et pièces</h2>
            <ul className="mt-4 grid gap-3">
              {b.travelers.map((tr) => (
                <TravelerCard
                  key={tr.id}
                  canManage={can("travelers.manage") && !closed}
                  t={{ id: tr.id, position: tr.position, firstName: tr.firstName, lastName: tr.lastName, birthDate: dateOnly(tr.birthDate), nationality: tr.nationality, passportLast4: tr.passportLast4, passportExpiry: dateOnly(tr.passportExpiry), isLead: tr.isLead, documents: tr.documents.map((d) => ({ kind: d.kind, status: d.status, note: d.note })) }}
                />
              ))}
            </ul>
          </section>

          <PaymentsPanel
            reservationId={b.id}
            canRecord={can("reservation_payments.record")}
            closed={closed}
            remaining={pay.remaining}
            suggested={suggested}
            payments={b.payments.map((p) => ({ id: p.id, receiptNumber: p.receiptNumber, kind: p.kind, amount: formatXof(p.amount), method: p.method, reference: p.reference, paidAt: formatLongDate(p.paidAt), voided: Boolean(p.voidedAt), voidReason: p.voidReason }))}
          />
        </div>

        <aside className="flex flex-col gap-4">
          <Panel>
            <PanelHeader title="Montants" />
            <dl className="grid gap-2 px-5 pb-5 text-sm">
              <div className="flex justify-between"><dt>Total</dt><dd className="yc-num font-semibold">{formatXof(pay.total)}</dd></div>
              {pay.depositDue != null && pay.depositDue > 0 && <div className="flex justify-between text-yc-ink-soft"><dt>Acompte ({t?.depositPercent} %)</dt><dd className="yc-num">{formatXof(pay.depositDue)}</dd></div>}
              <div className="flex justify-between"><dt>Encaissé</dt><dd className="yc-num font-semibold text-yc-success">{formatXof(pay.paid)}</dd></div>
              <div className="flex justify-between border-t border-yc-ink/[0.06] pt-2"><dt>Reste</dt><dd className="yc-num text-[17px] font-bold">{formatXof(pay.remaining)}</dd></div>
            </dl>
          </Panel>
          <Panel>
            <PanelHeader title="Contact" />
            <div className="grid gap-1.5 px-5 pb-5 text-sm">
              <p className="font-semibold">{b.customer.firstName} {b.customer.lastName ?? ""}</p>
              {b.customer.phone && <a href={`tel:${b.customer.phone}`} className="inline-flex items-center gap-1.5 text-yc-electric hover:underline"><IconPhone size={15} /> {b.customer.phone}</a>}
              {b.customer.email && <a href={`mailto:${b.customer.email}`} className="text-yc-electric hover:underline">{b.customer.email}</a>}
            </div>
          </Panel>
          <Panel>
            <PanelHeader title="Historique" description="Chaque changement de statut est conservé." />
            <ol className="grid gap-2 px-5 pb-5 text-sm">
              {b.history.map((h) => (
                <li key={h.id} className="flex justify-between gap-2"><span>{BOOKING_STATUS_LABELS[h.toStatus]?.label ?? h.toStatus}{h.note ? <span className="block text-xs text-yc-ink-soft">{h.note}</span> : null}</span><span className="shrink-0 text-yc-ink-soft">{formatLongDate(h.createdAt)}</span></li>
              ))}
            </ol>
          </Panel>
        </aside>
      </div>
    </>
  );
}
