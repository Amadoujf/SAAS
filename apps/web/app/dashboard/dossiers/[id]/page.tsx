import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { withTenant, getSale } from "@yamacommerce/database";
import { hasPermission } from "@yamacommerce/auth";
import { requireAutoPage } from "@/lib/auto/guard";
import { PAYMENT_METHOD_LABELS, SALE_LABELS, formatNumber } from "@/lib/auto/labels";
import { PageHeader, Panel, PanelHeader } from "@/components/yc/panel";
import { Pill } from "@/components/yc/status-pill";
import { SaleClose, SalePayment, VoidPayment } from "@/components/dashboard-auto/sale-panels";

export const metadata: Metadata = { title: "Dossier de vente — Y-COM", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const KIND: Record<string, string> = { deposit: "Acompte", balance: "Solde", other: "Autre" };
const when = (d: Date) => new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Dakar" }).format(d);

export default async function SalePage({ params }: { params: { id: string } }) {
  const membership = await requireAutoPage("reservations.view");
  if (!/^[0-9a-f-]{36}$/.test(params.id)) notFound();
  const s = await withTenant(membership.tenantId, (tx) => getSale(tx, membership.tenantId, params.id));
  if (!s?.vehicleSale || !s.listing) notFound();
  const sale = s.vehicleSale;
  const valid = s.payments.filter((p) => !p.voidedAt);
  const paid = valid.reduce((t, p) => t + p.amount, 0);
  const total = s.totalAmount ?? 0;
  const remaining = Math.max(0, total - paid);
  const live = s.status === "confirmed" || s.status === "requested";
  const can = (p: Parameters<typeof hasPermission>[1]) => hasPermission(membership.permissions, p);
  return (
    <>
      <PageHeader eyebrow={<Link href="/dashboard/dossiers" className="hover:underline">Dossiers de vente</Link>} title={`${s.reference} · ${s.listing.title}`} description={<span className="flex flex-wrap items-center gap-2"><Pill tone={SALE_LABELS[s.status]?.tone ?? "neutral"}>{SALE_LABELS[s.status]?.label}</Pill>{sale.deliveredAt && <span>Remis le {when(sale.deliveredAt)}</span>}</span>} />
      <div className="grid gap-5 lg:grid-cols-[1fr_400px]">
        <div className="grid content-start gap-5">
          <Panel>
            <PanelHeader title="Montants" />
            <dl className="grid gap-2 px-5 pb-5 text-[15px]">
              <div className="flex justify-between"><dt>Prix convenu</dt><dd className="yc-num font-semibold">{formatNumber(sale.agreedPrice)} FCFA</dd></div>
              {sale.tradeInValue > 0 && <div className="flex justify-between gap-4"><dt>Reprise <span className="text-yc-ink-soft">({sale.tradeInDescription})</span></dt><dd className="yc-num font-semibold">− {formatNumber(sale.tradeInValue)} FCFA</dd></div>}
              <div className="flex justify-between border-t border-yc-ink/10 pt-2"><dt className="font-semibold">À payer par le client</dt><dd className="yc-num font-bold">{formatNumber(total)} FCFA</dd></div>
              <div className="flex justify-between text-[rgb(4_120_87)]"><dt>Encaissé</dt><dd className="yc-num font-semibold">{formatNumber(paid)} FCFA</dd></div>
              <div className="flex justify-between"><dt className="font-semibold">Reste à encaisser</dt><dd className="yc-num text-[18px] font-bold">{formatNumber(remaining)} FCFA</dd></div>
            </dl>
          </Panel>
          <Panel className="overflow-hidden">
            <PanelHeader title="Encaissements" description="Reçus numérotés du service commun des réservations. Une annulation garde la ligne visible, avec son motif." />
            {s.payments.length === 0 ? <p className="px-5 pb-5 text-sm text-yc-ink-soft">Aucun encaissement pour l&apos;instant.</p> : (
              <ul className="divide-y divide-yc-ink/[0.06]">
                {s.payments.map((p) => (
                  <li key={p.id} className={`flex items-center justify-between gap-3 px-5 py-3 text-sm ${p.voidedAt ? "text-yc-ink-soft line-through" : ""}`}>
                    <span><span className="font-semibold">{p.receiptNumber}</span> · {KIND[p.kind]} · {PAYMENT_METHOD_LABELS[p.method] ?? p.method}{p.reference ? ` · ${p.reference}` : ""}<span className="block text-xs no-underline">{when(p.paidAt)}{p.voidReason ? ` — annulé : ${p.voidReason}` : ""}</span></span>
                    <span className="flex items-center gap-3"><span className="yc-num font-semibold">{formatNumber(p.amount)} F</span>{!p.voidedAt && live && can("payments.refund") && <VoidPayment paymentId={p.id} />}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          <Panel className="overflow-hidden">
            <PanelHeader title="Historique" />
            <ol className="grid gap-2 px-5 pb-5 text-sm">{s.history.map((h) => <li key={h.id}><span className="text-yc-ink-soft">{when(h.createdAt)}</span> — {SALE_LABELS[h.toStatus]?.label ?? h.toStatus}{h.note ? ` : ${h.note}` : ""}</li>)}</ol>
          </Panel>
        </div>
        <div className="grid content-start gap-5">
          <Panel>
            <PanelHeader title="Client" />
            <div className="px-5 pb-5 text-sm">
              <p className="font-semibold">{s.customer.firstName} {s.customer.lastName ?? ""}</p>
              {s.customer.phone && <a href={`tel:${s.customer.phone}`} className="text-yc-electric">{s.customer.phone}</a>}
              <p className="mt-3"><Link href={`/dashboard/vehicules/${s.listing.id}`} className="font-semibold text-yc-electric hover:underline">Fiche du véhicule →</Link></p>
            </div>
          </Panel>
          {live && can("reservations.update_status") && remaining > 0 && <Panel><PanelHeader title="Encaisser" /><div className="px-5 pb-5"><SalePayment reservationId={s.id} remaining={remaining} /></div></Panel>}
          {live && can("reservations.update_status") && <Panel><PanelHeader title="Clôturer" /><div className="px-5 pb-5"><SaleClose reservationId={s.id} paidInFull={remaining === 0} hasPayments={valid.length > 0} canCancel={can("reservations.cancel")} /></div></Panel>}
        </div>
      </div>
    </>
  );
}
