import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasPermission } from "@yamacommerce/auth";
import { withTenant, getAppointment, listStaff, utcToLocal } from "@yamacommerce/database";
import { requireSalonPage } from "@/lib/salon/guard";
import { APPOINTMENT_STATUS_LABELS, dayIn, durationLabel, formatXof, timeIn } from "@/lib/salon/labels";
import { PageHeader, Panel, PanelHeader } from "@/components/yc/panel";
import { Pill } from "@/components/yc/status-pill";
import { IconArrowLeft, IconPhone } from "@/components/yc/icons";
import { AppointmentStatusActions, CheckoutPanel, MovePanel } from "@/components/dashboard-salon/appointment-panels";
import { section } from "@/components/dashboard-salon/shared";

export const metadata: Metadata = { title: "Rendez-vous — Y-COM", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const CHANNELS: Record<string, string> = { web: "pris en ligne", phone: "pris au téléphone", dashboard: "pris au comptoir", whatsapp: "pris sur WhatsApp" };

/** Fiche d'un rendez-vous : statut, déplacement, prix final, encaissement, historique. */
export default async function AppointmentPage({ params }: { params: { id: string } }) {
  const membership = await requireSalonPage("reservations.view");
  const data = await withTenant(membership.tenantId, async (tx) => ({
    tz: (await tx.tenant.findUnique({ where: { id: membership.tenantId }, select: { timezone: true } }))?.timezone || "Africa/Dakar",
    a: await getAppointment(tx, membership.tenantId, params.id),
    staff: await listStaff(tx, membership.tenantId, { activeOnly: true }),
  }));
  const { a, tz } = data;
  if (!a || !a.appointment) notFound();
  const can = (p: Parameters<typeof hasPermission>[1]) => hasPermission(membership.permissions, p);
  const st = APPOINTMENT_STATUS_LABELS[a.status] ?? APPOINTMENT_STATUS_LABELS.requested!;
  const active = a.status === "requested" || a.status === "confirmed";
  const paid = a.payments.filter((p) => !p.voidedAt).reduce((s, p) => s + p.amount, 0);
  const svc = a.listing?.service;
  const skilled = data.staff.filter((s) => s.skills.some((k) => k.listingId === a.listingId));
  const fmt = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: tz });
  return (
    <>
      <Link href="/dashboard/rendez-vous" className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-yc-ink-soft hover:text-yc-ink"><IconArrowLeft size={16} /> Rendez-vous</Link>
      <PageHeader
        title={`${a.customer.firstName} ${a.customer.lastName ?? ""}`.trim()}
        description={<span className="flex flex-wrap items-center gap-2"><span className="font-mono text-xs">{a.reference}</span><Pill tone={st.tone}>{st.label}</Pill><span>· {CHANNELS[a.channel] ?? a.channel}</span></span>}
      />
      <div className="grid gap-5 xl:grid-cols-[1fr_340px]">
        <div className="flex min-w-0 flex-col gap-5">
          <section className={section} aria-labelledby="rdv">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold capitalize text-yc-electric">{dayIn(a.startAt, tz)}</p>
                <h2 id="rdv" className="mt-1 text-[26px] font-bold tabular-nums tracking-[-0.02em]">{timeIn(a.startAt, tz)}{a.endAt ? ` – ${timeIn(a.endAt, tz)}` : ""}</h2>
                <p className="mt-1 text-[15px]">{a.listing?.title}{svc ? ` · ${durationLabel(svc.durationMinutes)}` : ""} · avec <strong>{a.appointment.staff.displayName}</strong></p>
                {svc && svc.bufferMinutes > 0 && <p className="mt-1 text-sm text-yc-ink-soft">+ {svc.bufferMinutes} min de préparation bloquées dans l&apos;agenda.</p>}
                <Link href={`/dashboard/agenda?jour=${utcToLocal(a.startAt, tz).date}`} className="mt-2 inline-block text-sm font-semibold text-yc-electric hover:underline">Voir dans l&apos;agenda</Link>
              </div>
              <AppointmentStatusActions reservationId={a.id} status={a.status} started={a.startAt <= new Date()} canUpdate={can("reservations.update_status")} canCancel={can("reservations.cancel")} />
            </div>
            {a.customerNote && <p className="mt-4 rounded-lg bg-yc-ivory-50 px-3 py-2 text-sm ring-1 ring-yc-ink/[0.05]">« {a.customerNote} »</p>}
            {active && can("reservations.update_status") && (
              <div className="mt-4">
                <MovePanel reservationId={a.id} listingId={a.listingId!} staff={skilled.map((s) => ({ id: s.id, name: s.displayName }))} currentStaffId={a.appointment.staffId} today={utcToLocal(new Date(), tz).date} currentDate={utcToLocal(a.startAt, tz).date} />
              </div>
            )}
          </section>
          <CheckoutPanel
            reservationId={a.id}
            total={a.totalAmount}
            paid={paid}
            priceFrom={svc?.priceFrom ?? false}
            canRecord={can("reservation_payments.record")}
            closed={a.status === "canceled"}
            payments={a.payments.map((p) => ({ id: p.id, receiptNumber: p.receiptNumber, amount: formatXof(p.amount), method: p.method, reference: p.reference, paidAt: fmt.format(p.paidAt), voided: Boolean(p.voidedAt), voidReason: p.voidReason }))}
          />
        </div>
        <aside className="flex flex-col gap-4">
          <Panel>
            <PanelHeader title="Client" />
            <div className="grid gap-1.5 px-5 pb-5 text-sm">
              <p className="font-semibold">{a.customer.firstName} {a.customer.lastName ?? ""}</p>
              {a.customer.phone && <a href={`tel:${a.customer.phone}`} className="inline-flex items-center gap-1.5 text-yc-electric hover:underline"><IconPhone size={15} /> {a.customer.phone}</a>}
              {a.customer.phone && <a href={`https://wa.me/${a.customer.phone.replace(/[^\d]/g, "")}`} target="_blank" rel="noreferrer" className="text-yc-electric hover:underline">WhatsApp</a>}
              {a.customer.email && <a href={`mailto:${a.customer.email}`} className="text-yc-electric hover:underline">{a.customer.email}</a>}
            </div>
          </Panel>
          <Panel>
            <PanelHeader title="Historique" description="Chaque changement est conservé." />
            <ol className="grid gap-2 px-5 pb-5 text-sm">
              {a.history.map((h) => (
                <li key={h.id} className="flex justify-between gap-2">
                  <span>{h.fromStatus === h.toStatus ? "Déplacé" : APPOINTMENT_STATUS_LABELS[h.toStatus]?.label ?? h.toStatus}{h.note ? <span className="block text-xs text-yc-ink-soft">{h.note}</span> : null}</span>
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
