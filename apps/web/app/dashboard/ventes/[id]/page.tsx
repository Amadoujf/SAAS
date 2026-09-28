import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { withTenant, getOrder, paymentSummary } from "@yamacommerce/database";
import { hasPermission } from "@yamacommerce/auth";
import { requireRestaurantPage } from "@/lib/restaurant/guard";
import { KITCHEN_LABELS, MODE_LABELS, formatXof, optionsText, timeIn } from "@/lib/restaurant/labels";
import { PageHeader, Panel, PanelHeader } from "@/components/yc/panel";
import { Pill } from "@/components/yc/status-pill";
import { OrderActions, PaymentsPanel } from "@/components/dashboard-restaurant/order-panels";

export const metadata: Metadata = { title: "Commande — Y-COM", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const CHANNELS: Record<string, string> = { web: "Site", qr: "QR code de table", dashboard: "Salle", phone: "Téléphone", whatsapp: "WhatsApp" };

export default async function RestaurantOrderPage({ params }: { params: { id: string } }) {
  const membership = await requireRestaurantPage("orders.view");
  if (!/^[0-9a-f-]{36}$/.test(params.id)) notFound();
  const data = await withTenant(membership.tenantId, async (tx) => ({
    o: await getOrder(tx, membership.tenantId, params.id),
    tz: (await tx.tenant.findUnique({ where: { id: membership.tenantId }, select: { timezone: true } }))?.timezone || "Africa/Dakar",
  }));
  const o = data.o;
  if (!o) notFound();
  const can = (p: Parameters<typeof hasPermission>[1]) => hasPermission(membership.permissions, p);
  const st = KITCHEN_LABELS[o.status] ?? KITCHEN_LABELS.new!;
  const pay = paymentSummary(o.total, o.payments);
  return (
    <>
      <PageHeader
        eyebrow={<a href="/dashboard/ventes" className="hover:underline">Commandes</a>}
        title={<span className="flex flex-wrap items-center gap-3">Commande n° {o.number.split("-")[1]}<Pill tone={st.tone}>{st.label}</Pill></span>}
        description={`${o.table ? `Table ${o.table.label}` : MODE_LABELS[o.mode]?.label} · ${CHANNELS[o.channel] ?? o.channel} · ${timeIn(o.createdAt, data.tz)}${o.requestedFor ? ` · pour ${timeIn(o.requestedFor, data.tz)}` : ""}`}
      />
      <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
        <div className="grid content-start gap-5">
          <Panel className="overflow-hidden">
            <PanelHeader title="Détail" />
            <ul className="divide-y divide-yc-ink/[0.06]">
              {o.items.map((i) => (
                <li key={i.id} className="flex justify-between gap-4 px-5 py-3 text-sm">
                  <span className="min-w-0">
                    <span className="font-semibold"><span className="yc-num">{i.quantity} ×</span> {i.nameSnapshot}</span>
                    {optionsText(i.options) && <span className="block text-yc-ink-soft">{optionsText(i.options)}</span>}
                    {i.note && <span className="block font-medium text-[#B45309]">« {i.note} »</span>}
                  </span>
                  <span className="yc-num shrink-0 font-semibold">{formatXof(i.total)}</span>
                </li>
              ))}
            </ul>
            <dl className="grid gap-1 border-t border-yc-ink/[0.06] px-5 py-4 text-sm">
              {o.deliveryFee > 0 && <div className="flex justify-between"><dt>Livraison</dt><dd className="yc-num">{formatXof(o.deliveryFee)}</dd></div>}
              <div className="flex justify-between text-base font-bold"><dt>Total</dt><dd className="yc-num">{formatXof(o.total)}</dd></div>
              <div className="flex justify-between"><dt>Règlement</dt><dd>{pay.state === "paid" ? "Réglée" : pay.state === "partial" ? `Reste ${formatXof(pay.due)}` : "Non réglée"}</dd></div>
            </dl>
          </Panel>
          <PaymentsPanel
            orderId={o.id}
            total={o.total}
            canceled={o.status === "canceled"}
            canRecord={can("orders.update_status")}
            canVoid={can("payments.refund")}
            payments={o.payments.map((p) => ({ id: p.id, receiptNumber: p.receiptNumber, amount: p.amount, method: p.method, reference: p.reference, paidAt: p.paidAt.toISOString(), voidedAt: p.voidedAt?.toISOString() ?? null, voidReason: p.voidReason }))}
          />
        </div>
        <div className="grid content-start gap-5">
          {!["completed", "canceled"].includes(o.status) && <OrderActions orderId={o.id} status={o.status} canMove={can("orders.update_status")} canCancel={can("orders.cancel")} />}
          <Panel className="p-5">
            <h2 className="text-[16px] font-bold">Client</h2>
            <p className="mt-2 text-sm">{o.customerName}{o.customerPhone ? <> · <a href={`tel:${o.customerPhone}`} className="font-semibold text-yc-electric">{o.customerPhone}</a></> : null}</p>
            {o.deliveryAddress && <p className="mt-1 text-sm"><strong>Adresse :</strong> {o.deliveryAddress}</p>}
            {o.note && <p className="mt-1 text-sm"><strong>Note :</strong> {o.note}</p>}
          </Panel>
          <Panel className="p-5">
            <h2 className="text-[16px] font-bold">Historique</h2>
            <ol className="mt-3 grid gap-2 text-sm">
              {o.events.map((e) => (
                <li key={e.id} className="flex gap-3"><span className="yc-num w-14 shrink-0 text-yc-ink-soft">{timeIn(e.createdAt, data.tz)}</span><span>{e.toStatus === "new" ? "Reçue" : KITCHEN_LABELS[e.toStatus]?.label}{e.note ? ` — ${e.note}` : ""}<span className="text-yc-ink-soft"> · {e.changedByType === "customer" ? "client" : e.changedByType === "system" ? "automatique" : "équipe"}</span></span></li>
              ))}
            </ol>
          </Panel>
        </div>
      </div>
    </>
  );
}
