import Link from "next/link";
import type { Metadata } from "next";
import { hasPermission } from "@yamacommerce/auth";
import { withTenant, VISIT_MODULE } from "@yamacommerce/database";
import { requireRealEstatePage } from "@/lib/real-estate/guard";
import { VISIT_STATUS_LABELS } from "@/lib/real-estate/labels";
import { PageHeader, Panel, PanelHeader } from "@/components/yc/panel";
import { Pill } from "@/components/yc/status-pill";
import { EmptyState } from "@/components/yc/empty-state";
import { IconClock, IconPhone } from "@/components/yc/icons";
import { VisitActions } from "@/components/dashboard-real-estate/visit-actions";

export const metadata: Metadata = { title: "Visites — Y-COM", robots: { index: false, follow: false } };

const when = (d: Date) =>
  new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Dakar" }).format(d);

/** Demandes de visite reçues depuis le site (ou saisies par l'équipe) : à confirmer,
 *  à venir, passées. Le téléphone du client est affiché pour le rappeler. */
export default async function VisitsPage() {
  const membership = await requireRealEstatePage("reservations.view");
  const now = new Date();
  const visits = await withTenant(membership.tenantId, (tx) =>
    tx.reservation.findMany({
      where: { tenantId: membership.tenantId, moduleKey: VISIT_MODULE },
      include: { listing: { select: { id: true, title: true } }, customer: { select: { firstName: true, lastName: true, phone: true } } },
      orderBy: { startAt: "asc" },
      take: 300,
    }),
  );
  const toConfirm = visits.filter((v) => v.status === "requested");
  const upcoming = visits.filter((v) => v.status === "confirmed" && v.startAt >= now);
  const toClose = visits.filter((v) => v.status === "confirmed" && v.startAt < now);
  const history = visits.filter((v) => !["requested", "confirmed"].includes(v.status)).reverse().slice(0, 30);
  const canUpdate = hasPermission(membership.permissions, "reservations.update_status");
  const canCancel = hasPermission(membership.permissions, "reservations.cancel");

  const List = ({ items, title, description }: { items: typeof visits; title: string; description?: string }) =>
    items.length === 0 ? null : (
      <Panel className="overflow-hidden">
        <PanelHeader title={`${title} (${items.length})`} description={description} />
        <ul className="divide-y divide-yc-ink/[0.06]">
          {items.map((v) => {
            const meta = VISIT_STATUS_LABELS[v.status] ?? VISIT_STATUS_LABELS.requested!;
            return (
              <li key={v.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:gap-5">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 font-semibold">
                    {v.customer.firstName} {v.customer.lastName ?? ""}
                    <Pill tone={meta.tone}>{meta.label}</Pill>
                  </p>
                  <p className="mt-0.5 text-sm">
                    {v.listing ? <Link href={`/dashboard/biens/${v.listing.id}`} className="font-medium text-yc-electric hover:underline">{v.listing.title}</Link> : "Bien supprimé"}
                  </p>
                  <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-yc-ink-soft">
                    <span className="inline-flex items-center gap-1.5 capitalize"><IconClock size={15} /> {when(v.startAt)}</span>
                    {v.customer.phone && <a href={`tel:${v.customer.phone}`} className="inline-flex items-center gap-1.5 hover:text-yc-ink"><IconPhone size={15} /> {v.customer.phone}</a>}
                    <span className="font-mono text-xs">{v.reference}</span>
                  </p>
                  {v.customerNote && <p className="mt-2 rounded-lg bg-yc-ivory-50 px-3 py-2 text-sm ring-1 ring-yc-ink/[0.05]">« {v.customerNote} »</p>}
                </div>
                <VisitActions reservationId={v.id} status={v.status} past={v.startAt < now} canUpdate={canUpdate} canCancel={canCancel} />
              </li>
            );
          })}
        </ul>
      </Panel>
    );

  return (
    <>
      <PageHeader eyebrow="Pilotage" title="Visites" description="Les demandes de visite arrivent depuis la fiche de chaque bien sur votre site." />
      {visits.length === 0 ? (
        <Panel><EmptyState title="Aucune demande de visite" description="Dès qu'un visiteur demande à visiter un bien en ligne, sa demande apparaît ici avec son téléphone." /></Panel>
      ) : (
        <div className="flex flex-col gap-5">
          <List items={toConfirm} title="À confirmer" description="Appelez le client pour convenir de l'heure, puis confirmez." />
          <List items={toClose} title="À clôturer" description="Visites passées : indiquez si elles ont eu lieu." />
          <List items={upcoming} title="À venir" />
          <List items={history} title="Historique" />
        </div>
      )}
    </>
  );
}
