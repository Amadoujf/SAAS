import Link from "next/link";
import type { Metadata } from "next";
import { withTenant, getCommerceOverview } from "@yamacommerce/database";
import { auth } from "@/lib/auth";
import { getCurrentTenantMembership } from "@/lib/current-tenant";
import { isCatalogModuleEnabled } from "@/lib/catalog/require-catalog-module";
import { formatAmount, formatRelative } from "@/lib/format";
import { PageHeader, Panel, PanelHeader } from "@/components/yc/panel";
import { ButtonLink } from "@/components/yc/button";
import { CountUp } from "@/components/yc/count-up";
import { AreaChart } from "@/components/yc/area-chart";
import { OrderStatusPill } from "@/components/yc/status-pill";
import { EmptyState } from "@/components/yc/empty-state";
import { IconAlert, IconArrowRight, IconCheck, IconClock, IconPlus, IconTruck, IconWallet } from "@/components/yc/icons";

export const metadata: Metadata = { title: "Accueil — YamaCommerce", robots: { index: false, follow: false } };

function greeting(now = new Date()) {
  const h = Number(new Intl.DateTimeFormat("fr-FR", { hour: "numeric", hour12: false, timeZone: "Africa/Dakar" }).format(now));
  return h < 12 ? "Bonjour" : h < 18 ? "Bon après-midi" : "Bonsoir";
}

