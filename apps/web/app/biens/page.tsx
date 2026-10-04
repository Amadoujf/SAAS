import type { Metadata } from "next";
import Link from "next/link";
import { withTenant, listProperties, PROPERTY_TYPES, type PropertySearch } from "@yamacommerce/database";
import { resolveEstate } from "@/lib/real-estate/estate-context";
import { toEstateCard } from "@/lib/real-estate/estate-cards";
import { PROPERTY_TYPE_LABELS } from "@/lib/real-estate/labels";
import { EstateShell } from "@/components/estate/estate-shell";
import { PropertyCard } from "@/components/estate/property-card";
import { Reveal } from "@/components/store/reveal";
import { PublicSiteSuspended } from "@/components/public-site-suspended";
import { PublicSiteBillingSuspended } from "@/components/public-site-billing-suspended";

export const metadata: Metadata = { title: "Nos biens" };

type Params = { transaction?: string; type?: string; commune?: string; chambres?: string; budget?: string; q?: string };

/** Recherche de biens : filtres partageables dans l'adresse (transaction, type,
 *  commune, chambres, budget). Seuls les biens publiés apparaissent. */
export default async function PropertiesSearchPage({ searchParams }: { searchParams: Params }) {
  const r = await resolveEstate("/biens");
  if (r.status === "suspended") return <PublicSiteSuspended tenantName={r.tenantName} />;
  if (r.status === "billing_suspended") return <PublicSiteBillingSuspended tenantName={r.tenantName} />;
  const { estate } = r;
  const q: PropertySearch = {
    publishedOnly: true,
    take: 120,
    dealType: searchParams.transaction === "sale" || searchParams.transaction === "rent" ? searchParams.transaction : undefined,
    propertyType: (PROPERTY_TYPES as readonly string[]).includes(searchParams.type ?? "") ? (searchParams.type as PropertySearch["propertyType"]) : undefined,
    commune: searchParams.commune?.trim().slice(0, 60) || undefined,
    minBedrooms: Number(searchParams.chambres) > 0 ? Math.min(10, Math.floor(Number(searchParams.chambres))) : undefined,
    maxPrice: Number(searchParams.budget) > 0 ? Math.floor(Number(searchParams.budget)) : undefined,
    search: searchParams.q?.trim().slice(0, 80) || undefined,
  };
  const results = await withTenant(estate.tenantId, (tx) => listProperties(tx, estate.tenantId, q));
  const title = q.dealType === "sale" ? "Biens à vendre" : q.dealType === "rent" ? "Biens à louer" : "Tous nos biens";
  const field = "h-11 w-full rounded-[var(--radius-md)] bg-white px-3 text-[14px] ring-1 ring-inset ring-[var(--color-border)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]";
  const filtered = Boolean(q.propertyType || q.commune || q.minBedrooms || q.maxPrice || q.search);

  return (
    <EstateShell estate={estate}>
      <section className="border-b border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="mx-auto max-w-[var(--content-max-width,1320px)] px-5 pb-10 pt-14 sm:px-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[var(--color-accent-primary)]">{estate.tenantName}</p>
          <h1 className="mt-3 font-[family-name:var(--font-heading)] text-[40px] leading-tight sm:text-[56px]">{title}</h1>
          <form action="/biens" role="search" aria-label="Filtrer les biens" className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <label className="grid gap-1 text-xs font-semibold">Projet
              <select name="transaction" defaultValue={q.dealType ?? ""} className={field}><option value="">Acheter ou louer</option><option value="sale">Acheter</option><option value="rent">Louer</option></select>
            </label>
            <label className="grid gap-1 text-xs font-semibold">Type
              <select name="type" defaultValue={q.propertyType ?? ""} className={field}><option value="">Tous</option>{PROPERTY_TYPES.map((t) => <option key={t} value={t}>{PROPERTY_TYPE_LABELS[t]}</option>)}</select>
            </label>
            <label className="grid gap-1 text-xs font-semibold">Commune<input name="commune" defaultValue={q.commune ?? ""} placeholder="Almadies" className={field} /></label>
            <label className="grid gap-1 text-xs font-semibold">Chambres
              <select name="chambres" defaultValue={q.minBedrooms ? String(q.minBedrooms) : ""} className={field}><option value="">Indifférent</option>{[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n} et plus</option>)}</select>
            </label>
            <label className="grid gap-1 text-xs font-semibold">Budget max (FCFA)<input name="budget" inputMode="numeric" defaultValue={q.maxPrice ?? ""} placeholder="Sans limite" className={field} /></label>
            <button type="submit" className="mt-auto h-11 rounded-[var(--radius-md)] bg-[var(--color-primary)] text-[14px] font-semibold text-white">Filtrer</button>
          </form>
        </div>
      </section>
      <section className="mx-auto max-w-[var(--content-max-width,1320px)] px-5 pt-10 sm:px-8">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
          <p className="text-[15px] text-[var(--color-text-secondary)]" role="status">{results.length} bien{results.length > 1 ? "s" : ""}</p>
          {filtered && <Link href={q.dealType ? `/biens?transaction=${q.dealType}` : "/biens"} className="text-sm font-semibold underline underline-offset-4">Effacer les filtres</Link>}
        </div>
        {results.length === 0 ? (
          <div className="rounded-[var(--radius-lg)] bg-[var(--color-surface)] px-6 py-16 text-center">
            <p className="font-[family-name:var(--font-heading)] text-[28px]">Aucun bien ne correspond</p>
            <p className="mx-auto mt-2 max-w-md text-[var(--color-text-secondary)]">Élargissez votre recherche, ou appelez l&apos;agence : de nouveaux biens arrivent chaque semaine.</p>
          </div>
        ) : (
          <Reveal as="ul" className="grid gap-x-7 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
            {results.map((l, i) => <li key={l.id}><PropertyCard card={toEstateCard(l)} priority={i < 3} /></li>)}
          </Reveal>
        )}
      </section>
    </EstateShell>
  );
}
