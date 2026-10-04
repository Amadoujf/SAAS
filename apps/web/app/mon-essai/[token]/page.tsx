import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { resolveAuto } from "@/lib/auto/auto-context";
import { getTestDriveForGuest } from "@/lib/auto/public-pipeline";
import { TEST_DRIVE_LABELS, dateLabel, timeIn } from "@/lib/auto/labels";
import { AutoShell } from "@/components/auto/auto-shell";
import { CancelTestDrive } from "@/components/auto/cancel-test-drive";
import { PublicSiteSuspended } from "@/components/public-site-suspended";
import { PublicSiteBillingSuspended } from "@/components/public-site-billing-suspended";

export const metadata: Metadata = { title: "Mon essai", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** Suivi d'un essai par son jeton : le client ne voit que LE SIEN. */
export default async function TestDriveTrackingPage({ params }: { params: { token: string } }) {
  const r = await resolveAuto(`/mon-essai/${params.token}`);
  if (r.status === "suspended") return <PublicSiteSuspended tenantName={r.tenantName} />;
  if (r.status === "billing_suspended") return <PublicSiteBillingSuspended tenantName={r.tenantName} />;
  const { auto } = r;
  const td = await getTestDriveForGuest(auto.tenantId, params.token);
  if (!td?.listing) notFound();
  const listing = td.listing;
  const tz = auto.timezone;
  const active = ["requested", "confirmed"].includes(td.status) && td.startAt > new Date();
  const img = (Array.isArray(listing.media) ? (listing.media as { url?: string }[]) : [])[0]?.url;
  const whatsapp = auto.contact.whatsapp?.replace(/[^\d]/g, "");
  return (
    <AutoShell auto={auto}>
      <div className="mx-auto max-w-3xl px-4 pt-10 sm:px-8">
        <p className="text-[12px] font-extrabold uppercase tracking-[0.18em] text-[var(--color-accent-primary)]">Essai · {td.reference}</p>
        <h1 className="mt-2 text-[40px] font-black uppercase leading-[0.9] tracking-[-0.04em] sm:text-[58px]">{TEST_DRIVE_LABELS[td.status]?.label ?? td.status}</h1>
        <p className="mt-3 text-[17px] font-medium" aria-live="polite">{TEST_DRIVE_LABELS[td.status]?.guest}</p>

        <div className="mt-8 grid overflow-hidden bg-[var(--color-surface)] ring-1 ring-[var(--color-border)] sm:grid-cols-[240px_1fr]">
          {img && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={img} alt={listing.title} className="aspect-[16/10] h-full w-full object-cover sm:aspect-auto" />
          )}
          <dl className="grid content-center gap-3 p-5 text-[15px]">
            <div><dt className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">Véhicule</dt><dd className="text-[18px] font-extrabold">{listing.title}</dd></div>
            <div><dt className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">Rendez-vous</dt><dd className="yc-num text-[18px] font-extrabold first-letter:uppercase">{dateLabel(td.startAt, tz)} à {timeIn(td.startAt, tz)}</dd></div>
            <div><dt className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">Au nom de</dt><dd>{[td.customer.firstName, td.customer.lastName].filter(Boolean).join(" ")} · {td.customer.phone}</dd></div>
          </dl>
        </div>

        {active && (
          <ul className="mt-8 grid gap-3 text-[15px] leading-relaxed">
            <li className="flex gap-3"><span className="yc-num font-black text-[var(--color-accent-primary)]">01</span>Présentez votre permis de conduire et une pièce d&apos;identité.</li>
            <li className="flex gap-3"><span className="yc-num font-black text-[var(--color-accent-primary)]">02</span>L&apos;essai dure {auto.rules.testDriveMinutes} minutes environ, accompagné d&apos;un conseiller.</li>
            {auto.contact.address && <li className="flex gap-3"><span className="yc-num font-black text-[var(--color-accent-primary)]">03</span>Adresse du showroom : {auto.contact.address}</li>}
          </ul>
        )}

        <div className="mt-10 flex flex-wrap items-start gap-3">
          {active && <CancelTestDrive token={params.token} />}
          {auto.contact.phone && <a href={`tel:${auto.contact.phone.replace(/\s/g, "")}`} className="inline-flex h-12 items-center bg-[var(--color-primary)] px-6 text-[14px] font-bold text-white">Appeler le showroom</a>}
          {whatsapp && <a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noreferrer" className="inline-flex h-12 items-center px-6 text-[14px] font-bold ring-1 ring-inset ring-[var(--color-border)]">WhatsApp</a>}
          <Link href={`/vehicules/${listing.slug}`} className="inline-flex h-12 items-center px-2 text-[14px] font-bold underline-offset-4 hover:underline">Revoir le véhicule</Link>
        </div>
        <p className="mt-8 text-[13px] text-[var(--color-text-muted)]">Gardez ce lien : il vous permet de retrouver et d&apos;annuler votre essai. Personne d&apos;autre ne peut le consulter sans lui.</p>
      </div>
    </AutoShell>
  );
}