export default async function DashboardHome() {
  const session = await auth();
  const membership = await getCurrentTenantMembership();
  const firstName = session?.user?.name?.split(" ")[0] ?? "";

  if (!membership) {
    return (
      <>
        <PageHeader eyebrow="Bienvenue" title={`${greeting()} ${firstName}`.trim()} description="Votre compte n'est rattaché à aucune entreprise pour le moment." />
        <Panel>
          <EmptyState
            title="Créez votre première boutique"
            description="Choisissez votre secteur et un template : votre site est prêt à recevoir des commandes en quelques minutes."
            action={<ButtonLink href="/creer-ma-boutique" variant="primary">Créer ma boutique <IconArrowRight size={18} /></ButtonLink>}
          />
        </Panel>
      </>
    );
  }

  const catalogEnabled = await isCatalogModuleEnabled(membership.tenantId);
  const overview = catalogEnabled ? await withTenant(membership.tenantId, (tx) => getCommerceOverview(tx, membership.tenantId)) : null;
  const setup = catalogEnabled
    ? await withTenant(membership.tenantId, async (tx) => ({
        products: await tx.product.count({ where: { tenantId: membership.tenantId, status: "PUBLISHED", deletedAt: null } }),
        zones: await tx.deliveryZone.count({ where: { tenantId: membership.tenantId, isActive: true } }),
        wallets: await tx.paymentProviderConfig.count({ where: { tenantId: membership.tenantId, isEnabled: true, accountNumber: { not: null } } }),
        orders: await tx.order.count({ where: { tenantId: membership.tenantId } }),
      }))
    : null;
  const steps = setup
    ? [
        { done: setup.products > 0, label: "Publier un premier produit", href: "/dashboard/produits/nouveau" },
        { done: setup.zones > 0, label: "Définir vos zones de livraison", href: "/dashboard/livraison" },
        { done: setup.wallets > 0, label: "Ajouter votre numéro Wave ou Orange Money", href: "/dashboard/paiements" },
        { done: setup.orders > 0, label: "Recevoir votre première commande", href: "/catalogue" },
      ]
    : [];
  const remaining = steps.filter((s) => !s.done).length;

  const today = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "Africa/Dakar" }).format(new Date());

  return (
    <>
      <PageHeader
        eyebrow={today}
        title={
          <>
            {greeting()} {firstName}
            <span className="text-yc-ink-soft/60"> — </span>
            <span className="yc-text-gradient">{membership.tenantName}</span>
          </>
        }
        description={overview && overview.queues.toProcess + overview.queues.awaitingProof > 0
          ? `${overview.queues.toProcess + overview.queues.awaitingProof} action(s) vous attendent aujourd'hui.`
          : "Tout est à jour. Voici l'activité de votre boutique."}
        actions={catalogEnabled ? (
          <>
            <ButtonLink href="/dashboard/produits/nouveau" variant="secondary"><IconPlus size={18} /> Produit</ButtonLink>
            <ButtonLink href="/dashboard/commandes" variant="primary">Commandes <IconArrowRight size={18} /></ButtonLink>
          </>
        ) : undefined}
      />

      {!overview ? (
        <Panel><EmptyState title="Module commerce non activé" description="Votre secteur n'utilise pas le catalogue produits." /></Panel>
      ) : (
        <div className="flex flex-col gap-5">
          {remaining > 0 && (
            <Panel className="overflow-hidden">
              <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[1fr_1.4fr] lg:items-center">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-yc-electric">Premiers pas</p>
                  <h2 className="mt-1 font-display text-2xl font-semibold tracking-tight">Encore {remaining} étape{remaining > 1 ? "s" : ""} avant de vendre</h2>
                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-yc-ink/[0.07]"><div className="h-full rounded-full bg-gradient-to-r from-yc-cyan to-yc-electric transition-all duration-700" style={{ width: `${((steps.length - remaining) / steps.length) * 100}%` }} /></div>
                </div>
                <ol className="grid gap-2 sm:grid-cols-2">
                  {steps.map((st, i) => (
                    <li key={st.label}>
                      <Link href={st.href} className={`yc-focus flex items-center gap-3 rounded-2xl p-3.5 text-sm font-semibold ring-1 ring-inset transition-colors ${st.done ? "bg-yc-success/[0.06] text-yc-ink-soft ring-yc-success/20" : "bg-white ring-yc-ink/10 hover:ring-yc-electric"}`}>
                        <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs ${st.done ? "bg-yc-success text-white" : "bg-yc-ink/[0.06] text-yc-ink"}`}>{st.done ? <IconCheck size={14} /> : i + 1}</span>
                        <span className={st.done ? "line-through decoration-yc-ink/30" : ""}>{st.label}</span>
                      </Link>
                    </li>
                  ))}
                </ol>
              </div>
            </Panel>
          )}
          {/* Files d'action : ce qui demande une décision maintenant. */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <QueueCard href="/dashboard/commandes?file=a-traiter" label="À préparer" value={overview.queues.toProcess} icon={<IconClock size={20} />} tone="violet" hint="Confirmées, en attente d'expédition" />
            <QueueCard href="/dashboard/commandes?file=preuves" label="Preuves de paiement" value={overview.queues.awaitingProof} icon={<IconWallet size={20} />} tone="warning" hint="Wave / Orange Money à vérifier" />
            <QueueCard href="/dashboard/commandes?file=livraison" label="En livraison" value={overview.queues.inDelivery} icon={<IconTruck size={20} />} tone="cyan" hint="Expédiées ou en route" />
          </div>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.6fr_1fr]">
            <Panel className="overflow-hidden">
              <div className="grid grid-cols-2 gap-px bg-yc-ink/[0.06] sm:grid-cols-4">
                <Kpi label="Ventes · 30 j" value={<CountUp value={overview.revenue30} format="fcfa" />} />
                <Kpi label="Cmd · 30 j" value={<CountUp value={overview.orders30} />} />
                <Kpi label="Panier moyen" value={<CountUp value={overview.averageBasket30} format="fcfa" />} />
                <Kpi label="Clients" value={<CountUp value={overview.customers} />} />
              </div>
              <div className="px-4 pb-4 pt-6 sm:px-6">
                <p className="mb-2 text-[13px] font-semibold text-yc-ink-soft">Chiffre d&apos;affaires · 14 derniers jours</p>
                <AreaChart label="Chiffre d'affaires des 14 derniers jours" points={overview.series.map((d) => ({ date: d.date, value: d.revenue, orders: d.orders }))} />
              </div>
            </Panel>

            <Panel>
              <PanelHeader title="Dernières commandes" action={<Link href="/dashboard/commandes" className="yc-focus rounded-lg text-sm font-semibold text-yc-electric hover:underline">Tout voir</Link>} />
              {overview.recent.length === 0 ? (
                <EmptyState art="orders" title="Aucune commande pour l'instant" description="Partagez le lien de votre boutique sur WhatsApp : les commandes apparaîtront ici en temps réel." />
              ) : (
                <ul className="divide-y divide-yc-ink/[0.06] px-2 pb-2">
                  {overview.recent.map((o) => (
                    <li key={o.id}>
                      <Link href={`/dashboard/commandes/${o.id}`} className="yc-focus flex items-center gap-3 rounded-xl px-3 py-3 transition-colors hover:bg-yc-ivory-50">
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-yc-ivory-100 text-xs font-bold text-yc-ink">
                          {o.customer.firstName.slice(0, 1)}{o.customer.lastName?.slice(0, 1) ?? ""}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold">{o.customer.firstName} {o.customer.lastName ?? ""}</span>
                          <span className="block text-xs text-yc-ink-soft">{o.orderNumber} · {formatRelative(o.createdAt)}</span>
                        </span>
                        <span className="flex flex-col items-end gap-1">
                          <span className="yc-num text-sm font-semibold">{formatAmount(o.total)} F</span>
                          <OrderStatusPill status={o.status} />
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>

          {overview.lowStock > 0 && (
            <Link href="/dashboard/stocks" className="yc-focus group flex items-center gap-4 rounded-yc-lg bg-yc-night-900 p-5 text-white shadow-yc-float">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-yc-warning/20 text-yc-warning"><IconAlert size={22} /></span>
              <span className="flex-1">
                <span className="block font-semibold">{overview.lowStock} article(s) en stock faible</span>
                <span className="block text-sm text-white/60">Réapprovisionnez avant la rupture pour ne pas perdre de ventes.</span>
              </span>
              <IconArrowRight size={20} className="transition-transform group-hover:translate-x-1" />
            </Link>
          )}
        </div>
      )}
    </>
  );
}

function Kpi({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="bg-white px-4 py-4 sm:px-6 sm:py-5">
      <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-yc-ink-soft">{label}</p>
      <p className="mt-2 font-display text-[22px] font-semibold tracking-tight sm:text-[26px]">{value}</p>
    </div>
  );
}

const QUEUE_TONES = {
  violet: "from-yc-violet/15 to-transparent text-yc-violet",
  warning: "from-yc-warning/20 to-transparent text-[rgb(180_100_0)]",
  cyan: "from-yc-cyan/20 to-transparent text-yc-cyan-strong",
};

function QueueCard({ href, label, value, icon, tone, hint }: { href: string; label: string; value: number; icon: React.ReactNode; tone: keyof typeof QUEUE_TONES; hint: string }) {
  return (
    <Link href={href} className="yc-focus group relative overflow-hidden rounded-yc-lg bg-white p-5 shadow-yc ring-1 ring-yc-ink/[0.06] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-yc-float">
      <span className={`pointer-events-none absolute inset-0 bg-gradient-to-br opacity-70 ${QUEUE_TONES[tone].split(" ").slice(0, 2).join(" ")}`} aria-hidden="true" />
      <span className="relative flex items-start justify-between">
        <span>
          <span className="block text-[13px] font-semibold text-yc-ink-soft">{label}</span>
          <span className="mt-1 block font-display text-[34px] font-semibold leading-none tracking-tight text-yc-ink"><CountUp value={value} /></span>
          <span className="mt-2 block text-xs text-yc-ink-soft">{hint}</span>
        </span>
        <span className={`grid h-10 w-10 place-items-center rounded-2xl bg-white/80 ring-1 ring-yc-ink/5 ${QUEUE_TONES[tone].split(" ").at(-1)}`}>{icon}</span>
      </span>
    </Link>
  );
}
