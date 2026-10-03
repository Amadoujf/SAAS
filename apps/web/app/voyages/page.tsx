import type { Metadata } from "next";
import Link from "next/link";
import { withTenant, listTravelPackages, TRIP_TYPES, type TravelSearch as Search } from "@yamacommerce/database";
import { resolveTravel } from "@/lib/travel/travel-context";
import { toTripCard } from "@/lib/travel/travel-cards";
import { TRIP_TYPE_LABELS } from "@/lib/travel/labels";
import { TravelShell } from "@/components/travel/travel-shell";
import { TripCard } from "@/components/travel/trip-card";
import { loadTravelCatalog, searchOptions } from "@/components/travel/travel-home";
import { Reveal } from "@/components/store/reveal";
import { PublicSiteSuspended } from "@/components/public-site-suspended";
import { PublicSiteBillingSuspended } from "@/components/public-site-billing-suspended";

export const metadata: Metadata = { title: "Nos voyages" };

type Params = { type?: string; pays?: string; mois?: string; budget?: string; q?: string };

/** Catalogue des voyages : filtres partageables dans l'adresse (type, destination, mois
 *  de départ, budget). Seuls les voyages publiés apparaissent. */
export default async function TripsPage({ searchParams }: { searchParams: Params }) {
  const r = await resolveTravel("/voyages");
  if (r.status === "suspended") return <PublicSiteSuspended tenantName={r.tenantName} />;
  if (r.status === "billing_suspended") return <PublicSiteBillingSuspended tenantName={r.tenantName} />;
  const { travel } = r;
  const q: Search = {
    publishedOnly: true,
    take: 120,
    tripType: (TRIP_TYPES as readonly string[]).includes(searchParams.type ?? "") ? (searchParams.type as Search["tripType"]) : undefined,
    country: searchParams.pays?.trim().slice(0, 60) || undefined,
    month: /^\d{4}-(0[1-9]|1[0-2])$/.test(searchParams.mois ?? "") ? searchParams.mois : undefined,
    maxPrice: Number(searchParams.budget) > 0 ? Math.floor(Number(searchParams.budget)) : undefined,
    search: searchParams.q?.trim().slice(0, 80) || undefined,
  };
  const [results, catalog] = await Promise.all([withTenant(travel.tenantId, (tx) => listTravelPackages(tx, travel.tenantId, q)), loadTravelCatalog(travel.tenantId)]);
  const { countries, months } = searchOptions(catalog.trips, catalog.departures);
  const title = q.tripType === "pilgrimage" ? "Pèlerinages" : q.tripType === "stay" ? "Séjours" : q.tripType === "circuit" ? "Circuits" : q.tripType === "excursion" ? "Escapades" : "Tous nos voyages";
  const field = "h-11 w-full rounded-[var(--radius-full)] bg-white px-4 text-[14px] ring-1 ring-inset ring-[var(--color-border)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]";
  const filtered = Boolean(q.country || q.month || q.maxPrice || q.search);

  return (
    <TravelShell travel={travel}>
      <section className="bg-[var(--color-surface)]">
        <div className="mx-auto max-w-[var(--content-max-width,1320px)] px-5 pb-10 pt-14 sm:px-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-[var(--color-accent-primary)]">{travel.tenantName}</p>
          <h1 className="mt-3 font-[family-name:var(--font-heading)] text-[44px] leading-tight sm:text-[64px]">{title}</h1>
          <nav aria-label="Types de voyage" className="-mx-5 mt-6 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0">
            {[{ v: "", l: "Tous" }, ...TRIP_TYPES.filter((t) => t !== "cruise").map((t) => ({ v: t, l: TRIP_TYPE_LABELS[t]! }))].map((t) => {
              const active = (q.tripType ?? "") === t.v;
              return (
                <Link key={t.v || "all"} href={t.v ? `/voyages?type=${t.v}` : "/voyages"} aria-current={active ? "page" : undefined} className={`inline-flex h-10 shrink-0 items-center rounded-[var(--radius-full)] px-4 text-[14px] font-semibold ${active ? "bg-[var(--color-primary)] text-white" : "bg-white text-[var(--color-text-secondary)] ring-1 ring-inset ring-[var(--color-border)] hover:text-[var(--color-text-primary)]"}`}>
                  {t.l}
                </Link>
              );
            })}
          </nav>
          <form action="/voyages" role="search" aria-label="Filtrer les voyages" className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {q.tripType && <input type="hidden" name="type" value={q.tripType} />}
            <label className="grid gap-1 text-xs font-semibold">Destination
              <select name="pays" defaultValue={q.country ?? ""} className={field}><option value="">Toutes</option>{countries.map((c) => <option key={c} value={c}>{c}</option>)}</select>
            </label>
            <label className="grid gap-1 text-xs font-semibold">Mois de départ
              <select name="mois" defaultValue={q.month ?? ""} className={field}><option value="">Indifférent</option>{months.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}</select>
            </label>
            <label className="grid gap-1 text-xs font-semibold">Budget max / pers. (FCFA)<input name="budget" inputMode="numeric" defaultValue={q.maxPrice ?? ""} placeholder="Sans limite" className={field} /></label>
            <button type="submit" className="mt-auto h-11 rounded-[var(--radius-full)] bg-[var(--color-primary)] text-[14px] font-semibold text-white">Filtrer</button>
          </form>
        </div>
      </section>
      <section className="mx-auto max-w-[var(--content-max-width,1320px)] px-5 pt-10 sm:px-8">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
          <p className="text-[15px] text-[var(--color-text-secondary)]" role="status">{results.length} voyage{results.length > 1 ? "s" : ""}</p>
          {filtered && <Link href={q.tripType ? `/voyages?type=${q.tripType}` : "/voyages"} className="text-sm font-semibold underline underline-offset-4">Effacer les filtres</Link>}
        </div>
        {results.length === 0 ? (
          <div className="rounded-[var(--radius-lg)] bg-[var(--color-surface)] px-6 py-16 text-center">
            <p className="font-[family-name:var(--font-heading)] text-[30px]">Aucun voyage ne correspond</p>
            <p className="mx-auto mt-2 max-w-md text-[var(--color-text-secondary)]">Élargissez votre recherche, ou demandez un voyage sur mesure à l&apos;agence.</p>
          </div>
        ) : (
          <Reveal as="ul" className="grid gap-x-7 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
            {results.map((t, i) => <li key={t.id}><TripCard trip={toTripCard(t)} priority={i < 3} /></li>)}
          </Reveal>
        )}
      </section>
    </TravelShell>
  );
}
