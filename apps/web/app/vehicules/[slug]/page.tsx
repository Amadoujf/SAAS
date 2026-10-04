import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { utcToLocal } from "@yamacommerce/database";
import { resolveAuto } from "@/lib/auto/auto-context";
import { loadVehicle, loadVehicles } from "@/lib/auto/auto-data";
import { BODY_LABELS, CONDITION_LABELS, FEATURE_LABELS, FUEL_LABELS, TRANSMISSION_LABELS, formatKm, formatNumber, formatXof } from "@/lib/auto/labels";
import { AutoShell } from "@/components/auto/auto-shell";
import { StockBadge, VehicleCard } from "@/components/auto/vehicle-card";
import { VehicleGallery } from "@/components/auto/vehicle-gallery";
import { TestDriveBooking } from "@/components/auto/test-drive-booking";
import { LeadForm } from "@/components/auto/lead-form";
import { FinancingEstimate } from "@/components/auto/financing-estimate";
import { PublicSiteSuspended } from "@/components/public-site-suspended";
import { PublicSiteBillingSuspended } from "@/components/public-site-billing-suspended";

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const r = await resolveAuto(`/vehicules/${params.slug}`);
  if (r.status !== "ok") return {};
  const v = await loadVehicle(r.auto.tenantId, params.slug);
  return v ? { title: `${v.title} — ${r.auto.tenantName}`, description: v.summary ?? undefined } : {};
}
export const dynamic = "force-dynamic";

