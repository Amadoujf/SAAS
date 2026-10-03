import Link from "next/link";
import { withTenant, kitchenBoard, listTableBookings, restaurantOverview } from "@yamacommerce/database";
import { hasPermission, type Permission } from "@yamacommerce/auth";
import { KITCHEN_LABELS, MODE_LABELS, coversLabel, formatXof, timeIn } from "@/lib/restaurant/labels";
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

/** Vue d'ensemble du restaurant : service en cours, encaissé du jour, réservations. */
export async function RestaurantOverview({ tenantId, permissions, greeting }: { tenantId: string; permissions: string[]; greeting: React.ReactNode }) {
  const can = (p: Permission) => hasPermission(permissions, p);
  const data = await withTenant(tenantId, async (tx) => {
    const kpi = await restaurantOverview(tx, tenantId);
    return {
      kpi,
      board: await kitchenBoard(tx, tenantId),
      bookings: (await listTableBookings(tx, tenantId, { date: kpi.today, status: ["requested", "confirmed"] })).filter((b) => b.startAt.getTime() > Date.now() - 30 * 60_000),
    };
  });
  const { kpi } = data;
  return (
    <>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>{greeting}<p className="mt-1 text-yc-ink-soft">Votre service aujourd&apos;hui.</p></div>
        <div className="flex gap-2">
          <ButtonLink href="/dashboard/cuisine" variant="secondary">Écran cuisine</ButtonLink>
          {can("orders.update_status") && <ButtonLink href="/dashboard/ventes/nouvelle" variant="royal"><IconPlus size={18} /> Commande</ButtonLink>}
        </div>
      </div>
      <div className="mb-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Kpi href="/dashboard/cuisine" label="En cuisine" value={String(kpi.inKitchen)} foot={kpi.ready ? `${kpi.ready} prête${kpi.ready > 1 ? "s" : ""} à remettre` : "Aucune commande prête en attente"} tone={kpi.inKitchen ? "orange" : "blue"} />
        <Kpi href="/dashboard/ventes" label="Commandes du jour" value={String(kpi.ordersToday)} foot={`${kpi.byMode.dine_in} sur place · ${kpi.byMode.takeaway} à emporter · ${kpi.byMode.delivery} livrées`} />
        <Kpi href="/dashboard/ventes?file=a-encaisser" label="Encaissé aujourd'hui" value={formatXof(kpi.collectedToday)} foot={`Commandé : ${formatXof(kpi.orderedAmount)}`} tone="green" />
        <Kpi href="/dashboard/salle" label="Réservations du jour" value={String(kpi.bookingsToday)} foot={`${coversLabel(kpi.coversToday)}${kpi.soldOut ? ` · ${kpi.soldOut} plat${kpi.soldOut > 1 ? "s" : ""} épuisé${kpi.soldOut > 1 ? "s" : ""}` : ""}`} />
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <Panel className="overflow-hidden">
          <PanelHeader title="Commandes en cours" action={<Link href="/dashboard/cuisine" className="text-sm font-semibold text-yc-electric hover:underline">Écran cuisine</Link>} />
          {data.board.length === 0 ? (
            <EmptyState title="Aucune commande en cours" description="" />
          ) : (
            <ul className="divide-y divide-yc-ink/[0.06]">
              {data.board.slice(0, 8).map((o) => {
                const st = KITCHEN_LABELS[o.status]!;
                return (
                  <li key={o.id}>
                    <Link href={`/dashboard/ventes/${o.id}`} className="flex items-center gap-4 px-5 py-3 hover:bg-yc-ivory-50">
                      <span className="yc-num grid h-10 w-14 shrink-0 place-items-center rounded-lg bg-[#EEF3FF] text-sm font-bold text-yc-royal">{o.number.split("-")[1]}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{o.table ? `Table ${o.table.label}` : MODE_LABELS[o.mode]?.label} · {o.customerName}</span>
                        <span className="block truncate text-sm text-yc-ink-soft">{o.items.map((i) => `${i.quantity} × ${i.nameSnapshot}`).join(", ")}</span>
                      </span>
                      <Pill tone={st.tone}>{st.label}</Pill>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
        <Panel className="overflow-hidden">
          <PanelHeader title="Prochaines réservations" action={<Link href="/dashboard/salle" className="text-sm font-semibold text-yc-electric hover:underline">Tout voir</Link>} />
          {data.bookings.length === 0 ? (
            <EmptyState title="Plus de réservation aujourd'hui" description="" />
          ) : (
            <ul className="divide-y divide-yc-ink/[0.06]">
              {data.bookings.slice(0, 8).map((b) => (
                <li key={b.id} className="flex items-center gap-4 px-5 py-3">
                  <span className="yc-num w-16 shrink-0 text-[17px] font-bold">{timeIn(b.startAt, kpi.timezone)}</span>
                  <span className="min-w-0 flex-1 truncate font-medium">{b.customer.firstName} {b.customer.lastName ?? ""} · {coversLabel(b.quantity)}</span>
                  <span className="text-sm text-yc-ink-soft">{b.tableBooking?.table ? `Table ${b.tableBooking.table.label}` : "À placer"}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}
