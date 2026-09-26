import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { withTenant, listOrdersForTenant, countOrdersByQueue } from "@yamacommerce/database";
import { resolveDashboardTenant } from "@/lib/orders/dashboard-pipeline";
import { parseOrderFilters, ORDER_TABS } from "@/lib/orders/filters";
import { formatAmount, formatDateTime } from "@/lib/format";
import { PAYMENT_METHOD_LABEL } from "@/lib/commerce/order-status-meta";
import { PageHeader, Panel } from "@/components/yc/panel";
import { buttonClasses } from "@/components/yc/button";
import { OrderStatusPill, PaymentStatusPill, Pill } from "@/components/yc/status-pill";
import { EmptyState } from "@/components/yc/empty-state";
import { IconChevronRight, IconDownload, IconSearch, IconStore, IconTruck } from "@/components/yc/icons";

export const metadata: Metadata = { title: "Commandes — YamaCommerce", robots: { index: false, follow: false } };

export default async function OrdersPage({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const ctx = await resolveDashboardTenant("orders.view");
  if (!ctx) redirect("/dashboard");
  const filter = parseOrderFilters(searchParams);
  const [{ orders, total }, queues] = await withTenant(ctx.tenantId, (tx) =>
    Promise.all([listOrdersForTenant(tx, ctx.tenantId, filter), countOrdersByQueue(tx, ctx.tenantId)]),
  );
  const pages = Math.max(1, Math.ceil(total / 25));
  const counts: Record<string, number | undefined> = { "a-traiter": queues.toProcess, preuves: queues.awaitingProof, attente: queues.awaitingPayment, livraison: queues.inDelivery };
  const qs = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ file: searchParams.file, q: searchParams.q, du: searchParams.du, au: searchParams.au, ...patch })) if (v) p.set(k, v);
    const s = p.toString();
    return s ? `?${s}` : "";
  };

  return (
    <>
      <PageHeader
        eyebrow="Ventes"
        title="Commandes"
        description={`${total} commande${total > 1 ? "s" : ""}${filter.search ? ` pour « ${filter.search} »` : ""}.`}
        actions={
          <a href={`/api/dashboard/orders/export${qs({ page: undefined })}`} className={buttonClasses("secondary", "md")}>
            <IconDownload size={18} /> Exporter CSV
          </a>
        }
      />

      {/* Onglets de file : défilables au doigt sur mobile. */}
      <nav aria-label="Filtrer par file" className="-mx-4 mb-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <ul className="flex w-max gap-1.5 rounded-2xl bg-white p-1.5 shadow-yc ring-1 ring-yc-ink/[0.06]">
          {ORDER_TABS.map((tab) => {
            const active = filter.tab === tab.key && !searchParams.statut;
            const count = counts[tab.key];
            return (
              <li key={tab.key}>
                <Link
                  href={`/dashboard/commandes${qs({ file: tab.key === "toutes" ? undefined : tab.key, page: undefined })}`}
                  aria-current={active ? "page" : undefined}
                  className={`yc-focus flex items-center gap-2 whitespace-nowrap rounded-xl px-3.5 py-2 text-[13px] font-semibold transition-colors ${
                    active ? "bg-yc-night-900 text-white" : "text-yc-ink-soft hover:bg-yc-ivory-100 hover:text-yc-ink"
                  }`}
                >
                  {tab.label}
                  {count ? <span className={`yc-num rounded-full px-1.5 text-[11px] ${active ? "bg-yc-cyan text-yc-night-950" : "bg-yc-ink/[0.07]"}`}>{count}</span> : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <form className="mb-5 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto_auto_auto]" role="search">
        {searchParams.file && <input type="hidden" name="file" value={searchParams.file} />}
        <label className="relative">
          <span className="sr-only">Rechercher une commande</span>
          <IconSearch size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-yc-ink-soft" />
          <input
            name="q"
            defaultValue={searchParams.q}
            placeholder="N° de commande, nom, téléphone…"
            className="yc-focus h-11 w-full rounded-xl bg-white pl-10 pr-3 text-[15px] ring-1 ring-inset ring-yc-ink/12 placeholder:text-yc-ink-soft/60"
          />
        </label>
        <label className="flex items-center gap-2 rounded-xl bg-white px-3 text-xs font-semibold text-yc-ink-soft ring-1 ring-inset ring-yc-ink/12">
          Du <input type="date" name="du" defaultValue={searchParams.du} className="yc-focus h-11 bg-transparent text-sm text-yc-ink" />
        </label>
        <label className="flex items-center gap-2 rounded-xl bg-white px-3 text-xs font-semibold text-yc-ink-soft ring-1 ring-inset ring-yc-ink/12">
          Au <input type="date" name="au" defaultValue={searchParams.au} className="yc-focus h-11 bg-transparent text-sm text-yc-ink" />
        </label>
        <button type="submit" className={buttonClasses("primary", "md")}>Filtrer</button>
      </form>

      <Panel className="overflow-hidden">
        {orders.length === 0 ? (
          <EmptyState
            art="orders"
            title={filter.search || filter.status ? "Aucune commande ne correspond" : "Pas encore de commande"}
            description={filter.search || filter.status ? "Essayez une autre file ou un autre mot-clé." : "Dès qu'un client commande sur votre boutique, elle apparaît ici avec son statut de paiement."}
            action={filter.search || filter.status ? <Link href="/dashboard/commandes" className={buttonClasses("secondary", "md")}>Voir toutes les commandes</Link> : undefined}
          />
        ) : (
          <>
            {/* Bureau : tableau dense. */}
            <table className="hidden w-full text-left text-sm md:table">
              <thead className="border-b border-yc-ink/[0.06] bg-yc-ivory-50/60 text-[11px] font-semibold uppercase tracking-[0.08em] text-yc-ink-soft">
                <tr>
                  <th scope="col" className="px-5 py-3">Commande</th>
                  <th scope="col" className="px-3 py-3">Client</th>
                  <th scope="col" className="px-3 py-3">Paiement</th>
                  <th scope="col" className="px-3 py-3">Statut</th>
                  <th scope="col" className="px-3 py-3 text-right">Total</th>
                  <th scope="col" className="w-10 px-3 py-3"><span className="sr-only">Ouvrir</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-yc-ink/[0.05]">
                {orders.map((o) => {
                  const proof = o.payments[0]?.status === "PENDING" && o.payments[0]?.proofSubmittedAt;
                  return (
                    <tr key={o.id} className="group relative transition-colors hover:bg-yc-ivory-50">
                      <td className="px-5 py-3.5">
                        <Link href={`/dashboard/commandes/${o.id}`} className="yc-focus font-semibold text-yc-ink after:absolute after:inset-0 after:content-['']">
                          {o.orderNumber}
                        </Link>
                        <p className="text-xs text-yc-ink-soft">{formatDateTime(o.createdAt)} · {o.items.reduce((n, i) => n + i.quantity, 0)} art.</p>
                      </td>
                      <td className="px-3 py-3.5">
                        <p className="font-medium">{o.customer.firstName} {o.customer.lastName ?? ""}</p>
                        <p className="flex items-center gap-1 text-xs text-yc-ink-soft">
                          {o.deliveryMethod === "pickup" ? <IconStore size={13} /> : <IconTruck size={13} />}
                          {o.customer.phone ?? "—"}
                        </p>
                      </td>
                      <td className="px-3 py-3.5">
                        <div className="flex flex-col items-start gap-1">
                          {proof ? <Pill tone="warning">Preuve à vérifier</Pill> : <PaymentStatusPill status={o.paymentStatus} />}
                          <span className="text-xs text-yc-ink-soft">{PAYMENT_METHOD_LABEL[o.paymentMethod] ?? o.paymentMethod}</span>
                        </div>
                      </td>
                      <td className="px-3 py-3.5"><OrderStatusPill status={o.status} /></td>
                      <td className="yc-num px-3 py-3.5 text-right font-semibold">{formatAmount(o.total)} F</td>
                      <td className="px-3 py-3.5 text-yc-ink-soft"><IconChevronRight size={18} className="transition-transform group-hover:translate-x-0.5" /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Mobile : cartes lisibles au pouce. */}
            <ul className="divide-y divide-yc-ink/[0.06] md:hidden">
              {orders.map((o) => (
                <li key={o.id}>
                  <Link href={`/dashboard/commandes/${o.id}`} className="yc-focus flex flex-col gap-2 px-4 py-4 active:bg-yc-ivory-50">
                    <span className="flex items-center justify-between gap-3">
                      <span className="font-semibold">{o.customer.firstName} {o.customer.lastName ?? ""}</span>
                      <span className="yc-num font-semibold">{formatAmount(o.total)} F</span>
                    </span>
                    <span className="flex items-center justify-between gap-3 text-xs text-yc-ink-soft">
                      <span>{o.orderNumber} · {formatDateTime(o.createdAt)}</span>
                    </span>
                    <span className="flex flex-wrap gap-1.5">
                      <OrderStatusPill status={o.status} />
                      {o.payments[0]?.status === "PENDING" && o.payments[0]?.proofSubmittedAt ? <Pill tone="warning">Preuve à vérifier</Pill> : <PaymentStatusPill status={o.paymentStatus} />}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </Panel>

      {pages > 1 && (
        <nav aria-label="Pagination" className="mt-5 flex items-center justify-between text-sm">
          <span className="text-yc-ink-soft">Page {filter.page} sur {pages}</span>
          <span className="flex gap-2">
            {filter.page > 1 && <Link className={buttonClasses("secondary", "sm")} href={`/dashboard/commandes${qs({ page: String(filter.page - 1) })}`}>Précédente</Link>}
            {filter.page < pages && <Link className={buttonClasses("secondary", "sm")} href={`/dashboard/commandes${qs({ page: String(filter.page + 1) })}`}>Suivante</Link>}
          </span>
        </nav>
      )}
    </>
  );
}
