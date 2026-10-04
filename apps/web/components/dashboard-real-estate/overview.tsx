import Link from "next/link";
import { withTenant, rentOverview, VISIT_MODULE } from "@yamacommerce/database";
import { hasPermission, type Permission } from "@yamacommerce/auth";
import { formatAmount, formatDate } from "@/lib/format";
import { Panel, PanelHeader } from "@/components/yc/panel";
import { ButtonLink } from "@/components/yc/button";
import { EmptyState } from "@/components/yc/empty-state";
import { IconChevronRight, IconClock, IconPlus } from "@/components/yc/icons";

const when = (d: Date) => new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Dakar" }).format(d);

function Kpi({ href, label, value, foot, tone = "blue" }: { href: string; label: string; value: string; foot: string; tone?: "blue" | "orange" | "green" }) {
  const color = tone === "orange" ? "text-[#C2410C]" : tone === "green" ? "text-[rgb(4_120_87)]" : "text-yc-ink";
  return (
    <Link href={href} className="yc-focus group rounded-xl bg-white p-4 shadow-[0_1px_2px_rgb(12_22_48/0.04),0_8px_24px_-16px_rgb(12_22_48/0.12)] ring-1 ring-yc-ink/[0.07] transition-shadow hover:shadow-[0_12px_30px_-14px_rgb(12_22_48/0.25)] sm:p-5">
      <span className="flex items-center justify-between text-[13px] text-yc-ink-soft sm:text-[15px]">{label}<IconChevronRight size={16} className="transition-transform group-hover:translate-x-0.5" /></span>
      <span className={`yc-num mt-1 block text-[20px] font-bold tracking-[-0.02em] sm:text-[26px] ${color}`}>{value}</span>
      <span className="mt-0.5 block text-xs text-yc-ink-soft sm:text-sm">{foot}</span>
    </Link>
  );
}

/** Vue d'ensemble d'une agence immobilière : biens, visites, loyers — chiffres réels. */
export async function RealEstateOverview({ tenantId, permissions, greeting }: { tenantId: string; permissions: string[]; greeting: React.ReactNode }) {
  const can = (p: Permission) => hasPermission(permissions, p);
  const now = new Date();
  const startOfToday = new Date(now.toISOString().slice(0, 10) + "T00:00:00.000Z");
  const data = await withTenant(tenantId, async (tx) => ({
    published: await tx.listing.count({ where: { tenantId, type: "property", status: "published", deletedAt: null } }),
    total: await tx.listing.count({ where: { tenantId, type: "property", deletedAt: null } }),
    toConfirm: await tx.reservation.count({ where: { tenantId, moduleKey: VISIT_MODULE, status: "requested" } }),
    nextVisits: await tx.reservation.findMany({
      where: { tenantId, moduleKey: VISIT_MODULE, status: { in: ["requested", "confirmed"] }, startAt: { gte: startOfToday } },
      include: { listing: { select: { title: true } }, customer: { select: { firstName: true, lastName: true } } },
      orderBy: { startAt: "asc" },
      take: 5,
    }),
    rents: await rentOverview(tx, tenantId, now),
    late: await tx.rentPayment.findMany({
      where: { tenantId, status: "pending", dueDate: { lt: startOfToday } },
      include: { lease: { select: { reference: true, listing: { select: { title: true } }, occupant: { select: { firstName: true, lastName: true } } } } },
      orderBy: { dueDate: "asc" },
      take: 5,
    }),
  }));
  const rate = data.rents.dueThisMonth ? Math.round((data.rents.collectedThisMonth / data.rents.dueThisMonth) * 100) : null;

  return (
    <>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>{greeting}<p className="mt-1 text-yc-ink-soft">Votre agence aujourd&apos;hui.</p></div>
        {can("listings.create") && <ButtonLink href="/dashboard/biens/nouveau" variant="royal"><IconPlus size={18} /> Ajouter un bien</ButtonLink>}
      </div>
      <div className="mb-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Kpi href="/dashboard/biens?statut=published" label="Biens en ligne" value={String(data.published)} foot={`${data.total} bien${data.total > 1 ? "s" : ""} au total`} />
        <Kpi href="/dashboard/visites" label="Visites à confirmer" value={String(data.toConfirm)} foot="Demandes reçues du site" tone={data.toConfirm ? "orange" : "blue"} />
        <Kpi href="/dashboard/baux" label="Loyers encaissés ce mois" value={`${formatAmount(data.rents.collectedThisMonth)} FCFA`} foot={rate === null ? "Aucun loyer attendu ce mois" : `${rate} % des ${formatAmount(data.rents.dueThisMonth)} FCFA attendus`} tone="green" />
        <Kpi href="/dashboard/baux?filtre=retard" label="Impayés en retard" value={`${formatAmount(data.rents.lateAmount)} FCFA`} foot={`${data.rents.lateCount} échéance${data.rents.lateCount > 1 ? "s" : ""} · ${data.rents.activeLeases} ${data.rents.activeLeases > 1 ? "baux" : "bail"} en cours`} tone={data.rents.lateCount ? "orange" : "blue"} />
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <Panel className="overflow-hidden">
          <PanelHeader title="Prochaines visites" action={<Link href="/dashboard/visites" className="text-sm font-semibold text-yc-electric hover:underline">Tout voir</Link>} />
          {data.nextVisits.length === 0 ? (
            <EmptyState title="Aucune visite prévue" description="Les demandes de visite de votre site apparaîtront ici." />
          ) : (
            <ul className="divide-y divide-yc-ink/[0.06]">
              {data.nextVisits.map((v) => (
                <li key={v.id} className="flex items-center gap-3 px-5 py-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[#E8EFFF] text-yc-electric"><IconClock size={18} /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{v.customer.firstName} {v.customer.lastName ?? ""} · {v.listing?.title ?? "Bien supprimé"}</span>
                    <span className="block text-sm text-yc-ink-soft"><span className="capitalize">{when(v.startAt)}</span>{v.status === "requested" ? " · à confirmer" : ""}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel className="overflow-hidden">
          <PanelHeader title="Loyers en retard" action={<Link href="/dashboard/baux?filtre=retard" className="text-sm font-semibold text-yc-electric hover:underline">Tout voir</Link>} />
          {data.late.length === 0 ? (
            <EmptyState title="Aucun retard" description="Tous les loyers échus sont encaissés." />
          ) : (
            <ul className="divide-y divide-yc-ink/[0.06]">
              {data.late.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{p.lease.occupant.firstName} {p.lease.occupant.lastName ?? ""} · {p.lease.listing.title}</span>
                    <span className="block text-sm text-yc-ink-soft">Échéance du {formatDate(p.dueDate)} · {p.lease.reference}</span>
                  </span>
                  <span className="yc-num shrink-0 font-bold text-[#C2410C]">{formatAmount(p.amountDue - p.amountPaid)} FCFA</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}
