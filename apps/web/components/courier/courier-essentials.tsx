import Link from "next/link";
import type { CourierContext } from "@/lib/courier/courier-context";
import { loadZones } from "@/lib/courier/courier-data";
import { formatXof } from "@/lib/courier/labels";
import { RouteLine } from "./courier-shell";

/** Ce que toute société de livraison offre, sous l'accueil : marche à suivre, tarifs par zone, suivi. */
export async function CourierEssentials({ company }: { company: CourierContext }) {
  const zones = await loadZones(company.tenantId);
  return (
    <>
      <section aria-labelledby="comment" className="mx-auto mt-20 max-w-[var(--content-max-width,1240px)] px-4 sm:px-8">
        <h2 id="comment" className="font-[family-name:var(--font-heading)] text-[36px] leading-[1] tracking-[-0.02em] sm:text-[52px]">Du retrait à la remise</h2>
        <RouteLine className="mx-2 mt-6 hidden h-14 sm:block" />
        <ol className="mt-4 grid gap-6 sm:grid-cols-4">
          {[
            { t: "Vous demandez", d: "Adresse de retrait, destinataire, format du colis. Le tarif s'affiche avant l'envoi." },
            { t: "Un livreur passe", d: "Il prend le colis chez vous ; vous suivez chaque étape depuis votre lien." },
            { t: "Remise avec code", d: "Le destinataire donne son code à 4 chiffres : c'est la preuve de remise." },
            { t: "Argent reversé", d: "Ce qui est encaissé pour vous vous est reversé, tarifs déduits, avec un reçu." },
          ].map((s, i) => (
            <li key={s.t} className="rounded-[var(--radius-lg)] bg-[var(--color-surface)] p-5 ring-1 ring-[var(--color-border)]">
              <span className="yc-num font-[family-name:var(--font-heading)] text-[34px] leading-none text-[var(--color-accent-secondary)]">{String(i + 1).padStart(2, "0")}</span>
              <h3 className="mt-3 text-[18px] font-bold">{s.t}</h3>
              <p className="mt-1 text-[15px] leading-relaxed text-[var(--color-text-secondary)]">{s.d}</p>
            </li>
          ))}
        </ol>
      </section>

      {zones.length > 0 && (
        <section id="tarifs" aria-labelledby="tarifs-titre" className="mx-auto mt-20 max-w-[var(--content-max-width,1240px)] scroll-mt-20 px-4 sm:px-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 id="tarifs-titre" className="font-[family-name:var(--font-heading)] text-[36px] leading-[1] tracking-[-0.02em] sm:text-[52px]">Tarifs par zone</h2>
            <p className="text-[14px] text-[var(--color-text-muted)]">Petit colis. Moyen : +{formatXof(company.rules.mediumSurcharge)} · Grand : +{formatXof(company.rules.largeSurcharge)}</p>
          </div>
          <ul className="mt-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {zones.map((z) => (
              <li key={z.id} className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] bg-[var(--color-surface)] px-5 py-4 ring-1 ring-[var(--color-border)]">
                <span className="min-w-0"><span className="block truncate font-semibold">{z.label}</span>{z.estimatedDays != null && <span className="text-[13px] text-[var(--color-text-muted)]">{z.estimatedDays === 0 ? "Dans la journée" : `${z.estimatedDays} j`}</span>}</span>
                <span className="yc-num shrink-0 font-[family-name:var(--font-heading)] text-[22px]">{formatXof(z.fee)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-label="Suivre un colis" className="mx-auto mt-20 max-w-[var(--content-max-width,1240px)] px-4 sm:px-8">
        <div className="flex flex-col items-start justify-between gap-5 rounded-[var(--radius-lg)] bg-[var(--color-accent-primary)] p-6 sm:flex-row sm:items-center sm:p-8">
          <p className="font-[family-name:var(--font-heading)] text-[28px] leading-tight text-[var(--color-primary)] sm:text-[34px]">Un colis en route ? Suivez-le.</p>
          <Link href="/suivre" className="inline-flex h-12 items-center rounded-full bg-[var(--color-primary)] px-6 text-[15px] font-bold text-white">Suivre un colis</Link>
        </div>
      </section>
    </>
  );
}
