import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { summarizePayments } from "@yamacommerce/database";
import { resolveTravel } from "@/lib/travel/travel-context";
import { getTravelBookingForGuest } from "@/lib/travel/public-pipeline";
import { destinationOf, mediaOf } from "@/lib/travel/travel-cards";
import { BOOKING_STATUS_LABELS, DOCUMENT_LABELS, PAYMENT_KIND_LABELS, PAYMENT_METHOD_LABELS, documentStatusLabel, formatDateRange, formatLongDate, formatXof } from "@/lib/travel/labels";
import { TravelShell } from "@/components/travel/travel-shell";
import { CancelBookingButton } from "@/components/travel/cancel-booking-button";
import { PublicSiteSuspended } from "@/components/public-site-suspended";
import { PublicSiteBillingSuspended } from "@/components/public-site-billing-suspended";

export const metadata: Metadata = { title: "Ma réservation", robots: { index: false, follow: false } };

const TONE: Record<string, string> = {
  warning: "bg-[color-mix(in_srgb,var(--color-warning)_14%,white)] text-[var(--color-warning)]",
  info: "bg-[color-mix(in_srgb,var(--color-secondary)_12%,white)] text-[var(--color-secondary)]",
  success: "bg-[color-mix(in_srgb,var(--color-success)_12%,white)] text-[var(--color-success)]",
  danger: "bg-[color-mix(in_srgb,var(--color-danger)_10%,white)] text-[var(--color-danger)]",
  neutral: "bg-[var(--color-surface)] text-[var(--color-text-secondary)]",
};

/**
 * Suivi de SA réservation par le voyageur (lien secret reçu après l'envoi) : état,
 * voyageurs, montants — « payé » seulement pour les paiements réellement enregistrés par
 * l'agence —, comment régler l'acompte, pièces à fournir, annulation encadrée.
 */
