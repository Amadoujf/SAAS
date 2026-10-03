import Link from "next/link";
import type { Metadata } from "next";
import { hasPermission } from "@yamacommerce/auth";
import { withTenant, listLeases, rentOverview, ensureRentSchedule, isRentLate } from "@yamacommerce/database";
import { requireRealEstatePage } from "@/lib/real-estate/guard";
import { RENT_METHOD_LABELS } from "@/lib/real-estate/labels";
import { formatAmount, formatDate } from "@/lib/format";
import { PageHeader, Panel, PanelHeader } from "@/components/yc/panel";
import { Pill } from "@/components/yc/status-pill";
import { EmptyState } from "@/components/yc/empty-state";
import { IconPhone } from "@/components/yc/icons";
import { EndLeaseButton, OpenLeaseForm, RecordRentForm } from "@/components/dashboard-real-estate/lease-forms";

export const metadata: Metadata = { title: "Baux et loyers — Y-COM", robots: { index: false, follow: false } };

const periodLabel = (period: string) => {
  const [y, m] = period.split("-").map(Number);
  return new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(y!, m! - 1, 1)));
};

function Kpi({ label, value, tone = "neutral", foot }: { label: string; value: string; tone?: "neutral" | "danger" | "success"; foot?: string }) {
  return (
    <div className="rounded-xl bg-white p-4 shadow-[0_1px_2px_rgb(12_22_48/0.04),0_8px_24px_-16px_rgb(12_22_48/0.12)] ring-1 ring-yc-ink/[0.07] sm:p-5">
      <p className="text-[13px] text-yc-ink-soft sm:text-sm">{label}</p>
      <p className={`yc-num mt-1 text-[20px] font-bold tracking-[-0.02em] sm:text-[24px] ${tone === "danger" ? "text-[#C2410C]" : tone === "success" ? "text-[rgb(4_120_87)]" : "text-yc-ink"}`}>{value}</p>
      {foot && <p className="mt-0.5 text-xs text-yc-ink-soft">{foot}</p>}
    </div>
  );
}

/** Baux en cours, échéancier des loyers et encaissements. Un loyer n'est « payé » que
 *  lorsqu'un encaissement réel a été enregistré (montant, moyen, date). */
