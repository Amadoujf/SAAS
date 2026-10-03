import type { Metadata } from "next";
import { withTenant, courierReconciliation } from "@yamacommerce/database";
import { hasPermission } from "@yamacommerce/auth";
import { requireCourierPage } from "@/lib/courier/guard";
import { SETTLEMENT_METHOD_LABELS, dateTimeIn, formatNumber } from "@/lib/courier/labels";
import { PageHeader, Panel, PanelHeader } from "@/components/yc/panel";
import { EmptyState } from "@/components/yc/empty-state";
import { RemitForm, SettleForm } from "@/components/dashboard-courier/courier-panels";

export const metadata: Metadata = { title: "Caisse et reversements — Y-COM", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * Rapprochement des espèces : ce que chaque livreur détient, ce qui a été versé au bureau
 * (écarts motivés), ce qui est dû à chaque expéditeur (encaissements − tarifs à sa charge).
 */
export default async function CashPage({ searchParams }: { searchParams: { recu?: string } }) {
  const membership = await requireCourierPage("payments.view");
  const tenantId = membership.tenantId;
  const data = await withTenant(tenantId, async (tx) => ({ rec: await courierReconciliation(tx, tenantId), tz: (await tx.tenant.findUnique({ where: { id: tenantId }, select: { timezone: true } }))?.timezone || "Africa/Dakar" }));
  const { rec, tz } = data;
  const canRecord = hasPermission(membership.permissions, "reservation_payments.record");
  const holders = rec.couriers.filter((c) => c.cash.amount > 0);
  const receipt = searchParams.recu && /^(VER|REV)-\d{4}-\d{6}$/.test(searchParams.recu) ? searchParams.recu : null;
  return (
    <>
      <PageHeader eyebrow="Gestion" title="Caisse et reversements" description="Espèces encaissées à la livraison : chez le livreur, puis au bureau (reçu VER-), puis reversées à l'expéditeur (reçu REV-). Chaque course n'est comptée qu'une fois." />
      {receipt && <p role="status" className="mb-5 rounded-xl bg-[rgb(4_120_87/0.08)] px-4 py-3 text-sm font-semibold text-[rgb(4_120_87)] ring-1 ring-[rgb(4_120_87/0.25)]">{receipt.startsWith("VER") ? "Versement enregistré" : "Reversement enregistré"} : reçu <span className="yc-num">{receipt}</span>.</p>}
      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          { k: "Chez les livreurs", v: rec.totals.inHands, tone: "text-[#C2410C]" },
          { k: "Dû aux expéditeurs", v: rec.totals.owedToSenders, tone: "text-yc-ink" },
          { k: "Écarts de versement", v: rec.totals.shortfalls, tone: rec.totals.shortfalls ? "text-yc-danger" : "text-yc-ink" },
        ].map((x) => <Panel key={x.k} className="p-4"><p className="text-sm text-yc-ink-soft">{x.k}</p><p className={`yc-num text-[24px] font-bold ${x.tone}`}>{formatNumber(x.v)} F</p></Panel>)}
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        <Panel className="overflow-hidden">
          <PanelHeader title="Espèces à verser par les livreurs" />
          {holders.length === 0 ? <EmptyState title="Tout est versé" description="" /> : (
            <ul className="divide-y divide-yc-ink/[0.06]">
              {holders.map((c) => (
                <li key={c.id} className="grid gap-2 px-5 py-4">
                  <p className="flex justify-between gap-3"><span className="font-semibold">{c.name ?? c.phone}</span><span className="yc-num font-bold">{formatNumber(c.cash.amount)} F <span className="font-normal text-yc-ink-soft">· {c.cash.jobs} course{c.cash.jobs > 1 ? "s" : ""}</span></span></p>
                  {canRecord && <RemitForm delivererId={c.id} expected={c.cash.amount} />}
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel className="overflow-hidden">
          <PanelHeader title="À reverser aux expéditeurs" />
          {rec.balances.length === 0 ? <EmptyState title="Rien à reverser" description="" /> : (
            <ul className="divide-y divide-yc-ink/[0.06]">
              {rec.balances.map((b) => (
                <li key={b.sender.id} className="grid gap-2 px-5 py-4">
                  <p className="flex flex-wrap justify-between gap-3"><span className="font-semibold">{b.sender.firstName} {b.sender.lastName ?? ""}</span><span className="yc-num font-bold">{formatNumber(b.amount)} F</span></p>
                  <p className="yc-num text-xs text-yc-ink-soft">{b.jobCount} course{b.jobCount > 1 ? "s" : ""} : encaissé {formatNumber(b.codTotal)} − tarifs {formatNumber(b.feesDeducted)}{b.notYetRemitted.jobs ? ` · ${formatNumber(b.notYetRemitted.amount)} F encore chez les livreurs (pas encore reversable)` : ""}</p>
                  {canRecord && b.jobCount > 0 && <SettleForm senderId={b.sender.id} amount={b.amount} />}
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel className="overflow-hidden">
          <PanelHeader title="Derniers versements" />
          {rec.remittances.length === 0 ? <p className="px-5 pb-4 text-sm text-yc-ink-soft">Aucun.</p> : (
            <ul className="divide-y divide-yc-ink/[0.06] text-sm">
              {rec.remittances.map((r) => <li key={r.id} className="flex flex-wrap justify-between gap-2 px-5 py-2.5"><span><span className="yc-num font-semibold">{r.receiptNumber}</span> · {r.deliverer.name ?? r.deliverer.phone}{r.discrepancyNote ? <span className="block text-xs text-yc-danger">Écart {formatNumber(r.receivedAmount - r.expectedAmount)} F : {r.discrepancyNote}</span> : null}</span><span className="yc-num">{formatNumber(r.receivedAmount)} F · {dateTimeIn(r.receivedAt, tz)}</span></li>)}
            </ul>
          )}
        </Panel>
        <Panel className="overflow-hidden">
          <PanelHeader title="Derniers reversements" />
          {rec.settlements.length === 0 ? <p className="px-5 pb-4 text-sm text-yc-ink-soft">Aucun.</p> : (
            <ul className="divide-y divide-yc-ink/[0.06] text-sm">
              {rec.settlements.map((s) => <li key={s.id} className="flex flex-wrap justify-between gap-2 px-5 py-2.5"><span><span className="yc-num font-semibold">{s.receiptNumber}</span> · {s.sender.firstName} {s.sender.lastName ?? ""}</span><span className="yc-num">{formatNumber(s.amount)} F · {SETTLEMENT_METHOD_LABELS[s.method]} · {dateTimeIn(s.settledAt, tz)}</span></li>)}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}
