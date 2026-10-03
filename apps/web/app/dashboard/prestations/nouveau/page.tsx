import Link from "next/link";
import type { Metadata } from "next";
import { withTenant, listServices, listStaff } from "@yamacommerce/database";
import { requireSalonPage } from "@/lib/salon/guard";
import { PageHeader } from "@/components/yc/panel";
import { IconArrowLeft } from "@/components/yc/icons";
import { ServiceEditor } from "@/components/dashboard-salon/service-editor";

export const metadata: Metadata = { title: "Nouvelle prestation — Y-COM", robots: { index: false, follow: false } };

export default async function NewServicePage() {
  const membership = await requireSalonPage("listings.create");
  const { staff, services } = await withTenant(membership.tenantId, async (tx) => ({ staff: await listStaff(tx, membership.tenantId, { activeOnly: true }), services: await listServices(tx, membership.tenantId) }));
  return (
    <>
      <Link href="/dashboard/prestations" className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-yc-ink-soft hover:text-yc-ink"><IconArrowLeft size={16} /> Prestations</Link>
      <PageHeader title="Nouvelle prestation" description="Créée en brouillon : mettez-la en ligne quand elle est prête." />
      <ServiceEditor
        listingId={null}
        status={null}
        canPublish={false}
        canDelete={false}
        categories={[...new Set(services.map((s) => s.service?.category).filter((c): c is string => !!c))]}
        staff={staff.map((s) => ({ id: s.id, name: s.displayName, title: s.title }))}
        initial={{ title: "", summary: "", description: "", category: "", durationMinutes: 60, bufferMinutes: 0, price: "", priceFrom: false, onlineBooking: true, featured: false, staffIds: [], media: [] }}
      />
    </>
  );
}
