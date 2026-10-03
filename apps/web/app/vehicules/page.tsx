import type { Metadata } from "next";
import Link from "next/link";
import { resolveAuto } from "@/lib/auto/auto-context";
import { filtersFromSearch, loadFacets, loadVehicles } from "@/lib/auto/auto-data";
import { BODY_LABELS, FUEL_LABELS, TRANSMISSION_LABELS, formatNumber } from "@/lib/auto/labels";
import { AutoShell } from "@/components/auto/auto-shell";
import { VehicleCard } from "@/components/auto/vehicle-card";
import { PublicSiteSuspended } from "@/components/public-site-suspended";
import { PublicSiteBillingSuspended } from "@/components/public-site-billing-suspended";

export async function generateMetadata(): Promise<Metadata> {
  const r = await resolveAuto("/vehicules");
  return r.status === "ok" ? { title: `Nos véhicules — ${r.auto.tenantName}` } : {};
}
export const dynamic = "force-dynamic";

const BUDGETS = [5_000_000, 10_000_000, 15_000_000, 20_000_000, 30_000_000, 50_000_000];
const SORTS = [
  { v: "recent", l: "Nouveautés" },
  { v: "price_asc", l: "Prix croissant" },
  { v: "price_desc", l: "Prix décroissant" },
  { v: "year_desc", l: "Plus récents" },
  { v: "km_asc", l: "Moins de kilomètres" },
];

