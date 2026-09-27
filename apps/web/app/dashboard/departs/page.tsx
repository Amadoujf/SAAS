import Link from "next/link";
import type { Metadata } from "next";
import { withTenant, listUpcomingDepartures } from "@yamacommerce/database";
import { requireTravelPage } from "@/lib/travel/guard";
import { formatDateRange } from "@/lib/travel/labels";
import { PageHeader, Panel, PanelHeader } from "@/components/yc/panel";
import { EmptyState } from "@/components/yc/empty-state";

export const metadata: Metadata = { title: "Départs — Y-COM", robots: { index: false, follow: false } };
const monthFmt = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" });

/** Calendrier des départs à venir : remplissage, réservations et pièces à suivre, manifeste. */
export default async function DeparturesPage() {
  const membership = await requireTravelPage("reservations.view");
  const { departures, pending, missing } = await withTenant(membership.tenantId, async (tx) => {
    const departures = await listUpcomingDepartures(tx, membership.tenantId, { to: new Date(Date.now() + 365 * 86_400_000) });
    const ids = departures.map((d) => d.id);
    const pendingRows = await tx.reservation.groupBy({ by: ["availabilityId"], where: { tenantId: membership.tenantId, availabilityId: { in: ids }, status: "requested" }, _count: true });
    const missingRows = await tx.travelerDocument.findMany({ where: { tenantId: membership.tenantId, status: { in: ["missing", "refused"] }, traveler: { reservation: { availabilityId: { in: ids }, status: { in: ["requested", "confirmed"] } } } }, select: { traveler: { select: { reservation: { select: { availabilityId: true } } } } } });
    const missing = new Map<string, number>();
    for (const m of missingRows) {
      const id = m.traveler.reservation.availabilityId!;
      missing.set(id, (missing.get(id) ?? 0) + 1);
    }
    return { departures, pending: new Map(pendingRows.map((r) => [r.availabilityId, r._count])), missing };
  });
  const groups = new Map<string, typeof departures>();
  for (const d of departures) {
    const key = monthFmt.format(d.startAt);
    groups.set(key, [...(groups.get(key) ?? []), d]);
  }
  return (
    <>
      <PageHeader eyebrow="Pilotage" title="Départs" description="Tous vos départs à venir, leur remplissage et ce qui reste à suivre." />
      {departures.length === 0 ? (
        <Panel><EmptyState title="Aucun départ programmé" description="Ajoutez des dates de départ depuis la fiche de chaque voyage." /></Panel>
      ) : (
        <div className="flex flex-col gap-5">
          {[...groups.entries()].map(([month, items]) => (
            <Panel key={month} className="overflow-hidden">
              <PanelHeader title={month.replace(/^./, (c) => c.toUpperCase())} />
              <ul className="divide-y divide-yc-ink/[0.06]">
                {items.map((d) => {
                  const pct = Math.round((d.reservedCount / d.capacity) * 100);
                  const p = pending.get(d.id) ?? 0;
                  const m = missing.get(d.id) ?? 0;
                  return (
                    <li key={d.id}>
                      <Link href={`/dashboard/departs/${d.id}`} className="flex flex-col gap-2 px-5 py-4 hover:bg-yc-ivory-50 sm:flex-row sm:items-center sm:gap-5">
                        <span className="min-w-0 flex-1">
                          <span className="block font-semibold">{d.listing.title}</span>
                          <span className="block text-sm text-yc-ink-soft">{formatDateRange(d.startAt, d.endAt)}{d.label ? ` · ${d.label}` : ""}{d.status !== "open" ? " · fermé à la réservation" : ""}</span>
                        </span>
                        <span className="flex items-center gap-3 text-sm">
                          <span className="h-1.5 w-28 overflow-hidden rounded-full bg-yc-ink/[0.08]" aria-hidden="true"><span className={`block h-full rounded-full ${pct >= 100 ? "bg-yc-success" : "bg-yc-electric"}`} style={{ width: `${Math.min(100, pct)}%` }} /></span>
                          <span className="yc-num w-24 font-semibold">{d.reservedCount} / {d.capacity}</span>
                        </span>
                        <span className="flex flex-wrap gap-2 text-xs font-semibold">
                          {p > 0 && <span className="rounded-full bg-yc-warning/15 px-2.5 py-1 text-[rgb(146_84_0)]">{p} à confirmer</span>}
                          {m > 0 && <span className="rounded-full bg-yc-danger/10 px-2.5 py-1 text-yc-danger">{m} pièce{m > 1 ? "s" : ""} à obtenir</span>}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </Panel>
          ))}
        </div>
      )}
    </>
  );
}
