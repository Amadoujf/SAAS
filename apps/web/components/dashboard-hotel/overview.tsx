import Link from "next/link";
import { withTenant, hotelOverview, listStays } from "@yamacommerce/database";
import { hasPermission, type Permission } from "@yamacommerce/auth";
import { STAY_STATUS_LABELS, dateOnly, formatXof, guestsLabel, nightsLabel, shortDate } from "@/lib/hotel/labels";
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

function StayList({ rows, empty, what }: { rows: Awaited<ReturnType<typeof listStays>>; empty: string; what: "arrival" | "departure" }) {
  if (!rows.length) return <EmptyState title={empty} description="" />;
  return (
    <ul className="divide-y divide-yc-ink/[0.06]">
      {rows.map((s) => {
        const inHouse = Boolean(s.stay?.checkedInAt && !s.stay.checkedOutAt);
        const st = inHouse ? { label: "Sur place", tone: "success" as const } : STAY_STATUS_LABELS[s.status]!;
        return (
          <li key={s.id}>
            <Link href={`/dashboard/sejours/${s.id}`} className="flex items-center gap-4 px-5 py-3 hover:bg-yc-ivory-50">
              <span className="grid h-10 w-12 shrink-0 place-items-center rounded-lg bg-[#EEF3FF] text-sm font-bold text-yc-royal">{s.stay?.room.number}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{s.customer.firstName} {s.customer.lastName ?? ""} · {s.listing?.title}</span>
                <span className="block text-sm text-yc-ink-soft">{s.stay ? `${nightsLabel(s.stay.nights)} · ${guestsLabel(s.stay.adults, s.stay.children)}` : ""}{what === "arrival" && s.stay ? ` · départ ${shortDate(dateOnly(s.stay.departure))}` : ""}</span>
              </span>
              <Pill tone={st.tone}>{st.label}</Pill>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** Vue d'ensemble d'un établissement : occupation, arrivées, départs, ménage, encaissements. */
export async function HotelOverview({ tenantId, permissions, greeting }: { tenantId: string; permissions: string[]; greeting: React.ReactNode }) {
  const can = (p: Permission) => hasPermission(permissions, p);
  const data = await withTenant(tenantId, async (tx) => {
    const kpi = await hotelOverview(tx, tenantId);
    return {
      kpi,
      arrivals: await listStays(tx, tenantId, { arrivalOn: kpi.today, status: ["requested", "confirmed"] }),
      departures: await listStays(tx, tenantId, { departureOn: kpi.today, status: ["confirmed", "completed"] }),
      balance: (await listStays(tx, tenantId, { inHouse: true, status: ["confirmed"] })).reduce((sum, s) => sum + Math.max(0, (s.totalAmount ?? 0) - s.payments.filter((p) => !p.voidedAt).reduce((t, p) => t + p.amount, 0)), 0),
    };
  });
  const { kpi } = data;
  return (
    <>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>{greeting}<p className="mt-1 text-yc-ink-soft">Votre établissement aujourd&apos;hui.</p></div>
        {can("reservations.update_status") && <ButtonLink href="/dashboard/sejours/nouveau" variant="royal"><IconPlus size={18} /> Séjour</ButtonLink>}
      </div>
      <div className="mb-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Kpi href="/dashboard/planning" label="Occupation ce soir" value={`${kpi.occupancy} %`} foot={`${kpi.tonight} chambre${kpi.tonight > 1 ? "s" : ""} sur ${kpi.rooms}`} tone="green" />
        <Kpi href="/dashboard/sejours?file=arrivees" label="Arrivées du jour" value={String(kpi.arrivals)} foot={`${kpi.inHouse} client${kpi.inHouse > 1 ? "s" : ""} sur place`} tone={kpi.arrivals ? "orange" : "blue"} />
        <Kpi href="/dashboard/sejours?file=departs" label="Départs du jour" value={String(kpi.departures)} foot={`Reste à encaisser sur place : ${formatXof(data.balance)}`} />
        <Kpi href="/dashboard/chambres" label="Chambres à nettoyer" value={String(kpi.dirty)} foot={kpi.pending ? `${kpi.pending} réservation${kpi.pending > 1 ? "s" : ""} à confirmer` : "Aucune demande en attente"} tone={kpi.dirty ? "orange" : "blue"} />
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <Panel className="overflow-hidden">
          <PanelHeader title="Arrivées du jour" action={<Link href="/dashboard/sejours?file=arrivees" className="text-sm font-semibold text-yc-electric hover:underline">Tout voir</Link>} />
          <StayList rows={data.arrivals} empty="Aucune arrivée aujourd'hui" what="arrival" />
        </Panel>
        <Panel className="overflow-hidden">
          <PanelHeader title="Départs du jour" action={<Link href="/dashboard/sejours?file=departs" className="text-sm font-semibold text-yc-electric hover:underline">Tout voir</Link>} />
          <StayList rows={data.departures} empty="Aucun départ aujourd'hui" what="departure" />
        </Panel>
      </div>
    </>
  );
}
