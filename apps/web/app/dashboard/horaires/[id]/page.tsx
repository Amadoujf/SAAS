import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { withTenant, listServices, listStaff, utcToLocal } from "@yamacommerce/database";
import { requireSalonPage } from "@/lib/salon/guard";
import { PageHeader } from "@/components/yc/panel";
import { IconArrowLeft } from "@/components/yc/icons";
import { StaffEditor, TimeOffPanel } from "@/components/dashboard-salon/staff-editor";
import { clockLabel } from "@/lib/salon/labels";

export const metadata: Metadata = { title: "Membre de l'équipe — Y-COM", robots: { index: false, follow: false } };

export default async function StaffMemberPage({ params }: { params: { id: string } }) {
  const membership = await requireSalonPage("listings.manage_availability");
  const data = await withTenant(membership.tenantId, async (tx) => ({
    tz: (await tx.tenant.findUnique({ where: { id: membership.tenantId }, select: { timezone: true } }))?.timezone || "Africa/Dakar",
    staff: await listStaff(tx, membership.tenantId),
    services: await listServices(tx, membership.tenantId),
  }));
  const s = data.staff.find((x) => x.id === params.id);
  if (!s) notFound();
  const fmt = new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "numeric", month: "short", timeZone: data.tz });
  const last = (d: Date) => new Date(d.getTime() - 1);
  return (
    <>
      <Link href="/dashboard/horaires" className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-yc-ink-soft hover:text-yc-ink"><IconArrowLeft size={16} /> Équipe et horaires</Link>
      <PageHeader title={s.displayName} description={s.title ?? undefined} />
      <div className="mb-5">
        <TimeOffPanel
          staffId={s.id}
          today={utcToLocal(new Date(), data.tz).date}
          items={s.timeOff.map((t) => {
            const a = fmt.format(t.startAt);
            const b = fmt.format(last(t.endAt));
            return { id: t.id, label: a === b ? a : `${a} → ${b}`, reason: t.reason };
          })}
        />
      </div>
      <StaffEditor
        staffId={s.id}
        services={data.services.filter((x) => x.service).map((x) => ({ id: x.id, title: x.title, category: x.service!.category }))}
        initial={{
          displayName: s.displayName,
          title: s.title ?? "",
          bio: s.bio ?? "",
          photoUrl: s.photoUrl,
          isActive: s.isActive,
          acceptsOnline: s.acceptsOnline,
          serviceIds: s.skills.map((k) => k.listingId),
          hours: s.hours.map((h) => ({ weekday: h.weekday, start: clockLabel(h.startMinute), end: clockLabel(h.endMinute === 1440 ? 1439 : h.endMinute) })),
        }}
      />
    </>
  );
}