export default async function LeasesPage({ searchParams }: { searchParams: { filtre?: string } }) {
  const membership = await requireRealEstatePage("leases.view");
  const tenantId = membership.tenantId;
  const now = new Date();
  const data = await withTenant(tenantId, async (tx) => {
    // Échéancier à jour (idempotent) avant l'affichage.
    for (const l of await tx.lease.findMany({ where: { tenantId, status: "active" }, select: { id: true } })) await ensureRentSchedule(tx, tenantId, l.id, now);
    return {
      overview: await rentOverview(tx, tenantId, now),
      leases: await listLeases(tx, tenantId),
      rentable: await tx.listing.findMany({
        where: { tenantId, type: "property", deletedAt: null, status: { not: "archived" }, property: { is: { dealType: "rent" } }, leases: { none: { status: "active" } } },
        select: { id: true, title: true, price: true },
        orderBy: { title: "asc" },
      }),
    };
  });
  const can = (p: Parameters<typeof hasPermission>[1]) => hasPermission(membership.permissions, p);
  const lateOnly = searchParams.filtre === "retard";
  const active = data.leases.filter((l) => l.status === "active");
  const closed = data.leases.filter((l) => l.status !== "active");
  const shown = lateOnly ? active.filter((l) => l.rentPayments.some((p) => isRentLate(p, now))) : active;

  return (
    <>
      <PageHeader eyebrow="Pilotage" title="Baux et loyers" description="Les loyers restent « à payer » tant qu'un encaissement n'est pas enregistré ici." />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Baux en cours" value={String(data.overview.activeLeases)} />
        <Kpi label="Attendu ce mois-ci" value={`${formatAmount(data.overview.dueThisMonth)} FCFA`} />
        <Kpi label="Encaissé ce mois-ci" value={`${formatAmount(data.overview.collectedThisMonth)} FCFA`} tone="success" />
        <Kpi label="Impayés en retard" value={`${formatAmount(data.overview.lateAmount)} FCFA`} tone={data.overview.lateCount ? "danger" : "neutral"} foot={`${data.overview.lateCount} échéance${data.overview.lateCount > 1 ? "s" : ""}`} />
      </div>

      {can("leases.manage") && (
        <Panel className="mb-5">
          <PanelHeader title="Nouveau bail" description="Le locataire est enregistré dans vos clients ; l'échéancier des loyers est créé automatiquement." />
          <OpenLeaseForm properties={data.rentable} />
        </Panel>
      )}

      <div className="mb-3 flex gap-1">
        <Link href="/dashboard/baux" aria-current={!lateOnly ? "page" : undefined} className={`rounded-full px-3.5 py-2 text-sm font-medium ${!lateOnly ? "bg-yc-night-900 text-white" : "bg-white text-yc-ink-soft ring-1 ring-yc-ink/10"}`}>Tous les baux</Link>
        <Link href="/dashboard/baux?filtre=retard" aria-current={lateOnly ? "page" : undefined} className={`rounded-full px-3.5 py-2 text-sm font-medium ${lateOnly ? "bg-yc-night-900 text-white" : "bg-white text-yc-ink-soft ring-1 ring-yc-ink/10"}`}>Avec retard</Link>
      </div>

      {shown.length === 0 ? (
        <Panel><EmptyState title={lateOnly ? "Aucun loyer en retard" : "Aucun bail en cours"} description={lateOnly ? "Tous les loyers échus sont encaissés." : "Ouvrez un bail sur un bien à louer pour suivre ses loyers."} /></Panel>
      ) : (
        <div className="flex flex-col gap-5">
          {shown.map((lease) => {
            // D'abord ce qui reste dû (le plus ancien en premier), puis les derniers loyers encaissés.
            const due = lease.rentPayments.filter((p) => p.status === "pending").sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
            const paid = lease.rentPayments.filter((p) => p.status === "paid").slice(0, Math.max(2, 6 - due.length));
            const payments = [...due, ...paid];
            return (
              <Panel key={lease.id} className="overflow-hidden">
                <header className="flex flex-col gap-3 border-b border-yc-ink/[0.06] px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-mono text-xs text-yc-ink-soft">{lease.reference}</p>
                    <h2 className="text-[17px] font-bold"><Link href={`/dashboard/biens/${lease.listing.id}`} className="hover:underline">{lease.listing.title}</Link></h2>
                    <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-yc-ink-soft">
                      <span>Locataire : <span className="font-medium text-yc-ink">{lease.occupant.firstName} {lease.occupant.lastName ?? ""}</span></span>
                      {lease.occupant.phone && <a href={`tel:${lease.occupant.phone}`} className="inline-flex items-center gap-1 hover:text-yc-ink"><IconPhone size={14} /> {lease.occupant.phone}</a>}
                      {lease.landlordName && <span>Propriétaire : {lease.landlordName}</span>}
                    </p>
                    <p className="mt-1 text-sm text-yc-ink-soft">
                      Depuis le {formatDate(lease.startDate)}{lease.endDate ? ` jusqu'au ${formatDate(lease.endDate)}` : ""} · <span className="yc-num font-semibold text-yc-ink">{formatAmount(lease.monthlyRent + lease.charges)} FCFA</span> / mois (échéance le {lease.dueDay}) · caution {formatAmount(lease.depositAmount)} FCFA
                    </p>
                  </div>
                  {can("leases.manage") && <EndLeaseButton leaseId={lease.id} reference={lease.reference} />}
                </header>
                <ul className="divide-y divide-yc-ink/[0.06]">
                  {payments.map((p) => {
                    const late = isRentLate(p, now);
                    return (
                      <li key={p.id} className="flex flex-col gap-3 px-5 py-3 sm:flex-row sm:items-center">
                        <div className="min-w-0 flex-1">
                          <p className="flex flex-wrap items-center gap-2 font-medium">
                            <span className="capitalize">{periodLabel(p.period)}</span>
                            {p.status === "paid" ? <Pill tone="success">Payé</Pill> : late ? <Pill tone="danger">En retard</Pill> : <Pill tone="warning">À payer</Pill>}
                          </p>
                          <p className="text-sm text-yc-ink-soft">
                            Échéance {formatDate(p.dueDate)} · <span className="yc-num">{formatAmount(p.amountDue)} FCFA</span>
                            {p.amountPaid > 0 && p.status !== "paid" && <> · déjà reçu <span className="yc-num">{formatAmount(p.amountPaid)} FCFA</span></>}
                            {p.status === "paid" && p.paidAt && <> · reçu le {formatDate(p.paidAt)}{p.method ? ` (${RENT_METHOD_LABELS[p.method] ?? p.method})` : ""} · quittance {p.receiptNumber}</>}
                          </p>
                        </div>
                        {p.status === "pending" && can("rents.record") && <RecordRentForm rentPaymentId={p.id} remaining={p.amountDue - p.amountPaid} period={p.period} />}
                      </li>
                    );
                  })}
                </ul>
              </Panel>
            );
          })}
        </div>
      )}

      {!lateOnly && closed.length > 0 && (
        <Panel className="mt-5 overflow-hidden">
          <PanelHeader title={`Baux terminés (${closed.length})`} />
          <ul className="divide-y divide-yc-ink/[0.06]">
            {closed.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm">
                <span><span className="font-mono text-xs text-yc-ink-soft">{l.reference}</span> · {l.listing.title} · {l.occupant.firstName} {l.occupant.lastName ?? ""}</span>
                <span className="text-yc-ink-soft">terminé le {l.endDate ? formatDate(l.endDate) : "—"}</span>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </>
  );
}
