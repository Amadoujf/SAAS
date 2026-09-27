import Link from "next/link";
import type { Metadata } from "next";
import { withTenant, listServices } from "@yamacommerce/database";
import { requireSalonPage } from "@/lib/salon/guard";
import { PageHeader } from "@/components/yc/panel";
import { IconArrowLeft } from "@/components/yc/icons";
import { StaffEditor } from "@/components/dashboard-salon/staff-editor";

export const metadata: Metadata = { title: "Nouveau membre — Y-COM", robots: { index: false, follow: false } };

const workweek = [2, 3, 4, 5, 6].flatMap((weekday) => [{ weekday, start: "09:00", end: "13:00" }, { weekday, start: "14:00", end: "19:00" }]);

export default async function NewStaffPage() {
  const membership = await requireSalonPage("listings.manage_availability");
  const services = await withTenant(membership.tenantId, (tx) => listServices(tx, membership.tenantId));
  return (
    <>
      <Link href="/dashboard/horaires" className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-yc-ink-soft hover:text-yc-ink"><IconArrowLeft size={16} /> Équipe et horaires</Link>
      <PageHeader title="Nouveau membre de l'équipe" description="Horaires proposés par défaut : du mardi au samedi, 9 h–13 h et 14 h–19 h. Ajustez-les." />
      <StaffEditor staffId={null} services={services.filter((s) => s.service).map((s) => ({ id: s.id, title: s.title, category: s.service!.category }))} initial={{ displayName: "", title: "", bio: "", photoUrl: null, isActive: true, acceptsOnline: true, serviceIds: [], hours: workweek }} />
    </>
  );
}
