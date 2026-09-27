import Link from "next/link";
import type { Metadata } from "next";
import { withTenant, getDashboardInsights, isDashboardPeriod, planHasFeature, type DashboardPeriod, type PaymentBucket } from "@yamacommerce/database";
import { auth } from "@/lib/auth";
import { getCurrentTenantMembership } from "@/lib/current-tenant";
import { isCatalogModuleEnabled } from "@/lib/catalog/require-catalog-module";
import { getTenantModuleKeys, isRealEstate, isSalon, isTravel } from "@/lib/modules/tenant-modules";
import { RealEstateOverview } from "@/components/dashboard-real-estate/overview";
import { TravelOverview } from "@/components/dashboard-travel/overview";
import { SalonOverview } from "@/components/dashboard-salon/overview";
import { formatAmount, formatRelative } from "@/lib/format";
import { Panel } from "@/components/yc/panel";
import { ButtonLink } from "@/components/yc/button";
import { OrderStatusPill } from "@/components/yc/status-pill";
import { EmptyState } from "@/components/yc/empty-state";
import { IconArrowRight, IconBag, IconBox, IconChart, IconCheck, IconChevronRight, IconPlus, IconSparkles, IconUsers } from "@/components/yc/icons";
import { SalesChart } from "@/components/dashboard-home/sales-chart";
import { PeriodSelect } from "@/components/dashboard-home/period-select";

export const metadata: Metadata = { title: "Vue d'ensemble — Y-COM", robots: { index: false, follow: false } };

function dakarHour(now = new Date()) {
  return Number(new Intl.DateTimeFormat("fr-FR", { hour: "numeric", hour12: false, timeZone: "Africa/Dakar" }).format(now));
}

function Greeting({ name }: { name: string }) {
  const h = dakarHour();
  const evening = h >= 18 || h < 5;
  return (
    <h1 className="flex items-center gap-2.5 font-ui text-[30px] font-bold leading-tight tracking-[-0.03em] sm:text-[36px]">
      {evening ? "Bonsoir" : "Bonjour"} {name}
      {evening ? (
        <svg width="28" height="28" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" fill="#F5B82E" /></svg>
      ) : (
        <svg width="32" height="32" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="#F5B82E" strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="12" r="4.2" fill="#F5B82E" stroke="none" />
          {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => <path key={a} d="M12 2.5v2.2" transform={`rotate(${a} 12 12)`} />)}
        </svg>
      )}
    </h1>
  );
}

const PAYMENT_META: Record<PaymentBucket, { label: string; color: string; mark: React.ReactNode }> = {
  wave: { label: "Wave", color: "#0F2E70", mark: <span className="grid h-7 w-7 place-items-center rounded-md bg-[#1DC4FF] text-[13px] font-black text-white">W</span> },
  orange_money: { label: "Orange Money", color: "#3B82F6", mark: <span className="grid h-7 w-7 place-items-center rounded-md bg-[#111] text-[10px] font-black text-[#FF7900]">OM</span> },
  cod: { label: "À la livraison", color: "#E9DCC6", mark: <span className="grid h-7 w-7 place-items-center rounded-md bg-[#FFF3E3] text-[#C2570C]"><IconBox size={16} /></span> },
  online: { label: "En ligne", color: "#9DBBFF", mark: <span className="grid h-7 w-7 place-items-center rounded-md bg-[#E8EFFF] text-yc-electric"><IconChart size={15} /></span> },
};

const METHOD_TO_BUCKET: Record<string, PaymentBucket> = { manual_wave: "wave", manual_orange_money: "orange_money", cod: "cod", online: "online" };

const ACTIVITY_LABELS: Record<string, string> = {
  NEW: "Nouvelle commande", AWAITING_PAYMENT: "Nouvelle commande", PAID: "Paiement reçu", CONFIRMED: "Commande confirmée",
  PREPARING: "Préparation lancée", READY: "Commande prête", SHIPPED: "Commande expédiée", OUT_FOR_DELIVERY: "Partie en livraison",
  DELIVERED: "Commande livrée", CANCELED: "Commande annulée", REFUNDED: "Remboursement enregistré",
};

const fmtPct = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1, signDisplay: "always" });

