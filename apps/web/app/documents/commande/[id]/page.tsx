import { ycFontVariables } from "@/lib/yc-fonts";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { withTenant, getOrderDetailForTenant } from "@yamacommerce/database";
import { resolveDashboardTenant } from "@/lib/orders/dashboard-pipeline";
import { getCurrentTenantMembership } from "@/lib/current-tenant";
import { formatAmount, formatDate } from "@/lib/format";
import { PAYMENT_METHOD_LABEL } from "@/lib/commerce/order-status-meta";
import { PrintButton } from "./print-button";

export const metadata: Metadata = { title: "Document — YamaCommerce", robots: { index: false, follow: false } };

const TITLES = { preparation: "Bon de préparation", livraison: "Bon de livraison", facture: "Facture" } as const;

/**
 * Documents imprimables (A4, « Enregistrer en PDF » du navigateur). Hors du layout
 * dashboard pour une page d'impression propre ; mêmes gardes de permission et
 * d'isolation. La facture n'est affichée que si elle a réellement été émise (commande
 * payée) — jamais une facture générée à la volée pour une commande impayée.
 */
export default async function OrderDocumentPage({ params, searchParams }: { params: { id: string }; searchParams: { type?: string } }) {
  const type = (searchParams.type ?? "preparation") as keyof typeof TITLES;
  if (!(type in TITLES)) notFound();
  const ctx = await resolveDashboardTenant(type === "facture" ? "invoices.view" : "orders.view");
  if (!ctx) redirect("/connexion");
  const membership = await getCurrentTenantMembership();
  const order = await withTenant(ctx.tenantId, (tx) => getOrderDetailForTenant(tx, ctx.tenantId, params.id));
  if (!order) notFound();
  if (type === "facture" && !order.invoice) notFound();

  const address = [order.deliveryAddress?.street, order.deliveryAddress?.neighborhood, order.deliveryAddress?.commune, order.deliveryAddress?.region].filter(Boolean).join(", ");
  const showPrices = type !== "preparation";

  return (
    <main className={`${ycFontVariables} mx-auto max-w-[800px] bg-white px-8 py-10 font-ui text-[13px] text-yc-ink print:p-0`}>
      <div className="mb-8 flex items-start justify-between gap-6 border-b-2 border-yc-ink pb-6">
        <div>
          <p className="font-display text-2xl font-semibold">{membership?.tenantName}</p>
          <p className="text-yc-ink-soft">Document émis via YamaCommerce</p>
        </div>
        <div className="text-right">
          <p className="font-display text-xl font-semibold uppercase tracking-wide">{TITLES[type]}</p>
          <p className="yc-num">{type === "facture" ? order.invoice!.number : order.orderNumber}</p>
          <p className="text-yc-ink-soft">{formatDate(type === "facture" ? order.invoice!.issueDate : order.createdAt)}</p>
          {type === "facture" && <p className="text-yc-ink-soft">Commande {order.orderNumber}</p>}
        </div>
      </div>

      <div className="mb-8 grid grid-cols-2 gap-6">
        <div>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-yc-ink-soft">Client</p>
          <p className="font-semibold">{order.customer.firstName} {order.customer.lastName ?? ""}</p>
          <p>{order.customer.phone}</p>
          {order.customer.email && <p>{order.customer.email}</p>}
        </div>
        <div>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-yc-ink-soft">{order.deliveryMethod === "pickup" ? "Retrait en boutique" : "Adresse de livraison"}</p>
          <p>{order.deliveryMethod === "pickup" ? "Le client récupère sa commande." : address || "—"}</p>
          {order.deliveryZoneLabel && <p className="text-yc-ink-soft">Zone : {order.deliveryZoneLabel}</p>}
          {type === "livraison" && order.delivery?.deliverer && <p className="text-yc-ink-soft">Livreur : {order.delivery.deliverer.vehicleType ?? ""} {order.delivery.deliverer.phone}</p>}
        </div>
      </div>

      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-yc-ink/30 text-left text-[11px] uppercase tracking-[0.1em] text-yc-ink-soft">
            {type === "preparation" && <th className="w-10 py-2">✓</th>}
            <th className="py-2">Article</th>
            <th className="py-2 text-right">Qté</th>
            {showPrices && <th className="py-2 text-right">Prix unitaire</th>}
            {showPrices && <th className="py-2 text-right">Total</th>}
          </tr>
        </thead>
        <tbody>
          {order.items.map((i) => (
            <tr key={i.id} className="border-b border-yc-ink/10">
              {type === "preparation" && <td className="py-3"><span className="inline-block h-4 w-4 rounded border border-yc-ink/40" /></td>}
              <td className="py-3 font-medium">{i.productNameSnapshot}</td>
              <td className="yc-num py-3 text-right">{i.quantity}</td>
              {showPrices && <td className="yc-num py-3 text-right">{formatAmount(i.unitPrice)}</td>}
              {showPrices && <td className="yc-num py-3 text-right">{formatAmount(i.total)}</td>}
            </tr>
          ))}
        </tbody>
      </table>

      {showPrices && (
        <dl className="ml-auto mt-6 w-72 space-y-1">
          <div className="flex justify-between"><dt>Sous-total</dt><dd className="yc-num">{formatAmount(order.subtotal)} FCFA</dd></div>
          {order.discountTotal > 0 && <div className="flex justify-between"><dt>Remise</dt><dd className="yc-num">-{formatAmount(order.discountTotal)} FCFA</dd></div>}
          <div className="flex justify-between"><dt>Livraison</dt><dd className="yc-num">{formatAmount(order.shippingTotal)} FCFA</dd></div>
          <div className="flex justify-between border-t-2 border-yc-ink pt-2 text-base font-semibold"><dt>Total</dt><dd className="yc-num">{formatAmount(order.total)} FCFA</dd></div>
        </dl>
      )}

      <div className="mt-10 grid grid-cols-2 gap-6 text-yc-ink-soft">
        <p>Paiement : {PAYMENT_METHOD_LABEL[order.paymentMethod] ?? order.paymentMethod} — {order.paymentStatus === "PAID" ? "payé" : "non payé"}{order.paymentMethod === "cod" && order.paymentStatus !== "PAID" ? ` (à encaisser : ${formatAmount(order.total)} FCFA)` : ""}</p>
        {type === "livraison" && <p className="text-right">Signature du client : ______________________</p>}
        {type === "facture" && <p className="text-right font-mono text-[10px]">Empreinte : {order.invoice!.integrityHash?.slice(0, 32)}</p>}
      </div>

      <PrintButton />
    </main>
  );
}