/** Stock public filtrable : filtres dans l'adresse (partageables), fonctionnent sans JavaScript. */
export default async function VehiclesPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const r = await resolveAuto("/vehicules");
  if (r.status === "suspended") return <PublicSiteSuspended tenantName={r.tenantName} />;
  if (r.status === "billing_suspended") return <PublicSiteBillingSuspended tenantName={r.tenantName} />;
  const { auto } = r;
  const filters = filtersFromSearch(searchParams);
  const [vehicles, facets] = await Promise.all([loadVehicles(auto.tenantId, filters), loadFacets(auto.tenantId)]);
  const stock = typeof searchParams.stock === "string" ? searchParams.stock : "";
  const active = [filters.make, filters.fuel, filters.bodyType, filters.transmission, filters.priceMax, filters.yearMin, filters.search, stock].filter(Boolean).length;
  const select = "mt-1 h-11 w-full rounded-none bg-white px-2.5 text-[14.5px] font-semibold ring-1 ring-inset ring-[var(--color-border)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-primary)]";
  const label = "block text-[11px] font-extrabold uppercase tracking-[0.14em] text-[var(--color-text-muted)]";
  const fields = () => (
    <>
              <label className={label}>Recherche<input name="q" defaultValue={filters.search ?? ""} placeholder="Modèle, marque…" className={`${select} font-normal`} /></label>
              <label className={label}>Marque<select name="marque" defaultValue={filters.make ?? ""} className={select}><option value="">Toutes</option>{facets.makes.map((m) => <option key={m}>{m}</option>)}</select></label>
              <label className={label}>Carrosserie<select name="carrosserie" defaultValue={filters.bodyType ?? ""} className={select}><option value="">Toutes</option>{facets.bodyTypes.map((b) => <option key={b} value={b}>{BODY_LABELS[b] ?? b}</option>)}</select></label>
              <label className={label}>Énergie<select name="carburant" defaultValue={filters.fuel ?? ""} className={select}><option value="">Toutes</option>{facets.fuels.map((f) => <option key={f} value={f}>{FUEL_LABELS[f] ?? f}</option>)}</select></label>
              <label className={label}>Boîte<select name="boite" defaultValue={filters.transmission ?? ""} className={select}><option value="">Indifférent</option>{Object.entries(TRANSMISSION_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
              <label className={label}>Budget maximum<select name="prix_max" defaultValue={filters.priceMax ? String(filters.priceMax) : ""} className={select}><option value="">Sans limite</option>{BUDGETS.map((b) => <option key={b} value={b}>{formatNumber(b)} FCFA</option>)}</select></label>
              <label className={label}>Année minimum<select name="annee_min" defaultValue={filters.yearMin ? String(filters.yearMin) : ""} className={select}><option value="">Toutes</option>{facets.yearMin != null && Array.from({ length: new Date().getFullYear() - facets.yearMin + 1 }, (_, i) => new Date().getFullYear() - i).map((y) => <option key={y}>{y}</option>)}</select></label>
              <label className={label}>Disponibilité<select name="stock" defaultValue={stock} className={select}><option value="">Tout</option><option value="disponible">Disponible à l&apos;essai</option><option value="arrivage">En arrivage</option></select></label>
              <label className={label}>Trier par<select name="tri" defaultValue={filters.sort ?? "recent"} className={select}>{SORTS.map((s) => <option key={s.v} value={s.v}>{s.l}</option>)}</select></label>
              <div className="flex gap-2">
                <button type="submit" className="h-12 flex-1 bg-[var(--color-primary)] text-[14px] font-extrabold uppercase tracking-[0.06em] text-white">Appliquer</button>
                {active > 0 && <Link href="/vehicules" className="grid h-12 place-items-center px-4 text-[14px] font-bold ring-1 ring-inset ring-[var(--color-border)]">Effacer</Link>}
              </div>
    </>
  );
  return (
    <AutoShell auto={auto}>
      <div className="bg-[var(--color-primary)] text-white">
        <div className="mx-auto max-w-[var(--content-max-width,1320px)] px-4 pb-8 pt-10 sm:px-8">
          <h1 className="text-[46px] font-black uppercase leading-[0.86] tracking-[-0.045em] sm:text-[76px]">{stock === "arrivage" ? "Arrivages" : "Nos véhicules"}</h1>
          <p className="mt-3 text-[16px] text-white/65"><span className="yc-num font-bold text-white">{vehicles.length}</span> véhicule{vehicles.length > 1 ? "s" : ""}{active ? " correspondant à votre recherche" : ""}. Essai sur rendez-vous, sans engagement.</p>
        </div>
      </div>
      <div className="mx-auto grid max-w-[var(--content-max-width,1320px)] gap-8 px-4 pt-8 sm:px-8 lg:grid-cols-[260px_1fr]">
        <div className="lg:sticky lg:top-24 lg:self-start">
          <details className="group lg:hidden" open={active > 0 ? true : undefined}>
            <summary className="flex h-12 cursor-pointer list-none items-center justify-between bg-white px-4 text-[14px] font-extrabold uppercase tracking-[0.06em] ring-1 ring-inset ring-[var(--color-border)]">Filtrer et trier{active ? ` (${active})` : ""}<span aria-hidden="true" className="transition-transform group-open:rotate-180">▾</span></summary>
            <form method="get" aria-label="Filtrer les véhicules" className="mt-4 grid gap-4">{fields()}</form>
          </details>
          <form method="get" aria-label="Filtrer les véhicules" className="hidden gap-4 lg:grid">{fields()}</form>
        </div>
        <div>
          {vehicles.length === 0 ? (
            <div className="bg-[var(--color-surface)] p-8 ring-1 ring-[var(--color-border)]">
              <p className="text-[20px] font-extrabold">Aucun véhicule ne correspond pour le moment.</p>
              <p className="mt-2 text-[15px] text-[var(--color-text-secondary)]">Élargissez votre recherche, ou demandez-nous de le trouver pour vous.</p>
              <Link href="/#services" className="mt-5 inline-flex h-12 items-center bg-[var(--color-primary)] px-6 text-[14px] font-extrabold uppercase tracking-[0.06em] text-white">Faire une demande</Link>
            </div>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {vehicles.map((v, i) => <li key={v.id}><VehicleCard v={v} priority={i < 3} /></li>)}
            </ul>
          )}
        </div>
      </div>
    </AutoShell>
  );
}
