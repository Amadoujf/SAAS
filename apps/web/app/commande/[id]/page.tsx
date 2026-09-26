import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { withTenant, getManualPaymentInstructions } from "@yamacommerce/database";
import { resolveStore } from "@/lib/storefront/store-context";
import { getOrderView } from "@/lib/storefront/order-pipeline";
import { ORDER_STATUS_META, PAYMENT_METHOD_LABEL, progressIndex } from "@/lib/commerce/order-status-meta";
import { StoreShell } from "@/components/store/store-shell";
import { IconCheck, IconClock, IconMapPin, IconStore, IconX } from "@/components/yc/icons";
import { CopyValue, CustomerOrderActions, ProofForm } from "@/components/store/order-client-actions";
import { PublicSiteSuspended } from "@/components/public-site-suspended";
import { PublicSiteBillingSuspended } from "@/components/public-site-billing-suspended";

export const metadata: Metadata = { title: "Ma commande", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const fcfa = (n: number) => `${new Intl.NumberFormat("fr-SN").format(n)} FCFA`;

/** Suivi client d'UNE commande — accessible uniquement avec son jeton (lien reçu à la
 *  commande ou via /suivi). Une commande en attente de paiement n'est jamais
 *  présentée comme payée. */
export default async function OrderTrackingPage({ params, searchParams }: { params: { id: string }; searchParams: { token?: string; nouvelle?: string } }) {
  const resolution = await resolveStore(`/commande/${params.id}`);
  if (resolution.status === "suspended") return <PublicSiteSuspended tenantName={resolution.tenantName} />;
  if (resolution.status === "billing_suspended") return <PublicSiteBillingSuspended tenantName={resolution.tenantName} />;
  const { store } = resolution;
  if (!searchParams.token) notFound();
  const order = await getOrderView(store.tenantId, params.id, searchParams.token);
  if (!order) notFound();

  const manual = order.paymentMethod === "manual_wave" || order.paymentMethod === "manual_orange_money";
  const instructions = manual ? (await withTenant(store.tenantId, (tx) => getManualPaymentInstructions(tx, store.tenantId))).find((i) => i.method === order.paymentMethod) : undefined;
  const lastPayment = order.payments[0];
  const awaiting = order.status === "AWAITING_PAYMENT";
  const proofPending = awaiting && lastPayment?.status === "PENDING" && !!lastPayment.proofSubmittedAt;
  const canceled = order.status === "CANCELED" || order.status === "REFUNDED";
  const pickup = order.deliveryMethod === "pickup";
  const steps = pickup ? ["Reçue", "Confirmée", "Prête", "Retirée"] : ["Reçue", "Confirmée", "En préparation", "En route", "Livrée"];
  let current = progressIndex(order.status, order.deliveryMethod);
  if (pickup) current = current >= 4 ? 3 : Math.min(current, 2);
  const isNew = searchParams.nouvelle === "1";

  const hero = canceled
    ? { icon: <IconX size={28} />, tone: "bg-[var(--color-danger)]", title: order.status === "REFUNDED" ? "Remboursement en cours" : "Commande annulée", text: "Cette commande n'est plus active." }
    : awaiting
      ? { icon: <IconClock size={28} />, tone: "bg-[var(--color-warning)]", title: proofPending ? "Paiement en cours de vérification" : "En attente de paiement", text: proofPending ? "Votre preuve a bien été reçue. Nous vérifions le transfert avant de préparer votre commande." : "Votre commande est enregistrée mais n'est pas encore payée. Le stock vous est réservé temporairement." }
      : { icon: <IconCheck size={28} />, tone: "bg-[var(--color-success)]", title: isNew ? "Merci, commande confirmée !" : ORDER_STATUS_META[order.status]?.customerLabel ?? order.status, text: order.paymentMethod === "cod" && order.paymentStatus !== "PAID" ? `Vous paierez ${fcfa(order.total)} à la réception.` : "Nous vous tenons informé(e) à chaque étape." };

  return (
    <StoreShell store={store}>
      <div className="mx-auto max-w-3xl px-4 pt-10 sm:px-6">
        <div className="text-center">
          <span className={`yc-pop mx-auto grid h-16 w-16 place-items-center rounded-full text-white shadow-lg ${hero.tone}`}>{hero.icon}</span>
          <p className="mt-5 text-sm font-semibold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">Commande {order.orderNumber}</p>
          <h1 className="mt-2 font-[family-name:var(--font-heading)] text-3xl font-semibold tracking-tight sm:text-4xl">{hero.title}</h1>
          <p className="mx-auto mt-3 max-w-lg text-[var(--color-text-muted)]">{hero.text}</p>
        </div>

        {!canceled && !awaiting && (
          <ol className="mt-10 grid gap-2" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }} aria-label="Progression de la commande">
            {steps.map((label, i) => (
              <li key={label} className="flex flex-col items-center gap-2 text-center" aria-current={i === current ? "step" : undefined}>
                <span className="relative flex w-full items-center">
                  <span className={`h-1 flex-1 rounded-full ${i === 0 ? "opacity-0" : i <= current ? "bg-[var(--color-primary)]" : "bg-[var(--color-border)]"}`} />
                  <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-bold transition-colors ${i < current ? "bg-[var(--color-primary)] text-white" : i === current ? "bg-[var(--color-text-primary)] text-[var(--color-background)] ring-4 ring-[color-mix(in_srgb,var(--color-primary)_25%,transparent)]" : "bg-[var(--color-surface-muted)] text-[var(--color-text-muted)]"}`}>
                    {i < current ? <IconCheck size={14} /> : i + 1}
                  </span>
                  <span className={`h-1 flex-1 rounded-full ${i === steps.length - 1 ? "opacity-0" : i < current ? "bg-[var(--color-primary)]" : "bg-[var(--color-border)]"}`} />
                </span>
                <span className={`text-xs font-semibold sm:text-sm ${i <= current ? "" : "text-[var(--color-text-muted)]"}`}>{label}</span>
              </li>
            ))}
          </ol>
        )}

        {awaiting && manual && instructions && !proofPending && (
          <section className="mt-10 rounded-[var(--radius-lg)] bg-[var(--color-surface)] p-6 ring-2 ring-[color-mix(in_srgb,var(--color-warning)_45%,transparent)]" aria-labelledby="pay-now">
            <h2 id="pay-now" className="font-[family-name:var(--font-heading)] text-xl font-semibold">Payer avec {instructions.label}</h2>
            <ol className="mt-4 space-y-3 text-sm">
              <li className="flex flex-wrap items-center justify-between gap-2"><span>1. Envoyez exactement <strong className="tabular-nums">{fcfa(order.total)}</strong></span><CopyValue value={String(order.total)} label="le montant" /></li>
              <li className="flex flex-wrap items-center justify-between gap-2"><span>2. Au numéro <strong className="font-mono">{instructions.accountNumber}</strong>{instructions.accountHolderName ? ` (${instructions.accountHolderName})` : ""}</span><CopyValue value={instructions.accountNumber} label="le numéro" /></li>
              <li>3. Indiquez ci-dessous la référence reçue par SMS.</li>
            </ol>
            {instructions.instructions && <p className="mt-3 text-sm text-[var(--color-text-muted)]">{instructions.instructions}</p>}
            <ProofForm orderId={order.id} token={searchParams.token} rejectedNote={lastPayment?.status === "FAILED" ? lastPayment.reviewNote : null} />
          </section>
        )}

        <section className="mt-10 rounded-[var(--radius-lg)] bg-[var(--color-surface)] p-6" aria-labelledby="recap">
          <h2 id="recap" className="font-[family-name:var(--font-heading)] text-lg font-semibold">Récapitulatif</h2>
          <ul className="mt-4 divide-y divide-[var(--color-border)]">
            {order.items.map((i) => (
              <li key={i.id} className="flex justify-between gap-4 py-3 text-sm"><span>{i.quantity} × {i.productNameSnapshot}</span><span className="whitespace-nowrap tabular-nums">{fcfa(i.total)}</span></li>
            ))}
          </ul>
          <dl className="mt-3 space-y-1.5 border-t border-[var(--color-border)] pt-3 text-sm">
            <div className="flex justify-between"><dt className="text-[var(--color-text-muted)]">Sous-total</dt><dd className="tabular-nums">{fcfa(order.subtotal)}</dd></div>
            {order.discountTotal > 0 && <div className="flex justify-between"><dt className="text-[var(--color-text-muted)]">Remise</dt><dd className="tabular-nums">-{fcfa(order.discountTotal)}</dd></div>}
            <div className="flex justify-between"><dt className="text-[var(--color-text-muted)]">{pickup ? "Retrait" : "Livraison"}</dt><dd className="tabular-nums">{order.shippingTotal === 0 ? "Offerte" : fcfa(order.shippingTotal)}</dd></div>
            <div className="flex justify-between pt-2 text-base font-semibold"><dt>Total</dt><dd className="tabular-nums">{fcfa(order.total)}</dd></div>
          </dl>
          <div className="mt-5 grid gap-4 border-t border-[var(--color-border)] pt-5 text-sm sm:grid-cols-2">
            <p className="flex items-start gap-2">
              {pickup ? <IconStore size={18} className="mt-0.5 shrink-0" /> : <IconMapPin size={18} className="mt-0.5 shrink-0" />}
              <span>{pickup ? "Retrait en boutique" : [order.deliveryAddress?.street, order.deliveryAddress?.neighborhood, order.deliveryAddress?.commune, order.deliveryAddress?.region].filter(Boolean).join(", ")}
                {order.deliveryZoneLabel && <span className="block text-[var(--color-text-muted)]">{order.deliveryZoneLabel}{order.estimatedDays !== null ? ` · ${order.estimatedDays <= 1 ? "24 h" : `${order.estimatedDays} jours`}` : ""}</span>}
              </span>
            </p>
            <p>
              <span className="font-semibold">{PAYMENT_METHOD_LABEL[order.paymentMethod] ?? order.paymentMethod}</span>
              <span className="block text-[var(--color-text-muted)]">{order.paymentStatus === "PAID" ? "Payée" : awaiting ? (proofPending ? "Preuve reçue — vérification en cours" : "Non payée") : order.paymentMethod === "cod" ? "À régler à la réception" : "Non payée"}</span>
            </p>
          </div>
        </section>

        <div className="mt-8"><CustomerOrderActions orderId={order.id} token={searchParams.token} canCancel={order.customerCanCancel && order.paymentStatus !== "PAID"} /></div>
        <p className="mt-8 text-center text-sm text-[var(--color-text-muted)]">Conservez ce lien pour suivre votre commande, ou retrouvez-la sur <Link href="/suivi" className="underline">la page de suivi</Link> avec votre numéro de téléphone.</p>
      </div>
    </StoreShell>
  );
}
