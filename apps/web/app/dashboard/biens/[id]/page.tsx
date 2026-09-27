import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { hasPermission } from "@yamacommerce/auth";
import { withTenant } from "@yamacommerce/database";
import { requireRealEstatePage } from "@/lib/real-estate/guard";
import { LISTING_STATUS_LABELS } from "@/lib/real-estate/labels";
import { formatDate } from "@/lib/format";
import { PageHeader, Panel, PanelHeader } from "@/components/yc/panel";
import { Pill } from "@/components/yc/status-pill";
import { IconArrowLeft } from "@/components/yc/icons";
import { PropertyEditor, type PropertyDraft } from "@/components/dashboard-real-estate/property-editor";

export const metadata: Metadata = { title: "Bien — Y-COM", robots: { index: false, follow: false } };

export default async function PropertyPage({ params }: { params: { id: string } }) {
  const membership = await requireRealEstatePage("listings.view");
  const data = await withTenant(membership.tenantId, async (tx) => {
    const listing = await tx.listing.findFirst({ where: { id: params.id, tenantId: membership.tenantId, type: "property", deletedAt: null }, include: { property: true } });
    if (!listing) return null;
    return {
      listing,
      visits: await tx.reservation.count({ where: { tenantId: membership.tenantId, listingId: listing.id, moduleKey: "visit_requests" } }),
      lease: await tx.lease.findFirst({ where: { tenantId: membership.tenantId, listingId: listing.id, status: "active" }, select: { reference: true } }),
      revisions: await tx.listingRevision.findMany({ where: { tenantId: membership.tenantId, listingId: listing.id }, orderBy: { changedAt: "desc" }, take: 5, select: { id: true, changedAt: true } }),
    };
  });
  if (!data?.listing.property) notFound();
  const { listing, visits, lease, revisions } = data;
  const d = listing.property!;
  const loc = (listing.location ?? {}) as PropertyDraft["location"];
  const meta = LISTING_STATUS_LABELS[listing.status] ?? LISTING_STATUS_LABELS.draft!;
  const can = (p: Parameters<typeof hasPermission>[1]) => hasPermission(membership.permissions, p);

  return (
    <>
      <Link href="/dashboard/biens" className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-yc-ink-soft hover:text-yc-ink"><IconArrowLeft size={16} /> Biens</Link>
      <PageHeader
        title={listing.title}
        description={<span className="flex flex-wrap items-center gap-2"><Pill tone={meta.tone}>{meta.label}</Pill>{d.agencyReference && <span>Réf. {d.agencyReference}</span>}<span>· {visits} demande{visits > 1 ? "s" : ""} de visite</span>{lease && <span>· Bail {lease.reference}</span>}</span>}
      />
      <div className="grid gap-5 xl:grid-cols-[1fr_300px]">
        <PropertyEditor
          listingId={listing.id}
          status={listing.status}
          can={{ edit: can("listings.edit"), publish: can("listings.publish"), remove: can("listings.delete") }}
          initial={{
            title: listing.title,
            summary: listing.summary ?? "",
            description: listing.description ?? "",
            price: listing.price,
            propertyType: d.propertyType,
            dealType: d.dealType,
            bedrooms: d.bedrooms,
            bathrooms: d.bathrooms,
            surfaceM2: d.surfaceM2,
            landSurfaceM2: d.landSurfaceM2,
            furnished: d.furnished,
            amenities: d.amenities,
            agencyReference: d.agencyReference ?? "",
            featured: listing.featured,
            location: loc,
            media: (Array.isArray(listing.media) ? listing.media : []) as PropertyDraft["media"],
          }}
        />
        <aside className="flex flex-col gap-4">
          <Panel>
            <PanelHeader title="Historique" description="Chaque enregistrement est conservé et ne peut pas être modifié." />
            <ul className="space-y-2 px-5 pb-5 text-sm">
              {revisions.map((r, i) => <li key={r.id} className="flex justify-between gap-2"><span>{i === revisions.length - 1 && revisions.length < 5 ? "Création" : "Modification"}</span><span className="text-yc-ink-soft">{formatDate(r.changedAt)}</span></li>)}
            </ul>
          </Panel>
          {listing.status === "published" && (
            <Panel>
              <PanelHeader title="Sur votre site" description="Adresse de la fiche publique." />
              <p className="break-all px-5 pb-5 font-mono text-[13px] text-yc-ink-soft">/biens/{listing.slug}</p>
            </Panel>
          )}
        </aside>
      </div>
    </>
  );
}
