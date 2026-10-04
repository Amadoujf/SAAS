import type { Metadata } from "next";
import { headers } from "next/headers";
import { withTenant, listCouriers } from "@yamacommerce/database";
import { hasPermission } from "@yamacommerce/auth";
import { requireCourierPage } from "@/lib/courier/guard";
import { formatNumber } from "@/lib/courier/labels";
import { PageHeader, Panel } from "@/components/yc/panel";
import { Pill } from "@/components/yc/status-pill";
import { EmptyState } from "@/components/yc/empty-state";
import { CourierLink, NewCourier } from "@/components/dashboard-courier/courier-panels";

export const metadata: Metadata = { title: "Livreurs — Y-COM", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** Livreurs : courses en cours, espèces en main, lien personnel (sans mot de passe) renouvelable. */
export default async function CouriersPage() {
  const membership = await requireCourierPage("delivery.view");
  const tenantId = membership.tenantId;
  const [couriers, domain] = await withTenant(tenantId, async (tx) => [await listCouriers(tx, tenantId), await tx.domain.findFirst({ where: { tenantId, lifecycleStatus: "ACTIVE" }, orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] })] as const);
  const host = (await headers()).get("host") ?? "";
  const origin = domain ? `https://${domain.domain}` : `${host.startsWith("localhost") ? "http" : "https"}://${host}`;
  const manage = hasPermission(membership.permissions, "delivery.manage_zones");
  return (
    <>
      <PageHeader eyebrow="Pilotage" title="Livreurs" description="Chaque livreur a un lien personnel vers SES courses : il y confirme la prise en charge, la remise avec le code, ou l'échec." />
      <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
        <Panel className="overflow-hidden">
          {couriers.length === 0 ? <EmptyState title="Aucun livreur" description="Ajoutez vos livreurs, puis envoyez-leur leur lien." /> : (
            <ul className="divide-y divide-yc-ink/[0.06]">
              {couriers.map((c) => (
                <li key={c.id} className="grid gap-3 px-5 py-4 lg:grid-cols-[1fr_1fr] lg:items-start">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 font-semibold">{c.name ?? c.phone}{!c.isActive && <Pill tone="neutral">Inactif</Pill>}</p>
                    <p className="text-sm text-yc-ink-soft"><a href={`tel:${c.phone}`} className="yc-num">{c.phone}</a>{c.vehicleType ? ` · ${c.vehicleType}` : ""}</p>
                    <p className="yc-num mt-1 text-sm">{c.activeJobs} course{c.activeJobs > 1 ? "s" : ""} en cours · <span className={c.cash.amount ? "font-semibold text-[#C2410C]" : ""}>{formatNumber(c.cash.amount)} F en main</span></p>
                  </div>
                  {manage && <CourierLink delivererId={c.id} url={`${origin}/livreur/${c.accessToken}`} isActive={c.isActive} />}
                </li>
              ))}
            </ul>
          )}
        </Panel>
        {manage && <NewCourier />}
      </div>
    </>
  );
}
