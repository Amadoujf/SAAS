import type { Metadata } from "next";
import Link from "next/link";
import { withTenant, listVehicles } from "@yamacommerce/database";
import { hasPermission } from "@yamacommerce/auth";
import { requireAutoPage } from "@/lib/auto/guard";
import { FUEL_LABELS, STOCK_LABELS, TRANSMISSION_LABELS, formatKm, formatXof } from "@/lib/auto/labels";
import { PageHeader, Panel } from "@/components/yc/panel";
import { Pill } from "@/components/yc/status-pill";
import { ButtonLink } from "@/components/yc/button";
import { EmptyState } from "@/components/yc/empty-state";
import { IconPlus } from "@/components/yc/icons";
import { StockActions } from "@/components/dashboard-auto/stock-actions";

export const metadata: Metadata = { title: "Stock — Y-COM", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const TABS = [
  { key: "", label: "Tout" },
  { key: "available", label: "Disponibles" },
  { key: "incoming", label: "En arrivage" },
  { key: "reserved", label: "Réservés" },
  { key: "sold", label: "Vendus" },
];

/** Stock de la concession : état réel (arrivage, disponible, réservé, vendu) et publication. */
export default async function StockPage({ searchParams }: { searchParams: { etat?: string; q?: string } }) {
  const membership = await requireAutoPage("listings.view");
  const etat = TABS.some((t) => t.key === searchParams.etat) ? searchParams.etat! : "";
  const [vehicles, counts] = await withTenant(membership.tenantId, async (tx) => [
    await listVehicles(tx, membership.tenantId, { stock: etat ? [etat] : undefined, search: searchParams.q?.slice(0, 60) }),
    await tx.vehicleDetails.groupBy({ by: ["stockStatus"], where: { tenantId: membership.tenantId, listing: { deletedAt: null } }, _count: true }),
  ] as const);
  const count = (k: string) => (k ? counts.find((c) => c.stockStatus === k)?._count ?? 0 : counts.reduce((s, c) => s + c._count, 0));
  const can = (p: Parameters<typeof hasPermission>[1]) => hasPermission(membership.permissions, p);
  return (
    <>
      <PageHeader eyebrow="Pilotage" title="Stock" description="Chaque véhicule a un état réel : il passe « réservé » à l'ouverture d'un dossier de vente, « vendu » à la remise des clés." actions={can("listings.create") && <ButtonLink href="/dashboard/vehicules/nouveau" variant="royal"><IconPlus size={18} /> Ajouter un véhicule</ButtonLink>} />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {TABS.map((t) => (
          <Link key={t.key} href={t.key ? `/dashboard/vehicules?etat=${t.key}` : "/dashboard/vehicules"} aria-current={etat === t.key ? "page" : undefined} className="rounded-full bg-white px-3.5 py-1.5 text-sm font-semibold ring-1 ring-yc-ink/10 aria-[current=page]:bg-yc-night-900 aria-[current=page]:text-white">
            {t.label} <span className="yc-num opacity-60">{count(t.key)}</span>
          </Link>
        ))}
        <form className="ml-auto w-full sm:w-64"><input name="q" defaultValue={searchParams.q ?? ""} placeholder="Rechercher un modèle…" aria-label="Rechercher un véhicule" className="h-10 w-full rounded-lg bg-white px-3 text-sm ring-1 ring-inset ring-yc-ink/12" />{etat && <input type="hidden" name="etat" value={etat} />}</form>
      </div>
      {vehicles.length === 0 ? (
        <Panel><EmptyState title="Aucun véhicule ici" description={etat ? "Aucun véhicule dans cet état." : "Ajoutez votre premier véhicule : il apparaîtra sur votre site une fois publié."} /></Panel>
      ) : (
        <ul className="grid gap-3">
          {vehicles.map((l) => {
            const v = l.vehicle!;
            const img = (Array.isArray(l.media) ? (l.media as { url?: string }[]) : [])[0]?.url;
            const st = STOCK_LABELS[v.stockStatus]!;
            return (
              <li key={l.id} className="flex min-w-0 flex-col gap-4 rounded-xl bg-white p-3 ring-1 ring-yc-ink/[0.07] sm:flex-row sm:items-center sm:p-4">
                <Link href={`/dashboard/vehicules/${l.id}`} className="flex min-w-0 flex-1 items-center gap-4">
                  <span className="block h-[68px] w-[108px] shrink-0 overflow-hidden rounded-lg bg-yc-ink/[0.05]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {img && <img src={img} alt="" className="h-full w-full object-cover" />}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{l.title}</span>
                    <span className="block truncate text-sm text-yc-ink-soft">{formatKm(v.mileageKm)} · {FUEL_LABELS[v.fuel]} · {TRANSMISSION_LABELS[v.transmission]}</span>
                    <span className="mt-1 flex flex-wrap gap-1.5"><Pill tone={st.tone}>{st.label}</Pill>{l.status === "published" ? <Pill tone="success" dot={false}>En ligne</Pill> : <Pill tone="neutral" dot={false}>Brouillon</Pill>}</span>
                  </span>
                </Link>
                <span className="yc-num shrink-0 text-[17px] font-bold sm:w-40 sm:text-right">{formatXof(l.price)}</span>
                <div className="shrink-0 sm:w-[250px]"><StockActions listingId={l.id} published={l.status === "published"} stockStatus={v.stockStatus} canPublish={can("listings.publish") && v.stockStatus !== "sold"} canEdit={can("listings.edit")} compact /></div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
