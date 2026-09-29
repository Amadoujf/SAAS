import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { withTenant } from "@yamacommerce/database";
import { hasPermission } from "@yamacommerce/auth";
import { requireAutoPage } from "@/lib/auto/guard";
import { IMPORT_LABELS, LEAD_LABELS, SALE_LABELS, STOCK_LABELS, TEST_DRIVE_LABELS, dateLabel, timeIn } from "@/lib/auto/labels";
import { PageHeader, Panel, PanelHeader } from "@/components/yc/panel";
import { Pill } from "@/components/yc/status-pill";
import { VehicleEditor, type VehicleForm } from "@/components/dashboard-auto/vehicle-editor";
import { StockActions } from "@/components/dashboard-auto/stock-actions";

export const metadata: Metadata = { title: "Véhicule — Y-COM", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** Fiche d'un véhicule côté équipe : édition, et tout ce qui le concerne (essais, prospects, dossier, importation). */
export default async function VehiclePage({ params }: { params: { id: string } }) {
  const membership = await requireAutoPage("listings.view");
  if (!/^[0-9a-f-]{36}$/.test(params.id)) notFound();
  const tenantId = membership.tenantId;
  const data = await withTenant(tenantId, async (tx) => {
    const l = await tx.listing.findFirst({ where: { id: params.id, tenantId, type: "vehicle", deletedAt: null }, include: { vehicle: true } });
    if (!l?.vehicle) return null;
    const tz = (await tx.tenant.findUnique({ where: { id: tenantId }, select: { timezone: true } }))?.timezone || "Africa/Dakar";
    return {
      l,
      tz,
      drives: await tx.reservation.findMany({ where: { tenantId, listingId: l.id, moduleKey: "test_drive_appointments" }, include: { customer: true }, orderBy: { startAt: "desc" }, take: 10 }),
      leads: await tx.lead.findMany({ where: { tenantId, listingId: l.id }, include: { customer: true }, orderBy: { updatedAt: "desc" }, take: 10 }),
      sales: await tx.reservation.findMany({ where: { tenantId, listingId: l.id, moduleKey: "vehicle_sales" }, include: { customer: true, vehicleSale: true }, orderBy: { createdAt: "desc" } }),
      imports: await tx.vehicleImport.findMany({ where: { tenantId, listingId: l.id }, orderBy: { createdAt: "desc" } }),
    };
  });
  if (!data) notFound();
  const { l, tz } = data;
  const v = l.vehicle!;
  const can = (p: Parameters<typeof hasPermission>[1]) => hasPermission(membership.permissions, p);
  const form: VehicleForm = {
    make: v.make, model: v.model, version: v.version ?? "", year: String(v.year), mileageKm: String(v.mileageKm), fuel: v.fuel, transmission: v.transmission, bodyType: v.bodyType, condition: v.condition,
    color: v.color ?? "", engine: v.engine ?? "", seats: v.seats ? String(v.seats) : "", features: v.features, negotiable: v.negotiable, vin: v.vin ?? "", plate: v.plate ?? "",
    price: l.price ? String(l.price) : "", summary: l.summary ?? "", description: l.description ?? "", featured: l.featured,
    media: (Array.isArray(l.media) ? (l.media as { url: string; alt?: string; demo?: boolean }[]) : []).map((m) => ({ url: m.url, alt: m.alt ?? "", demo: m.demo })), published: l.status === "published",
  };
  const st = STOCK_LABELS[v.stockStatus]!;
  const row = "flex items-center justify-between gap-3 px-5 py-3 text-sm hover:bg-yc-ivory-50";
  return (
    <>
      <PageHeader eyebrow={<Link href="/dashboard/vehicules" className="hover:underline">Stock</Link>} title={l.title} description={<span className="flex flex-wrap items-center gap-2"><Pill tone={st.tone}>{st.label}</Pill>{l.status === "published" ? <a href={`/vehicules/${l.slug}`} target="_blank" rel="noreferrer" className="font-semibold text-yc-electric hover:underline">Voir sur le site</a> : <span>Brouillon</span>}</span>} />
      <div className="mb-5"><StockActions listingId={l.id} published={l.status === "published"} stockStatus={v.stockStatus} canPublish={can("listings.publish") && v.stockStatus !== "sold"} canEdit={can("listings.edit")} canDelete={can("listings.delete")} /></div>
      <div className="mb-5 grid gap-5 lg:grid-cols-2">
        <Panel className="overflow-hidden">
          <PanelHeader title="Dossier de vente" action={v.stockStatus === "available" && can("reservations.update_status") ? <Link href={`/dashboard/dossiers?vehicule=${l.id}#ouvrir`} className="text-sm font-semibold text-yc-electric hover:underline">Ouvrir un dossier</Link> : undefined} />
          {data.sales.length === 0 ? <p className="px-5 pb-5 text-sm text-yc-ink-soft">Aucun dossier.</p> : (
            <ul className="divide-y divide-yc-ink/[0.06]">{data.sales.map((s) => <li key={s.id}><Link href={`/dashboard/dossiers/${s.id}`} className={row}><span>{s.reference} · {s.customer.firstName} {s.customer.lastName ?? ""}</span><Pill tone={SALE_LABELS[s.status]?.tone ?? "neutral"}>{SALE_LABELS[s.status]?.label ?? s.status}</Pill></Link></li>)}</ul>
          )}
        </Panel>
        <Panel className="overflow-hidden">
          <PanelHeader title="Essais" action={<Link href="/dashboard/essais" className="text-sm font-semibold text-yc-electric hover:underline">Agenda des essais</Link>} />
          {data.drives.length === 0 ? <p className="px-5 pb-5 text-sm text-yc-ink-soft">Aucun essai.</p> : (
            <ul className="divide-y divide-yc-ink/[0.06]">{data.drives.map((d) => <li key={d.id} className={row}><span className="first-letter:uppercase">{dateLabel(d.startAt, tz)} à {timeIn(d.startAt, tz)} · {d.customer.firstName}</span><Pill tone={TEST_DRIVE_LABELS[d.status]?.tone ?? "neutral"}>{TEST_DRIVE_LABELS[d.status]?.label}</Pill></li>)}</ul>
          )}
        </Panel>
        <Panel className="overflow-hidden">
          <PanelHeader title="Prospects intéressés" action={<Link href="/dashboard/prospects" className="text-sm font-semibold text-yc-electric hover:underline">Suivi des prospects</Link>} />
          {data.leads.length === 0 ? <p className="px-5 pb-5 text-sm text-yc-ink-soft">Aucune demande pour ce véhicule.</p> : (
            <ul className="divide-y divide-yc-ink/[0.06]">{data.leads.map((d) => <li key={d.id}><Link href={`/dashboard/prospects?ouvert=${d.id}`} className={row}><span>{d.customer.firstName} {d.customer.lastName ?? ""} · {d.customer.phone}</span><Pill tone={LEAD_LABELS[d.status]?.tone ?? "neutral"}>{LEAD_LABELS[d.status]?.label}</Pill></Link></li>)}</ul>
          )}
        </Panel>
        <Panel className="overflow-hidden">
          <PanelHeader title="Importation" action={can("listings.edit") ? <Link href={`/dashboard/arrivages?vehicule=${l.id}#nouvelle`} className="text-sm font-semibold text-yc-electric hover:underline">Suivre une importation</Link> : undefined} />
          {data.imports.length === 0 ? <p className="px-5 pb-5 text-sm text-yc-ink-soft">Véhicule non importé par la concession.</p> : (
            <ul className="divide-y divide-yc-ink/[0.06]">{data.imports.map((i) => <li key={i.id}><Link href="/dashboard/arrivages" className={row}><span>{i.reference} · {i.origin}</span><Pill tone={IMPORT_LABELS[i.stage]?.tone ?? "neutral"}>{IMPORT_LABELS[i.stage]?.label}</Pill></Link></li>)}</ul>
          )}
        </Panel>
      </div>
      {can("listings.edit") && v.stockStatus !== "sold" ? <VehicleEditor listingId={l.id} initial={form} canPublish={can("listings.publish")} /> : <Panel><p className="p-5 text-sm text-yc-ink-soft">{v.stockStatus === "sold" ? "Véhicule vendu : sa fiche est figée." : "Vous pouvez consulter ce véhicule, pas le modifier."}</p></Panel>}
    </>
  );
}
