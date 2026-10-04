import type { Metadata } from "next";
import { withTenant, getAutoSettings } from "@yamacommerce/database";
import { requireAutoPage } from "@/lib/auto/guard";
import { PageHeader } from "@/components/yc/panel";
import { ShowroomSettings } from "@/components/dashboard-auto/showroom-settings";

export const metadata: Metadata = { title: "Showroom — Y-COM", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function ShowroomPage() {
  const membership = await requireAutoPage("listings.manage_availability");
  const s = await withTenant(membership.tenantId, (tx) => getAutoSettings(tx, membership.tenantId));
  return (
    <>
      <PageHeader eyebrow="Gestion" title="Horaires et règles" description="Horaires du showroom, durée des essais et acompte conseillé." />
      <ShowroomSettings initial={{ openingHours: s.openingHours, testDriveMinutes: s.testDriveMinutes, slotStepMinutes: ([15, 30, 60].includes(s.slotStepMinutes) ? s.slotStepMinutes : 30) as 15 | 30 | 60, maxAdvanceDays: s.maxAdvanceDays, depositPercent: s.depositPercent }} />
    </>
  );
}
