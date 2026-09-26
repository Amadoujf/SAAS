import Link from "next/link";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { withTenant, getOrderDetailForTenant, listDeliverers, listNotificationsForOrder, ORDER_NOTIFICATION_EVENTS } from "@yamacommerce/database";
import { hasPermission } from "@yamacommerce/auth";
import { resolveDashboardTenant } from "@/lib/orders/dashboard-pipeline";
import { getCurrentTenantMembership } from "@/lib/current-tenant";
import { formatAmount, formatDateTime } from "@/lib/format";
import { ORDER_STATUS_META, PAYMENT_METHOD_LABEL } from "@/lib/commerce/order-status-meta";
import { Panel, PanelHeader } from "@/components/yc/panel";
import { buttonClasses } from "@/components/yc/button";
import { OrderStatusPill, PaymentStatusPill, Pill } from "@/components/yc/status-pill";
import { IconArrowLeft, IconMapPin, IconPhone, IconPrinter, IconStore, IconTruck, IconWallet } from "@/components/yc/icons";
import { DelivererPicker, InternalNotes, InvoiceButton, ManualPaymentReview, StatusActions } from "@/components/dashboard-orders/order-actions";

export const metadata: Metadata = { title: "Commande — YamaCommerce", robots: { index: false, follow: false } };

const NOTIF_STATUS: Record<string, { label: string; tone: "neutral" | "warning" | "success" | "danger" | "info" }> = {
  queued: { label: "En file d'attente", tone: "info" },
  sent: { label: "Envoyée", tone: "success" },
  failed: { label: "Échec d'envoi", tone: "danger" },
  not_sent_no_provider: { label: "Non envoyée · aucun fournisseur", tone: "neutral" },
};

