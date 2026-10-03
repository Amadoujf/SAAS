import Link from "next/link";
import type { Metadata } from "next";
import { withTenant, listServices, listStaff, isIsoDate, utcToLocal } from "@yamacommerce/database";
import { requireSalonPage } from "@/lib/salon/guard";
import { PageHeader } from "@/components/yc/panel";
import { IconArrowLeft } from "@/components/yc/icons";
import { DeskBookingForm } from "@/components/dashboard-salon/desk-booking-form";

export const metadata: Metadata = { title: "Nouveau rendez-vous — Y-COM", robots: { index: false, follow: false } };

export default async function NewAppointmentPage({ searchParams }: { searchParams: { jour?: string; avec?: string } }) {
  const membership = await requireSalonPage("reservations.update_status");
  const data = await withTenant(membership.tenantId, async (tx) => ({
    tz: (await tx.tenant.findUnique({ where: { id: membership.tenantId }, select: { timezone: true } }))?.timezone || "Africa/Dakar",
    services: await listServices(tx, membership.tenantId, {}),
    staff: await listStaff(tx, membership.tenantId, { activeOnly: true }),
  }));
  const today = utcToLocal(new Date(), data.tz).date;
  const day = searchParams.jour && isIsoDate(searchParams.jour) && searchParams.jour >= today ? searchParams.jour : today;
  return (
    <>
      <Link href="/dashboard/agenda" className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-yc-ink-soft hover:text-yc-ink"><IconArrowLeft size={16} /> Agenda</Link>
      <PageHeader title="Nouveau rendez-vous" description="Au téléphone ou au comptoir : seuls les horaires réellement libres sont proposés." />
      <DeskBookingForm
        services={data.services.filter((s) => s.service && s.status !== "archived").map((s) => ({ id: s.id, title: s.title, category: s.service!.category, durationMinutes: s.service!.durationMinutes, staffIds: s.service!.skills.filter((k) => k.staff.isActive).map((k) => k.staffId) }))}
        staff={data.staff.map((s) => ({ id: s.id, name: s.displayName }))}
        today={today}
        initialDate={day}
        initialStaff={searchParams.avec && data.staff.some((s) => s.id === searchParams.avec) ? searchParams.avec : null}
      />
    </>
  );
}
