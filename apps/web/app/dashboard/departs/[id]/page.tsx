import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasPermission } from "@yamacommerce/auth";
import { withTenant, departureManifest, summarizePayments } from "@yamacommerce/database";
import { requireTravelPage } from "@/lib/travel/guard";
import { BOOKING_STATUS_LABELS, DOCUMENT_LABELS, PAYMENT_STATE_LABELS, documentStatusLabel, formatDateRange, formatXof } from "@/lib/travel/labels";
import { PageHeader, Panel, PanelHeader } from "@/components/yc/panel";
import { Pill } from "@/components/yc/status-pill";
import { EmptyState } from "@/components/yc/empty-state";
import { IconArrowLeft, IconDownload } from "@/components/yc/icons";
import { PhoneBookingForm } from "@/components/dashboard-travel/phone-booking-form";

export const metadata: Metadata = { title: "Manifeste du départ — Y-COM", robots: { index: false, follow: false } };

/** Manifeste d'un départ : chaque voyageur, ses pièces, l'état du paiement de sa réservation. */
export default async function ManifestPage({ params }: { params: { id: string } }) {
  const membership = await requireTravelPage("reservations.view");
  const manifest = await withTenant(membership.tenantId, (tx) => departureManifest(tx, membership.tenantId, params.id));
  if (!manifest) notFound();
  const { departure, bookings } = manifest;
  const docs = departure.listing.travel?.requiredDocuments ?? [];
  const travelers = bookings.flatMap((b) => b.travelers.map((t) => ({ t, b })));
  const left = departure.capacity - departure.reservedCount;
  return (
    <>
      <Link href="/dashboard/departs" className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-yc-ink-soft hover:text-yc-ink"><IconArrowLeft size={16} /> Départs</Link>
      <PageHeader
        title={departure.listing.title}
        description={`${formatDateRange(departure.startAt, departure.endAt)} · ${departure.reservedCount} / ${departure.capacity} places réservées${departure.label ? ` · ${departure.label}` : ""}`}
        actions={<a href={`/dashboard/departs/${departure.id}/manifeste.csv`} className="inline-flex h-10 items-center gap-2 rounded-lg bg-white px-4 text-sm font-semibold ring-1 ring-inset ring-yc-ink/12 hover:ring-yc-ink/30"><IconDownload size={16} /> Manifeste (CSV)</a>}
      />
      {hasPermission(membership.permissions, "reservations.update_status") && departure.status === "open" && departure.startAt > new Date() && (
        <div className="mb-5"><PhoneBookingForm listingId={departure.listing.id} departureId={departure.id} left={left} /></div>
      )}
      {travelers.length === 0 ? (
        <Panel><EmptyState title="Aucun voyageur pour l'instant" description="Les réservations du site et celles prises par téléphone apparaissent ici." /></Panel>
      ) : (
        <Panel className="overflow-hidden">
          <PanelHeader title={`Voyageurs (${travelers.length})`} description="Réservations à confirmer et confirmées. Les annulations n'apparaissent pas." />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-yc-ivory-50 text-xs uppercase tracking-[0.08em] text-yc-ink-soft">
                <tr><th className="px-5 py-3">Voyageur</th><th className="px-3 py-3">Passeport</th>{docs.map((k) => <th key={k} className="px-3 py-3">{DOCUMENT_LABELS[k]?.split(" (")[0]}</th>)}<th className="px-3 py-3">Réservation</th><th className="px-5 py-3">Paiement</th></tr>
              </thead>
              <tbody className="divide-y divide-yc-ink/[0.06]">
                {travelers.map(({ t, b }) => {
                  const pay = summarizePayments(b.totalAmount, departure.listing.travel?.depositPercent ?? 0, b.payments);
                  const status = BOOKING_STATUS_LABELS[b.status] ?? BOOKING_STATUS_LABELS.requested!;
                  const payMeta = PAYMENT_STATE_LABELS[pay.state]!;
                  return (
                    <tr key={t.id}>
                      <td className="px-5 py-3 font-semibold">{t.firstName} {t.lastName}{t.isLead && <span className="block text-xs font-normal text-yc-ink-soft">{b.customer.phone}</span>}</td>
                      <td className="px-3 py-3 font-mono text-xs">{t.passportLast4 ? `•••• ${t.passportLast4}` : "—"}</td>
                      {docs.map((k) => {
                        const doc = t.documents.find((x) => x.kind === k);
                        const s = doc?.status ?? "missing";
                        return <td key={k} className="px-3 py-3"><Pill tone={s === "approved" ? "success" : s === "refused" ? "danger" : s === "missing" ? "warning" : "info"}>{documentStatusLabel(k, s)}</Pill></td>;
                      })}
                      <td className="px-3 py-3"><Link href={`/dashboard/reservations/${b.id}`} className="font-mono text-xs text-yc-electric hover:underline">{b.reference}</Link><span className="block"><Pill tone={status.tone}>{status.label}</Pill></span></td>
                      <td className="px-5 py-3"><Pill tone={payMeta.tone}>{payMeta.label}</Pill><span className="mt-1 block text-xs text-yc-ink-soft">{formatXof(pay.paid)} / {formatXof(pay.total)}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </>
  );
}
