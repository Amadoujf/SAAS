import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { utcToLocal } from "@yamacommerce/database";
import { resolveSalon } from "@/lib/salon/salon-context";
import { getAppointmentForGuest } from "@/lib/salon/public-pipeline";
import { APPOINTMENT_STATUS_LABELS, dayIn, durationLabel, formatXof, timeIn } from "@/lib/salon/labels";
import { SalonShell } from "@/components/salon/salon-shell";
import { AppointmentActions } from "@/components/salon/appointment-actions";
import { PublicSiteSuspended } from "@/components/public-site-suspended";
import { PublicSiteBillingSuspended } from "@/components/public-site-billing-suspended";

export const metadata: Metadata = { title: "Mon rendez-vous", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** Suivi d'un rendez-vous par son jeton : le client ne voit que LE SIEN. */
export default async function AppointmentPage({ params }: { params: { token: string } }) {
  const r = await resolveSalon(`/rdv/${params.token}`);
  if (r.status === "suspended") return <PublicSiteSuspended tenantName={r.tenantName} />;
  if (r.status === "billing_suspended") return <PublicSiteBillingSuspended tenantName={r.tenantName} />;
  const { salon } = r;
  const a = await getAppointmentForGuest(salon.tenantId, params.token);
  if (!a || !a.appointment) notFound();
  const tz = salon.timezone;
  const status = APPOINTMENT_STATUS_LABELS[a.status] ?? APPOINTMENT_STATUS_LABELS.requested!;
  const active = a.status === "requested" || a.status === "confirmed";
  const canChange = active && a.startAt.getTime() - Date.now() >= salon.rules.cancelCutoffHours * 3600_000;
  const paid = a.payments.filter((p) => !p.voidedAt).reduce((s, p) => s + p.amount, 0);
  const svc = a.listing?.service;
  return (
    <SalonShell salon={salon} bookingBar={false}>
      <div className="mx-auto max-w-3xl px-5 pb-10 pt-10 sm:px-8 sm:pt-14">
        <p className="text-[12px] font-semibold uppercase tracking-[0.28em] text-[var(--color-accent-secondary)]">Rendez-vous {a.reference}</p>
        <h1 className="mt-3 font-[family-name:var(--font-heading)] text-[44px] italic leading-none sm:text-[60px]">{a.status === "canceled" ? "Rendez-vous annulé" : a.status === "requested" ? "Demande envoyée" : "À bientôt !"}</h1>
        <p className="mt-4 text-[16px] text-[var(--color-text-secondary)]">{status.guest}</p>

        <article className={`mt-10 overflow-hidden rounded-[var(--radius-lg)] bg-white shadow-[var(--shadow-md)] ring-1 ring-[var(--color-border)] ${a.status === "canceled" ? "opacity-60" : ""}`}>
          <div className="grid gap-6 bg-[var(--color-primary)] px-6 py-7 text-white sm:grid-cols-[auto_1fr] sm:items-center sm:gap-8 sm:px-8">
            <div className="text-center sm:border-r sm:border-white/15 sm:pr-8">
              <p className="text-[12px] font-semibold uppercase tracking-[0.2em] text-white/60">{dayIn(a.startAt, tz, { weekday: "long" })}</p>
              <p className="font-[family-name:var(--font-heading)] text-[64px] leading-none">{dayIn(a.startAt, tz, { day: "numeric" })}</p>
              <p className="text-[14px] text-white/70">{dayIn(a.startAt, tz, { month: "long", year: "numeric" })}</p>
            </div>
            <div>
              <p className="font-[family-name:var(--font-heading)] text-[40px] italic leading-none tabular-nums">{timeIn(a.startAt, tz)}{a.endAt ? <span className="text-[22px] text-white/60"> – {timeIn(a.endAt, tz)}</span> : null}</p>
              <p className="mt-3 text-[18px] font-semibold">{a.listing?.title}</p>
              <p className="mt-1 text-[14px] text-white/70">avec {a.appointment.staff.displayName}{svc ? ` · ${durationLabel(svc.durationMinutes)}` : ""}</p>
            </div>
          </div>
          <dl className="grid gap-4 px-6 py-6 text-[15px] sm:grid-cols-3 sm:px-8">
            <div><dt className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">Statut</dt><dd className="mt-1 font-semibold">{status.label}</dd></div>
            <div><dt className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">Prix</dt><dd className="mt-1 font-semibold">{a.totalAmount == null ? "Sur devis" : `${svc?.priceFrom ? "À partir de " : ""}${formatXof(a.totalAmount)}`}</dd></div>
            <div><dt className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">Règlement</dt><dd className="mt-1 font-semibold">{paid > 0 ? `${formatXof(paid)} reçus` : "Au salon"}</dd></div>
          </dl>
          {active && (
            <div className="flex flex-wrap gap-3 border-t border-[var(--color-border)] px-6 py-5 sm:px-8">
              <a href={`/rdv/${params.token}/agenda.ics`} className="inline-flex h-11 items-center gap-2 rounded-[var(--radius-full)] px-5 text-[14px] font-semibold ring-1 ring-inset ring-[var(--color-border)] hover:ring-[var(--color-text-muted)]">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15.5" rx="2.5" /><path d="M3.5 10h17M8 3v4M16 3v4" /></svg>
                Ajouter à mon agenda
              </a>
              {salon.contact.address && <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${salon.tenantName} ${salon.contact.address}`)}`} target="_blank" rel="noreferrer" className="inline-flex h-11 items-center rounded-[var(--radius-full)] px-5 text-[14px] font-semibold ring-1 ring-inset ring-[var(--color-border)] hover:ring-[var(--color-text-muted)]">Itinéraire</a>}
            </div>
          )}
        </article>

        {active && (
          <section aria-labelledby="modifier" className="mt-10">
            <h2 id="modifier" className="font-[family-name:var(--font-heading)] text-[30px] italic">Un empêchement ?</h2>
            <div className="mt-4">
              <AppointmentActions token={params.token} service={a.listing!.slug} staffId={a.appointment.staffId} today={utcToLocal(new Date(), tz).date} canChange={canChange} cutoffHours={salon.rules.cancelCutoffHours} phone={salon.contact.phone} />
            </div>
          </section>
        )}
        <p className="mt-10 text-[14px] text-[var(--color-text-secondary)]">Règlement au salon : {salon.payWays.join(", ")}. Rien n&apos;est payé en ligne.</p>
        <Link href="/" className="mt-6 inline-block text-[14px] font-semibold text-[var(--color-accent-primary)] underline-offset-4 hover:underline">Retour au salon</Link>
      </div>
    </SalonShell>
  );
}
