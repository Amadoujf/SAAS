import type { Metadata } from "next";
import Link from "next/link";
import { withTenant, getAutoSettings, listTestDrives, listVehicles, utcToLocal } from "@yamacommerce/database";
import { hasPermission } from "@yamacommerce/auth";
import { requireAutoPage } from "@/lib/auto/guard";
import { SOURCE_LABELS, TEST_DRIVE_LABELS, dateIn, dateLabel, timeIn } from "@/lib/auto/labels";
import { PageHeader, Panel } from "@/components/yc/panel";
import { Pill } from "@/components/yc/status-pill";
import { EmptyState } from "@/components/yc/empty-state";
import { DeskDrive, DriveOutcome } from "@/components/dashboard-auto/drive-panels";

export const metadata: Metadata = { title: "Essais — Y-COM", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** Agenda des essais : à venir groupés par jour, puis les derniers passés à solder. */
export default async function DrivesPage({ searchParams }: { searchParams: { vue?: string } }) {
  const membership = await requireAutoPage("reservations.view");
  const tenantId = membership.tenantId;
  const past = searchParams.vue === "passes";
  const now = new Date();
  const data = await withTenant(tenantId, async (tx) => {
    const tz = (await tx.tenant.findUnique({ where: { id: tenantId }, select: { timezone: true } }))?.timezone || "Africa/Dakar";
    return {
      tz,
      drives: past
        ? (await listTestDrives(tx, tenantId, { to: now })).reverse().slice(0, 60)
        : await listTestDrives(tx, tenantId, { from: new Date(now.getTime() - 2 * 3600_000) }),
      available: await listVehicles(tx, tenantId, { stock: ["available"] }),
      settings: await getAutoSettings(tx, tenantId),
    };
  });
  const { tz } = data;
  const today = utcToLocal(now, tz).date;
  const days = new Map<string, typeof data.drives>();
  for (const d of data.drives) {
    const k = dateIn(d.startAt, tz);
    days.set(k, [...(days.get(k) ?? []), d]);
  }
  const canUpdate = hasPermission(membership.permissions, "reservations.update_status");
  return (
    <>
      <PageHeader eyebrow="Pilotage" title="Essais" description="Réservés depuis le site ou saisis par l'équipe. Un même véhicule n'a jamais deux essais qui se chevauchent." />
      <div className="mb-4 flex gap-2">
        <Link href="/dashboard/essais" aria-current={!past ? "page" : undefined} className="rounded-full bg-white px-3.5 py-1.5 text-sm font-semibold ring-1 ring-yc-ink/10 aria-[current=page]:bg-yc-night-900 aria-[current=page]:text-white">À venir</Link>
        <Link href="/dashboard/essais?vue=passes" aria-current={past ? "page" : undefined} className="rounded-full bg-white px-3.5 py-1.5 text-sm font-semibold ring-1 ring-yc-ink/10 aria-[current=page]:bg-yc-night-900 aria-[current=page]:text-white">Passés</Link>
      </div>
      <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
        <div className="grid content-start gap-5">
          {days.size === 0 ? (
            <Panel><EmptyState title={past ? "Aucun essai passé" : "Aucun essai à venir"} description={past ? "" : "Les essais réservés sur le site apparaissent ici immédiatement."} /></Panel>
          ) : (
            [...days.entries()].map(([day, list]) => (
              <Panel key={day} className="overflow-hidden">
                <h2 className="border-b border-yc-ink/[0.06] px-5 py-3 text-[15px] font-bold first-letter:uppercase">{day === today ? "Aujourd'hui" : dateLabel(`${day}T12:00:00Z`, "UTC")}</h2>
                <ul className="divide-y divide-yc-ink/[0.06]">
                  {list.map((d) => {
                    const st = TEST_DRIVE_LABELS[d.status]!;
                    const open = ["requested", "confirmed"].includes(d.status);
                    return (
                      <li key={d.id} className="grid gap-3 px-5 py-4 sm:grid-cols-[72px_1fr_auto] sm:items-center">
                        <span className="yc-num text-[18px] font-bold">{timeIn(d.startAt, tz)}</span>
                        <div className="min-w-0">
                          <Link href={`/dashboard/vehicules/${d.listing!.id}`} className="block truncate font-semibold hover:underline">{d.listing!.title}</Link>
                          <p className="truncate text-sm text-yc-ink-soft">{d.customer.firstName} {d.customer.lastName ?? ""} · <a href={`tel:${d.customer.phone}`} className="hover:underline">{d.customer.phone}</a> · {SOURCE_LABELS[d.channel] ?? (d.channel === "dashboard" ? "Showroom" : d.channel)}{d.testDrive?.licenseConfirmed ? " · permis confirmé" : ""}</p>
                          {d.customerNote && <p className="mt-1 text-sm">« {d.customerNote} »</p>}
                        </div>
                        <div className="flex flex-col items-start gap-2 sm:items-end">
                          <Pill tone={st.tone}>{st.label}</Pill>
                          {/* Effectué / absent : à partir de l'heure de l'essai ; avant, seulement l'annulation. */}
                          {open && canUpdate && <DriveOutcome reservationId={d.id} canCancel={hasPermission(membership.permissions, "reservations.cancel")} canSettle={d.startAt.getTime() <= now.getTime() + 15 * 60_000} />}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </Panel>
            ))
          )}
        </div>
        {canUpdate && <DeskDrive vehicles={data.available.map((v) => ({ id: v.id, title: v.title }))} today={today} hours={data.settings.openingHours} />}
      </div>
    </>
  );
}
