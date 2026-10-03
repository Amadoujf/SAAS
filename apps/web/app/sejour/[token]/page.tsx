import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { resolveHotel } from "@/lib/hotel/hotel-context";
import { getStayForGuest } from "@/lib/hotel/public-pipeline";
import { STAY_STATUS_LABELS, clockLabel, dateOnly, formatXof, guestsLabel, longDate, nightsLabel, shortDate } from "@/lib/hotel/labels";
import { HotelShell } from "@/components/hotel/hotel-shell";
import { CancelStayButton } from "@/components/hotel/cancel-stay-button";
import { PublicSiteSuspended } from "@/components/public-site-suspended";
import { PublicSiteBillingSuspended } from "@/components/public-site-billing-suspended";

export const metadata: Metadata = { title: "Mon séjour", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** Suivi d'un séjour par son jeton : le client ne voit que LE SIEN. */
export default async function StayPage({ params }: { params: { token: string } }) {
  const r = await resolveHotel(`/sejour/${params.token}`);
  if (r.status === "suspended") return <PublicSiteSuspended tenantName={r.tenantName} />;
  if (r.status === "billing_suspended") return <PublicSiteBillingSuspended tenantName={r.tenantName} />;
  const { hotel } = r;
  const s = await getStayForGuest(hotel.tenantId, params.token);
  if (!s?.stay) notFound();
  const st = STAY_STATUS_LABELS[s.status] ?? STAY_STATUS_LABELS.requested!;
  const active = s.status === "requested" || s.status === "confirmed";
  const paid = s.payments.filter((p) => !p.voidedAt).reduce((sum, p) => sum + p.amount, 0);
  const canCancel = active && !s.stay.checkedInAt && paid === 0 && s.startAt.getTime() - Date.now() >= hotel.rules.cancelFreeHours * 3600_000;
  const rt = s.listing?.roomType;
  const nightly = (Array.isArray(s.stay.nightly) ? s.stay.nightly : []) as { date: string; price: number }[];
  const deposit = rt?.depositPercent && s.totalAmount ? Math.ceil((s.totalAmount * rt.depositPercent) / 100) : 0;
  return (
    <HotelShell hotel={hotel}>
      <div className="mx-auto max-w-3xl px-5 pt-12 sm:px-8">
        <p className="text-[12px] font-semibold uppercase tracking-[0.26em] text-[var(--color-accent-secondary)]">Séjour {s.reference}</p>
        <h1 className="mt-3 font-[family-name:var(--font-heading)] text-[44px] leading-none sm:text-[58px]">{s.status === "canceled" ? "Séjour annulé" : s.status === "requested" ? "Demande envoyée" : s.status === "completed" ? "Merci de votre séjour" : "Nous vous attendons"}</h1>
        <p className="mt-4 text-[16px] text-[var(--color-text-secondary)]">{st.guest}</p>
        <article className={`mt-10 overflow-hidden rounded-[var(--radius-lg)] bg-white shadow-[var(--shadow-md)] ring-1 ring-[var(--color-border)] ${s.status === "canceled" ? "opacity-60" : ""}`}>
          <div className="grid gap-6 bg-[var(--color-primary)] px-6 py-7 text-white sm:grid-cols-2 sm:px-8">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/60">Arrivée</p>
              <p className="mt-1 font-[family-name:var(--font-heading)] text-[26px] leading-tight first-letter:uppercase">{longDate(dateOnly(s.stay.arrival))}</p>
              {rt && <p className="text-[14px] text-white/70">à partir de {clockLabel(rt.checkInMinute)}</p>}
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/60">Départ</p>
              <p className="mt-1 font-[family-name:var(--font-heading)] text-[26px] leading-tight first-letter:uppercase">{longDate(dateOnly(s.stay.departure))}</p>
              {rt && <p className="text-[14px] text-white/70">avant {clockLabel(rt.checkOutMinute)}</p>}
            </div>
          </div>
          <dl className="grid gap-4 px-6 py-6 text-[15px] sm:grid-cols-3 sm:px-8">
            <div><dt className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">Chambre</dt><dd className="mt-1 font-semibold">{s.listing?.title}</dd></div>
            <div><dt className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">Séjour</dt><dd className="mt-1 font-semibold">{nightsLabel(s.stay.nights)} · {guestsLabel(s.stay.adults, s.stay.children)}</dd></div>
            <div><dt className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">Statut</dt><dd className="mt-1 font-semibold">{st.label}</dd></div>
          </dl>
          <div className="border-t border-[var(--color-border)] px-6 py-5 text-[14.5px] sm:px-8">
            {nightly.length <= 10 && nightly.map((n) => <p key={n.date} className="flex justify-between text-[var(--color-text-secondary)]"><span>Nuit du {shortDate(n.date)}</span><span className="tabular-nums">{formatXof(n.price)}</span></p>)}
            <p className="mt-2 flex items-baseline justify-between border-t border-[var(--color-border)] pt-2"><span className="font-semibold">Total</span><span className="font-[family-name:var(--font-heading)] text-[24px]">{s.totalAmount == null ? "Sur demande" : formatXof(s.totalAmount)}</span></p>
            <p className="mt-1 flex justify-between text-[var(--color-text-secondary)]"><span>Déjà réglé</span><span className="tabular-nums">{formatXof(paid)}</span></p>
            {deposit > 0 && paid < deposit && active && <p className="mt-3 rounded-[var(--radius-sm)] bg-[var(--color-surface)] px-3 py-2">Acompte demandé : <strong>{formatXof(deposit)}</strong>. L&apos;établissement vous indique comment le régler ({hotel.payWays.join(", ")}).</p>}
          </div>
        </article>
        {active && (
          <section aria-labelledby="modifier" className="mt-10">
            <h2 id="modifier" className="font-[family-name:var(--font-heading)] text-[30px]">Un changement de programme ?</h2>
            <div className="mt-4">
              {canCancel ? <CancelStayButton token={params.token} /> : <p className="text-[15px] text-[var(--color-text-secondary)]">Pour modifier ou annuler ce séjour, contactez l&apos;établissement{hotel.contact.phone ? ` au ${hotel.contact.phone}` : ""}.</p>}
            </div>
          </section>
        )}
        <Link href="/" className="mt-10 inline-block text-[14px] font-semibold text-[var(--color-accent-primary)] underline-offset-4 hover:underline">Retour à l&apos;accueil</Link>
      </div>
    </HotelShell>
  );
}
