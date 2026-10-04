import Link from "next/link";
import type { Metadata } from "next";
import { hasPermission } from "@yamacommerce/auth";
import { withTenant, listProperties, resolveEffectiveLimit, countQuotaUsage } from "@yamacommerce/database";
import { requireRealEstatePage } from "@/lib/real-estate/guard";
import { DEAL_TYPE_LABELS, LISTING_STATUS_LABELS, PROPERTY_TYPE_LABELS, formatPropertyPrice, propertyFacts } from "@/lib/real-estate/labels";
import { PageHeader, Panel } from "@/components/yc/panel";
import { ButtonLink } from "@/components/yc/button";
import { Pill } from "@/components/yc/status-pill";
import { EmptyState } from "@/components/yc/empty-state";
import { IconPlus, IconMapPin } from "@/components/yc/icons";

export const metadata: Metadata = { title: "Biens — Y-COM", robots: { index: false, follow: false } };

const FILTERS = [
  { key: "", label: "Tous" },
  { key: "published", label: "En ligne" },
  { key: "draft", label: "Brouillons" },
  { key: "unavailable", label: "Indisponibles" },
  { key: "archived", label: "Archivés" },
] as const;

/** Biens de l'agence : vente et location, statut de publication, quota de fiches. */
export default async function PropertiesPage({ searchParams }: { searchParams: { statut?: string; transaction?: string; q?: string } }) {
  const membership = await requireRealEstatePage("listings.view");
  const status = FILTERS.some((f) => f.key && f.key === searchParams.statut) ? (searchParams.statut as "published") : undefined;
  const dealType = searchParams.transaction === "sale" || searchParams.transaction === "rent" ? searchParams.transaction : undefined;
  const search = searchParams.q?.trim().slice(0, 80) || undefined;
  const { properties, limit, used } = await withTenant(membership.tenantId, async (tx) => ({
    properties: await listProperties(tx, membership.tenantId, { status, dealType, search, take: 200, featuredFirst: false }),
    limit: await resolveEffectiveLimit(tx, membership.tenantId, "records"),
    used: await countQuotaUsage(tx, membership.tenantId, "records"),
  }));
  const canCreate = hasPermission(membership.permissions, "listings.create");
  const qs = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams(Object.entries({ statut: searchParams.statut, transaction: searchParams.transaction, q: searchParams.q, ...patch }).filter((e): e is [string, string] => !!e[1]));
    const s = p.toString();
    return s ? `/dashboard/biens?${s}` : "/dashboard/biens";
  };

  return (
    <>
      <PageHeader
        eyebrow="Pilotage"
        title="Biens"
        description={limit === null ? `${used} fiche${used > 1 ? "s" : ""}.` : `${used} / ${limit} fiches incluses dans votre formule.`}
        actions={canCreate ? <ButtonLink href="/dashboard/biens/nouveau" variant="royal"><IconPlus size={18} /> Ajouter un bien</ButtonLink> : undefined}
      />
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <nav aria-label="Filtrer par statut" className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
          {FILTERS.map((f) => {
            const active = (searchParams.statut ?? "") === f.key;
            return <Link key={f.key} href={qs({ statut: f.key || undefined })} aria-current={active ? "page" : undefined} className={`shrink-0 rounded-full px-3.5 py-2 text-sm font-medium transition-colors ${active ? "bg-yc-night-900 text-white" : "bg-white text-yc-ink-soft ring-1 ring-yc-ink/10 hover:text-yc-ink"}`}>{f.label}</Link>;
          })}
        </nav>
        <form action="/dashboard/biens" className="flex gap-2">
          {searchParams.statut && <input type="hidden" name="statut" value={searchParams.statut} />}
          <select name="transaction" defaultValue={dealType ?? ""} aria-label="Transaction" className="h-10 rounded-lg bg-white px-3 text-sm ring-1 ring-inset ring-yc-ink/12">
            <option value="">Vente et location</option>
            <option value="sale">À vendre</option>
            <option value="rent">À louer</option>
          </select>
          <input name="q" defaultValue={search ?? ""} placeholder="Rechercher un bien" aria-label="Rechercher un bien" className="h-10 w-full min-w-0 rounded-lg bg-white px-3 text-sm ring-1 ring-inset ring-yc-ink/12 lg:w-56" />
          <button type="submit" className="h-10 shrink-0 rounded-lg bg-yc-night-900 px-4 text-sm font-semibold text-white">Filtrer</button>
        </form>
      </div>

      {properties.length === 0 ? (
        <Panel>
          <EmptyState
            title={status || dealType || search ? "Aucun bien ne correspond" : "Ajoutez votre premier bien"}
            description={status || dealType || search ? "Modifiez les filtres pour voir d'autres biens." : "Villa, appartement, terrain : chaque bien a sa fiche, ses photos et reçoit des demandes de visite dès sa mise en ligne."}
            action={canCreate && !(status || dealType || search) ? <ButtonLink href="/dashboard/biens/nouveau" variant="royal"><IconPlus size={18} /> Ajouter un bien</ButtonLink> : undefined}
          />
        </Panel>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {properties.map((p) => {
            const cover = Array.isArray(p.media) ? (p.media[0] as { url?: string; alt?: string } | undefined) : undefined;
            const meta = LISTING_STATUS_LABELS[p.status] ?? LISTING_STATUS_LABELS.draft!;
            const loc = p.location as { commune?: string; neighborhood?: string } | null;
            return (
              <li key={p.id}>
                <Link href={`/dashboard/biens/${p.id}`} className="yc-focus group block overflow-hidden rounded-xl bg-white shadow-[0_1px_2px_rgb(12_22_48/0.04),0_8px_24px_-16px_rgb(12_22_48/0.12)] ring-1 ring-yc-ink/[0.07] transition-shadow hover:shadow-[0_14px_32px_-14px_rgb(12_22_48/0.28)]">
                  <span className="relative block aspect-[16/10] overflow-hidden bg-yc-ivory-100">
                    {cover?.url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={cover.url} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.04]" />
                    ) : <span className="grid h-full place-items-center text-sm text-yc-ink-soft">Aucune photo</span>}
                    <span className="absolute left-3 top-3 rounded-full bg-white/95 px-2.5 py-1 text-[12px] font-semibold">{DEAL_TYPE_LABELS[p.property?.dealType ?? "sale"]}</span>
                  </span>
                  <span className="block p-4">
                    <span className="flex items-start justify-between gap-3">
                      <span className="min-w-0 font-semibold leading-snug">{p.title}</span>
                      <Pill tone={meta.tone}>{meta.label}</Pill>
                    </span>
                    <span className="yc-num mt-1.5 block text-[17px] font-bold">{formatPropertyPrice(p.price, p.priceUnit)}</span>
                    <span className="mt-1 flex flex-wrap items-center gap-x-2 text-sm text-yc-ink-soft">
                      <span>{PROPERTY_TYPE_LABELS[p.property?.propertyType ?? ""] ?? "Bien"}</span>
                      {p.property && propertyFacts(p.property) && <span>· {propertyFacts(p.property)}</span>}
                    </span>
                    {loc?.commune && <span className="mt-1.5 flex items-center gap-1 text-sm text-yc-ink-soft"><IconMapPin size={14} /> {[loc.neighborhood, loc.commune].filter(Boolean).join(", ")}</span>}
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
