import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { resolveAuto } from "@/lib/auto/auto-context";
import { getImportForGuest } from "@/lib/auto/public-pipeline";
import { IMPORT_LABELS, IMPORT_STAGES, dateLabel } from "@/lib/auto/labels";
import { AutoShell } from "@/components/auto/auto-shell";
import { PublicSiteSuspended } from "@/components/public-site-suspended";
import { PublicSiteBillingSuspended } from "@/components/public-site-billing-suspended";

export const metadata: Metadata = { title: "Suivi de mon véhicule", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** Suivi d'une importation par son jeton (lien remis par la concession au client). */
export default async function ImportTrackingPage({ params }: { params: { token: string } }) {
  const r = await resolveAuto(`/arrivage/${params.token}`);
  if (r.status === "suspended") return <PublicSiteSuspended tenantName={r.tenantName} />;
  if (r.status === "billing_suspended") return <PublicSiteBillingSuspended tenantName={r.tenantName} />;
  const { auto } = r;
  const imp = await getImportForGuest(auto.tenantId, params.token);
  if (!imp) notFound();
  const tz = auto.timezone;
  const canceled = imp.stage === "canceled";
  const reached = IMPORT_STAGES.indexOf(imp.stage as (typeof IMPORT_STAGES)[number]);
  const at = (s: string) => imp.events.find((e) => e.toStage === s)?.createdAt;
  const img = (Array.isArray(imp.listing.media) ? (imp.listing.media as { url?: string }[]) : [])[0]?.url;
  return (
    <AutoShell auto={auto}>
      <div className="mx-auto max-w-3xl px-4 pt-10 sm:px-8">
        <p className="text-[12px] font-extrabold uppercase tracking-[0.18em] text-[var(--color-accent-primary)]">Importation · {imp.reference}</p>
        <h1 className="mt-2 text-[38px] font-black uppercase leading-[0.9] tracking-[-0.04em] sm:text-[56px]">{imp.listing.title}</h1>
        <p className="mt-3 text-[17px] font-medium" aria-live="polite">{IMPORT_LABELS[imp.stage]?.guest}</p>
        {imp.eta && !canceled && imp.stage !== "ready" && <p className="mt-1 text-[15px] text-[var(--color-text-secondary)]">Arrivée estimée : <span className="first-letter:uppercase">{dateLabel(imp.eta, "UTC")}</span> (estimation, susceptible d&apos;évoluer).</p>}

        {img && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={img} alt={imp.listing.title} className="mt-8 aspect-[16/9] w-full object-cover" />
        )}

        {!canceled && (
          <ol className="relative mt-10 grid gap-0" aria-label="Étapes de l'importation">
            {IMPORT_STAGES.map((s, i) => {
              const done = i <= reached;
              const when = at(s);
              return (
                <li key={s} className="grid grid-cols-[40px_1fr] gap-4 pb-7 last:pb-0">
                  <span className="relative flex justify-center">
                    <span className={`z-10 grid h-9 w-9 place-items-center text-[13px] font-black ${done ? "bg-[var(--color-accent-primary)] text-[var(--color-primary)]" : "bg-[var(--color-surface-muted)] text-[var(--color-text-muted)]"}`}>{String(i + 1).padStart(2, "0")}</span>
                    {i < IMPORT_STAGES.length - 1 && <span aria-hidden="true" className={`absolute top-9 h-[calc(100%+4px)] w-[3px] ${i < reached ? "bg-[var(--color-accent-primary)]" : "bg-[var(--color-surface-muted)]"}`} />}
                  </span>
                  <div className="pt-1.5">
                    <p className={`text-[16.5px] font-extrabold ${done ? "" : "text-[var(--color-text-muted)]"}`}>{IMPORT_LABELS[s]?.guest}{i === reached && <span className="sr-only"> (étape actuelle)</span>}</p>
                    {when && <p className="text-[13.5px] text-[var(--color-text-muted)] first-letter:uppercase">{dateLabel(when, tz)}</p>}
                  </div>
                </li>
              );
            })}
          </ol>
        )}

        <dl className="mt-10 grid gap-3 border-t border-[var(--color-border)] pt-6 text-[15px] sm:grid-cols-3">
          <div><dt className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">Provenance</dt><dd className="font-bold">{imp.origin}</dd></div>
          {imp.vessel && <div><dt className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">Navire</dt><dd className="font-bold">{imp.vessel}</dd></div>}
          {imp.containerRef && <div><dt className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">Conteneur</dt><dd className="yc-num font-bold">{imp.containerRef}</dd></div>}
        </dl>

        <div className="mt-10 flex flex-wrap gap-3">
          {imp.stage === "ready" && imp.listing.status === "published" && <Link href={`/vehicules/${imp.listing.slug}`} className="inline-flex h-12 items-center bg-[var(--color-accent-primary)] px-6 text-[14px] font-extrabold uppercase tracking-[0.06em] text-[var(--color-primary)]">Voir le véhicule</Link>}
          {auto.contact.phone && <a href={`tel:${auto.contact.phone.replace(/\s/g, "")}`} className="inline-flex h-12 items-center bg-[var(--color-primary)] px-6 text-[14px] font-bold text-white">Appeler la concession</a>}
        </div>
        <p className="mt-8 text-[13px] text-[var(--color-text-muted)]">Les étapes sont mises à jour par la concession à chaque avancée réelle. Ce lien est personnel.</p>
      </div>
    </AutoShell>
  );
}
