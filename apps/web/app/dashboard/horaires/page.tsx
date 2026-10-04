import Link from "next/link";
import type { Metadata } from "next";
import { withTenant, listStaff, getBookingSettings } from "@yamacommerce/database";
import { requireSalonPage } from "@/lib/salon/guard";
import { WEEKDAYS, WEEK_ORDER, minuteLabel } from "@/lib/salon/labels";
import { PageHeader, Panel } from "@/components/yc/panel";
import { Pill } from "@/components/yc/status-pill";
import { EmptyState } from "@/components/yc/empty-state";
import { ButtonLink } from "@/components/yc/button";
import { IconPlus } from "@/components/yc/icons";
import { BookingSettingsPanel } from "@/components/dashboard-salon/staff-editor";

export const metadata: Metadata = { title: "Équipe et horaires — Y-COM", robots: { index: false, follow: false } };

/** L'équipe du salon, ses horaires de la semaine, et les règles de réservation en ligne. */
export default async function StaffPage() {
  const membership = await requireSalonPage("listings.manage_availability");
  const { staff, settings } = await withTenant(membership.tenantId, async (tx) => ({ staff: await listStaff(tx, membership.tenantId), settings: await getBookingSettings(tx, membership.tenantId) }));
  return (
    <>
      <PageHeader eyebrow="Salon" title="Équipe et horaires" description="Qui travaille quand, et sur quelles prestations : l'agenda et les horaires proposés en ligne en découlent." actions={<ButtonLink href="/dashboard/horaires/nouveau" variant="royal"><IconPlus size={18} /> Membre</ButtonLink>} />
      {staff.length === 0 ? (
        <Panel><EmptyState title="Aucun membre" description="Ajoutez les personnes qui réalisent les prestations et leurs horaires." /></Panel>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {staff.map((s) => (
            <Link key={s.id} href={`/dashboard/horaires/${s.id}`} className="rounded-xl bg-white p-5 shadow-[0_1px_2px_rgb(12_22_48/0.04),0_8px_24px_-16px_rgb(12_22_48/0.12)] ring-1 ring-yc-ink/[0.07] transition-shadow hover:shadow-[0_12px_30px_-14px_rgb(12_22_48/0.25)]">
              <span className="flex items-center gap-3">
                {s.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.photoUrl} alt="" className="h-11 w-11 rounded-full object-cover" />
                ) : (
                  <span className="grid h-11 w-11 place-items-center rounded-full bg-[#F4E7EA] text-lg font-bold text-[#8E3A52]" aria-hidden="true">{s.displayName.slice(0, 1)}</span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 font-semibold">{s.displayName}{!s.isActive && <Pill tone="neutral">Hors agenda</Pill>}{s.isActive && !s.acceptsOnline && <Pill tone="neutral">Hors ligne</Pill>}</span>
                  <span className="block truncate text-sm text-yc-ink-soft">{s.title ?? "—"} · {s.skills.length} prestation{s.skills.length > 1 ? "s" : ""}</span>
                </span>
              </span>
              <dl className="mt-4 grid gap-1 text-[13px]">
                {WEEK_ORDER.map((d) => {
                  const r = s.hours.filter((h) => h.weekday === d);
                  return (
                    <div key={d} className="flex justify-between gap-3">
                      <dt className="text-yc-ink-soft">{WEEKDAYS[d]}</dt>
                      <dd className={`tabular-nums ${r.length ? "" : "text-yc-ink-soft"}`}>{r.length ? r.map((x) => `${minuteLabel(x.startMinute)}–${minuteLabel(x.endMinute)}`).join(", ") : "Repos"}</dd>
                    </div>
                  );
                })}
              </dl>
              {s.timeOff.length > 0 && <p className="mt-3 rounded-lg bg-yc-warning/10 px-3 py-1.5 text-xs font-semibold text-[rgb(146_84_0)]">{s.timeOff.length} absence{s.timeOff.length > 1 ? "s" : ""} prévue{s.timeOff.length > 1 ? "s" : ""}</p>}
            </Link>
          ))}
        </div>
      )}
      <div className="mt-6"><BookingSettingsPanel initial={{ slotStepMinutes: settings.slotStepMinutes, minLeadMinutes: settings.minLeadMinutes, maxAdvanceDays: settings.maxAdvanceDays, cancelCutoffHours: settings.cancelCutoffHours, autoConfirm: settings.autoConfirm }} /></div>
    </>
  );
}
