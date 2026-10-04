import type { Metadata } from "next";
import Link from "next/link";
import { withTenant, getAutoSettings, listLeads, listSales, listVehicles } from "@yamacommerce/database";
import { hasPermission } from "@yamacommerce/auth";
import { requireAutoPage } from "@/lib/auto/guard";
import { SALE_LABELS, formatNumber } from "@/lib/auto/labels";
import { PageHeader, Panel } from "@/components/yc/panel";
import { Pill } from "@/components/yc/status-pill";
import { EmptyState } from "@/components/yc/empty-state";
import { OpenSale } from "@/components/dashboard-auto/sale-panels";

export const metadata: Metadata = { title: "Dossiers de vente — Y-COM", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const uuid = (v?: string) => (v && /^[0-9a-f-]{36}$/.test(v) ? v : null);

/** Dossiers de vente : un par véhicule, encaissements par le service commun, remise après règlement. */
export default async function SalesPage({ searchParams }: { searchParams: { vehicule?: string; prospect?: string } }) {
  const membership = await requireAutoPage("reservations.view");
  const tenantId = membership.tenantId;
  const data = await withTenant(tenantId, async (tx) => ({
    sales: await listSales(tx, tenantId),
    available: await listVehicles(tx, tenantId, { stock: ["available"] }),
    leads: await listLeads(tx, tenantId, { status: ["new", "contacted", "test_drive", "negotiation"] }),
    settings: await getAutoSettings(tx, tenantId),
  }));
  const open = data.sales.filter((s) => s.status === "confirmed" || s.status === "requested");
  const closed = data.sales.filter((s) => !open.includes(s));
  const Row = ({ s }: { s: (typeof data.sales)[number] }) => {
    const paid = s.payments.filter((p) => !p.voidedAt).reduce((t, p) => t + p.amount, 0);
    const total = s.totalAmount ?? 0;
    return (
      <li>
        <Link href={`/dashboard/dossiers/${s.id}`} className="grid gap-2 px-5 py-4 hover:bg-yc-ivory-50 sm:grid-cols-[1fr_200px_auto] sm:items-center">
          <span className="min-w-0"><span className="block truncate font-semibold">{s.listing!.title}</span><span className="block truncate text-sm text-yc-ink-soft">{s.reference} · {s.customer.firstName} {s.customer.lastName ?? ""}</span></span>
          <span className="text-sm">
            <span className="yc-num font-semibold">{formatNumber(paid)}</span> / <span className="yc-num">{formatNumber(total)}</span> FCFA
            <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-yc-ink/[0.08]"><span className="block h-full bg-[rgb(4_120_87)]" style={{ width: `${total ? Math.min(100, (paid / total) * 100) : 0}%` }} /></span>
          </span>
          <Pill tone={SALE_LABELS[s.status]?.tone ?? "neutral"}>{SALE_LABELS[s.status]?.label ?? s.status}</Pill>
        </Link>
      </li>
    );
  };
  return (
    <>
      <PageHeader eyebrow="Pilotage" title="Dossiers de vente" description="Prix convenu, reprise déduite, acompte et solde avec reçus numérotés. Jamais de paiement en ligne." />
      <div className="grid gap-5 xl:grid-cols-[1fr_420px]">
        <div className="grid content-start gap-5">
          <Panel className="overflow-hidden">
            <h2 className="border-b border-yc-ink/[0.06] px-5 py-3 text-[15px] font-bold">En cours <span className="yc-num text-yc-ink-soft">{open.length}</span></h2>
            {open.length === 0 ? <EmptyState title="Aucun dossier en cours" description="Ouvrez un dossier quand un client s'engage sur un véhicule." /> : <ul className="divide-y divide-yc-ink/[0.06]">{open.map((s) => <Row key={s.id} s={s} />)}</ul>}
          </Panel>
          {closed.length > 0 && (
            <Panel className="overflow-hidden">
              <h2 className="border-b border-yc-ink/[0.06] px-5 py-3 text-[15px] font-bold">Clos</h2>
              <ul className="divide-y divide-yc-ink/[0.06]">{closed.map((s) => <Row key={s.id} s={s} />)}</ul>
            </Panel>
          )}
        </div>
        {hasPermission(membership.permissions, "reservations.update_status") && (
          <OpenSale
            vehicles={data.available.map((v) => ({ id: v.id, title: v.title, price: v.price }))}
            prospects={data.leads.map((l) => ({ id: l.id, name: `${l.customer.firstName} ${l.customer.lastName ?? ""} · ${l.customer.phone ?? ""}`.trim(), listingId: l.listingId }))}
            initialVehicle={uuid(searchParams.vehicule)}
            initialProspect={uuid(searchParams.prospect)}
            depositPercent={data.settings.depositPercent}
          />
        )}
      </div>
    </>
  );
}