export default async function OrderDetailPage({ params }: { params: { id: string } }) {
  const ctx = await resolveDashboardTenant("orders.view");
  if (!ctx) redirect("/dashboard");
  const membership = await getCurrentTenantMembership();
  const perms = membership?.permissions ?? [];

  const data = await withTenant(ctx.tenantId, async (tx) => {
    const order = await getOrderDetailForTenant(tx, ctx.tenantId, params.id);
    if (!order) return null;
    const [deliverers, notifications, images] = await Promise.all([
      listDeliverers(tx, ctx.tenantId),
      listNotificationsForOrder(tx, ctx.tenantId, order.id),
      tx.productVariant.findMany({
        where: { tenantId: ctx.tenantId, id: { in: order.items.map((i) => i.productVariantId) } },
        select: { id: true, product: { select: { images: { select: { url: true }, orderBy: { position: "asc" }, take: 1 } } } },
      }),
    ]);
    return { order, deliverers, notifications, images: new Map(images.map((v) => [v.id, v.product.images[0]?.url ?? null])) };
  });
  if (!data) notFound();
  const { order, deliverers, notifications, images } = data;

  const manualPending = order.payments.find((p) => p.status === "PENDING" && p.proofSubmittedAt && (p.provider === "wave_direct" || p.provider === "orange_money_direct"));
  const pickup = order.deliveryMethod === "pickup";
  const can = (p: Parameters<typeof hasPermission>[1]) => hasPermission(perms, p);
  const canCancel = order.allowedTransitions.includes("CANCELED") && can("orders.cancel");
  const canRefund = order.allowedTransitions.includes("REFUNDED") && order.paymentStatus === "PAID" && can("orders.refund");
  const whatsapp = order.customer.phone ? `https://wa.me/${order.customer.phone.replace("+", "")}?text=${encodeURIComponent(`Bonjour ${order.customer.firstName}, au sujet de votre commande ${order.orderNumber}…`)}` : null;
  const statusMeta = ORDER_STATUS_META[order.status];

  return (
    <>
      <Link href="/dashboard/commandes" className="yc-focus mb-5 inline-flex items-center gap-1.5 rounded-lg text-sm font-semibold text-yc-ink-soft hover:text-yc-ink">
        <IconArrowLeft size={16} /> Commandes
      </Link>

      {/* En-tête : identité de la commande + prochaine action, toujours visible. */}
      <div className="yc-rise relative mb-6 overflow-hidden rounded-yc-lg bg-yc-night-900 p-6 text-white shadow-yc-float sm:p-8">
        <div className="pointer-events-none absolute inset-0 yc-glow opacity-60" aria-hidden="true" />
        <div className="pointer-events-none absolute inset-0 yc-grid opacity-60" aria-hidden="true" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-yc-cyan">Commande · {formatDateTime(order.createdAt)}</p>
            <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-4xl">{order.orderNumber}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <OrderStatusPill status={order.status} onDark />
              {manualPending ? <Pill tone="warning" onDark>Preuve à vérifier</Pill> : <PaymentStatusPill status={order.paymentStatus} onDark />}
              <span className="text-sm text-white/60">{statusMeta?.description}</span>
            </div>
          </div>
          <div className="text-left lg:text-right">
            <p className="text-sm text-white/60">Total</p>
            <p className="font-display text-4xl font-semibold tracking-tight yc-num">{formatAmount(order.total)}<span className="ml-1 text-base text-white/60">FCFA</span></p>
          </div>
        </div>
        {can("orders.update_status") && (
          <div className="relative mt-6 border-t border-white/10 pt-5">
            <StatusActions onDark orderId={order.id} status={order.status} pickup={pickup} canCancel={canCancel} canRefund={canRefund} />
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.5fr_1fr]">
        <div className="flex flex-col gap-5">
          {manualPending && (
            <Panel className="ring-2 ring-yc-warning/40">
              <PanelHeader eyebrow="Action requise" title="Preuve de paiement à vérifier" description="Vérifiez dans votre application que le montant exact a bien été reçu avant de valider." />
              <div className="grid gap-4 px-5 pb-5 sm:grid-cols-3 sm:px-6">
                <Info label="Moyen" value={PAYMENT_METHOD_LABEL[order.paymentMethod] ?? order.paymentMethod} />
                <Info label="Référence déclarée" value={<span className="font-mono">{manualPending.proofReference}</span>} />
                <Info label="Montant attendu" value={`${formatAmount(manualPending.amount)} FCFA`} />
                {manualPending.proofImageUrl && (
                  <a href={manualPending.proofImageUrl} target="_blank" rel="noreferrer" className="text-sm font-semibold text-yc-electric underline sm:col-span-3">Voir la capture envoyée</a>
                )}
                <div className="sm:col-span-3"><ManualPaymentReview orderId={order.id} /></div>
              </div>
            </Panel>
          )}

          <Panel>
            <PanelHeader title="Articles" description={`${order.items.reduce((n, i) => n + i.quantity, 0)} article(s)`} />
            <ul className="divide-y divide-yc-ink/[0.06] px-5 sm:px-6">
              {order.items.map((item) => {
                const img = images.get(item.productVariantId);
                return (
                  <li key={item.id} className="flex items-center gap-4 py-3.5">
                    <span className="h-14 w-12 shrink-0 overflow-hidden rounded-xl bg-yc-ivory-100 ring-1 ring-yc-ink/5">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {img && <img src={img} alt="" className="h-full w-full object-cover" loading="lazy" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{item.productNameSnapshot}</span>
                      <span className="block text-sm text-yc-ink-soft yc-num">{item.quantity} × {formatAmount(item.unitPrice)} F</span>
                    </span>
                    <span className="yc-num font-semibold">{formatAmount(item.total)} F</span>
                  </li>
                );
              })}
            </ul>
            <dl className="mx-5 mb-5 mt-2 space-y-1.5 rounded-2xl bg-yc-ivory-50 p-4 text-sm sm:mx-6">
              <Row label="Sous-total" value={order.subtotal} />
              {order.discountTotal > 0 && <Row label="Remise" value={-order.discountTotal} />}
              <Row label={pickup ? "Retrait en boutique" : "Livraison"} value={order.shippingTotal} />
              {order.taxTotal > 0 && <Row label="Taxes" value={order.taxTotal} />}
              <div className="flex justify-between border-t border-yc-ink/10 pt-2 text-base font-semibold"><dt>Total</dt><dd className="yc-num">{formatAmount(order.total)} FCFA</dd></div>
            </dl>
          </Panel>

          <Panel>
            <PanelHeader title="Historique" description="Chaque changement de statut est horodaté et ne peut pas être modifié." />
            <ol className="relative mx-5 mb-6 border-l-2 border-dashed border-yc-ink/10 pl-6 sm:mx-6">
              {order.statusHistory.map((h, i) => {
                const last = i === order.statusHistory.length - 1;
                return (
                  <li key={h.id} className="relative pb-5 last:pb-0">
                    <span className={`absolute -left-[33px] top-0.5 grid h-4 w-4 place-items-center rounded-full ring-4 ring-white ${last ? "bg-yc-electric" : "bg-yc-ink/20"}`} aria-hidden="true" />
                    <p className="text-sm font-semibold">{ORDER_STATUS_META[h.toStatus]?.label ?? h.toStatus}</p>
                    <p className="text-xs text-yc-ink-soft">{formatDateTime(h.createdAt)} · {h.changedByType === "customer" ? "client" : h.changedByType === "system" ? "automatique" : "équipe"}</p>
                    {h.note && <p className="mt-1 text-sm text-yc-ink-soft">{h.note}</p>}
                  </li>
                );
              })}
            </ol>
          </Panel>

          <Panel>
            <PanelHeader title="Notifications" description="Ce qui a réellement été envoyé au client — jamais supposé." />
            {notifications.length === 0 ? (
              <p className="px-6 pb-6 text-sm text-yc-ink-soft">Aucune notification pour cette commande.</p>
            ) : (
              <ul className="divide-y divide-yc-ink/[0.06] px-5 pb-3 sm:px-6">
                {notifications.map((n) => (
                  <li key={n.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                    <span>
                      <span className="font-semibold">{ORDER_NOTIFICATION_EVENTS[n.event as keyof typeof ORDER_NOTIFICATION_EVENTS] ?? n.event}</span>
                      <span className="block text-xs text-yc-ink-soft">{n.channel === "internal" ? "Équipe" : n.channel} · {n.recipient} · {formatDateTime(n.createdAt)}</span>
                      {n.lastError && <span className="block text-xs text-yc-ink-soft">{n.lastError}</span>}
                    </span>
                    <Pill tone={NOTIF_STATUS[n.status]?.tone ?? "neutral"}>{NOTIF_STATUS[n.status]?.label ?? n.status}</Pill>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <div className="flex flex-col gap-5">
          <Panel>
            <PanelHeader title="Client" action={<Link href={`/dashboard/clients/${order.customer.id}`} className="yc-focus rounded-lg text-sm font-semibold text-yc-electric hover:underline">Fiche</Link>} />
            <div className="space-y-3 px-5 pb-5 sm:px-6">
              <p className="text-lg font-semibold">{order.customer.firstName} {order.customer.lastName ?? ""}</p>
              {order.customer.phone && (
                <div className="flex flex-wrap gap-2">
                  <a href={`tel:${order.customer.phone}`} className={buttonClasses("secondary", "sm")}><IconPhone size={16} /> {order.customer.phone}</a>
                  {whatsapp && <a href={whatsapp} target="_blank" rel="noreferrer" className={buttonClasses("secondary", "sm")}>WhatsApp</a>}
                </div>
              )}
              {order.customer.email && <p className="text-sm text-yc-ink-soft">{order.customer.email}</p>}
              {order.notes && <p className="rounded-xl bg-yc-ivory-50 p-3 text-sm"><span className="font-semibold">Note du client : </span>{order.notes}</p>}
            </div>
          </Panel>

          <Panel>
            <PanelHeader title={pickup ? "Retrait en boutique" : "Livraison"} />
            <div className="space-y-4 px-5 pb-5 sm:px-6">
              {pickup ? (
                <p className="flex items-center gap-2 text-sm"><IconStore size={18} className="text-yc-electric" /> Le client vient récupérer sa commande.</p>
              ) : (
                <>
                  <p className="flex items-start gap-2 text-sm">
                    <IconMapPin size={18} className="mt-0.5 shrink-0 text-yc-electric" />
                    <span>
                      {[order.deliveryAddress?.street, order.deliveryAddress?.neighborhood, order.deliveryAddress?.commune, order.deliveryAddress?.region].filter(Boolean).join(", ") || "Adresse non renseignée"}
                      {order.deliveryZoneLabel && <span className="block text-xs text-yc-ink-soft">Zone : {order.deliveryZoneLabel}</span>}
                    </span>
                  </p>
                  {order.delivery && (
                    <p className="flex items-center gap-2 text-sm"><IconTruck size={18} className="text-yc-electric" /> Suivi : {order.delivery.status === "delivered" ? "livré" : order.delivery.status === "in_transit" ? "en route" : "affecté"}</p>
                  )}
                  {can("delivery.assign") && !["CANCELED", "REFUNDED", "DELIVERED"].includes(order.status) && (
                    <DelivererPicker
                      orderId={order.id}
                      current={order.delivery?.delivererId ?? null}
                      deliverers={deliverers.filter((d) => d.isActive).map((d) => ({ id: d.id, label: `${d.vehicleType ?? "Livreur"} · ${d.phone}` }))}
                    />
                  )}
                  {order.delivery?.deliverer && ["DELIVERED"].includes(order.status) && (
                    <p className="text-sm text-yc-ink-soft">Livré par {order.delivery.deliverer.vehicleType ?? order.delivery.deliverer.phone}</p>
                  )}
                </>
              )}
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="Paiement" />
            <div className="space-y-3 px-5 pb-5 text-sm sm:px-6">
              <p className="flex items-center gap-2"><IconWallet size={18} className="text-yc-electric" /> {PAYMENT_METHOD_LABEL[order.paymentMethod] ?? order.paymentMethod}</p>
              {order.payments.map((p) => (
                <div key={p.id} className="rounded-xl bg-yc-ivory-50 p-3">
                  <p className="flex items-center justify-between gap-2">
                    <span className="yc-num font-semibold">{formatAmount(p.amount)} FCFA</span>
                    <Pill tone={p.status === "SUCCEEDED" ? "success" : p.status === "FAILED" ? "danger" : "warning"}>
                      {p.status === "SUCCEEDED" ? "Vérifié" : p.status === "FAILED" ? "Refusé" : p.proofSubmittedAt ? "Preuve déposée" : "En attente du client"}
                    </Pill>
                  </p>
                  {p.proofReference && <p className="mt-1 text-xs text-yc-ink-soft">Réf. {p.proofReference}</p>}
                  {p.reviewNote && <p className="mt-1 text-xs text-yc-ink-soft">Note : {p.reviewNote}</p>}
                </div>
              ))}
              {order.paymentMethod === "cod" && order.paymentStatus !== "PAID" && <p className="text-yc-ink-soft">À encaisser à la remise du colis.</p>}
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="Documents" description="Imprimables ou enregistrables en PDF depuis le navigateur." />
            <div className="flex flex-wrap gap-2 px-5 pb-5 sm:px-6">
              <a href={`/documents/commande/${order.id}?type=preparation`} target="_blank" className={buttonClasses("secondary", "sm")}><IconPrinter size={16} /> Bon de préparation</a>
              {!pickup && <a href={`/documents/commande/${order.id}?type=livraison`} target="_blank" className={buttonClasses("secondary", "sm")}><IconPrinter size={16} /> Bon de livraison</a>}
              {order.invoice ? (
                <a href={`/documents/commande/${order.id}?type=facture`} target="_blank" className={buttonClasses("secondary", "sm")}><IconPrinter size={16} /> Facture {order.invoice.number}</a>
              ) : order.paymentStatus === "PAID" && can("invoices.view") ? (
                <InvoiceButton orderId={order.id} />
              ) : (
                <p className="text-xs text-yc-ink-soft">La facture sera disponible une fois le paiement vérifié.</p>
              )}
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="Notes internes" description="Jamais visibles par le client." />
            <div className="px-5 pb-5 sm:px-6"><InternalNotes orderId={order.id} initial={order.internalNotes ?? ""} /></div>
          </Panel>
        </div>
      </div>
    </>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-yc-ink-soft">{label}</p>
      <p className="mt-1 font-semibold">{value}</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between text-yc-ink-soft">
      <dt>{label}</dt>
      <dd className="yc-num">{value === 0 && label !== "Sous-total" ? "Offert" : `${formatAmount(value)} FCFA`}</dd>
    </div>
  );
}
