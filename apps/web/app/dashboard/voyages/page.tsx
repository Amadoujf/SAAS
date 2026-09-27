import Link from "next/link";
import type { Metadata } from "next";
import { hasPermission } from "@yamacommerce/auth";
import { withTenant, listTravelPackages, resolveEffectiveLimit, countQuotaUsage } from "@yamacommerce/database";
import { requireTravelPage } from "@/lib/travel/guard";
import { TRIP_TYPE_LABELS, durationLabel, formatShortDate, formatTripPrice } from "@/lib/travel/labels";
import { LISTING_STATUS_LABELS } from "@/lib/real-estate/labels";
import { destinationOf } from "@/lib/travel/travel-cards";
import { PageHeader, Panel } from "@/components/yc/panel";
import { ButtonLink } from "@/components/yc/button";
import { Pill } from "@/components/yc/status-pill";
import { EmptyState } from "@/components/yc/empty-state";
import { IconPlus, IconMapPin } from "@/components/yc/icons";

export const metadata: Metadata = { title: "Voyages — Y-COM", robots: { index: false, follow: false } };

const FILTERS = [
  { key: "", label: "Tous" },
  { key: "published", label: "En ligne" },
  { key: "draft", label: "Brouillons" },
  { key: "unavailable", label: "Retirés" },
  { key: "archived", label: "Archivés" },
] as const;

/** Voyages de l'agence : statut de publication, prochains départs et remplissage, quota de fiches. */
export default async function TripsDashboardPage({ searchParams }: { searchParams: { statut?: string; q?: string } }) {
  const membership = await requireTravelPage("listings.view");
  const status = FILTERS.some((f) => f.key && f.key === searchParams.statut) ? (searchParams.statut as "published") : undefined;
  const search = searchParams.q?.trim().slice(0, 80) || undefined;
  const { trips, limit, used } = await withTenant(membership.tenantId, async (tx) => ({
    trips: await listTravelPackages(tx, membership.tenantId, { status, search, take: 200 }),
    limit: await resolveEffectiveLimit(tx, membership.tenantId, "records"),
    used: await countQuotaUsage(tx, membership.tenantId, "records"),
  }));
  const canCreate = hasPermission(membership.permissions, "listings.create");

  return (
    <>
      <PageHeader
        eyebrow="Pilotage"
        title="Voyages"
        description={limit === null ? `${used} fiche${used > 1 ? "s" : ""}.` : `${used} / ${limit} fiches incluses dans votre formule.`}
        actions={canCreate ? <ButtonLink href="/dashboard/voyages/nouveau" variant="royal"><IconPlus size={18} /> Nouveau voyage</ButtonLink> : undefined}
      />
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <nav aria-label="Filtrer par statut" className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
          {FILTERS.map((f) => {
            const active = (searchParams.statut ?? "") === f.key;
            return <Link key={f.key} href={f.key ? `/dashboard/voyages?statut=${f.key}` : "/dashboard/voyages"} aria-current={active ? "page" : undefined} className={`shrink-0 rounded-full px-3.5 py-2 text-sm font-medium transition-colors ${active ? "bg-yc-night-900 text-white" : "bg-white text-yc-ink-soft ring-1 ring-yc-ink/10 hover:text-yc-ink"}`}>{f.label}</Link>;
          })}
        </nav>
        <form action="/dashboard/voyages" className="flex gap-2">
          {searchParams.statut && <input type="hidden" name="statut" value={searchParams.statut} />}
          <input name="q" defaultValue={search ?? ""} placeholder="Rechercher un voyage" aria-label="Rechercher un voyage" className="h-10 w-full min-w-0 rounded-lg bg-white px-3 text-sm ring-1 ring-inset ring-yc-ink/12 lg:w-64" />
          <button type="submit" className="h-10 shrink-0 rounded-lg bg-yc-night-900 px-4 text-sm font-semibold text-white">Filtrer</button>
        </form>
      </div>

      {trips.length === 0 ? (
        <Panel>
          <EmptyState
            title={status || search ? "Aucun voyage ne correspond" : "Créez votre premier voyage"}
            description={status || search ? "Modifiez les filtres pour voir d'autres voyages." : "Circuit, séjour, pèlerinage : chaque voyage a son programme, ses départs et ses places, réservables depuis votre site."}
            action={canCreate && !(status || search) ? <ButtonLink href="/dashboard/voyages/nouveau" variant="royal"><IconPlus size={18} /> Nouveau voyage</ButtonLink> : undefined}
          />
        </Panel>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {trips.map((t) => {
            const cover = Array.isArray(t.media) ? (t.media[0] as { url?: string } | undefined) : undefined;
            const meta = LISTING_STATUS_LABELS[t.status] ?? LISTING_STATUS_LABELS.draft!;
            const seats = t.availabilities.reduce((s, a) => s + a.capacity, 0);
            const sold = t.availabilities.reduce((s, a) => s + a.reservedCount, 0);
            const next = t.availabilities[0];
            return (
              <li key={t.id}>
                <Link href={`/dashboard/voyages/${t.id}`} className="yc-focus group block overflow-hidden rounded-xl bg-white shadow-[0_1px_2px_rgb(12_22_48/0.04),0_8px_24px_-16px_rgb(12_22_48/0.12)] ring-1 ring-yc-ink/[0.07] transition-shadow hover:shadow-[0_14px_32px_-14px_rgb(12_22_48/0.28)]">
                  <span className="relative block aspect-[16/9] overflow-hidden bg-yc-ivory-100">
                    {cover?.url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={cover.url} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.04]" />
                    ) : <span className="grid h-full place-items-center text-sm text-yc-ink-soft">Aucune photo</span>}
                    <span className="absolute left-3 top-3 rounded-full bg-white/95 px-2.5 py-1 text-[12px] font-semibold">{TRIP_TYPE_LABELS[t.travel?.tripType ?? ""] ?? "Voyage"}</span>
                  </span>
                  <span className="block p-4">
                    <span className="flex items-start justify-between gap-3">
                      <span className="min-w-0 font-semibold leading-snug">{t.title}</span>
                      <Pill tone={meta.tone}>{meta.label}</Pill>
                    </span>
                    <span className="yc-num mt-1.5 block text-[16px] font-bold">{formatTripPrice(t.price, t.priceUnit)}</span>
                    <span className="mt-1 flex items-center gap-1 text-sm text-yc-ink-soft"><IconMapPin size={14} /> {destinationOf(t.travel)} · {t.travel ? durationLabel(t.travel.durationDays, t.travel.durationNights) : ""}</span>
                    <span className="mt-3 flex items-center justify-between border-t border-yc-ink/[0.06] pt-3 text-sm">
                      <span className="text-yc-ink-soft">{next ? `Prochain départ : ${formatShortDate(next.startAt)}` : "Aucun départ à venir"}</span>
                      {seats > 0 && <span className="yc-num font-semibold">{sold} / {seats} places</span>}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