export default async function BookingStatusPage({ params }: { params: { token: string } }) {
  const r = await resolveTravel(`/reservation/${params.token}`);
  if (r.status === "suspended") return <PublicSiteSuspended tenantName={r.tenantName} />;
  if (r.status === "billing_suspended") return <PublicSiteBillingSuspended tenantName={r.tenantName} />;
  const { travel } = r;
  const booking = await getTravelBookingForGuest(travel.tenantId, params.token);
  if (!booking) notFound();
  const status = BOOKING_STATUS_LABELS[booking.status] ?? BOOKING_STATUS_LABELS.requested!;
  const t = booking.listing?.travel;
  const pay = summarizePayments(booking.totalAmount, t?.depositPercent ?? 0, booking.payments);
  const receipts = booking.payments.filter((p) => !p.voidedAt);
  const cover = booking.listing ? mediaOf(booking.listing.media)[0] : undefined;
  const active = booking.status === "requested" || booking.status === "confirmed";
  const cancellable = active && booking.startAt > new Date() && receipts.length === 0;
  const depositOutstanding = active && pay.depositDue != null && pay.paid < pay.depositDue;
  const whatsapp = travel.contact.whatsapp?.replace(/[^\d]/g, "");

  return (
    <TravelShell travel={travel}>
      <div className="mx-auto max-w-3xl px-5 pt-14 sm:px-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-[var(--color-accent-primary)]">Réservation {booking.reference}</p>
        <h1 className="mt-3 font-[family-name:var(--font-heading)] text-[40px] leading-tight sm:text-[54px]">{booking.status === "requested" ? "Demande bien reçue" : status.label}</h1>
        <p className="mt-4 text-[17px] leading-relaxed text-[var(--color-text-secondary)]">{status.guest}</p>

        <article className="mt-8 overflow-hidden rounded-[var(--radius-lg)] bg-white shadow-[var(--shadow-md)] ring-1 ring-[var(--color-border)]">
          {cover && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cover.url} alt="" className="aspect-[16/7] w-full object-cover" />
          )}
          <div className="grid gap-5 p-6 sm:grid-cols-2 sm:p-7">
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Voyage</p>
              <p className="mt-1 font-[family-name:var(--font-heading)] text-[24px] leading-snug">{booking.listing ? <Link href={`/voyages/${booking.listing.slug}`} className="hover:underline">{booking.listing.title}</Link> : "—"}</p>
              {t && <p className="text-[14px] text-[var(--color-text-secondary)]">{destinationOf(t)}</p>}
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Dates</p>
              <p className="mt-1 text-[17px] font-semibold">{formatDateRange(booking.startAt, booking.endAt)}</p>
              <span className={`mt-2 inline-flex rounded-full px-3 py-1 text-[12px] font-semibold ${TONE[status.tone]}`}>{status.label}</span>
            </div>
          </div>
          <div className="border-t border-[var(--color-border)] p-6 sm:p-7">
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Voyageurs</p>
            <ul className="mt-3 grid gap-3">
              {booking.travelers.map((tr) => (
                <li key={tr.id} className="rounded-[var(--radius-md)] bg-[var(--color-surface)] p-4">
                  <p className="font-semibold">{tr.firstName} {tr.lastName}{tr.isLead ? <span className="ml-2 text-[12px] font-normal text-[var(--color-text-muted)]">contact principal</span> : null}</p>
                  {tr.passportLast4 && <p className="text-[13px] text-[var(--color-text-muted)]">Passeport se terminant par {tr.passportLast4}</p>}
                  {tr.documents.length > 0 && (
                    <ul className="mt-2 flex flex-wrap gap-2">
                      {tr.documents.map((doc) => (
                        <li key={doc.id} className={`rounded-full px-2.5 py-1 text-[12px] font-medium ${TONE[doc.status === "approved" ? "success" : doc.status === "refused" ? "danger" : doc.status === "missing" ? "warning" : "info"]}`}>
                          {DOCUMENT_LABELS[doc.kind] ?? doc.kind} · {documentStatusLabel(doc.kind, doc.status)}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          </div>
          <div className="border-t border-[var(--color-border)] p-6 sm:p-7">
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Paiement</p>
            <dl className="mt-3 grid gap-2 text-[15px]">
              <div className="flex justify-between gap-3"><dt>Total ({booking.quantity} voyageur{booking.quantity > 1 ? "s" : ""})</dt><dd className="font-semibold">{formatXof(pay.total)}</dd></div>
              {pay.depositDue != null && pay.depositDue > 0 && <div className="flex justify-between gap-3 text-[var(--color-text-secondary)]"><dt>Acompte demandé ({t?.depositPercent} %)</dt><dd>{formatXof(pay.depositDue)}</dd></div>}
              <div className="flex justify-between gap-3"><dt>Reçu par l&apos;agence</dt><dd className={`font-semibold ${pay.paid > 0 ? "text-[var(--color-success)]" : ""}`}>{formatXof(pay.paid)}</dd></div>
              {pay.remaining != null && <div className="flex justify-between gap-3 border-t border-[var(--color-border)] pt-2"><dt>Reste à régler</dt><dd className="font-[family-name:var(--font-heading)] text-[22px]">{formatXof(pay.remaining)}</dd></div>}
            </dl>
            {receipts.length > 0 && (
              <ul className="mt-4 grid gap-1.5 text-[13px] text-[var(--color-text-secondary)]">
                {receipts.map((p) => <li key={p.id}>Reçu {p.receiptNumber} — {PAYMENT_KIND_LABELS[p.kind]} de {formatXof(p.amount)} ({PAYMENT_METHOD_LABELS[p.method]}), le {formatLongDate(p.paidAt)}</li>)}
              </ul>
            )}
            {depositOutstanding && (
              <div className="mt-5 rounded-[var(--radius-md)] bg-[var(--color-surface)] p-4 text-[14px]">
                <p className="font-semibold">{booking.status === "requested" ? "Après l'appel de confirmation de l'agence" : "Pour régler l'acompte"}</p>
                {travel.paymentChannels.length > 0 ? (
                  <ul className="mt-2 grid gap-1.5">
                    {travel.paymentChannels.map((c) => (
                      <li key={c.provider}>{c.label} : <strong>{c.accountNumber}</strong>{c.accountHolderName ? ` (${c.accountHolderName})` : ""} — référence à indiquer : <strong>{booking.reference}</strong>{c.instructions ? `. ${c.instructions}` : ""}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-[var(--color-text-secondary)]">L&apos;agence vous indique les moyens de paiement lors de son appel.</p>
                )}
                <p className="mt-2 text-[13px] text-[var(--color-text-muted)]">Un paiement n&apos;apparaît comme reçu qu&apos;une fois enregistré par l&apos;agence, avec son numéro de reçu.</p>
              </div>
            )}
          </div>
        </article>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          {whatsapp && <a href={`https://wa.me/${whatsapp}?text=${encodeURIComponent(`Bonjour, réservation ${booking.reference}`)}`} target="_blank" rel="noreferrer" className="inline-flex h-11 items-center rounded-[var(--radius-full)] bg-[var(--color-primary)] px-5 text-[14px] font-semibold text-white">Écrire à l&apos;agence</a>}
          {travel.contact.phone && <a href={`tel:${travel.contact.phone.replace(/\s/g, "")}`} className="inline-flex h-11 items-center rounded-[var(--radius-full)] px-5 text-[14px] font-semibold ring-1 ring-inset ring-[var(--color-border)]">Appeler {travel.contact.phone}</a>}
          {cancellable && <CancelBookingButton token={params.token} />}
        </div>
        {active && !cancellable && booking.startAt > new Date() && <p className="mt-3 text-[13px] text-[var(--color-text-muted)]">Un paiement a été enregistré : pour annuler, contactez l&apos;agence (remboursement selon ses conditions).</p>}
        <p className="mt-6 text-sm text-[var(--color-text-muted)]">Gardez ce lien : il vous permet de revoir votre réservation à tout moment.</p>
      </div>
    </TravelShell>
  );
}
