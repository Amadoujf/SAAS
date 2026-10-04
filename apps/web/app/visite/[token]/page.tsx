import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { resolveEstate } from "@/lib/real-estate/estate-context";
import { getVisitForGuest } from "@/lib/real-estate/public-pipeline";
import { EstateShell } from "@/components/estate/estate-shell";
import { CancelVisitButton } from "@/components/estate/cancel-visit-button";
import { PublicSiteSuspended } from "@/components/public-site-suspended";
import { PublicSiteBillingSuspended } from "@/components/public-site-billing-suspended";

export const metadata: Metadata = { title: "Ma demande de visite", robots: { index: false, follow: false } };

const STATUS: Record<string, { title: string; text: string }> = {
  requested: { title: "Demande envoyée", text: "L'agence a bien reçu votre demande. Elle vous appelle pour confirmer l'horaire : la visite n'est pas encore confirmée." },
  confirmed: { title: "Visite confirmée", text: "L'agence a confirmé votre visite. Elle vous communique l'adresse exacte." },
  completed: { title: "Visite effectuée", text: "Merci de votre visite. L'agence reste à votre disposition." },
  canceled: { title: "Demande annulée", text: "Cette demande de visite est annulée." },
  no_show: { title: "Visite manquée", text: "La visite n'a pas eu lieu. Contactez l'agence pour en fixer une nouvelle." },
};

/** Suivi de SA demande de visite par le visiteur (lien secret reçu après l'envoi). */
export default async function VisitStatusPage({ params }: { params: { token: string } }) {
  const r = await resolveEstate(`/visite/${params.token}`);
  if (r.status === "suspended") return <PublicSiteSuspended tenantName={r.tenantName} />;
  if (r.status === "billing_suspended") return <PublicSiteBillingSuspended tenantName={r.tenantName} />;
  const visit = await getVisitForGuest(r.estate.tenantId, params.token);
  if (!visit) notFound();
  const meta = STATUS[visit.status] ?? STATUS.requested!;
  const when = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Dakar" }).format(visit.startAt);
  const cover = ((Array.isArray(visit.listing?.media) ? visit.listing?.media : []) as { url?: string }[])[0]?.url;
  const cancellable = (visit.status === "requested" || visit.status === "confirmed") && visit.startAt > new Date();
  return (
    <EstateShell estate={r.estate}>
      <div className="mx-auto max-w-2xl px-5 pt-14 sm:px-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[var(--color-accent-primary)]">Demande {visit.reference}</p>
        <h1 className="mt-3 font-[family-name:var(--font-heading)] text-[40px] leading-tight sm:text-[52px]">{meta.title}</h1>
        <p className="mt-4 text-[17px] leading-relaxed text-[var(--color-text-secondary)]">{meta.text}</p>
        <div className="mt-8 overflow-hidden rounded-[var(--radius-lg)] ring-1 ring-[var(--color-border)]">
          {cover && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cover} alt="" className="aspect-[16/8] w-full object-cover" />
          )}
          <dl className="grid gap-4 p-6 sm:grid-cols-2">
            <div><dt className="text-xs uppercase tracking-[0.14em] text-[var(--color-text-muted)]">Bien</dt><dd className="mt-1 font-[family-name:var(--font-heading)] text-xl">{visit.listing ? <Link href={`/biens/${visit.listing.slug}`} className="hover:underline">{visit.listing.title}</Link> : "—"}</dd></div>
            <div><dt className="text-xs uppercase tracking-[0.14em] text-[var(--color-text-muted)]">Date souhaitée</dt><dd className="mt-1 text-[16px] capitalize">{when}</dd></div>
          </dl>
        </div>
        <p className="mt-5 text-sm text-[var(--color-text-muted)]">Gardez ce lien : il vous permet de revoir ou d&apos;annuler votre demande.</p>
        {cancellable && <div className="mt-6"><CancelVisitButton token={params.token} /></div>}
      </div>
    </EstateShell>
  );
}