function Trend({ value }: { value: number | null }) {
  if (value === null) return <span className="text-[13px] text-yc-ink-soft" title="Pas de période précédente comparable">Pas de comparaison</span>;
  const up = value >= 0;
  return (
    <span className={`inline-flex items-center gap-1 text-[12px] font-semibold sm:text-sm ${up ? "text-yc-electric" : "text-[#C2410C]"}`}>
      <svg width="14" height="14" viewBox="0 0 12 12" aria-hidden="true" className={up ? "" : "rotate-180"}><path d="M2.5 7.5 6 4l3.5 3.5" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" /></svg>
      {fmtPct.format(value)} %
      <span className="sr-only"> par rapport à la période précédente</span>
    </span>
  );
}

function KpiCard({ href, icon, tone = "blue", label, value, foot }: { href: string; icon: React.ReactNode; tone?: "blue" | "orange"; label: string; value: React.ReactNode; foot: React.ReactNode }) {
  return (
    <Link href={href} className="yc-focus group flex gap-3 rounded-xl bg-white p-4 shadow-[0_1px_2px_rgb(12_22_48/0.04),0_8px_24px_-16px_rgb(12_22_48/0.12)] ring-1 ring-yc-ink/[0.07] transition-shadow hover:shadow-[0_12px_30px_-14px_rgb(12_22_48/0.25)] max-sm:gap-2.5 max-sm:p-3 sm:gap-4 sm:p-5">
      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg sm:h-12 sm:w-12 ${tone === "orange" ? "bg-[#FFF1E3] text-[#E07A1F]" : "bg-[#E8EFFF] text-yc-electric"}`}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-1 text-[12px] text-yc-ink-soft sm:text-[15px]">{label}<IconChevronRight size={16} className="shrink-0 transition-transform group-hover:translate-x-0.5" /></span>
        <span className="yc-num mt-1 block truncate text-[16px] font-bold tracking-[-0.02em] text-yc-ink sm:text-[24px] 2xl:text-[26px]">{value}</span>
        <span className="mt-1 block">{foot}</span>
      </span>
    </Link>
  );
}

function PaymentDonut({ payments }: { payments: { total: number; items: { method: PaymentBucket; count: number; percent: number }[] } }) {
  const r = 38;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row sm:gap-5">
      <div className="relative h-40 w-40 shrink-0 xl:h-36 xl:w-36 2xl:h-40 2xl:w-40">
        <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" aria-hidden="true">
          <circle cx="50" cy="50" r={r} fill="none" stroke="rgb(12 22 48 / 0.06)" strokeWidth="18" />
          {payments.items.map((p) => {
            const len = (p.count / payments.total) * c;
            const el = <circle key={p.method} cx="50" cy="50" r={r} fill="none" stroke={PAYMENT_META[p.method].color} strokeWidth="18" strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-offset} />;
            offset += len;
            return el;
          })}
        </svg>
        <div className="absolute inset-0 grid place-items-center text-center">
          <span><span className="yc-num block text-[26px] font-bold leading-none">{payments.total}</span><span className="text-xs text-yc-ink-soft">commande{payments.total > 1 ? "s" : ""}</span></span>
        </div>
      </div>
      <ul className="w-full space-y-3.5">
        {payments.items.map((p) => (
          <li key={p.method} className="flex items-center gap-3 whitespace-nowrap text-[14px] sm:text-[15px]">
            <span className="h-3.5 w-3.5 shrink-0 rounded-full" style={{ background: PAYMENT_META[p.method].color }} aria-hidden="true" />
            <span className="flex-1">{PAYMENT_META[p.method].label}</span>
            <span className="yc-num font-bold">{p.percent} %</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const Dots = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" /></svg>
);

export default async function DashboardHome({ searchParams }: { searchParams: { periode?: string } }) {
  const session = await auth();
  const membership = await getCurrentTenantMembership();
  const firstName = session?.user?.name?.split(" ")[0] ?? "";

  if (!membership) {
    return (
      <>
        <div className="mb-6"><Greeting name={firstName} /><p className="mt-1 text-yc-ink-soft">Votre compte n&apos;est rattaché à aucune entreprise pour le moment.</p></div>
        <Panel>
          <EmptyState
            title="Créez votre première boutique"
            description="Choisissez votre secteur et un template : votre site est prêt à recevoir des commandes en quelques minutes."
            action={<ButtonLink href="/creer-ma-boutique" variant="royal">Créer ma boutique <IconArrowRight size={18} /></ButtonLink>}
          />
        </Panel>
      </>
    );
  }

  const catalogEnabled = await isCatalogModuleEnabled(membership.tenantId);
  const moduleKeys = catalogEnabled ? null : await getTenantModuleKeys(membership.tenantId);
  if (moduleKeys && isTravel(moduleKeys)) {
    return <TravelOverview tenantId={membership.tenantId} permissions={membership.permissions} greeting={<Greeting name={firstName} />} />;
  }
  if (moduleKeys && isSalon(moduleKeys)) {
    return <SalonOverview tenantId={membership.tenantId} permissions={membership.permissions} greeting={<Greeting name={firstName} />} />;
  }
  if (moduleKeys && isRealEstate(moduleKeys)) {
    return <RealEstateOverview tenantId={membership.tenantId} permissions={membership.permissions} greeting={<Greeting name={firstName} />} />;
  }
  if (!catalogEnabled) {
    return (
      <>
        <div className="mb-6"><Greeting name={firstName} /></div>
        <Panel><EmptyState title="Module commerce non activé" description="Votre secteur n'utilise pas le catalogue produits." /></Panel>
      </>
    );
  }

  // Un membre sans accès aux ventes (ex. livreur, stock) ne voit pas le chiffre
  // d'affaires : seulement un accueil vers ses propres sections.
  if (!session?.user?.isSuperAdmin && !membership.permissions.includes("orders.view")) {
    return (
      <>
        <div className="mb-6"><Greeting name={firstName} /><p className="mt-1 text-yc-ink-soft">Bienvenue dans l&apos;espace de {membership.tenantName}. Vos sections sont dans le menu.</p></div>
        <Panel className="p-5 text-sm text-yc-ink-soft">Les indicateurs de ventes sont réservés aux membres qui ont accès aux commandes.</Panel>
      </>
    );
  }

  const period: DashboardPeriod = isDashboardPeriod(searchParams.periode) ? searchParams.periode : "month";
  const { insights, setup, demo, stats } = await withTenant(membership.tenantId, async (tx) => {
    const tenantId = membership.tenantId;
    const [insights, products, zones, wallets, orders, tenant, stats] = await Promise.all([
      getDashboardInsights(tx, tenantId, period),
      tx.product.count({ where: { tenantId, status: "PUBLISHED", deletedAt: null } }),
      tx.deliveryZone.count({ where: { tenantId, isActive: true } }),
      tx.paymentProviderConfig.count({ where: { tenantId, isEnabled: true, accountNumber: { not: null } } }),
      tx.order.count({ where: { tenantId } }),
      tx.tenant.findUnique({ where: { id: tenantId }, select: { isDemo: true } }),
      planHasFeature(tx, tenantId, "statistics"),
    ]);
    return { insights, setup: { products, zones, wallets, orders }, demo: tenant?.isDemo === true, stats };
  });

  const steps = [
    { done: setup.products > 0, label: "Publier un premier produit", href: "/dashboard/produits/nouveau" },
    { done: setup.zones > 0, label: "Définir vos zones de livraison", href: "/dashboard/livraison" },
    { done: setup.wallets > 0, label: "Ajouter votre numéro Wave ou Orange Money", href: "/dashboard/paiements" },
    { done: setup.orders > 0, label: "Recevoir votre première commande", href: "/catalogue" },
  ];
  const remaining = steps.filter((s) => !s.done).length;
  const { kpis } = insights;

  return (
    <>
      <div className="yc-rise mb-5 flex flex-col gap-4 sm:mb-6 xl:flex-row xl:items-end xl:justify-between">
        <div className="min-w-0">
          {demo && <p className="mb-2 inline-block rounded-md bg-[#E8EFFF] px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-yc-electric">Données de démonstration</p>}
          <Greeting name={firstName} />
          <p className="mt-1 text-[15px] text-yc-ink-soft sm:text-base">Voici l&apos;essentiel de votre activité aujourd&apos;hui.</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <PeriodSelect value={period} className="sm:w-56" />
          <ButtonLink href="/dashboard/produits/nouveau" variant="royal" className="hidden rounded-lg px-6 sm:inline-flex"><IconPlus size={20} /> Ajouter un produit</ButtonLink>
        </div>
      </div>

      <div className="flex flex-col gap-4 sm:gap-5">
        {/* Indicateurs de la période, comparés à la période précédente de même durée. */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
          <KpiCard href="/dashboard/commandes" icon={<IconChart size={22} />} label="Chiffre d'affaires" value={<>{formatAmount(kpis.revenue.value)} <span className="text-[0.62em] font-bold">FCFA</span></>} foot={stats ? <Trend value={kpis.revenue.trend} /> : <span className="text-[13px] text-yc-ink-soft">Sur la période</span>} />
          <KpiCard href="/dashboard/commandes" icon={<IconBag size={22} />} label="Commandes" value={formatAmount(kpis.orders.value)} foot={stats ? <Trend value={kpis.orders.trend} /> : <span className="text-[13px] text-yc-ink-soft">Sur la période</span>} />
          <KpiCard href="/dashboard/clients" icon={<IconUsers size={22} />} label="Clients" value={formatAmount(kpis.customers.value)} foot={stats ? <Trend value={kpis.customers.trend} /> : <span className="text-[13px] text-yc-ink-soft">Sur la période</span>} />
          <KpiCard href="/dashboard/commandes?file=a-traiter" icon={<IconBox size={22} />} tone="orange" label="À préparer" value={kpis.toPrepare} foot={<span className="text-[13px] text-yc-ink-soft">En ce moment</span>} />
        </div>

        {remaining > 0 && (
          <Panel as="div">
            <div id="premiers-pas" className="grid scroll-mt-24 gap-5 p-5 lg:grid-cols-[1fr_1.6fr] lg:items-center">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-yc-electric">Premiers pas</p>
                <h2 className="mt-1 text-xl font-bold tracking-tight">Encore {remaining} étape{remaining > 1 ? "s" : ""} avant de vendre</h2>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-yc-ink/[0.07]"><div className="h-full rounded-full bg-yc-electric transition-all duration-700" style={{ width: `${((steps.length - remaining) / steps.length) * 100}%` }} /></div>
              </div>
              <ol className="grid gap-2 sm:grid-cols-2">
                {steps.map((st, i) => (
                  <li key={st.label}>
                    <Link href={st.href} className={`yc-focus flex items-center gap-3 rounded-lg p-3 text-sm font-semibold ring-1 ring-inset transition-colors ${st.done ? "bg-yc-success/[0.06] text-yc-ink-soft ring-yc-success/20" : "bg-white ring-yc-ink/10 hover:ring-yc-electric"}`}>
                      <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs ${st.done ? "bg-yc-success text-white" : "bg-yc-ink/[0.06] text-yc-ink"}`}>{st.done ? <IconCheck size={14} /> : i + 1}</span>
                      <span className={st.done ? "line-through decoration-yc-ink/30" : ""}>{st.label}</span>
                    </Link>
                  </li>
                ))}
              </ol>
            </div>
          </Panel>
        )}

        {!stats ? (
          <Panel className="flex flex-col items-start gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-[18px] font-bold tracking-[-0.015em]">Statistiques détaillées</h2>
              <p className="mt-1 text-sm text-yc-ink-soft">Évolution des ventes, comparaison avec la période précédente et répartition des paiements : incluses à partir de la formule Business.</p>
            </div>
            <ButtonLink href="/dashboard/facturation" variant="secondary" className="shrink-0 rounded-lg">Voir les formules</ButtonLink>
          </Panel>
        ) : (
        <div className="grid grid-cols-1 gap-4 sm:gap-5 xl:grid-cols-[1.9fr_1fr]">
          <Panel className="min-w-0 p-4 sm:p-5">
            <SalesChart series={insights.series} />
          </Panel>

          <Panel className="p-5">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-[18px] font-bold tracking-[-0.015em]">Moyens de paiement</h2>
              <Link href="/dashboard/paiements" aria-label="Réglages des moyens de paiement" className="yc-focus grid h-8 w-8 place-items-center rounded-md text-yc-ink-soft hover:bg-yc-ink/5"><Dots /></Link>
            </div>
            {insights.payments.total === 0 ? (
              <p className="py-10 text-center text-sm text-yc-ink-soft">Aucune commande sur cette période.</p>
            ) : (
              <PaymentDonut payments={insights.payments} />
            )}
          </Panel>
        </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:gap-5 xl:grid-cols-[1.9fr_1fr]">
          <div className="flex min-w-0 flex-col gap-4 sm:gap-5">
            <Panel className="overflow-hidden">
              <div className="flex items-center justify-between px-5 pb-3 pt-5">
                <h2 className="text-[18px] font-bold tracking-[-0.015em]">Dernières commandes</h2>
                <Link href="/dashboard/commandes" className="yc-focus inline-flex items-center gap-1.5 rounded text-sm font-semibold text-yc-electric hover:underline">Tout voir <IconArrowRight size={16} /></Link>
              </div>
              {insights.recent.length === 0 ? (
                <EmptyState art="orders" title="Aucune commande pour l'instant" description="Partagez le lien de votre boutique sur WhatsApp : les commandes apparaîtront ici." />
              ) : (
                <>
                  {/* Tableau (tablette et bureau) */}
                  <div className="relative hidden overflow-x-auto px-2 pb-2 sm:block">
                    <table className="w-full min-w-[600px] text-left text-[14px]">
                      <thead>
                        <tr className="bg-[#F6F7FB] text-[13px] text-yc-ink-soft">
                          <th scope="col" className="rounded-l-md px-2.5 py-2.5 font-medium">Commande</th>
                          <th scope="col" className="px-2.5 py-2.5 font-medium">Client</th>
                          <th scope="col" className="px-2.5 py-2.5 font-medium">Montant</th>
                          <th scope="col" className="px-2.5 py-2.5 font-medium">Paiement</th>
                          <th scope="col" className="px-2.5 py-2.5 font-medium">Statut</th>
                          <th scope="col" className="rounded-r-md px-2.5 py-2.5"><span className="sr-only">Ouvrir</span></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-yc-ink/[0.06]">
                        {insights.recent.map((o) => {
                          const pay = PAYMENT_META[METHOD_TO_BUCKET[o.paymentMethod] ?? "cod"];
                          return (
                            <tr key={o.id} className="hover:bg-[#F9FAFD]">
                              <td className="whitespace-nowrap px-2.5 py-3 font-semibold"><Link href={`/dashboard/commandes/${o.id}`} className="yc-focus rounded hover:text-yc-electric">#{o.orderNumber}</Link></td>
                              <td className="max-w-[180px] truncate px-2.5 py-3">{o.customer.firstName} {o.customer.lastName ?? ""}</td>
                              <td className="yc-num whitespace-nowrap px-2.5 py-3">{formatAmount(o.total)} FCFA</td>
                              <td className="whitespace-nowrap px-2.5 py-3"><span className="flex items-center gap-2" title={pay.label}>{pay.mark}<span className="text-[13px] max-2xl:sr-only">{pay.label}</span></span></td>
                              <td className="px-2.5 py-3"><OrderStatusPill status={o.status} /></td>
                              <td className="px-2.5 py-3 text-right">
                                <Link href={`/dashboard/commandes/${o.id}`} aria-label={`Ouvrir la commande ${o.orderNumber}`} className="yc-focus inline-grid h-8 w-8 place-items-center rounded-md text-yc-ink-soft hover:bg-yc-ink/5"><Dots /></Link>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {/* Liste (mobile) */}
                  <ul className="divide-y divide-yc-ink/[0.06] px-2 pb-2 sm:hidden">
                    {insights.recent.map((o) => (
                      <li key={o.id}>
                        <Link href={`/dashboard/commandes/${o.id}`} className="yc-focus flex items-center gap-3 rounded-lg px-2.5 py-3">
                          <span className="min-w-0 flex-1">
                            <span className="block whitespace-nowrap text-[13px] font-bold">#{o.orderNumber}</span>
                            <span className="block truncate text-[13px] text-yc-ink-soft">{o.customer.firstName} {o.customer.lastName ?? ""}</span>
                          </span>
                          <span className="flex flex-col items-end gap-1">
                            <span className="yc-num text-[13px]">{formatAmount(o.total)} FCFA</span>
                            <OrderStatusPill status={o.status} />
                          </span>
                          <IconChevronRight size={18} className="shrink-0 text-yc-ink-soft" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </Panel>

            <Panel className="px-5 py-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-6">
                <h2 className="shrink-0 text-[17px] font-bold tracking-[-0.015em] sm:pt-0.5">Activité récente</h2>
                {insights.activity.length === 0 ? (
                  <p className="text-sm text-yc-ink-soft">Aucune activité pour le moment.</p>
                ) : (
                  <ul className="min-w-0 flex-1 space-y-2.5">
                    {insights.activity.slice(0, 3).map((a) => (
                      <li key={a.id}>
                        <Link href={`/dashboard/commandes/${a.order.id}`} className="yc-focus flex items-center gap-3 rounded text-[14px] hover:text-yc-electric">
                          <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-yc-electric" aria-hidden="true" />
                          <span className="min-w-0 flex-1 truncate">
                            {a.fromStatus === null ? "Nouvelle commande" : ACTIVITY_LABELS[a.toStatus] ?? a.toStatus} #{a.order.orderNumber} de {a.order.customer.firstName} {a.order.customer.lastName ?? ""}
                          </span>
                          <span className="shrink-0 text-[13px] text-yc-ink-soft">{formatRelative(a.createdAt)}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Panel>
          </div>

          <div className="flex min-w-0 flex-col gap-4 sm:gap-5">
            {/* Assistant IA : annoncé, pas encore disponible — l'action proposée est réelle. */}
            <section className="relative overflow-hidden rounded-xl bg-[linear-gradient(135deg,#0F2E70_0%,#0B2459_60%,#123A8C_100%)] p-5 text-white">
              <svg className="pointer-events-none absolute -right-10 -top-6 h-48 w-48 text-white/[0.07]" viewBox="0 0 200 200" aria-hidden="true" fill="none" stroke="currentColor">
                {[40, 60, 80, 100].map((r) => <circle key={r} cx="150" cy="60" r={r} />)}
              </svg>
              <div className="relative flex gap-3.5">
                <IconSparkles size={30} className="mt-0.5 shrink-0 text-[#8FB8FF]" />
                <div>
                  <h2 className="flex flex-wrap items-center gap-2 text-[18px] font-bold">Votre assistant IA <span className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">Bientôt</span></h2>
                  <p className="mt-1 text-[14px] text-white/80">Il vous aidera à ajouter plusieurs produits en quelques instants. En attendant, ajoutez-les un par un.</p>
                </div>
              </div>
              <Link href="/dashboard/produits/nouveau" className="relative mt-4 flex items-center justify-center gap-2 rounded-lg bg-white py-2.5 text-sm font-bold text-yc-navy transition-colors hover:bg-[#EEF3FF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70">
                Ajouter un produit <IconArrowRight size={16} />
              </Link>
            </section>

            <Panel className="p-5">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-[18px] font-bold tracking-[-0.015em]">Stock à surveiller</h2>
                <Link href="/dashboard/stocks" className="yc-focus inline-flex items-center gap-1.5 rounded text-sm font-semibold text-yc-ink-soft hover:text-yc-electric">Tout voir <IconArrowRight size={16} /></Link>
              </div>
              {insights.lowStock.length === 0 ? (
                <p className="py-4 text-sm text-yc-ink-soft">Aucun article sous son seuil d&apos;alerte.</p>
              ) : (
                <ul className="divide-y divide-yc-ink/[0.06]">
                  {insights.lowStock.map((item) => (
                    <li key={item.id}>
                      <Link href={`/dashboard/produits/${item.productId}`} className="yc-focus flex items-center gap-3 rounded-lg py-2.5">
                        {item.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={item.imageUrl} alt="" className="h-14 w-16 shrink-0 rounded-md object-cover" loading="lazy" />
                        ) : (
                          <span className="grid h-14 w-16 shrink-0 place-items-center rounded-md bg-yc-ivory-100 text-yc-ink-soft"><IconBox size={20} /></span>
                        )}
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[14px] font-medium">{item.name}{item.variantName && item.variantName !== "Standard" ? ` · ${item.variantName}` : ""}</span>
                          <span className={`mt-1 inline-block rounded-md px-2 py-0.5 text-[12px] font-semibold ${item.available === 0 ? "bg-[#FDECEC] text-[#B42318]" : "bg-[#FFF1E3] text-[#C2570C]"}`}>
                            {item.available === 0 ? "Rupture" : `${item.available} restant${item.available > 1 ? "s" : ""}`}
                          </span>
                        </span>
                        <IconChevronRight size={18} className="shrink-0 text-yc-ink-soft" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>
        </div>
      </div>
    </>
  );
}
