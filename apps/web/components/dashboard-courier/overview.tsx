import Link from "next/link";
import { withTenant, courierOverview, expectedCollection, listCourierJobs, listCouriers } from "@yamacommerce/database";
import { hasPermission, type Permission } from "@yamacommerce/auth";
import { JOB_LABELS, formatNumber, zoneLabel } from "@/lib/courier/labels";
import { Panel, PanelHeader } from "@/components/yc/panel";
import { Pill } from "@/components/yc/status-pill";
import { ButtonLink } from "@/components/yc/button";
import { EmptyState } from "@/components/yc/empty-state";
import { IconChevronRight, IconPlus } from "@/components/yc/icons";

function Kpi({ href, label, value, foot, tone = "blue" }: { href: string; label: string; value: string; foot: string; tone?: "blue" | "orange" | "green" | "red" }) {
  const color = tone === "orange" ? "text-[#C2410C]" : tone === "green" ? "text-[rgb(4_120_87)]" : tone === "red" ? "text-yc-danger" : "text-yc-ink";
  return (
    <Link href={href} className="yc-focus group rounded-xl bg-white p-4 shadow-[0_1px_2px_rgb(12_22_48/0.04),0_8px_24px_-16px_rgb(12_22_48/0.12)] ring-1 ring-yc-ink/[0.07] transition-shadow hover:shadow-[0_12px_30px_-14px_rgb(12_22_48/0.25)] sm:p-5">
      <span className="flex items-center justify-between text-[13px] text-yc-ink-soft sm:text-[15px]">{label}<IconChevronRight size={16} className="transition-transform group-hover:translate-x-0.5" /></span>
      <span className={`yc-num mt-1 block text-[20px] font-bold tracking-[-0.02em] sm:text-[26px] ${color}`}>{value}</span>
      <span className="mt-0.5 block text-xs text-yc-ink-soft sm:text-sm">{foot}</span>
    </Link>
  );
}

/** Vue d'ensemble du bureau : file à affecter, livreurs sur la route, échecs, espèces en circulation. */
export async function CourierOverview({ tenantId, permissions, greeting }: { tenantId: string; permissions: string[]; greeting: React.ReactNode }) {
  const can = (p: Permission) => hasPermission(permissions, p);
  const data = await withTenant(tenantId, async (tx) => ({
    kpi: await courierOverview(tx, tenantId),
    toAssign: await listCourierJobs(tx, tenantId, { status: ["pending", "failed"], take: 8 }),
    couriers: (await listCouriers(tx, tenantId)).filter((c) => c.isActive),
  }));
  const { kpi } = data;
  return (
    <>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>{greeting}<p className="mt-1 text-yc-ink-soft">Vos courses aujourd&apos;hui.</p></div>
        {can("delivery.assign") && <ButtonLink href="/dashboard/courses#nouvelle" variant="royal"><IconPlus size={18} /> Nouvelle course</ButtonLink>}
      </div>
      <div className="mb-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Kpi href="/dashboard/courses?file=a-affecter" label="À affecter" value={String(kpi.pending)} foot={`${kpi.failed} en échec · ${kpi.returning} en retour`} tone={kpi.pending ? "orange" : "blue"} />
        <Kpi href="/dashboard/courses" label="Sur la route" value={String(kpi.onTheRoad)} foot={`${data.couriers.length} livreur${data.couriers.length > 1 ? "s" : ""} actif${data.couriers.length > 1 ? "s" : ""}`} />
        <Kpi href="/dashboard/courses?file=terminees" label="Livrées aujourd'hui" value={String(kpi.deliveredToday)} foot={`${kpi.failedToday} échec${kpi.failedToday > 1 ? "s" : ""} aujourd'hui`} tone="green" />
        <Kpi href="/dashboard/caisse" label="Espèces chez les livreurs" value={`${formatNumber(kpi.cashInHands)} F`} foot="À verser au bureau" tone={kpi.cashInHands ? "red" : "blue"} />
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <Panel className="overflow-hidden">
          <PanelHeader title="À affecter et échecs" action={<Link href="/dashboard/courses" className="text-sm font-semibold text-yc-electric hover:underline">Courses</Link>} />
          {data.toAssign.length === 0 ? <EmptyState title="Tout est affecté" description="" /> : (
            <ul className="divide-y divide-yc-ink/[0.06]">{data.toAssign.map((j) => (
              <li key={j.id}><Link href={`/dashboard/courses/${j.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-yc-ivory-50">
                <span className="min-w-0 flex-1"><span className="block truncate font-medium">{j.recipientName} · {j.zone ? zoneLabel(j.zone) : ""}</span><span className="block truncate text-sm text-yc-ink-soft"><span className="yc-num">{j.reference}</span> · {j.sender.firstName}{expectedCollection(j) ? ` · ${formatNumber(expectedCollection(j))} F à encaisser` : ""}</span></span>
                <Pill tone={JOB_LABELS[j.status]!.tone}>{JOB_LABELS[j.status]!.label}</Pill>
              </Link></li>
            ))}</ul>
          )}
        </Panel>
        <Panel className="overflow-hidden">
          <PanelHeader title="Livreurs" action={<Link href="/dashboard/livreurs" className="text-sm font-semibold text-yc-electric hover:underline">Tous</Link>} />
          {data.couriers.length === 0 ? <EmptyState title="Aucun livreur" description="Ajoutez vos livreurs pour affecter les courses." /> : (
            <ul className="divide-y divide-yc-ink/[0.06]">{data.couriers.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                <span className="min-w-0 truncate font-medium">{c.name ?? c.phone}</span>
                <span className="yc-num shrink-0 text-yc-ink-soft">{c.activeJobs} en cours · <span className={c.cash.amount ? "font-semibold text-[#C2410C]" : ""}>{formatNumber(c.cash.amount)} F</span></span>
              </li>
            ))}</ul>
          )}
        </Panel>
      </div>
    </>
  );
}
