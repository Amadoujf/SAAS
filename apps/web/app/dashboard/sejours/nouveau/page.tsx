import Link from "next/link";
import type { Metadata } from "next";
import { withTenant, utcToLocal } from "@yamacommerce/database";
import { requireHotelPage } from "@/lib/hotel/guard";
import { PageHeader } from "@/components/yc/panel";
import { IconArrowLeft } from "@/components/yc/icons";
import { DeskStayForm } from "@/components/dashboard-hotel/desk-stay-form";

export const metadata: Metadata = { title: "Nouveau séjour — Y-COM", robots: { index: false, follow: false } };

export default async function NewStayPage() {
  const membership = await requireHotelPage("reservations.update_status");
  const tz = await withTenant(membership.tenantId, async (tx) => (await tx.tenant.findUnique({ where: { id: membership.tenantId }, select: { timezone: true } }))?.timezone || "Africa/Dakar");
  return (
    <>
      <Link href="/dashboard/planning" className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-yc-ink-soft hover:text-yc-ink"><IconArrowLeft size={16} /> Planning</Link>
      <PageHeader title="Nouveau séjour" description="À la réception ou au téléphone : seules les chambres réellement libres sont proposées, le prix est calculé nuit par nuit." />
      <DeskStayForm today={utcToLocal(new Date(), tz).date} />
    </>
  );
}
