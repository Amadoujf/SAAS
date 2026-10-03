import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasPermission } from "@yamacommerce/auth";
import { withTenant, listServices, listStaff } from "@yamacommerce/database";
import { requireSalonPage } from "@/lib/salon/guard";
import { PageHeader } from "@/components/yc/panel";
import { IconArrowLeft } from "@/components/yc/icons";
import { ServiceEditor } from "@/components/dashboard-salon/service-editor";

export const metadata: Metadata = { title: "Prestation — Y-COM", robots: { index: false, follow: false } };

export default async function ServicePage({ params }: { params: { id: string } }) {
  const membership = await requireSalonPage("listings.edit");
  const { staff, services } = await withTenant(membership.tenantId, async (tx) => ({ staff: await listStaff(tx, membership.tenantId), services: await listServices(tx, membership.tenantId) }));
  const s = services.find((x) => x.id === params.id);
  if (!s || !s.service) notFound();
  const media = (Array.isArray(s.media) ? s.media : []) as { url: string; alt?: string; demo?: boolean }[];
  return (
    <>
      <Link href="/dashboard/prestations" className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-yc-ink-soft hover:text-yc-ink"><IconArrowLeft size={16} /> Prestations</Link>
      <PageHeader title={s.title} description={s.service.category} />
      <ServiceEditor
        listingId={s.id}
        status={s.status}
        canPublish={hasPermission(membership.permissions, "listings.publish")}
        canDelete={hasPermission(membership.permissions, "listings.delete")}
        categories={[...new Set(services.map((x) => x.service?.category).filter((c): c is string => !!c))]}
        staff={staff.filter((x) => x.isActive || s.service!.skills.some((k) => k.staffId === x.id)).map((x) => ({ id: x.id, name: x.isActive ? x.displayName : `${x.displayName} (hors agenda)`, title: x.title }))}
        initial={{
          title: s.title,
          summary: s.summary ?? "",
          description: s.description ?? "",
          category: s.service.category,
          durationMinutes: s.service.durationMinutes,
          bufferMinutes: s.service.bufferMinutes,
          price: s.price == null ? "" : String(s.price),
          priceFrom: s.service.priceFrom,
          onlineBooking: s.service.onlineBooking,
          featured: s.featured,
          staffIds: s.service.skills.map((k) => k.staffId),
          media: media.map((m) => ({ url: m.url, alt: m.alt ?? "", demo: m.demo })),
        }}
      />
    </>
  );
}