/** Fiche d'un véhicule PUBLIÉ : photos, fiche technique, équipements, essai, demande. */
export default async function VehiclePage({ params }: { params: { slug: string } }) {
  const r = await resolveAuto(`/vehicules/${params.slug}`);
  if (r.status === "suspended") return <PublicSiteSuspended tenantName={r.tenantName} />;
  if (r.status === "billing_suspended") return <PublicSiteBillingSuspended tenantName={r.tenantName} />;
  const { auto } = r;
  const v = await loadVehicle(auto.tenantId, params.slug);
  if (!v) notFound();
  const today = utcToLocal(new Date(), auto.timezone).date;
  const similar = (await loadVehicles(auto.tenantId, { bodyType: v.bodyType })).filter((x) => x.id !== v.id).slice(0, 3);
  const specs = [
    { k: "Année", v: String(v.year) },
    { k: "Kilométrage", v: formatKm(v.mileageKm) },
    { k: "Énergie", v: FUEL_LABELS[v.fuel] ?? v.fuel },
    { k: "Boîte", v: TRANSMISSION_LABELS[v.transmission] ?? v.transmission },
    { k: "Carrosserie", v: BODY_LABELS[v.bodyType] ?? v.bodyType },
    { k: "État", v: CONDITION_LABELS[v.condition] ?? v.condition },
    ...(v.engine ? [{ k: "Moteur", v: v.engine }] : []),
    ...(v.color ? [{ k: "Couleur", v: v.color }] : []),
    ...(v.seats ? [{ k: "Places", v: String(v.seats) }] : []),
  ];
  const deposit = v.price && auto.rules.depositPercent ? Math.round((v.price * auto.rules.depositPercent) / 100) : null;
  return (
    <AutoShell auto={auto}>
      <nav aria-label="Fil d'Ariane" className="mx-auto max-w-[var(--content-max-width,1320px)] px-4 pt-6 text-[13px] text-[var(--color-text-muted)] sm:px-8">
        <Link href="/vehicules" className="font-semibold hover:text-[var(--color-text-primary)]">← Tous les véhicules</Link>
      </nav>
      <div className="mx-auto grid max-w-[var(--content-max-width,1320px)] gap-8 px-4 pt-4 sm:px-8 lg:grid-cols-[1.35fr_1fr] lg:gap-12">
        <div className="min-w-0">
          <VehicleGallery images={v.images} title={v.title} />
        </div>
        <div className="min-w-0">
          <StockBadge status={v.stockStatus} />
          <p className="mt-4 text-[13px] font-extrabold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">{v.make}</p>
          <h1 className="text-[38px] font-black leading-[0.95] tracking-[-0.04em] sm:text-[52px]">{v.model}{v.version && <span className="block text-[22px] font-bold tracking-[-0.02em] text-[var(--color-text-secondary)] sm:text-[26px]">{v.version}</span>}</h1>
          <p className="yc-num mt-5 text-[36px] font-black tracking-[-0.03em]">{formatXof(v.price)}</p>
          {v.negotiable && v.price != null && <p className="text-[14px] font-semibold text-[var(--color-text-secondary)]">Prix à débattre au showroom</p>}
          {v.summary && <p className="mt-4 text-[16px] leading-relaxed text-[var(--color-text-secondary)]">{v.summary}</p>}
          <div className="mt-6 flex flex-wrap gap-2">
            {v.stockStatus === "available" && <a href="#essai" className="inline-flex h-13 min-h-[52px] items-center bg-[var(--color-accent-primary)] px-7 text-[14.5px] font-extrabold uppercase tracking-[0.06em] text-[var(--color-primary)]">Réserver un essai</a>}
            <a href="#demande" className="inline-flex min-h-[52px] items-center px-7 text-[14.5px] font-extrabold uppercase tracking-[0.06em] ring-2 ring-inset ring-[var(--color-primary)]">{v.stockStatus === "incoming" ? "Être prévenu à l'arrivée" : "Être rappelé"}</a>
          </div>
          {deposit != null && v.stockStatus === "available" && (
            <p className="mt-4 text-[13.5px] leading-relaxed text-[var(--color-text-muted)]">Pour le réserver : acompte de {auto.rules.depositPercent} % ({formatNumber(deposit)} FCFA) réglé au showroom, avec reçu. Aucun paiement en ligne.</p>
          )}
        </div>
      </div>

      <div className="mx-auto mt-14 grid max-w-[var(--content-max-width,1320px)] gap-10 px-4 sm:px-8 lg:grid-cols-[1.35fr_1fr] lg:gap-12">
        <div className="min-w-0">
          <h2 className="text-[12px] font-extrabold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Fiche technique</h2>
          <dl className="mt-3 grid border-t-2 border-[var(--color-primary)] sm:grid-cols-2">
            {specs.map((s, i) => (
              <div key={s.k} className="grid grid-cols-[36px_1fr_auto] items-baseline gap-3 border-b border-[var(--color-border)] py-3.5 sm:odd:pr-6 sm:even:pl-6">
                <span aria-hidden="true" className="yc-num text-[12px] font-bold text-[var(--color-accent-primary)]">{String(i + 1).padStart(2, "0")}</span>
                <dt className="text-[14px] text-[var(--color-text-secondary)]">{s.k}</dt>
                <dd className="yc-num text-right text-[15.5px] font-extrabold">{s.v}</dd>
              </div>
            ))}
          </dl>
          {v.features.length > 0 && (
            <>
              <h2 className="mt-10 text-[12px] font-extrabold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Équipements</h2>
              <ul className="mt-3 flex flex-wrap gap-2">
                {v.features.map((f) => <li key={f} className="bg-[var(--color-surface)] px-3 py-1.5 text-[14px] font-semibold ring-1 ring-inset ring-[var(--color-border)]">{FEATURE_LABELS[f] ?? f}</li>)}
              </ul>
            </>
          )}
          {v.description && (
            <>
              <h2 className="mt-10 text-[12px] font-extrabold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Le mot du vendeur</h2>
              <p className="mt-3 whitespace-pre-line text-[16px] leading-relaxed text-[var(--color-text-secondary)]">{v.description}</p>
            </>
          )}

          <section id="essai" aria-labelledby="essai-titre" className="mt-14 scroll-mt-24">
            <h2 id="essai-titre" className="text-[30px] font-black uppercase leading-[0.9] tracking-[-0.035em] sm:text-[42px]">Essai sur rendez-vous</h2>
            {v.stockStatus === "available" ? (
              <div className="mt-6"><TestDriveBooking listingId={v.id} today={today} days={auto.rules.maxAdvanceDays} minutes={auto.rules.testDriveMinutes} phone={auto.contact.phone} /></div>
            ) : (
              <p className="mt-4 bg-[var(--color-surface)] p-5 text-[15.5px] ring-1 ring-[var(--color-border)]">
                {v.stockStatus === "incoming" ? "Ce véhicule est en route : l'essai ouvrira dès son arrivée au showroom. Laissez vos coordonnées, nous vous appelons." : "Ce véhicule est réservé par un client. Laissez vos coordonnées : nous vous prévenons s'il se libère, ou vous proposons un modèle proche."}
              </p>
            )}
          </section>
        </div>
        <aside className="grid content-start gap-6">
          {v.price != null && <FinancingEstimate price={v.price} />}
          <section id="demande" aria-labelledby="demande-titre" className="scroll-mt-24 bg-[var(--color-primary)] p-5 text-white sm:p-6">
            <h2 id="demande-titre" className="text-[20px] font-extrabold tracking-[-0.01em]">{v.stockStatus === "incoming" ? "Être prévenu à l'arrivée" : "Une question sur ce véhicule ?"}</h2>
            <div className="mt-5"><LeadForm listingId={v.id} choices={["purchase", "trade_in", "financing"]} dark /></div>
          </section>
        </aside>
      </div>

      {similar.length > 0 && (
        <section aria-labelledby="similaires" className="mx-auto mt-20 max-w-[var(--content-max-width,1320px)] px-4 sm:px-8">
          <h2 id="similaires" className="border-b-2 border-[var(--color-primary)] pb-3 text-[28px] font-black uppercase tracking-[-0.035em] sm:text-[40px]">Dans la même catégorie</h2>
          <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{similar.map((s) => <li key={s.id}><VehicleCard v={s} /></li>)}</ul>
        </section>
      )}
    </AutoShell>
  );
}
