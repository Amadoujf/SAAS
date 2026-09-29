import Link from "next/link";
import { withTenant, autoOverview, listLeads, listTestDrives } from "@yamacommerce/database";
import { hasPermission, type Permission } from "@yamacommerce/auth";
import { INTEREST_LABELS, LEAD_LABELS, SOURCE_LABELS, formatNumber, timeIn } from "@/lib/auto/labels";
import { Panel, PanelHeader } from "@/components/yc/panel";
import { Pill } from "@/components/yc/status-pill";
import { ButtonLink } from "@/components/yc/button";
import { EmptyState } from "@/components/yc/empty-state";
import { IconChevronRight, IconPlus } from "@/components/yc/icons";

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

/** Vue d'ensemble de la concession : essais du jour, demandes nouvelles, stock, encaissé du mois. */
export async function AutoOverview({ tenantId, permissions, greeting }: { tenantId: string; permissions: string[]; greeting: React.ReactNode }) {
  const can = (p: Permission) => hasPermission(permissions, p);
  const data = await withTenant(tenantId, async (tx) => {
    const kpi = await autoOverview(tx, tenantId);
    return { kpi, drives: await listTestDrives(tx, tenantId, { date: kpi.today, status: ["requested", "confirmed"] }), fresh: await listLeads(tx, tenantId, { status: ["new"], take: 6 }) };
  });
  const { kpi } = data;
  return (
    <>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>{greeting}<p className="mt-1 text-yc-ink-soft">Votre showroom aujourd&apos;hui.</p></div>
        <div className="flex gap-2">
          {can("reservations.update_status") && <ButtonLink href="/dashboard/essais#saisir" variant="secondary">Saisir un essai</ButtonLink>}
          {can("listings.create") && <ButtonLink href="/dashboard/vehicules/nouveau" variant="royal"><IconPlus size={18} /> Véhicule</ButtonLink>}
        </div>
      </div>
      <div className="mb-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Kpi href="/dashboard/essais" label="Essais aujourd'hui" value={String(kpi.drivesToday)} foot="Réservés et à venir" tone={kpi.drivesToday ? "orange" : "blue"} />
        <Kpi href="/dashboard/prospects" label="Nouvelles demandes" value={String(kpi.newLeads)} foot={`${kpi.openLeads} prospect${kpi.openLeads > 1 ? "s" : ""} en cours`} tone={kpi.newLeads ? "orange" : "blue"} />
        <Kpi href="/dashboard/vehicules" label="En stock" value={String(kpi.available)} foot={`${kpi.reserved} réservé${kpi.reserved > 1 ? "s" : ""} · ${kpi.incoming} en arrivage · ${kpi.sold} vendu${kpi.sold > 1 ? "s" : ""}`} />
        <Kpi href="/dashboard/dossiers" label="Encaissé ce mois" value={`${formatNumber(kpi.collectedThisMonth)} F`} foot={`${kpi.salesOpen} dossier${kpi.salesOpen > 1 ? "s" : ""} de vente en cours`} tone="green" />
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <Panel className="overflow-hidden">
          <PanelHeader title="Essais du jour" action={<Link href="/dashboard/essais" className="text-sm font-semibold text-yc-electric hover:underline">Agenda</Link>} />
          {data.drives.length === 0 ? <EmptyState title="Aucun essai aujourd'hui" description="" /> : (
            <ul className="divide-y divide-yc-ink/[0.06]">{data.drives.map((d) => (
              <li key={d.id} className="flex items-center gap-4 px-5 py-3">
                <span className="yc-num w-16 shrink-0 font-bold">{timeIn(d.startAt, kpi.timezone)}</span>
                <span className="min-w-0 flex-1"><span className="block truncate font-medium">{d.listing!.title}</span><span className="block truncate text-sm text-yc-ink-soft">{d.customer.firstName} {d.customer.lastName ?? ""} · {d.customer.phone}</span></span>
              </li>
            ))}</ul>
          )}
        </Panel>
        <Panel className="overflow-hidden">
          <PanelHeader title="Demandes à traiter" action={<Link href="/dashboard/prospects" className="text-sm font-semibold text-yc-electric hover:underline">Prospects</Link>} />
          {data.fresh.length === 0 ? <EmptyState title="Toutes les demandes sont traitées" description="" /> : (
            <ul className="divide-y divide-yc-ink/[0.06]">{data.fresh.map((l) => (
              <li key={l.id}><Link href={`/dashboard/prospects?ouvert=${l.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-yc-ivory-50">
                <span className="min-w-0 flex-1"><span className="block truncate font-medium">{l.customer.firstName} {l.customer.lastName ?? ""} · {INTEREST_LABELS[l.interest]}</span><span className="block truncate text-sm text-yc-ink-soft">{l.listing?.title ?? "Sans véhicule précis"} · {SOURCE_LABELS[l.source]}</span></span>
                <Pill tone={LEAD_LABELS[l.status]!.tone}>{LEAD_LABELS[l.status]!.label}</Pill>
              </Link></li>
            ))}</ul>
          )}
        </Panel>
      </div>
    </>
  );
}
